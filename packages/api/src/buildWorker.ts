import * as Cloudflare from "alchemy/Cloudflare";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { WebCrypto } from "./platform/WebCrypto.ts";
import { makeDaytonaBuildRunner } from "./publish/daytona.ts";
import { BuildRunner, makeNoopBuildRunner } from "./publish/BuildRunner.ts";
import { BuildQueue, type BuildJob } from "./publish/BuildQueue.ts";
import { processBuildJob } from "./publish/processBuildJob.ts";
import { Database } from "./site/database.ts";
import { makeSiteRepository, SiteRepository } from "./site/SiteRepository.ts";

// Queue consumer: runs the static build for published sites. Decoupled from
// the api request path so long builds can't be cut off by worker lifetime
// limits; Cloudflare retries failed messages with backoff before dead-lettering.
export default Cloudflare.Worker(
  "build",
  { main: import.meta.url, dev: { port: 8789 } },
  Effect.gen(function* () {
    const db = yield* Cloudflare.D1.QueryDatabase(Database);
    const repo = makeSiteRepository(db);
    const buildRunner = yield* makeDaytonaBuildRunner().pipe(
      Effect.catch(() => Effect.succeed(makeNoopBuildRunner())),
    );
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
    Effect.provide(Cloudflare.Queues.EventSourceLive),
    Effect.provide(WebCrypto),
  ),
);
