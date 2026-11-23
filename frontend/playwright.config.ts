import { defineConfig } from "@playwright/test";
import {
  E2E_BACKEND_PORT,
  E2E_DATABASE_URL,
  E2E_FRONTEND_PORT,
  E2E_JWT_SECRET,
} from "./e2e/e2eConfig.mjs";

// Run via `npm run test:e2e` (e2e/run-e2e.mjs), which prepares the e2e database first.
// The webServers below are started by Playwright; the backend needs the database already up.
const frontendUrl = `http://localhost:${E2E_FRONTEND_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node server.js",
      cwd: "../backend",
      url: `http://localhost:${E2E_BACKEND_PORT}/api/auth/me`, // 401 counts as up
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        PORT: String(E2E_BACKEND_PORT),
        JWT_SECRET: E2E_JWT_SECRET,
        DATABASE_URL: E2E_DATABASE_URL,
      },
    },
    {
      command: `npx vite --port ${E2E_FRONTEND_PORT} --strictPort`,
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        // Process env beats .env.development, so the app talks to the e2e backend.
        VITE_API_URL: `http://localhost:${E2E_BACKEND_PORT}/api`,
      },
    },
  ],
});
