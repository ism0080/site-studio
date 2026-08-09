import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { Site } from "../site/site.ts";

/**
 * The static-site build runner: given a site document, produces its static
 * build and uploads it to R2. The interface is provider-agnostic so the
 * implementation can be swapped (Daytona sandbox, local bun, a future
 * queue consumer, etc.).
 */
export interface BuildResult {
  /** Provider identifier for the build (e.g. a sandbox id). */
  readonly buildId: string;
  readonly exitCode: number;
  readonly output: string;
}

export class BuildError extends Data.TaggedError("BuildError")<{
  message: string;
  cause?: unknown;
}> {}

export class BuildRunner extends Context.Service<
  BuildRunner,
  {
    readonly publish: (site: Site) => Effect.Effect<BuildResult, BuildError>;
  }
>()("BuildRunner") {}
