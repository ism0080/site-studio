#!/usr/bin/env bun
/**
 * Render a site document to `./out/<site-id>` and print its R2 key manifest.
 *
 * Usage:
 *   bun run scripts/publish.mjs <site.json>
 *
 * This is the local dry-run/inspection path. Publishing itself runs in the
 * build worker, which renders the document in-process and writes the same
 * `sites/<site-id>/<key>` objects to R2.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { render, templateRoot } from "./render.mjs";

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const [sitePath] = process.argv.slice(2);
if (!sitePath) {
  console.error("Usage: bun run scripts/publish.mjs <site.json>");
  process.exit(1);
}

const site = JSON.parse(readFileSync(resolve(sitePath), "utf8"));
if (!site?.id) {
  console.error("site.json must contain a site document with an `id`");
  process.exit(1);
}

const outDir = join(templateRoot, "out", site.id);
await render(site, outDir);

const manifest = listFiles(outDir).map((file) => relative(outDir, file));
for (const key of manifest) console.log(`sites/${site.id}/${key}`);
console.log(`dry run — ${manifest.length} file(s); the build worker uploads these keys`);
