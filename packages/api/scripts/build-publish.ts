#!/usr/bin/env bun
/**
 * Publish a site's static build via the configured BuildRunner.
 *
 * Usage:
 *   bun run build-publish <site.json>
 *
 * The BuildRunner is swappable via BUILD_RUNNER (default "daytona"):
 *   BUILD_RUNNER=daytona  scripts/build-runner/daytona.ts (requires DAYTONA_API_KEY)
 *   BUILD_RUNNER=local    scripts/build-runner/local.ts   (runs publish.mjs on this host)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Effect from "effect/Effect";
import { BuildRunner } from "../src/publish/BuildRunner.ts";
import { DaytonaBuildRunner } from "../src/publish/daytona.ts";
import { decodeSiteJson } from "../src/site/site.ts";
import { LocalBuildRunner } from "./build-runner/local.ts";

const [sitePath] = process.argv.slice(2);
if (!sitePath) {
  console.error("Usage: bun run build-publish <site.json>");
  process.exit(1);
}

const kind = process.env.BUILD_RUNNER ?? "daytona";
const runnerLayer = kind === "local" ? LocalBuildRunner : DaytonaBuildRunner;

const site = Effect.runSync(
  decodeSiteJson(readFileSync(resolve(sitePath), "utf8")).pipe(
    Effect.mapError((issue) => new Error(`Invalid site document: ${issue}`)),
  ),
);

const result = await Effect.runPromise(
  Effect.gen(function* () {
    const runner = yield* BuildRunner;
    return yield* runner.publish(site);
  }).pipe(Effect.provide(runnerLayer)),
).catch((e) => {
  console.error(`build failed: ${e?.message ?? e}`);
  if (e?.cause) console.error(e.cause);
  process.exit(1);
});

console.log(result.output);

if (result.exitCode !== 0) {
  console.error(`build failed (exit ${result.exitCode}, build ${result.buildId})`);
  process.exit(1);
}

console.log(`published ${site.id} (${kind} build ${result.buildId})`);
