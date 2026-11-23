// Single definition of the test-database connection. The suite runs against a separate
// PostgreSQL database (default LazarOS_Test) on the same server as dev — never the dev
// database. `vitest.config.js` points DATABASE_URL at TEST_DATABASE_URL so `config/db.js`
// connects here; `globalSetup.js` uses MAINTENANCE_URL to create the database if missing.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/LazarOS_Test";

const url = new URL(TEST_DATABASE_URL);

export const TEST_DB_NAME = decodeURIComponent(url.pathname.replace(/^\//, "")) || "LazarOS_Test";

// The maintenance connection (the server's default `postgres` database) used only to
// CREATE the test database; you cannot create a database while connected to it.
export const MAINTENANCE_URL = (() => {
  const u = new URL(TEST_DATABASE_URL);
  u.pathname = "/postgres";
  return u.toString();
})();
