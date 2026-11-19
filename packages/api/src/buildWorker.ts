import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { DEFAULT_API_BASE } from "@site-studio/site-template/server";
import { WebCrypto } from "./platform/WebCrypto.ts";
import { RenderBuildRunnerLayer } from "./publish/RenderBuildRunner.ts";
import { BuildRunner } from "./publish/BuildRunner.ts";
import { BuildQueue, type BuildJob } from "./publish/BuildQueue.ts";
import { processBuildJob } from "./publish/processBuildJob.ts";
import { SitesBucket } from "./site/bucket.ts";
import { Database } from "./site/database.ts";
import { SiteRepository, SiteRepositoryLayer } from "./site/SiteRepository.ts";

// Bind the runner's config so a deployed worker renders with the right api
// base and can purge the edge cache. Alchemy uploads only declared env
// entries, so unbound names would silently fall back to their defaults.
const BuildEnv = {
  publicApiUrl: Config.string("PUBLIC_API_URL").pipe(Config.withDefault(DEFAULT_API_BASE)),
  wwwDomain: Config.string("WWW_DOMAIN").pipe(Config.withDefault("")),
  saasZoneId: Config.string("CF_SAAS_ZONE_ID").pipe(Config.withDefault("")),
  apiToken: Config.redacted("CF_API_TOKEN").pipe(Config.withDefault(Redacted.make(""))),
};

// Queue consumer: runs the static build for published sites. Decoupled from
// the api request path so long builds can't be cut off by worker lifetime
// limits; Cloudflare retries failed messages with backoff before dead-lettering.
export default Cloudflare.Worker(
  "build",
  {
    main: import.meta.url,
    dev: { port: 8789 },
    // Invocation + error logs in the dashboard and `wrangler tail`.
    observability: { enabled: true, logs: { enabled: true, invocationLogs: true } },
    env: {
      PUBLIC_API_URL: BuildEnv.publicApiUrl,
      WWW_DOMAIN: BuildEnv.wwwDomain,
      CF_SAAS_ZONE_ID: BuildEnv.saasZoneId,
      CF_API_TOKEN: BuildEnv.apiToken,
    },
  },
  Effect.gen(function* () {
    const db = yield* Cloudflare.D1.QueryDatabase(Database);
    const bucket = yield* Cloudflare.R2.ReadWriteBucket(SitesBucket);
    const repo = yield* Effect.gen(function* () {
      return yield* SiteRepository;
    }).pipe(Effect.provide(SiteRepositoryLayer(db)));
    const buildRunner = yield* Effect.gen(function* () {
      return yield* BuildRunner;
    }).pipe(Effect.provide(RenderBuildRunnerLayer(bucket)));
    const queue = yield* BuildQueue;

    yield* Cloudflare.Queues.consumeQueueMessages<BuildJob>(
      queue,
      {
        maxRetries: 3,
        retryDelay: Duration.seconds(30),
        maxConcurrency: 2,
      },
      (stream) =>
        Stream.runForEach(stream, (msg) => processBuildJob(msg.body)).pipe(
          Effect.provideService(SiteRepository, repo),
          Effect.provideService(BuildRunner, buildRunner),
        ),
    );
    return {};
  }).pipe(
    Effect.provide(Cloudflare.D1.QueryDatabaseBinding),
    Effect.provide(Cloudflare.R2.ReadWriteBucketBinding),
    Effect.provide(Cloudflare.Queues.EventSourceLive),
    Effect.provide(WebCrypto),
  ),
);
