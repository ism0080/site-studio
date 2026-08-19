import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";
import { sitePreview } from "./vite/site-preview.ts";

// The API worker serves /api/auth (Better Auth) and /api/sites. Proxying /api
// in dev keeps the frontend and API same-origin, so session cookies just work.
export default defineConfig({
  plugins: [
    // Generates the typed route tree from src/routes and code-splits each
    // route's component/pending/error boundaries into its own chunk.
    tanstackRouter({ autoCodeSplitting: true }),
    react(),
    sitePreview(),
  ],
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
