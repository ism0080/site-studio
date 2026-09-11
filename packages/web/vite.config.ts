import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import { defineConfig } from "vite";
import { ENV } from "varlock/env";

// The API worker serves /api/auth (Better Auth) and /api/sites. Proxying /api
// in dev keeps the frontend and API same-origin, so session cookies just work.
export default defineConfig({
  plugins: [
    varlockVitePlugin(),
    // Generates the typed route tree from src/routes and code-splits each
    // route's component/pending/error boundaries into its own chunk.
    tanstackRouter({ autoCodeSplitting: true }),
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: ENV.VITE_API_URL,
        changeOrigin: true,
      },
    },
  },
});
