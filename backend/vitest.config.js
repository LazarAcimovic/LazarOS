import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/setup/testDbConfig.js";

export default defineConfig({
  test: {
    pool: "forks",
    // Integration suites drop/recreate shared tables, so test files must run sequentially (not in parallel) against the one test DB.
    fileParallelism: false,
    testTimeout: 30000,
    globalSetup: ["./tests/setup/globalSetup.js"],
    env: {
      // config/db.js reads DATABASE_URL; point it at the test database so tests never
      // touch the dev database (LazarOS).
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "lazaros-test-jwt-secret-not-for-production",
    },
  },
});
