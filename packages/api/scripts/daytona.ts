/**
 * Daytona build runner for published sites.
 *
 * Runs `astro build` + R2 upload inside an ephemeral Daytona sandbox, so the
 * Node/Bun build happens in the cloud instead of locally. The sandbox snapshot
 * should contain the `site-template` repo (with deps installed) plus `bun`.
 *
 * Env (read by the CLI):
 *   DAYTONA_API_KEY          — Daytona API key (required)
 *   DAYTONA_API_URL          — Daytona API base URL (defaults to Daytona cloud)
 *   DAYTONA_SNAPSHOT         — pre-built sandbox snapshot name (recommended)
 *   DAYTONA_IMAGE            — fallback: base image (e.g. "debian:12.9")
 *   DAYTONA_REPO_DIR         — path to the site-template repo inside the sandbox
 *   DAYTONA_CPU / DAYTONA_MEMORY — sandbox resources (default 2 / 2)
 *   R2_* / PUBLIC_API_URL    — passed to the sandbox for the upload step
 */

import { Daytona } from "@daytona/sdk"

export interface BuildEnv {
  R2_ENDPOINT: string
  R2_BUCKET: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  PUBLIC_API_URL?: string
}

export interface BuildResult {
  sandboxId: string
  exitCode: number
  output: string
}

export async function publishSiteWithDaytona(
  site: unknown,
  siteId: string,
  options: {
    apiKey: string
    apiUrl?: string
    snapshot?: string
    image?: string
    repoDir: string
    cpu: number
    memory: number
    env: BuildEnv
  },
): Promise<BuildResult> {
  const daytona = new Daytona({
    apiKey: options.apiKey,
    ...(options.apiUrl ? { apiUrl: options.apiUrl } : {}),
  })

  const sandbox = await daytona.create({
    ...(options.snapshot
      ? { snapshot: options.snapshot }
      : options.image
        ? { image: options.image }
        : {}),
    envVars: options.env as Record<string, string>,
    resources: { cpu: options.cpu, memory: options.memory },
    autoDeleteInterval: 30,
    labels: { app: "site-studio", site: siteId },
  })

  try {
    const repoDir = options.repoDir
    const siteJson = JSON.stringify(site, null, 2)

    await sandbox.fs.uploadFile(Buffer.from(siteJson, "utf8"), `${repoDir}/site.json`)

    const result = await sandbox.process.executeCommand(
      "bun run publish site.json --upload",
      repoDir,
      options.env as Record<string, string>,
      600,
    )

    return {
      sandboxId: sandbox.id,
      exitCode: result.exitCode,
      output: result.result,
    }
  } finally {
    await daytona.delete(sandbox).catch(() => {})
  }
}
