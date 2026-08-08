#!/usr/bin/env bun
/**
 * Render a site document to static HTML with Astro.
 *
 * CLI:
 *   bun run scripts/render.mjs <site.json> [outDir]
 *
 * Programmatic:
 *   import { render } from "./scripts/render.mjs"
 *   await render(site, outDir)
 *
 * Steps:
 *   1. Writes the site document to `src/site.data.ts` (the build's data module).
 *   2. Runs `astro build` to generate the static site into `dist/`.
 *   3. Moves the result to `outDir` (default `./out/<site-id>`).
 *
 * The `outDir` tree is what the publish pipeline uploads to R2 under
 * `sites/<site-id>/`.
 */

import { execSync } from "node:child_process"
import { mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs"
import { writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
export const templateRoot = resolve(here, "..")

export async function render(site, outDir) {
  const dataModule = join(templateRoot, "src", "site.data.ts")
  const dist = join(templateRoot, "dist")

  const serialized = JSON.stringify(site, null, 2).replace(/</g, "\\u003c")
  const generated = `// GENERATED FILE — written by scripts/render.mjs. Do not edit by hand.
import type { Site } from "./site.ts"

export const site: Site = ${serialized} as Site
`
  mkdirSync(dirname(dataModule), { recursive: true })
  rmSync(dataModule, { force: true })
  writeFileSync(dataModule, generated)

  // Public API base URL for the site's contact form. Falls back to a same-origin
  // path if unset (works when the site is served behind the API).
  const apiUrl =
    process.env.PUBLIC_API_URL ?? process.env.API_URL ?? "https://api.site-studio.dev"
  execSync("bun run astro build", {
    cwd: templateRoot,
    stdio: "inherit",
    env: { ...process.env, PUBLIC_API_URL: apiUrl },
  })

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(dirname(outDir), { recursive: true })
  renameSync(dist, outDir)

  const bytes = statSync(outDir).size
  console.log(`rendered ${site.id} -> ${outDir} (${(bytes / 1024).toFixed(1)} KiB)`)
  return outDir
}

if (import.meta.main) {
  const [sitePath, outDirArg] = process.argv.slice(2)
  if (!sitePath) {
    console.error("Usage: bun run scripts/render.mjs <site.json> [outDir]")
    process.exit(1)
  }
  const site = JSON.parse(readFileSync(resolve(sitePath), "utf8"))
  if (!site?.id) {
    console.error("site.json must contain a site document with an `id`")
    process.exit(1)
  }
  const outDir = outDirArg
    ? resolve(outDirArg)
    : join(templateRoot, "out", site.id)
  await render(site, outDir)
}
