import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { sitePreview } from "./vite/site-preview.ts";

// The API worker serves /api/auth (Better Auth) and /api/sites. Proxying /api
// in dev keeps the frontend and API same-origin, so session cookies just work.
export default defineConfig({
  plugins: [react(), sitePreview()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
