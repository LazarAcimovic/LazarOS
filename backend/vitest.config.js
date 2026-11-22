import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    testTimeout: 30000,
    env: {
      DB_NAME: "LazarOS_Test",
      JWT_SECRET: "lazaros-test-jwt-secret-not-for-production",
    },
  },
});
