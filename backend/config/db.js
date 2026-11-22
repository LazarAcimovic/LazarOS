import sql from "mssql/msnodesqlv8.js";

let poolPromise = null;

export function getPool() {
  if (!poolPromise) {
    const dbName = process.env.DB_NAME ?? "LazarOS";
    // Set only by the test setup (vitest.config.js): SQL auth to the test container.
    const config = {
      connectionString:
        process.env.TEST_DB_CONNECTION_STRING ??
        "Driver={ODBC Driver 17 for SQL Server};" +
          "Server=DESKTOP-8R6Q0B4;" +
          `Database=${dbName};` +
          "Trusted_Connection=Yes;" +
          "TrustServerCertificate=Yes;",
    };
    poolPromise = sql.connect(config).then((pool) => {
      console.log(`✓ Connected to SQL Server (${dbName})`);
      return pool;
    }).catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

export { sql };
