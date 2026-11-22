// Single definition of the e2e stack (see docker-compose.e2e.yml). Used by run-e2e.mjs and playwright.config.ts.
export const E2E_DB_CONTAINER = "lazaros-e2e-db";
export const E2E_DB_NAME = "LazarOS_E2E";
export const E2E_DB_PASSWORD = "LazarOS_E2E_Pass123!";
export const E2E_DB_HOST_PORT = 14334;
export const E2E_BACKEND_PORT = 5001;
export const E2E_FRONTEND_PORT = 5174;
export const E2E_JWT_SECRET = "e2e-only-jwt-secret";

// SQL auth, because a Linux container cannot do Windows Trusted_Connection.
export const E2E_DB_CONNECTION_STRING =
  "Driver={ODBC Driver 17 for SQL Server};" +
  `Server=localhost,${E2E_DB_HOST_PORT};` +
  `Uid=sa;Pwd=${E2E_DB_PASSWORD};TrustServerCertificate=Yes;` +
  `Database=${E2E_DB_NAME};`;
