#!/usr/bin/env bun
/**
 * Render a site document with Astro and publish the static output to R2.
 *
 * Usage:
 *   bun run scripts/publish.mjs <site.json> [--upload]
 *
 * Without `--upload`, renders to `./out/<site-id>` and prints the file
 * manifest plus the wrangler commands that would upload it.
 *
 * With `--upload`, PUTs every file to R2's S3-compatible API using:
 *   R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 * (the R2 endpoint looks like https://<account>.r2.cloudflarestorage.com).
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { createHash, createHmac } from "node:crypto"
import { render, templateRoot } from "./render.mjs"

function usage() {
  console.error("Usage: bun run scripts/publish.mjs <site.json> [--upload]")
  process.exit(1)
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

// Minimal AWS Signature Version 4 for a single R2 S3 PUT.
function awsSign({ method, host, path, payloadHash, accessKey, secretKey, date }) {
  const amzDate = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  const dateStamp = amzDate.slice(0, 8)
  const region = "auto"
  const service = "s3"
  const canonicalHeaders =
    `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date"
  const canonicalRequest =
    `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n` +
    createHash("sha256").update(canonicalRequest).digest("hex")
  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest()
  const kRegion = createHmac("sha256", kDate).update(region).digest()
  const kService = createHmac("sha256", kRegion).update(service).digest()
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest()
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex")
  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

async function uploadManifest(manifest, siteId) {
  const endpoint = process.env.R2_ENDPOINT
  const bucket = process.env.R2_BUCKET
  const accessKey = process.env.R2_ACCESS_KEY_ID
  const secretKey = process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    console.error("R2 upload credentials missing (R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)")
    console.error("Upload commands:")
    for (const [key, file] of manifest) {
      console.error(`  wrangler r2 object put ${bucket}/${key} --file ${file}`)
    }
    return false
  }
  const host = new URL(endpoint).host
  const date = new Date()
  let ok = true
  for (const [key, file] of manifest) {
    const body = readFileSync(file)
    const payloadHash = createHash("sha256").update(body).digest("hex")
    const path = `/${bucket}/${key}`
    const authorization = awsSign({
      method: "PUT",
      host,
      path,
      payloadHash,
      accessKey,
      secretKey,
      date,
    })
    const res = await fetch(`${endpoint}${path}`, {
      method: "PUT",
      headers: {
        Authorization: authorization,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"),
        "Content-Type": file.endsWith(".html") ? "text/html" : "application/octet-stream",
      },
      body,
    })
    if (!res.ok) {
      console.error(`upload ${key} failed: ${res.status} ${await res.text()}`)
      ok = false
      process.exitCode = 1
      return ok
    }
    console.log(`uploaded sites/${siteId}/${key}`)
  }
  return ok
}

async function purgeSite(site) {
  const zoneId = process.env.CF_ZONE_ID
  const apiToken = process.env.CF_API_TOKEN
  const hosts = (process.env.SITE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
  if (site.customDomain) hosts.push(site.customDomain)
  if (!zoneId || !apiToken || hosts.length === 0) {
    console.log(
      "cache purge skipped — set CF_ZONE_ID, CF_API_TOKEN and SITE_HOSTS to purge the edge cache on publish",
    )
    return
  }
  // Purge each published page; custom domains serve at the domain root, the
  // www worker serves under /<siteId>/.
  const slugs = (site.pages ?? []).map((p) => p.slug ?? "/")
  const urls = hosts.flatMap((host) =>
    slugs.flatMap((slug) => [
      `https://${host}${slug === "/" ? "" : slug}`,
      `https://${host}/${site.id}${slug === "/" ? "/" : slug}`,
    ]),
  )
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    },
  )
  if (!res.ok) {
    console.error(`cache purge failed: ${res.status} ${await res.text()}`)
    process.exitCode = 1
    return
  }
  console.log(`purged ${urls.length} edge url(s)`)
}

const [sitePath, flag] = process.argv.slice(2)
if (!sitePath) usage()
const site = JSON.parse(readFileSync(resolve(sitePath), "utf8"))
if (!site?.id) {
  console.error("site.json must contain a site document with an `id`")
  process.exit(1)
}

const outDir = join(templateRoot, "out", site.id)
await render(site, outDir)

const manifest = listFiles(outDir)
  .filter((file) => statSync(file).isFile())
  .map((file) => [relative(outDir, file), file])

if (flag === "--upload") {
  const uploaded = await uploadManifest(manifest, site.id)
  if (uploaded) await purgeSite(site)
} else {
  for (const [key] of manifest) console.log(`sites/${site.id}/${key}`)
  console.log(`dry run — pass --upload to push ${manifest.length} file(s) to R2`)
}
