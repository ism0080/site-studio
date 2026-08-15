import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Http from "effect/unstable/http";
import * as HttpApi from "effect/unstable/httpapi";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { SitesBucket } from "./site/bucket.ts";
import { Database } from "./site/database.ts";
import { SiteApi } from "./site/siteApi.ts";
import { publishSite } from "./site/publish.ts";
import { makeSiteRepository, SiteRepository } from "./site/SiteRepository.ts";
import { makeLeadRepository, LeadRepository } from "./leads/LeadRepository.ts";
import { LeadNotifier, makeCloudflareNotifier, makeNoopNotifier } from "./leads/LeadNotifier.ts";
import { LeadRateLimiter, submitLead } from "./leads/submitLead.ts";
import { SiteStorage, makeR2SiteStorage } from "./storage/SiteStorage.ts";
import { WebCrypto } from "./platform/WebCrypto.ts";
import { BuildQueue, encodeBuildJob } from "./publish/BuildQueue.ts";
import { BuildJobSink } from "./publish/BuildJobSink.ts";
import { AUTH_PATH, CurrentUser, createAuth } from "./auth/auth.ts";

const HttpPlatformStub = Layer.succeed(Http.HttpPlatform.HttpPlatform, {
  platform: "web",
  compression: Http.HttpPlatform.makeCompressionWeb({
    algorithms: [],
    transform: (_algorithm) => (stream) => stream,
  }),
  fileResponse: () => Effect.die("HttpPlatform.fileResponse not supported"),
  fileWebResponse: () => Effect.die("HttpPlatform.fileWebResponse not supported"),
});

export default Cloudflare.Worker(
  "api",
  { main: import.meta.url, dev: { port: 8787 } },
  Effect.gen(function* () {
    const db = yield* Cloudflare.D1.QueryDatabase(Database);
    const bucket = yield* Cloudflare.R2.ReadWriteBucket(SitesBucket);
    const env = yield* Cloudflare.WorkerEnvironment;
    // Native D1 binding for Better Auth (alchemy's QueryDatabase client is a
    // wrapper; Better Auth wants the raw D1Database). Binding name matches the
    // resource's logical id ("Database").
    // SAFETY: The Worker's D1 binding is registered under the resource's logical id, so reading "Database" off the raw env yields the native D1Database.
    const rawDb = yield* Effect.sync(() => (env as Record<string, D1Database>)["Database"]!);

    // Rate-limit public lead submissions per IP (5/min).
    const throttle = yield* Cloudflare.RateLimit("LeadsRateLimit", {
      namespaceId: 1001,
      simple: { limit: 5, period: 60 },
    });

    // Service implementations. These are the swap points: the interfaces are
    // the Context tags above, and each impl is built here in init and provided
    // per-request to the router.
    const siteRepo = makeSiteRepository(db);
    const leadRepo = makeLeadRepository(db);
    const siteStorage = makeR2SiteStorage(bucket);

    // Lead notifications are best-effort and swappable. Cloudflare's
    // send_email binding only reaches verified destination addresses, so the
    // Cloudflare impl sends to a platform inbox when configured.
    const leadsNotifyEmail = yield* Config.option(Config.string("LEADS_NOTIFY_EMAIL"));
    const leadsFromEmail = yield* Config.option(Config.string("LEADS_FROM_EMAIL"));
    const leadNotifier =
      Option.isSome(leadsNotifyEmail) && Option.isSome(leadsFromEmail)
        ? yield* makeCloudflareNotifier()
        : makeNoopNotifier();

    const config = yield* Effect.all({
      authSecret: Config.redacted("AUTH_SECRET").pipe(
        Config.withDefault(Redacted.make("dev-only-secret-0123456789abcdef0123456789abcdef")),
      ),
      authBaseUrl: Config.string("AUTH_BASE_URL").pipe(Config.withDefault("http://localhost:8787")),
      trustedOrigins: Config.string("TRUSTED_ORIGINS").pipe(
        Config.withDefault("http://localhost:5173"),
      ),
      googleClientId: Config.string("GOOGLE_CLIENT_ID").pipe(Config.withDefault("")),
      googleClientSecret: Config.redacted("GOOGLE_CLIENT_SECRET").pipe(
        Config.withDefault(Redacted.make("")),
      ),
    });
    const auth = createAuth(rawDb, {
      secret: Redacted.value(config.authSecret),
      baseURL: config.authBaseUrl,
      trustedOrigins: config.trustedOrigins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      googleClientId: config.googleClientId,
      googleClientSecret: Redacted.value(config.googleClientSecret),
    });

    const rateLimiter = {
      limit: (key: string) =>
        throttle.limit({ key }).pipe(
          // Fail open: allow the request if the limiter itself errors.
          Effect.catchTag("RateLimitError", () => Effect.succeed({ success: true })),
          Effect.map((result) => result.success),
        ),
    };

    // Published sites are handed to the build queue; the `build` worker runs
    // the static build and reports the outcome back onto the site.
    const buildQueue = yield* Cloudflare.Queues.WriteQueue(BuildQueue);
    const buildJobSink: BuildJobSink["Service"] = {
      send: (job) => buildQueue.send(encodeBuildJob(job)),
    };

    const sitesGroup = HttpApi.HttpApiBuilder.group(SiteApi, "Sites", (handlers) =>
      handlers
        .handle("list", () =>
          CurrentUser.use((user) => SiteRepository.use((repo) => repo.list(user.id))),
        )
        .handle("get", ({ params }) =>
          CurrentUser.use((user) => SiteRepository.use((repo) => repo.get(params.id, user.id))),
        )
        .handle("create", ({ payload }) =>
          CurrentUser.use((user) => SiteRepository.use((repo) => repo.create(payload, user.id))),
        )
        .handle("update", ({ params, payload }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.update(params.id, payload, user.id)),
          ),
        )
        .handle("remove", ({ params }) =>
          CurrentUser.use((user) => SiteRepository.use((repo) => repo.remove(params.id, user.id))),
        )
        .handle("publish", ({ params }) => publishSite(params.id))
        .handle("setDomain", ({ params, payload }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.setDomain(params.id, user.id, payload.domain)),
          ),
        )
        .handle("verifyDomain", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.verifyDomain(params.id, user.id)),
          ),
        )
        .handle("removeDomain", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.removeDomain(params.id, user.id)),
          ),
        ),
    );

    const siteLeadsGroup = HttpApi.HttpApiBuilder.group(SiteApi, "SiteLeads", (handlers) =>
      handlers
        .handle("listLeads", ({ params }) =>
          CurrentUser.use((user) =>
            LeadRepository.use((leads) => leads.listForSite(params.id, user.id)),
          ),
        )
        .handle("deleteLead", ({ params }) =>
          CurrentUser.use((user) =>
            LeadRepository.use((leads) => leads.remove(params.id, params.leadId, user.id)),
          ),
        ),
    );

    // Public — visitor contact-form submissions (no session).
    const leadsPublicGroup = HttpApi.HttpApiBuilder.group(SiteApi, "LeadsPublic", (handlers) =>
      handlers.handle("submit", ({ payload }) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest;
          return yield* submitLead(payload, request.headers["cf-connecting-ip"] ?? "unknown");
        }),
      ),
    );

    const httpEffect = yield* Http.HttpRouter.toHttpEffect(
      HttpApi.HttpApiBuilder.layer(SiteApi).pipe(
        Layer.provide(sitesGroup),
        Layer.provide(siteLeadsGroup),
        Layer.provide(leadsPublicGroup),
        Layer.provide([Http.Etag.layer, HttpPlatformStub, Path.layer]),
        Layer.provide(
          Http.HttpRouter.cors({
            allowedOrigins: ["*"],
            allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type"],
          }),
        ),
      ),
    );

    const unauthorized = HttpServerResponse.json({ error: "Unauthorized" }, { status: 401 });
    // The router effect requires the service context (CurrentUser + the
    // swappable impls). Public submissions never read CurrentUser, so a guest
    // identity keeps the type satisfied.
    const guestUser = { id: "guest", email: "" };

    const provideServices = (user: { id: string; email: string }) =>
      httpEffect.pipe(
        Effect.provideService(CurrentUser, user),
        Effect.provideService(SiteRepository, siteRepo),
        Effect.provideService(LeadRepository, leadRepo),
        Effect.provideService(SiteStorage, siteStorage),
        Effect.provideService(LeadNotifier, leadNotifier),
        Effect.provideService(LeadRateLimiter, rateLimiter),
        Effect.provideService(BuildJobSink, buildJobSink),
      );

    return {
      // The fetch is the HttpEffect value the worker invokes per request.
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        // SAFETY: The web adapter stores the incoming platform Request on HttpServerRequest.source.
        const nativeRequest = request.source as Request;

        // Better Auth handles everything under /api/auth (sign-in, callbacks,
        // session) with its own native fetch handler.
        if (new URL(nativeRequest.url).pathname.startsWith(AUTH_PATH)) {
          const response = yield* Effect.promise(() => auth.handler(nativeRequest));
          return HttpServerResponse.fromWeb(response);
        }

        // Public contact-form submissions — no session required.
        if (new URL(nativeRequest.url).pathname.startsWith("/api/leads")) {
          return yield* provideServices(guestUser);
        }

        // Resolve the session and scope site queries to the owner.
        const session = yield* Effect.promise(() =>
          auth.api.getSession({ headers: nativeRequest.headers }),
        );
        if (!session) return yield* unauthorized;

        return yield* provideServices({
          id: session.user.id,
          email: session.user.email,
        });
      }),
    };
  }).pipe(
    Effect.provide(Cloudflare.D1.QueryDatabaseBinding),
    Effect.provide(Cloudflare.R2.ReadWriteBucketBinding),
    Effect.provide(Cloudflare.Workers.RateLimitBinding),
    Effect.provide(Cloudflare.Email.SendBinding),
    Effect.provide(Cloudflare.Queues.WriteQueueBinding),
    Effect.provide(WebCrypto),
  ),
);
