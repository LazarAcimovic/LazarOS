import sql from "mssql/msnodesqlv8.js";
import {
  TEST_DB_NAME,
  TEST_MASTER_CONNECTION_STRING,
} from "./testDbConfig.js";

const MAX_WAIT_MS = 120000;
const RETRY_MS = 2000;

// Guarantees the empty test database exists. Tables are each suite's job (beforeAll).
export default async function setup() {
  const deadline = Date.now() + MAX_WAIT_MS;
  let lastErr;
  while (Date.now() < deadline) {
    let pool;
    try {
      pool = await new sql.ConnectionPool({
        connectionString: TEST_MASTER_CONNECTION_STRING,
      }).connect();
      await pool
        .request()
        .query(
          `IF DB_ID('${TEST_DB_NAME}') IS NULL CREATE DATABASE [${TEST_DB_NAME}];`
        );
      await pool.close();
      return;
    } catch (err) {
      lastErr = err;
      if (pool) await pool.close().catch(() => {});
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
  throw new Error(
    `Test database container not reachable on localhost,14333: ${lastErr?.message}`
  );
}
