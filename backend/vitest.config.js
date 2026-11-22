import { defineConfig } from "vitest/config";
import {
  TEST_DB_NAME,
  TEST_DB_CONNECTION_STRING,
} from "./tests/setup/testDbConfig.js";

export default defineConfig({
  test: {
    pool: "forks",
    // Integration suites drop/recreate shared tables, so test files must run sequentially (not in parallel) against the one test DB.
    fileParallelism: false,
    testTimeout: 30000,
    globalSetup: ["./tests/setup/globalSetup.js"],
    env: {
      DB_NAME: TEST_DB_NAME,
      TEST_DB_CONNECTION_STRING,
      JWT_SECRET: "lazaros-test-jwt-secret-not-for-production",
    },
  },
});
