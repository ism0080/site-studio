import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { SitesBucket } from "./site/bucket.ts";
import { Database } from "./site/database.ts";
import { contentTypeFor, normalizeDomain, resolveRequestKey } from "./site/keys.ts";

const SWR_DAYS = 86400;

const _notFound = (): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.raw(
    "<!doctype html><html><body><h1>404</h1><p>Site not found.</p></body></html>",
    { status: 404, contentType: "text/html" },
  );

// `WWW_DOMAIN` (e.g. `sites.site-studio.dev`) attaches a custom domain to the
// www worker — DNS record and edge certificate are managed automatically.
// The Cloudflare zone must already exist in the account. Read at plan time
// from the deploy process env; workerd has no `process`, so fall back to
// undefined via an optional property read.
// SAFETY: The optional `process` surface exists only on Node-based runtimes (deploy-time planning); on workerd the property read is undefined.
const wwwDomain = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  ?.env?.WWW_DOMAIN;

const wwwProps: Cloudflare.WorkerProps = {
  main: import.meta.url,
  dev: { port: 8788 },
};
if (wwwDomain) {
  wwwProps.domain = wwwDomain;
}

export default Cloudflare.Worker(
  "www",
  wwwProps,
  Effect.gen(function* () {
    const bucket = yield* Cloudflare.R2.ReadBucket(SitesBucket);
    const db = yield* Cloudflare.D1.QueryDatabase(Database);
    // Sites only change on republish, so a long edge TTL means the vast
    // majority of requests are served straight from Cloudflare's cache
    // without invoking the Worker. stale-while-revalidate keeps pages
    // instantly fresh for up to a day after expiry.
    const maxAge = yield* Config.number("CACHE_MAX_AGE").pipe(Config.withDefault(3600));
    const cacheControl = `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${SWR_DAYS}`;

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        // SAFETY: The web adapter stores the incoming platform Request on HttpServerRequest.source.
        const nativeRequest = request.source as Request;

        if (request.method !== "GET" && request.method !== "HEAD") {
          return HttpServerResponse.text("Method not allowed", { status: 405 });
        }

        const url = new URL(nativeRequest.url);
        const hostname = normalizeDomain(url.hostname);

        // 1) Custom domain -> site, via the `site_domains` mapping.
        const byDomain = yield* db
          .prepare("SELECT site_id FROM site_domains WHERE domain = ?")
          .bind(hostname)
          .first<{ site_id: string }>();

        // 2) Fall back to path-based routing: /<siteId>/<path> on the www URL.
        const key = resolveRequestKey(url.pathname, byDomain?.site_id ?? null);
        if (key === null) return _notFound();

        const object = yield* bucket.get(key);
        if (object === null) return _notFound();

        const headers = {
          "Content-Type": contentTypeFor(key),
          "Cache-Control": cacheControl,
          ETag: object.httpEtag,
        } satisfies Record<string, string>;

        const ifNoneMatch = request.headers["if-none-match"];
        if (ifNoneMatch === object.httpEtag) {
          return HttpServerResponse.empty({ status: 304, headers });
        }
        if (request.method === "HEAD") {
          return HttpServerResponse.empty({ status: 200, headers });
        }

        return HttpServerResponse.stream(object.body, {
          status: 200,
          headers,
        });
      }).pipe(Effect.orDie),
    };
  }).pipe(
    Effect.provide(Cloudflare.D1.QueryDatabaseBinding),
    Effect.provide(Cloudflare.R2.ReadBucketBinding),
  ),
);
