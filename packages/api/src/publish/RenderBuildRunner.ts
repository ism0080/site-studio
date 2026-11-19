import { DEFAULT_API_BASE, renderSite } from "@site-studio/site-template/server";
import type * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { siteObjectKey } from "../site/objectKeys.ts";
import type { Site } from "../site/site.ts";
import { BuildError, BuildRunner } from "./BuildRunner.ts";

type Bucket = Cloudflare.R2.ReadWriteBucketClient;

/**
 * The edge-cache purge after an upload. Disabled (with a log) when
 * `CF_SAAS_ZONE_ID` / `CF_API_TOKEN` are not configured, so local publishes still
 * build. `wwwDomain` is the path-based route host (`/<siteId>/...`); custom
 * domains serve from their root.
 */
export type CachePurge =
  | {
      readonly _tag: "enabled";
      readonly zoneId: string;
      readonly apiToken: Redacted.Redacted<string>;
      readonly wwwDomain: string | null;
    }
  | { readonly _tag: "disabled" };

export interface RenderBuildConfig {
  /** Public api base baked into the contact form (`PUBLIC_API_URL`). */
  readonly apiBase: string;
  readonly purge: CachePurge;
}

const PurgeRequest = Schema.fromJsonString(Schema.Struct({ files: Schema.Array(Schema.String) }));

/**
 * Renders the site document in-process and writes each page to the site's R2
 * tree at the keys the www worker serves (`sites/<siteId>/<path>/index.html`).
 * No sandbox, no external process: the site-template renderer is bundled into
 * the build worker via `@site-studio/site-template/server`.
 */
export const makeRenderBuildRunner = (deps: {
  readonly bucket: Bucket;
  readonly config: RenderBuildConfig;
  readonly fetcher: typeof fetch;
}): BuildRunner["Service"] => {
  const { bucket, config, fetcher } = deps;

  return {
    publish: Effect.fn("RenderBuildRunner.publish")(function* (site: Site) {
      const files = yield* Effect.try({
        try: () => renderSite(site, { apiBase: config.apiBase }),
        catch: (cause) =>
          new BuildError({
            message: `renderBuildRunner: render failed for site ${site.id}`,
            cause,
          }),
      });

      const keys = yield* Effect.forEach(
        Object.entries(files),
        ([key, html]) => {
          const objectKey = siteObjectKey(site.id, key);
          return bucket.put(objectKey, html).pipe(
            Effect.mapError(
              (cause) =>
                new BuildError({ message: `renderBuildRunner: upload ${objectKey} failed`, cause }),
            ),
            Effect.as(objectKey),
          );
        },
        { concurrency: 4 },
      );

      const purge = config.purge;
      if (purge._tag === "disabled") {
        yield* Effect.logInfo(`cache purge skipped for site ${site.id}: purge is not configured`);
        return { keys };
      }

      const { zoneId, apiToken } = purge;
      const hosts = [purge.wwwDomain, site.customDomain ?? null].filter(
        (host): host is string => host !== null && host.length > 0,
      );
      const subdomainHost =
        site.subdomain && purge.wwwDomain ? `${site.subdomain}.${purge.wwwDomain}` : null;
      const urls = [
        ...hosts.flatMap((host) =>
          site.pages.flatMap((page) =>
            (page.slug === "/" ? ["", `/${site.id}/`] : [page.slug, `/${site.id}${page.slug}`]).map(
              (path) => `https://${host}${path}`,
            ),
          ),
        ),
        // The subdomain host serves the site from its root, so it has no
        // `/<siteId>` alias to purge.
        ...(subdomainHost
          ? site.pages.map(
              (page) => `https://${subdomainHost}${page.slug === "/" ? "" : page.slug}`,
            )
          : []),
      ];
      if (urls.length === 0) return { keys };

      yield* Effect.tryPromise({
        try: () =>
          fetcher(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Redacted.value(apiToken)}`,
              "Content-Type": "application/json",
            },
            body: Schema.encodeSync(PurgeRequest)({ files: urls }),
          }),
        catch: (cause) => cause,
      }).pipe(
        Effect.flatMap((response) =>
          response.ok
            ? Effect.logInfo(`cache purge: ${urls.length} url(s) for site ${site.id}`)
            : Effect.logWarning(`cache purge failed (${response.status}) for site ${site.id}`),
        ),
        // Purge is best-effort: a bad token, missing zone, or network error
        // must never turn a successful upload into a failed build.
        Effect.catchCause((cause) =>
          Effect.logWarning(`cache purge failed for site ${site.id}: ${String(cause)}`),
        ),
      );
      return { keys };
    }),
  };
};

/** BuildRunner backed by the in-worker renderer and the sites R2 bucket. */
export const RenderBuildRunnerLayer = (bucket: Bucket) =>
  Layer.effect(
    BuildRunner,
    Effect.gen(function* () {
      const env = yield* Config.all({
        apiBase: Config.string("PUBLIC_API_URL").pipe(Config.withDefault(DEFAULT_API_BASE)),
        wwwDomain: Config.string("WWW_DOMAIN").pipe(Config.withDefault("")),
        zoneId: Config.string("CF_SAAS_ZONE_ID").pipe(Config.withDefault("")),
        apiToken: Config.redacted("CF_API_TOKEN").pipe(Config.withDefault(Redacted.make(""))),
      });
      const purge: CachePurge =
        env.zoneId.length > 0 && Redacted.value(env.apiToken).length > 0
          ? {
              _tag: "enabled",
              zoneId: env.zoneId,
              apiToken: env.apiToken,
              wwwDomain: env.wwwDomain.length > 0 ? env.wwwDomain : null,
            }
          : { _tag: "disabled" };

      return makeRenderBuildRunner({
        bucket,
        config: { apiBase: env.apiBase, purge },
        fetcher: globalThis.fetch,
      });
    }),
  );
