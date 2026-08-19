import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";

type Bucket = Cloudflare.R2.ReadWriteBucketClient;

/** A site document read or write to the storage backend failed. */
export class SiteStorageError extends Data.TaggedError("SiteStorageError")<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Where a site's buildable document (site.json) and static output live.
 * R2 today; the interface is the seam for Cloudflare Artifacts when it GA's.
 */
export interface SiteStorageService {
  readonly putSiteDocument: (
    siteId: string,
    document: string,
  ) => Effect.Effect<void, SiteStorageError, RuntimeContext>;
  readonly getSiteDocument: (
    siteId: string,
  ) => Effect.Effect<string | null, SiteStorageError, RuntimeContext>;
}

export class SiteStorage extends Context.Service<SiteStorage, SiteStorageService>()(
  "@app/SiteStorage",
) {}

const _siteKey = (siteId: string) => `sites/${siteId}/site.json`;

const _toStorageError = (cause: unknown) =>
  new SiteStorageError({
    message: `siteStorage: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  });

export const makeR2SiteStorage = (bucket: Bucket): SiteStorageService => ({
  putSiteDocument: Effect.fn("SiteStorage.putSiteDocument")(function* (
    siteId: string,
    document: string,
  ) {
    return yield* bucket
      .put(_siteKey(siteId), document)
      .pipe(Effect.as(undefined), Effect.mapError(_toStorageError));
  }),
  getSiteDocument: Effect.fn("SiteStorage.getSiteDocument")(function* (siteId: string) {
    const object = yield* bucket.get(_siteKey(siteId)).pipe(Effect.mapError(_toStorageError));
    if (object === null) return null;
    return yield* object.text().pipe(Effect.mapError(_toStorageError));
  }),
});

export const R2SiteStorageLayer = (bucket: Bucket) =>
  Layer.effect(
    SiteStorage,
    Effect.sync(() => makeR2SiteStorage(bucket)),
  );
