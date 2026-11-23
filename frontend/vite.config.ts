/// <reference types="vitest" />
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }), // React Compiler
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // No proxy needed — Axios calls http://localhost:5000/api directly via VITE_API_URL.
    // CORS + SameSite=None cookie handles the cross-origin auth.
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "e2e/**"], // Playwright specs run via `npm run test:e2e`
    setupFiles: ["./src/test/setup.ts"],
  },
});
