import pg from "pg";
import { TEST_DB_NAME, MAINTENANCE_URL } from "./testDbConfig.js";

// Guarantees the empty test database exists. Tables are each suite's job (beforeAll).
export default async function setup() {
  const client = new pg.Client({ connectionString: MAINTENANCE_URL });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Cannot reach PostgreSQL to prepare the test database (${MAINTENANCE_URL.replace(/:[^:@/]*@/, ":****@")}): ${err.message}`
    );
  }
  try {
    const { rowCount } = await client.query(
      "select 1 from pg_database where datname = $1",
      [TEST_DB_NAME]
    );
    if (rowCount === 0) {
      // TEST_DB_NAME is our own config value, never user input; identifiers can't be parameterised.
      await client.query(`CREATE DATABASE "${TEST_DB_NAME.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }
}
