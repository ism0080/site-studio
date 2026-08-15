import * as Effect from "effect/Effect";
import { nowIso } from "../platform/Time.ts";
import { decodeSiteJson, type BuildStatus, type Site } from "../site/site.ts";
import { SiteRepository } from "../site/SiteRepository.ts";
import { BuildRunner } from "./BuildRunner.ts";
import type { BuildJob } from "./BuildQueue.ts";

// Records the build outcome on the site. A failing status write must not mask
// the build result, so it dies (the queue only sees the build error).
const _record = (
  repo: SiteRepository["Service"],
  site: Site,
  job: BuildJob,
  buildStatus: BuildStatus,
  builtAt: string,
  error: string | undefined,
) => repo.markBuildResult(site.id, job.ownerId, buildStatus, builtAt, error).pipe(Effect.orDie);

/**
 * Runs a published site's build and reports the outcome back onto the site.
 * Success marks the site `built`; a BuildError marks it `failed` and
 * re-propagates so the queue retries (transient failures recover; the status
 * already reflects the last attempt).
 */
export const processBuildJob = Effect.fn("build.processBuildJob")(function* (job: BuildJob) {
  const repo = yield* SiteRepository;
  const buildRunner = yield* BuildRunner;
  const site = yield* decodeSiteJson(job.document).pipe(Effect.orDie);
  const now = yield* nowIso;
  yield* buildRunner.publish(site).pipe(
    Effect.tap(() => _record(repo, site, job, "built", now, undefined)),
    Effect.catchTag("BuildError", (cause) =>
      Effect.flatMap(_record(repo, site, job, "failed", now, cause.message), () =>
        Effect.fail(cause),
      ),
    ),
  );
});
