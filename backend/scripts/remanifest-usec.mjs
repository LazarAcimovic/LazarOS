#!/usr/bin/env node
// remanifest-usec.mjs — regenerate a backup manifest at MICROSECOND precision from the existing
// 6.1 CSVs, with no live SQL Server (DB §7.3, D-017).
//
// A backup captured before the microsecond canonicalization (D-017) has 100-ns (native
// DATETIME2(7)) checksums that a PostgreSQL `timestamptz` can never reproduce. This tool reads the
// CSVs that are already on disk and rewrites manifest.json so its content checksums are computed
// over the shared microsecond canonical form — the exact form reconcile-postgres-data.mjs recomputes
// from Postgres. The CSVs are NOT modified (they stay the faithful, full-precision record). The
// original manifest is preserved as manifest.native.json before the first rewrite.
//
// Usage (from backend/):  node scripts/remanifest-usec.mjs [backup-dir]
//   backup-dir defaults to the sibling "LazarOS-data-backup" directory beside the repo checkout.

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TABLES, parseTableCsv, contentChecksum, overallChecksum } from "./lib/canonical.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const BACKUP_DIR = resolve(process.argv[2] ?? resolve(REPO_ROOT, "..", "LazarOS-data-backup"));

const MANIFEST = resolve(BACKUP_DIR, "manifest.json");
const NATIVE_BACKUP = resolve(BACKUP_DIR, "manifest.native.json");
const PRECISION = "microsecond";

function checksumTable(name) {
  const text = readFileSync(resolve(BACKUP_DIR, `${name}.csv`), "utf8");
  const spec = TABLES[name];
  const rows = parseTableCsv(text, spec.columns);
  return {
    rowCount: rows.length,
    columns: spec.columns,
    checksum: contentChecksum(spec, rows),
    file: `${name}.csv`,
  };
}

function main() {
  const prev = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};

  // Preserve the original native-precision manifest once, before the first rewrite.
  if (existsSync(MANIFEST) && prev.checksumPrecision !== PRECISION && !existsSync(NATIVE_BACKUP)) {
    copyFileSync(MANIFEST, NATIVE_BACKUP);
    console.log(`Preserved the original manifest as ${NATIVE_BACKUP}`);
  }

  const tables = { profiles: checksumTable("profiles"), tasks: checksumTable("tasks") };

  // Sanity: the row counts must match what the original backup recorded — we are re-manifesting
  // the same export, not a different dataset.
  for (const name of ["profiles", "tasks"]) {
    const was = prev.tables?.[name]?.rowCount;
    if (was !== undefined && was !== tables[name].rowCount) {
      console.error(`row count for ${name} changed (${was} → ${tables[name].rowCount}); refusing to remanifest.`);
      process.exit(1);
    }
  }

  const manifest = {
    ...prev,
    checksumAlgorithm: "SHA-256",
    checksumPrecision: PRECISION,
    canonicalForm:
      "Rows ordered by lower(36-char id). Per column (fixed order): 'N' for NULL, else " +
      "'V'+utf8ByteLength+':'+value. Each row terminated by \\n; SHA-256 over the byte stream. " +
      "Timestamps rendered at MICROSECOND precision (YYYY-MM-DDTHH:MM:SS.ffffff, UTC, no offset, " +
      "half-to-even on the 100-ns tick — identical to a Postgres timestamptz cast; D-017), dates " +
      "YYYY-MM-DD, GUIDs lowercased, BIT as 0/1. overallChecksum = SHA-256 of " +
      "'profiles:<count>:<checksum>\\ntasks:<count>:<checksum>\\n'.",
    regeneratedAt: new Date().toISOString(),
    regeneratedBy: "remanifest-usec.mjs",
    tables,
    overallChecksum: overallChecksum(tables),
  };

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`  profiles: ${tables.profiles.rowCount} rows  sha256=${tables.profiles.checksum}`);
  console.log(`  tasks:    ${tables.tasks.rowCount} rows  sha256=${tables.tasks.checksum}`);
  console.log(`  overall:  sha256=${manifest.overallChecksum}`);
  console.log(`Microsecond manifest written to: ${MANIFEST}`);
}

main();
