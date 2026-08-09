/**
 * Local BuildRunner layer — runs the site-template `publish.mjs` on this host
 * (Bun/Node). Useful as a swap-in for Daytona when building locally.
 *
 * Env:
 *   SITE_TEMPLATE_DIR — path to packages/site-template (defaults to ../site-template)
 *   R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   PUBLIC_API_URL (for the upload step)
 */

import { execFile } from "node:child_process"
import { writeFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { Site } from "../../src/site/site.ts"
import {
  BuildError,
  BuildRunner,
  type BuildResult,
} from "../../src/publish/BuildRunner.ts"

const execFileP = promisify(execFile)

const templateDirDefault = fileURLToPath(
  new URL("../../../site-template/", import.meta.url),
)

const config = Effect.all({
  templateDir: Config.string("SITE_TEMPLATE_DIR").pipe(
    Config.withDefault(templateDirDefault),
  ),
  r2Endpoint: Config.string("R2_ENDPOINT").pipe(Config.withDefault("")),
  r2Bucket: Config.string("R2_BUCKET").pipe(Config.withDefault("")),
  r2AccessKeyId: Config.string("R2_ACCESS_KEY_ID").pipe(Config.withDefault("")),
  r2SecretAccessKey: Config.string("R2_SECRET_ACCESS_KEY").pipe(Config.withDefault("")),
  publicApiUrl: Config.option(Config.string("PUBLIC_API_URL")),
})

export const LocalBuildRunner = Layer.effect(
  BuildRunner,
  Effect.gen(function* () {
    const env = yield* config

    return {
      publish: (site: Site) =>
        Effect.tryPromise(async (): Promise<BuildResult> => {
          const siteJson = join(tmpdir(), `${site.id}.json`)
          writeFileSync(siteJson, JSON.stringify(site, null, 2), "utf8")
          try {
            const { stdout } = await execFileP(
              "bun",
              ["run", "publish", siteJson, "--upload"],
              {
                cwd: env.templateDir,
                env: {
                  ...process.env,
                  R2_ENDPOINT: env.r2Endpoint,
                  R2_BUCKET: env.r2Bucket,
                  R2_ACCESS_KEY_ID: env.r2AccessKeyId,
                  R2_SECRET_ACCESS_KEY: env.r2SecretAccessKey,
                  PUBLIC_API_URL:
                    env.publicApiUrl._tag === "Some"
                      ? env.publicApiUrl.value
                      : "",
                },
              },
            )
            return {
              buildId: `local-${site.id}`,
              exitCode: 0,
              output: stdout,
            }
          } finally {
            unlinkSync(siteJson)
          }
        }).pipe(
          Effect.mapError(
            (cause) =>
              new BuildError({
                message: cause instanceof Error ? cause.message : String(cause),
                cause,
              }),
          ),
        ),
    }
  }),
)
