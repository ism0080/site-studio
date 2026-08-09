#!/usr/bin/env bun
/**
 * Publish a site's static build via a Daytona sandbox.
 *
 * Usage:
 *   bun run build-publish <site.json>
 *
 * Reads the site document, uploads it to an ephemeral Daytona sandbox that has
 * the site-template repo, runs `bun run publish site.json --upload` (Astro
 * build -> R2 -> purge), and tears the sandbox down.
 *
 * Requires DAYTONA_API_KEY (plus R2_* credentials for the upload step). See
 * scripts/daytona.ts for all env vars.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { publishSiteWithDaytona } from "./daytona.ts"

const [sitePath] = process.argv.slice(2)
if (!sitePath) {
  console.error("Usage: bun run build-publish <site.json>")
  process.exit(1)
}

const apiKey = process.env.DAYTONA_API_KEY
if (!apiKey) {
  console.error("DAYTONA_API_KEY is required")
  process.exit(1)
}

const site = JSON.parse(readFileSync(resolve(sitePath), "utf8"))
if (!site?.id) {
  console.error("site.json must contain a site document with an `id`")
  process.exit(1)
}

const repoDir =
  process.env.DAYTONA_REPO_DIR ?? "/home/daytona/site-template"

const result = await publishSiteWithDaytona(site, site.id, {
  apiKey,
  apiUrl: process.env.DAYTONA_API_URL,
  snapshot: process.env.DAYTONA_SNAPSHOT,
  image: process.env.DAYTONA_IMAGE,
  repoDir,
  cpu: Number(process.env.DAYTONA_CPU ?? 2),
  memory: Number(process.env.DAYTONA_MEMORY ?? 2),
  env: {
    R2_ENDPOINT: process.env.R2_ENDPOINT ?? "",
    R2_BUCKET: process.env.R2_BUCKET ?? "",
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
    PUBLIC_API_URL: process.env.PUBLIC_API_URL ?? "",
  },
})

console.log(result.output)

if (result.exitCode !== 0) {
  console.error(`Daytona build failed (exit ${result.exitCode}, sandbox ${result.sandboxId})`)
  process.exit(1)
}

console.log(`published ${site.id} via Daytona sandbox ${result.sandboxId}`)
