// `npm run test:e2e`: ensure the e2e PostgreSQL database exists with a clean schema, then run
// Playwright (which boots backend + frontend against it). No Docker — a local PostgreSQL server
// hosts a dedicated LazarOS_E2E database alongside the dev one.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
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
const migrationsDir = path.resolve(frontendDir, "..", "backend", "prisma", "migrations");

// The Prisma migrations are the single schema source (code-first, D-019). The e2e database is
// reset by applying them in order — the same SQL `prisma migrate deploy` runs. Directory names
// sort into apply order (`0_init`, then timestamped ones); `migration_lock.toml` is a file.
function migrationSqlFiles() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => path.join(migrationsDir, name, "migration.sql"));
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

  // Reset to the migrated schema on every run (each journey registers its own user).
  const db = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await db.connect();
  try {
    await db.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    for (const file of migrationSqlFiles()) {
      await db.query(readFileSync(file, "utf8"));
    }
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
