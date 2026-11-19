import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { RuntimeContext } from "alchemy";
import type { Site } from "../site/site.ts";

/**
 * The static-site build runner: renders a site document to its static output
 * and writes it to the site's published tree. Runs in the build worker.
 */
export interface BuildResult {
  /** R2 object keys written for the site, e.g. `sites/<siteId>/index.html`. */
  readonly keys: ReadonlyArray<string>;
}

/** The static build failed to render or upload. */
export class BuildError extends Data.TaggedError("BuildError")<{
  message: string;
  cause?: unknown;
}> {}

export class BuildRunner extends Context.Service<
  BuildRunner,
  {
    readonly publish: (site: Site) => Effect.Effect<BuildResult, BuildError, RuntimeContext>;
  }
>()("@app/BuildRunner") {}
