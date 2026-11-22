// Single definition of the test-container connection (see docker-compose.test.yml).
// SQL auth, because a Linux container cannot do Windows Trusted_Connection.
const base =
  "Driver={ODBC Driver 17 for SQL Server};Server=localhost,14333;" +
  "Uid=sa;Pwd=LazarOS_Test_Pass123!;TrustServerCertificate=Yes;";

export const TEST_DB_NAME = "LazarOS_Test";
export const TEST_DB_CONNECTION_STRING = `${base}Database=${TEST_DB_NAME};`;
export const TEST_MASTER_CONNECTION_STRING = `${base}Database=master;`;
