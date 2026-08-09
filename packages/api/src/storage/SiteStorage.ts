import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";

type Bucket = Cloudflare.R2.ReadWriteBucketClient;

export class SiteStorageError extends Data.TaggedError("SiteStorageError")<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Where a site's buildable document (site.json) and static output live.
 * R2 today; the interface is the seam for Cloudflare Artifacts when it GA's.
 */
export interface SiteStorageShape {
  readonly putSiteDocument: (
    siteId: string,
    document: string,
  ) => Effect.Effect<void, SiteStorageError, RuntimeContext>;
  readonly getSiteDocument: (
    siteId: string,
  ) => Effect.Effect<string | null, SiteStorageError, RuntimeContext>;
}

export class SiteStorage extends Context.Service<SiteStorage, SiteStorageShape>()("SiteStorage") {}

const siteKey = (siteId: string) => `sites/${siteId}/site.json`;

const toStorageError = (cause: unknown) =>
  new SiteStorageError({
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });

export const makeR2SiteStorage = (bucket: Bucket): SiteStorageShape => ({
  putSiteDocument: (siteId, document) =>
    bucket
      .put(siteKey(siteId), document)
      .pipe(Effect.as(undefined), Effect.mapError(toStorageError)),
  getSiteDocument: (siteId) =>
    bucket.get(siteKey(siteId)).pipe(
      Effect.mapError(toStorageError),
      Effect.flatMap((object) =>
        object === null
          ? Effect.succeed(null)
          : object.text().pipe(Effect.mapError(toStorageError)),
      ),
    ),
});

export const R2SiteStorageLayer = (bucket: Bucket) =>
  Layer.effect(
    SiteStorage,
    Effect.sync(() => makeR2SiteStorage(bucket)),
  );
