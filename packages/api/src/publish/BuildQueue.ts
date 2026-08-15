import * as Cloudflare from "alchemy/Cloudflare";
import * as Schema from "effect/Schema";

/**
 * The queue that decouples publishing from the static build. The api worker
 * enqueues a {@link BuildJob} on publish; the `build` worker (a queue
 * consumer) runs the Astro build in a sandbox and records the result.
 */
export const BuildQueue = Cloudflare.Queues.Queue("BuildQueue");

/**
 * A build job. `document` is the encoded site document (`SiteJson`); the
 * consumer decodes it, runs the build, and reports the outcome back through
 * the owning repository.
 */
export const BuildJob = Schema.Struct({
  siteId: Schema.String,
  ownerId: Schema.String,
  document: Schema.String,
});
export type BuildJob = (typeof BuildJob)["Type"];

export const encodeBuildJob = Schema.encodeUnknownSync(BuildJob);
