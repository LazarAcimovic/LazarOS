#!/usr/bin/env node
// import-postgres-data.mjs — load the preserved SQL Server data (the 6.1 CSV export) into the
// migrated PostgreSQL schema (DB §7.2 step 2, task-06 subtask 6.2).
//
// Usage (from backend/):  node scripts/import-postgres-data.mjs [backup-dir]
//   backup-dir defaults to the sibling "LazarOS-data-backup" directory beside the repo checkout.
//   DATABASE_URL (required) selects the target Postgres database — point it at your real `LazarOS`.
//
// Idempotent: every row is inserted ON CONFLICT (id) DO NOTHING, keyed on the original primary
// key, so re-running never duplicates rows. `profiles` are inserted before `tasks` so the foreign
// key is always satisfied. The only transformations are the documented type conversions
// (uniqueidentifier→uuid, datetime2→timestamptz, bit→boolean, VARCHAR(MAX)→text); values are
// otherwise unchanged. Timestamps are inserted verbatim and the `timestamptz` cast rounds them to
// microseconds exactly as the canonical form expects (DB §7.1, D-017). Runs in one transaction.

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TABLES, parseTableCsv, canonicalDate } from "./lib/canonical.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", ".."); // backend/scripts -> backend -> repo root
const BACKUP_DIR = resolve(process.argv[2] ?? resolve(REPO_ROOT, "..", "LazarOS-data-backup"));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set — point it at the target Postgres database (e.g. your LazarOS).");
  process.exit(1);
}

function readRows(table) {
  const text = readFileSync(resolve(BACKUP_DIR, `${table}.csv`), "utf8");
  return parseTableCsv(text, TABLES[table].columns);
}

// A row's values in fixed column order. The only conversions are bit→boolean and date→ISO
// (so the insert is independent of the server's DateStyle); uuid / timestamptz / text are cast
// from the string by the column type, with the timestamptz cast rounding to microseconds (D-017).
function values(table, row) {
  const { columns, dates } = TABLES[table];
  return columns.map((c) => {
    if (c === "is_deleted") return row[c] === "1"; // bit 0/1 → boolean
    if (dates.has(c)) return row[c] === null ? null : canonicalDate(row[c]); // → YYYY-MM-DD
    return row[c];
  });
}

async function insertAll(client, table, rows) {
  const cols = TABLES[table].columns;
  const colList = cols.join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql =
    `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
  let inserted = 0;
  for (const row of rows) {
    const res = await client.query(sql, values(table, row));
    inserted += res.rowCount;
  }
  return inserted;
}

async function main() {
  const profiles = readRows("profiles");
  const tasks = readRows("tasks");
  console.log(`Read ${profiles.length} profiles and ${tasks.length} tasks from ${BACKUP_DIR}`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL, options: "-c timezone=UTC" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const p = await insertAll(client, "profiles", profiles); // profiles first (FK)
    const t = await insertAll(client, "tasks", tasks);
    await client.query("COMMIT");
    console.log(`profiles: ${p} inserted, ${profiles.length - p} already present`);
    console.log(`tasks:    ${t} inserted, ${tasks.length - t} already present`);
    console.log("Import complete. Run reconcile-postgres-data.mjs to prove parity against the manifest.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`import failed: ${err.message}`);
  process.exit(1);
});
