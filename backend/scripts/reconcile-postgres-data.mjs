#!/usr/bin/env node
// reconcile-postgres-data.mjs — prove the migrated Postgres data equals the backup (DB §7.3,
// task-06 subtask 6.3). The one-off cutover proof; not part of the permanent test suite.
//
// Usage (from backend/):  node scripts/reconcile-postgres-data.mjs [backup-dir]
//   backup-dir defaults to the sibling "LazarOS-data-backup" directory beside the repo checkout.
//   DATABASE_URL (required) selects the Postgres database the import loaded into (your `LazarOS`).
//
// Exits 0 only when every check passes; non-zero with a report otherwise. Checks:
//   1. Per-table row counts equal the manifest.
//   2. Content checksums — the CSV-derived (expected) and the Postgres-derived (actual) each equal
//      the manifest's, and the overall checksum matches. Zero rows added, dropped or altered.
//   3. A known profile and all its tasks reconcile field-by-field across both engines.
//   4. The Today dashboard and the Archive for that user match, for every date in the data, what
//      the backup data implies (PRD §4.7, §4.8, §4.11) — the data behaves identically, not just
//      copied.
//
// Timestamps are compared at microsecond precision — the shared canonical form (D-017). Requires a
// microsecond manifest; run remanifest-usec.mjs first if the backup predates D-017.

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TABLES, parseTableCsv, contentChecksum, overallChecksum, toMicros, canonicalValue } from "./lib/canonical.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const BACKUP_DIR = resolve(process.argv[2] ?? resolve(REPO_ROOT, "..", "LazarOS-data-backup"));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set — point it at the Postgres database the import loaded into.");
  process.exit(1);
}

const results = [];
const pass = (name) => { results.push({ name, ok: true }); console.log(`  PASS  ${name}`); };
const fail = (name, detail) => { results.push({ name, ok: false, detail }); console.log(`  FAIL  ${name}\n        ${detail}`); };

// Canonical-rendered SELECTs: every column emitted as the exact token-stream string the checksum
// expects (ids lowercased, booleans as 0/1, dates as YYYY-MM-DD, timestamps µs UTC no-offset).
const TS = `'YYYY-MM-DD"T"HH24:MI:SS.US'`;
const SELECTS = {
  profiles:
    `SELECT lower(id::text) AS id, first_name, last_name, email, password, ` +
    `to_char(created_at AT TIME ZONE 'UTC', ${TS}) AS created_at ` +
    `FROM profiles`,
  tasks:
    `SELECT lower(id::text) AS id, lower(user_id::text) AS user_id, title, description, ` +
    `to_char(due_date, 'YYYY-MM-DD') AS due_date, priority, status, ` +
    `CASE WHEN is_deleted THEN '1' ELSE '0' END AS is_deleted, ` +
    `CASE WHEN completed_at IS NULL THEN NULL ELSE to_char(completed_at AT TIME ZONE 'UTC', ${TS}) END AS completed_at, ` +
    `to_char(created_at AT TIME ZONE 'UTC', ${TS}) AS created_at, ` +
    `to_char(updated_at AT TIME ZONE 'UTC', ${TS}) AS updated_at ` +
    `FROM tasks`,
};

function readCsv(name) {
  return parseTableCsv(readFileSync(resolve(BACKUP_DIR, `${name}.csv`), "utf8"), TABLES[name].columns);
}

// Expected canonical row from a CSV row: timestamps rounded to µs, dates to YYYY-MM-DD, others
// verbatim (null = NULL) — the same canonicalization the checksum uses.
function canonCsvRow(name, row) {
  const spec = TABLES[name];
  const out = {};
  for (const c of spec.columns) out[c] = canonicalValue(c, row[c], spec);
  return out;
}

const dayDiff = (today, due) =>
  Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000);

async function main() {
  const csv = { profiles: readCsv("profiles"), tasks: readCsv("tasks") };
  const manifest = JSON.parse(readFileSync(resolve(BACKUP_DIR, "manifest.json"), "utf8"));

  if (manifest.checksumPrecision !== "microsecond") {
    console.error(
      `manifest.json is not at microsecond precision (checksumPrecision=${manifest.checksumPrecision ?? "native"}).\n` +
      `Run:  node scripts/remanifest-usec.mjs  first (D-017).`
    );
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: DATABASE_URL, options: "-c timezone=UTC" });
  try {
    // 1. Row counts ---------------------------------------------------------------------------
    for (const name of ["profiles", "tasks"]) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${name}`);
      const pgN = rows[0].n;
      const manN = manifest.tables[name].rowCount;
      if (pgN === manN && pgN === csv[name].length) pass(`row count ${name} = ${manN}`);
      else fail(`row count ${name}`, `postgres=${pgN} manifest=${manN} csv=${csv[name].length}`);
    }

    // 2. Checksums ----------------------------------------------------------------------------
    const actualTables = {};
    for (const name of ["profiles", "tasks"]) {
      const spec = TABLES[name];
      const expected = contentChecksum(spec, csv[name]);
      const { rows: pgRows } = await pool.query(SELECTS[name]);
      const actual = contentChecksum(spec, pgRows);
      const man = manifest.tables[name].checksum;
      actualTables[name] = { rowCount: pgRows.length, checksum: actual };
      if (expected !== man) {
        fail(`checksum ${name} (manifest vs CSV)`,
          `manifest=${man}\n        csv=${expected} — regenerate the manifest with remanifest-usec.mjs`);
      } else if (actual !== man) {
        fail(`checksum ${name} (postgres)`, `manifest=${man}\n        postgres=${actual} — data differs`);
      } else {
        pass(`content checksum ${name} = ${man.slice(0, 16)}…`);
      }
    }
    const actualOverall = overallChecksum(actualTables);
    if (actualOverall === manifest.overallChecksum) pass(`overall checksum = ${actualOverall.slice(0, 16)}…`);
    else fail("overall checksum", `manifest=${manifest.overallChecksum}\n        postgres=${actualOverall}`);

    // 3. Field-by-field spot-check of a known profile and its tasks ---------------------------
    const taskCountByUser = new Map();
    for (const t of csv.tasks) taskCountByUser.set(t.user_id, (taskCountByUser.get(t.user_id) ?? 0) + 1);
    const known = [...csv.profiles].sort(
      (a, b) => (taskCountByUser.get(b.id) ?? 0) - (taskCountByUser.get(a.id) ?? 0)
    )[0];

    {
      const expected = canonCsvRow("profiles", known);
      const { rows } = await pool.query(`${SELECTS.profiles} WHERE id = $1`, [known.id]);
      if (rows.length !== 1) {
        fail("spot-check profile", `expected 1 row for ${known.id}, got ${rows.length}`);
      } else {
        const diffs = TABLES.profiles.columns.filter((c) => (rows[0][c] ?? null) !== (expected[c] ?? null));
        if (diffs.length === 0) pass(`spot-check profile ${known.email} (${TABLES.profiles.columns.length} fields)`);
        else fail("spot-check profile", `fields differ: ${diffs.join(", ")}`);
      }
    }

    {
      const expectedTasks = csv.tasks.filter((t) => t.user_id === known.id).map((t) => canonCsvRow("tasks", t));
      const { rows } = await pool.query(`${SELECTS.tasks} WHERE user_id = $1`, [known.id]);
      const byId = new Map(rows.map((r) => [r.id, r]));
      let mismatched = 0, missing = 0;
      for (const e of expectedTasks) {
        const a = byId.get(e.id);
        if (!a) { missing++; continue; }
        if (TABLES.tasks.columns.some((c) => (a[c] ?? null) !== (e[c] ?? null))) mismatched++;
      }
      if (rows.length === expectedTasks.length && missing === 0 && mismatched === 0) {
        pass(`spot-check ${expectedTasks.length} tasks of ${known.email}, every field`);
      } else {
        fail("spot-check tasks", `count pg=${rows.length} csv=${expectedTasks.length}, missing=${missing}, mismatched=${mismatched}`);
      }
    }

    // 4. Dashboard + Archive behavioural parity (PRD §4.7, §4.8, §4.11) -----------------------
    // Canonicalized rows: due_date is YYYY-MM-DD and completed_at microsecond, so date comparisons
    // and bucketing match the Postgres `date`/`timestamptz` semantics exactly.
    const userTasks = csv.tasks.filter((t) => t.user_id === known.id).map((t) => canonCsvRow("tasks", t));
    const dates = new Set();
    for (const t of userTasks) {
      dates.add(t.due_date);
      if (t.completed_at) dates.add(toMicros(t.completed_at).slice(0, 10));
    }
    const todays = [...dates].sort();

    let dashOk = 0;
    for (const today of todays) {
      // Expected buckets straight from the backup data.
      const exp = { overdue: new Map(), today: new Map(), completed_today: new Map() };
      for (const t of userTasks) {
        if (t.is_deleted === "1") continue;
        if (t.status === "pending" && t.due_date < today) exp.overdue.set(t.id, dayDiff(today, t.due_date));
        else if (t.status === "pending" && t.due_date === today) exp.today.set(t.id, 0);
        else if (t.status === "completed" && t.completed_at && toMicros(t.completed_at).slice(0, 10) === today)
          exp.completed_today.set(t.id, dayDiff(today, t.due_date));
      }
      // Actual buckets from the Postgres dashboard query (mirrors getDashboard).
      const { rows } = await pool.query(
        `SELECT lower(id::text) AS id,
           CASE WHEN status='pending' AND due_date < $2::date THEN 'overdue'
                WHEN status='pending' AND due_date = $2::date THEN 'today'
                WHEN status='completed' AND (completed_at AT TIME ZONE 'utc')::date = $2::date THEN 'completed_today'
                ELSE 'other' END AS section,
           ($2::date - due_date) AS days_overdue
         FROM tasks
         WHERE user_id = $1 AND is_deleted = false
           AND ((status='pending' AND due_date <= $2::date)
             OR (status='completed' AND (completed_at AT TIME ZONE 'utc')::date = $2::date))`,
        [known.id, today]
      );
      const act = { overdue: new Map(), today: new Map(), completed_today: new Map() };
      for (const r of rows) if (r.section !== "other") act[r.section].set(r.id, Number(r.days_overdue));

      const sameBucket = (a, b) =>
        a.size === b.size && [...a].every(([id, d]) => b.get(id) === d);
      if (sameBucket(exp.overdue, act.overdue) && sameBucket(exp.today, act.today) && sameBucket(exp.completed_today, act.completed_today)) {
        dashOk++;
      } else {
        fail(`dashboard parity @ ${today}`,
          `overdue ${exp.overdue.size}/${act.overdue.size}, today ${exp.today.size}/${act.today.size}, completed ${exp.completed_today.size}/${act.completed_today.size}`);
      }
    }
    if (dashOk === todays.length) pass(`dashboard parity across ${todays.length} dates (overdue/today/completed_today, days_overdue)`);

    {
      const expArchive = new Set(userTasks.filter((t) => t.is_deleted === "1").map((t) => t.id));
      const { rows } = await pool.query(
        `SELECT lower(id::text) AS id FROM tasks WHERE user_id = $1 AND is_deleted = true`, [known.id]);
      const actArchive = new Set(rows.map((r) => r.id));
      if (expArchive.size === actArchive.size && [...expArchive].every((id) => actArchive.has(id)))
        pass(`archive parity (${expArchive.size} soft-deleted tasks)`);
      else fail("archive parity", `csv=${expArchive.size} postgres=${actArchive.size}`);
    }
  } finally {
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nreconcile: ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.error(`RECONCILE FAILED — ${failed.length} check(s) did not pass.`);
    process.exit(1);
  }
  console.log("RECONCILE PASSED — the migrated Postgres data equals the backup, byte for byte at microsecond precision.");
}

main().catch((err) => {
  console.error(`reconcile failed: ${err.message}`);
  process.exit(1);
});
