// `npm run test:e2e`: ensure the e2e PostgreSQL database exists with a clean schema, then run
// Playwright (which boots backend + frontend against it). No Docker — a local PostgreSQL server
// hosts a dedicated LazarOS_E2E database alongside the dev one.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import {
  E2E_DB_NAME,
  E2E_DATABASE_URL,
  E2E_MAINTENANCE_URL,
} from "./e2eConfig.mjs";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(e2eDir, "..");
const schemaPath = path.resolve(frontendDir, "..", "backend", "db", "schema.sql");

// schema.sql holds the table/index DDL followed by a seed section. The e2e database needs the
// tables + indexes only (each journey registers its own user), so cut the file at the seed banner.
function schemaDdlOnly() {
  const full = readFileSync(schemaPath, "utf8");
  const marker = full.indexOf("5. SEED DATA");
  if (marker === -1) {
    throw new Error("backend/db/schema.sql seed marker not found; update e2e/run-e2e.mjs");
  }
  const bannerStart = full.lastIndexOf("-- ===", marker);
  return full.slice(0, bannerStart === -1 ? marker : bannerStart);
}

async function prepareDatabase() {
  // Create the e2e database if it is missing (via the maintenance database).
  const admin = new pg.Client({ connectionString: E2E_MAINTENANCE_URL });
  await admin.connect();
  try {
    const { rowCount } = await admin.query(
      "select 1 from pg_database where datname = $1",
      [E2E_DB_NAME]
    );
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${E2E_DB_NAME.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end();
  }

  // Apply the tables + indexes; the drop-recreate guards reset them on every run.
  const db = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await db.connect();
  try {
    await db.query(schemaDdlOnly());
  } finally {
    await db.end();
  }
}

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: frontendDir, stdio: "inherit", ...opts });

let code = 1;
try {
  await prepareDatabase();
  const cli = path.join(frontendDir, "node_modules", "@playwright", "test", "cli.js");
  code = run(process.execPath, [cli, "test", ...process.argv.slice(2)]).status ?? 1;
} catch (err) {
  console.error(`e2e setup failed: ${err.message}`);
}
process.exit(code);
