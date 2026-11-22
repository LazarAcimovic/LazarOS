// `npm run test:e2e`: start the throwaway SQL Server container, create the e2e database and
// apply the schema, run Playwright (which boots backend + frontend), always tear the container down.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  E2E_DB_CONTAINER,
  E2E_DB_NAME,
  E2E_DB_PASSWORD,
} from "./e2eConfig.mjs";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(e2eDir, "..");
const schemaPath = path.resolve(frontendDir, "..", "backend", "db", "schema.sql");
const compose = ["compose", "-f", path.join(e2eDir, "docker-compose.e2e.yml")];
const SQLCMD = "/opt/mssql-tools18/bin/sqlcmd";

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { cwd: frontendDir, stdio: "inherit", ...opts });
const sqlcmd = (extra) =>
  run("docker", [
    "exec", E2E_DB_CONTAINER, SQLCMD,
    "-S", "localhost", "-U", "sa", "-P", E2E_DB_PASSWORD, "-C", "-b", ...extra,
  ]);

// schema.sql also creates the dev database, drops tables and inserts seed data. The e2e DB needs
// only the tables + indexes (sections 3-5): the smoke journey registers its own user.
function tablesOnlySql() {
  const full = readFileSync(schemaPath, "utf8");
  const start = full.indexOf("/* ---- 3. profiles");
  const end = full.indexOf("/* ====", start);
  if (start === -1 || end === -1) {
    throw new Error("backend/db/schema.sql markers not found; update e2e/run-e2e.mjs");
  }
  return full.slice(start, end);
}

function applySchema() {
  const create = sqlcmd(["-Q", `IF DB_ID('${E2E_DB_NAME}') IS NULL CREATE DATABASE [${E2E_DB_NAME}];`]);
  if (create.status !== 0) return false;
  const tmp = mkdtempSync(path.join(tmpdir(), "lazaros-e2e-"));
  try {
    const file = path.join(tmp, "schema.sql");
    writeFileSync(file, tablesOnlySql());
    const cp = run("docker", ["cp", file, `${E2E_DB_CONTAINER}:/tmp/e2e-schema.sql`]);
    if (cp.status !== 0) return false;
    return sqlcmd(["-d", E2E_DB_NAME, "-i", "/tmp/e2e-schema.sql"]).status === 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

let code = 1;
try {
  const up = run("docker", [...compose, "up", "-d", "--wait"]);
  if (up.status !== 0) {
    console.error("Failed to start the e2e database container.");
  } else if (!applySchema()) {
    console.error("Failed to create the e2e database or apply the schema.");
  } else {
    const cli = path.join(frontendDir, "node_modules", "@playwright", "test", "cli.js");
    code = run(process.execPath, [cli, "test", ...process.argv.slice(2)]).status ?? 1;
  }
} finally {
  run("docker", [...compose, "down", "-v"]);
}
process.exit(code);
