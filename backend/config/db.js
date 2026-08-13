import sql from "mssql/msnodesqlv8.js";

const config = {
  connectionString:
    "Driver={ODBC Driver 17 for SQL Server};" +
    "Server=DESKTOP-8R6Q0B4;" +
    "Database=LazarOS;" +
    "Trusted_Connection=Yes;" +
    "TrustServerCertificate=Yes;",
};

let poolPromise = null;

export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).then((pool) => {
      console.log("✓ Connected to SQL Server (LazarOS)");
      return pool;
    }).catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

export { sql };
