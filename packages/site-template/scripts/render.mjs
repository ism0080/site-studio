#!/usr/bin/env bun
/**
 * Render a site document to static HTML.
 *
 * CLI:
 *   bun run scripts/render.mjs <site.json> [outDir]
 *
 * Programmatic:
 *   import { render } from "./scripts/render.mjs"
 *   await render(site, outDir)
 *
 * The renderer (src/render.tsx) turns the site document into one HTML file
 * per page (`index.html`, `<slug>/index.html`) with no build step — a pure
 * function, fast enough to also serve the editor's live preview.
 *
 * The `outDir` tree is what the publish pipeline uploads to R2 under
 * `sites/<site-id>/`.
 */

import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSite } from "../src/render.tsx";

const here = dirname(fileURLToPath(import.meta.url));
export const templateRoot = resolve(here, "..");

export async function render(site, outDir) {
  const apiBase =
    process.env.PUBLIC_API_URL ?? process.env.API_URL ?? "https://api.site-studio.dev";
  const files = renderSite(site, { apiBase });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const [key, content] of Object.entries(files)) {
    const out = join(outDir, key);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, content);
  }

  const bytes = statSync(outDir).size;
  console.log(`rendered ${site.id} -> ${outDir} (${(bytes / 1024).toFixed(1)} KiB)`);
  return outDir;
}

if (import.meta.main) {
  const [sitePath, outDirArg] = process.argv.slice(2);
  if (!sitePath) {
    console.error("Usage: bun run scripts/render.mjs <site.json> [outDir]");
    process.exit(1);
  }
  const site = JSON.parse(readFileSync(resolve(sitePath), "utf8"));
  if (!site?.id) {
    console.error("site.json must contain a site document with an `id`");
    process.exit(1);
  }
  const outDir = outDirArg ? resolve(outDirArg) : join(templateRoot, "out", site.id);
  await render(site, outDir);
}
