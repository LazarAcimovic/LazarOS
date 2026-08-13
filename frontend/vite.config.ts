import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // No proxy needed — Axios calls http://localhost:5000/api directly via VITE_API_URL.
    // CORS + SameSite=None cookie handles the cross-origin auth.
  },
});
