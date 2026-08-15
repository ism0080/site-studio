import * as Cloudflare from "alchemy/Cloudflare";
import type { RuntimeContext } from "alchemy";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type { BuildJob } from "./BuildQueue.ts";

/**
 * Where published sites are handed off for the background build. The api
 * worker provides the Cloudflare Queues implementation; the domain only
 * depends on the port, so the queue is swappable in tests.
 */
export class BuildJobSink extends Context.Service<
  BuildJobSink,
  {
    readonly send: (
      job: BuildJob,
    ) => Effect.Effect<void, Cloudflare.Queues.SendError, RuntimeContext>;
  }
>()("@app/BuildJobSink") {}
