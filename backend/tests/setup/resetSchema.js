import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The Prisma migrations are the single schema source (code-first, D-019). Each integration suite
// resets its database by applying exactly these — the same SQL `prisma migrate deploy` would run —
// so tests never carry a hand-maintained copy of the DDL (Tech-Backend §9).
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "prisma",
  "migrations"
);

// Ordered migration.sql paths. Directory names sort lexicographically into apply order
// (`0_init`, then the timestamped ones); `migration_lock.toml` is a file, not a directory.
function migrationSqlFiles() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => path.join(migrationsDir, name, "migration.sql"));
}

// Drops the public schema and replays every migration against the connected database. Called from
// each integration suite's beforeAll (the suite owns the test database — never the dev database).
export async function resetSchema(pool) {
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  for (const file of migrationSqlFiles()) {
    await pool.query(readFileSync(file, "utf8"));
  }
}
