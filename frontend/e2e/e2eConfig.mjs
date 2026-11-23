// Single definition of the e2e stack. Used by run-e2e.mjs and playwright.config.ts.
export const E2E_DB_NAME = "LazarOS_E2E";
export const E2E_BACKEND_PORT = 5001;
export const E2E_FRONTEND_PORT = 5174;
export const E2E_JWT_SECRET = "e2e-only-jwt-secret";

// PostgreSQL connection for the e2e run — a separate database on the same server as dev,
// never the dev database. Override with E2E_DATABASE_URL if your server differs.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgres://postgres:postgres@localhost:5432/${E2E_DB_NAME}`;

// The maintenance connection (the server's default `postgres` database), used only to
// CREATE the e2e database; you cannot create a database while connected to it.
export const E2E_MAINTENANCE_URL = (() => {
  const u = new URL(E2E_DATABASE_URL);
  u.pathname = "/postgres";
  return u.toString();
})();
