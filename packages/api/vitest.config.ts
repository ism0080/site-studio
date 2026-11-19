import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // BuildRunner tests exercise the renderer source, not the worker bundle
      // (`dist/render-server.mjs`, produced by `bun run build:template`).
      "@site-studio/site-template/server": fileURLToPath(
        new URL("../site-template/src/render.tsx", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
