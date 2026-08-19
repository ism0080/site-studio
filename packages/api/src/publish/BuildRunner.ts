import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
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

/** The static build failed to produce output. */
export class BuildError extends Data.TaggedError("BuildError")<{
  message: string;
  cause?: unknown;
}> {}

export class BuildRunner extends Context.Service<
  BuildRunner,
  {
    readonly publish: (site: Site) => Effect.Effect<BuildResult, BuildError>;
  }
>()("@app/BuildRunner") {}

/**
 * Fallback runner for when no build backend is configured (e.g. no
 * DAYTONA_API_KEY). It fails so the consumer records the site as `failed`
 * with a clear reason rather than falsely reporting a live build.
 */
export const makeNoopBuildRunner = (): BuildRunner["Service"] => ({
  publish: (site: Site) =>
    Effect.logWarning(`no build backend configured; build skipped for site ${site.id}`).pipe(
      Effect.flatMap(() =>
        Effect.fail(
          new BuildError({
            message: "buildRunner: no build backend configured (set DAYTONA_API_KEY)",
          }),
        ),
      ),
    ),
});

/** BuildRunner fallback layer for when no build backend is configured. */
export const NoopBuildRunner = Layer.effect(BuildRunner, Effect.succeed(makeNoopBuildRunner()));
