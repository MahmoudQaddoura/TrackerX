import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev server proxies /api to the FastAPI backend so the frontend talks to a
// single origin (mirrors the nginx setup used in production).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["catty-playset-caterer.ngrok-free.dev"],
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
