// `npm test`: start the throwaway SQL Server container, run vitest, always tear it down.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compose = ["compose", "-f", "docker-compose.test.yml"];
const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: backendDir, stdio: "inherit" });

let code = 1;
try {
  const up = run("docker", [...compose, "up", "-d", "--wait"]);
  if (up.status !== 0) {
    console.error("Failed to start the test database container.");
  } else {
    const vitestBin = path.join(backendDir, "node_modules", "vitest", "vitest.mjs");
    const extra = process.argv.slice(2);
    code = run(process.execPath, [vitestBin, "run", ...extra]).status ?? 1;
  }
} finally {
  run("docker", [...compose, "down", "-v"]);
}
process.exit(code);
