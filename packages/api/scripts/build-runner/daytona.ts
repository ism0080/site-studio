/**
 * Daytona-backed BuildRunner layer.
 *
 * Runs `astro build` + R2 upload inside an ephemeral Daytona sandbox. Requires
 * DAYTONA_API_KEY; the sandbox snapshot should contain the site-template repo
 * (deps installed) plus `bun`.
 *
 * Env:
 *   DAYTONA_API_KEY, DAYTONA_API_URL, DAYTONA_SNAPSHOT, DAYTONA_IMAGE,
 *   DAYTONA_REPO_DIR, DAYTONA_CPU, DAYTONA_MEMORY
 *   R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   PUBLIC_API_URL (passed into the sandbox for the upload step)
 */

import { Daytona } from "@daytona/sdk";
import * as Config from "effect/Config";
import * as Redacted from "effect/Redacted";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { Site } from "../../src/site/site.ts";
import { encodeSiteDocument } from "../../src/site/site.ts";
import { BuildError, BuildRunner, type BuildResult } from "../../src/publish/BuildRunner.ts";

const config = Effect.all({
  apiKey: Config.redacted("DAYTONA_API_KEY"),
  apiUrl: Config.option(Config.string("DAYTONA_API_URL")),
  snapshot: Config.option(Config.string("DAYTONA_SNAPSHOT")),
  image: Config.option(Config.string("DAYTONA_IMAGE")),
  repoDir: Config.string("DAYTONA_REPO_DIR").pipe(
    Config.withDefault("/home/daytona/site-template"),
  ),
  cpu: Config.number("DAYTONA_CPU").pipe(Config.withDefault(2)),
  memory: Config.number("DAYTONA_MEMORY").pipe(Config.withDefault(2)),
  r2Endpoint: Config.string("R2_ENDPOINT").pipe(Config.withDefault("")),
  r2Bucket: Config.string("R2_BUCKET").pipe(Config.withDefault("")),
  r2AccessKeyId: Config.string("R2_ACCESS_KEY_ID").pipe(Config.withDefault("")),
  r2SecretAccessKey: Config.redacted("R2_SECRET_ACCESS_KEY").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  publicApiUrl: Config.option(Config.string("PUBLIC_API_URL")),
});

export const DaytonaBuildRunner = Layer.effect(
  BuildRunner,
  Effect.gen(function* () {
    const env = yield* config;
    const client = new Daytona(
      env.apiUrl._tag === "Some"
        ? { apiKey: Redacted.value(env.apiKey), apiUrl: env.apiUrl.value }
        : { apiKey: Redacted.value(env.apiKey) },
    );

    return {
      publish: (site: Site) =>
        Effect.tryPromise(() =>
          client.create({
            ...(env.snapshot._tag === "Some"
              ? { snapshot: env.snapshot.value }
              : env.image._tag === "Some"
                ? { image: env.image.value }
                : {}),
            envVars: {
              R2_ENDPOINT: env.r2Endpoint,
              R2_BUCKET: env.r2Bucket,
              R2_ACCESS_KEY_ID: env.r2AccessKeyId,
              R2_SECRET_ACCESS_KEY: Redacted.value(env.r2SecretAccessKey),
              PUBLIC_API_URL: env.publicApiUrl._tag === "Some" ? env.publicApiUrl.value : "",
            },
            resources: { cpu: env.cpu, memory: env.memory },
            autoDeleteInterval: 30,
            labels: { app: "site-studio", site: site.id },
          }),
        ).pipe(
          Effect.flatMap((sandbox) =>
            Effect.tryPromise(async (): Promise<BuildResult> => {
              await sandbox.fs.uploadFile(
                Buffer.from(encodeSiteDocument(site), "utf8"),
                `${env.repoDir}/site.json`,
              );
              const result = await sandbox.process.executeCommand(
                "bun run publish site.json --upload",
                env.repoDir,
                {
                  R2_ENDPOINT: env.r2Endpoint,
                  R2_BUCKET: env.r2Bucket,
                  R2_ACCESS_KEY_ID: env.r2AccessKeyId,
                  R2_SECRET_ACCESS_KEY: Redacted.value(env.r2SecretAccessKey),
                  PUBLIC_API_URL: env.publicApiUrl._tag === "Some" ? env.publicApiUrl.value : "",
                },
                600,
              );
              return {
                buildId: sandbox.id,
                exitCode: result.exitCode,
                output: result.result,
              };
            }).pipe(Effect.ensuring(Effect.promise(() => client.delete(sandbox).catch(() => {})))),
          ),
          Effect.mapError(
            (cause) =>
              new BuildError({
                message: cause instanceof Error ? cause.message : String(cause),
                cause,
              }),
          ),
        ),
    };
  }),
);
