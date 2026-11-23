#!/usr/bin/env node
// export-mssql-data.mjs — portable, verifiable backup of the live SQL Server data.
//
// Produces, for the `profiles` and `tasks` tables of the `LazarOS` SQL Server database:
//   - <out>/profiles.csv, <out>/tasks.csv  — engine-neutral CSV, every column, every row
//     (soft-deleted rows included), nulls preserved. The CSV keeps SQL Server's native style-126
//     timestamp (7 fractional digits) as the faithful record.
//   - <out>/manifest.json                  — per-table row counts + a deterministic SHA-256
//     content checksum, the source of truth for reconciliation (DB §7.3, decisions D-015 / D-017)
//
// Usage (from backend/):  node scripts/export-mssql-data.mjs [out-dir]
//   out-dir defaults to a sibling "LazarOS-data-backup" directory beside the repo checkout.
//   Overrides: DB_SERVER (default DESKTOP-8R6Q0B4), DB_NAME (default LazarOS).
//
// The export is read-only. It does NOT replace the native .bak safety copy (DB §7.2); it is the
// portable migration vehicle into Postgres. The canonical form (including the microsecond
// timestamp rounding) lives in ./lib/canonical.mjs so the export, the re-manifest tool and the
// reconcile share one definition. See DB §7 for the fidelity rules.

import sql from "mssql/msnodesqlv8.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TABLES, toCsv, contentChecksum, overallChecksum } from "./lib/canonical.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", ".."); // backend/scripts -> backend -> repo root

const SERVER = process.env.DB_SERVER ?? "DESKTOP-8R6Q0B4";
const DATABASE = process.env.DB_NAME ?? "LazarOS";
const OUT_DIR = resolve(process.argv[2] ?? resolve(REPO_ROOT, "..", "LazarOS-data-backup"));

const CONNECTION_STRING =
  "Driver={ODBC Driver 17 for SQL Server};" +
  `Server=${SERVER};` +
  `Database=${DATABASE};` +
  "Trusted_Connection=Yes;" +
  "TrustServerCertificate=Yes;";

// Per-table SELECT. Column order and checksum come from lib/canonical.mjs (DB §7.3). Timestamps
// are exported at SQL Server's native style-126 precision; the shared checksum rounds them to
// microseconds, the precision both engines reproduce (D-017).
const QUERIES = {
  profiles:
    "SELECT LOWER(CONVERT(char(36), id)) AS id, first_name, last_name, email, password, " +
    "CONVERT(varchar(33), created_at, 126) AS created_at " +
    "FROM profiles ORDER BY LOWER(CONVERT(char(36), id))",
  tasks:
    "SELECT LOWER(CONVERT(char(36), id)) AS id, LOWER(CONVERT(char(36), user_id)) AS user_id, " +
    "title, description, CONVERT(varchar(10), due_date, 23) AS due_date, priority, status, " +
    "CONVERT(int, is_deleted) AS is_deleted, " +
    "CONVERT(varchar(33), completed_at, 126) AS completed_at, " +
    "CONVERT(varchar(33), created_at, 126) AS created_at, " +
    "CONVERT(varchar(33), updated_at, 126) AS updated_at " +
    "FROM tasks ORDER BY LOWER(CONVERT(char(36), id))",
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const pool = await sql.connect({ connectionString: CONNECTION_STRING });
  const manifestTables = {};
  try {
    for (const [name, spec] of Object.entries(TABLES)) {
      const result = await pool.request().query(QUERIES[name]);
      const rows = result.recordset;
      writeFileSync(resolve(OUT_DIR, `${name}.csv`), toCsv(spec.columns, rows), "utf8");
      manifestTables[name] = {
        rowCount: rows.length,
        columns: spec.columns,
        checksum: contentChecksum(spec, rows),
        file: `${name}.csv`,
      };
      console.log(`  ${name}: ${rows.length} rows  sha256=${manifestTables[name].checksum}`);
    }
  } finally {
    await pool.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      server: SERVER,
      database: DATABASE,
      driver: "mssql/msnodesqlv8 (ODBC Driver 17 for SQL Server)",
    },
    checksumAlgorithm: "SHA-256",
    checksumPrecision: "microsecond",
    nullConvention:
      "CSV: a SQL NULL is an empty unquoted field; an empty string is the quoted token \"\". " +
      "Checksum: a SQL NULL is the token 'N'.",
    canonicalForm:
      "Rows ordered by lower(36-char id). Per column (fixed order): 'N' for NULL, else " +
      "'V'+utf8ByteLength+':'+value. Each row terminated by \\n; SHA-256 over the byte stream. " +
      "Timestamps rendered at MICROSECOND precision (YYYY-MM-DDTHH:MM:SS.ffffff, UTC, no offset, " +
      "half-to-even on the 100-ns tick — identical to a Postgres timestamptz cast; D-017), dates " +
      "YYYY-MM-DD, GUIDs lowercased, BIT as 0/1. overallChecksum = SHA-256 of " +
      "'profiles:<count>:<checksum>\\ntasks:<count>:<checksum>\\n'.",
    tables: manifestTables,
    overallChecksum: overallChecksum(manifestTables),
  };

  writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`  overall: sha256=${manifest.overallChecksum}`);
  console.log(`\nExport written to: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(`export failed: ${err.message}`);
  process.exit(1);
});
