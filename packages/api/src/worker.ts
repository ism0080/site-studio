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
import { requesterFor, type GlobalRole } from "./access/access.ts";
import { makeMemberRepository, MemberRepository } from "./members/MemberRepository.ts";
import { makeAdminRepository, AdminRepository } from "./admin/AdminRepository.ts";
import { Forbidden, SiteNotFound } from "./site/site.ts";

const AuthEnv = {
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
};

const AuthConfig = Effect.all(AuthEnv);

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
  {
    main: import.meta.url,
    dev: { port: 8787 },
    env: {
      AUTH_SECRET: AuthEnv.authSecret,
      AUTH_BASE_URL: AuthEnv.authBaseUrl,
      TRUSTED_ORIGINS: AuthEnv.trustedOrigins,
      GOOGLE_CLIENT_ID: AuthEnv.googleClientId,
      GOOGLE_CLIENT_SECRET: AuthEnv.googleClientSecret,
    },
  },
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
    const memberRepo = makeMemberRepository(db);
    const adminRepo = makeAdminRepository(db);
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
      auth: AuthConfig,
      adminEmails: Config.string("ADMIN_EMAILS").pipe(
        Config.withDefault(""),
        Config.map((raw) =>
          raw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        ),
      ),
    });
    const auth = createAuth(rawDb, {
      secret: Redacted.value(config.auth.authSecret),
      baseURL: config.auth.authBaseUrl,
      trustedOrigins: config.auth.trustedOrigins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      googleClientId: config.auth.googleClientId,
      googleClientSecret: Redacted.value(config.auth.googleClientSecret),
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
          CurrentUser.use((user) => SiteRepository.use((repo) => repo.list(requesterFor(user)))),
        )
        .handle("get", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.get(params.id, requesterFor(user))),
          ),
        )
        .handle("access", ({ params }) =>
          CurrentUser.use((user) =>
            Effect.gen(function* () {
              const repo = yield* SiteRepository;
              const access = yield* repo.access(params.id, requesterFor(user));
              if (access === null) return yield* new SiteNotFound({ id: params.id });
              return access;
            }),
          ),
        )
        .handle("create", ({ payload }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.create(payload, requesterFor(user))),
          ),
        )
        .handle("update", ({ params, payload }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.update(params.id, payload, requesterFor(user))),
          ),
        )
        .handle("remove", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.remove(params.id, requesterFor(user))),
          ),
        )
        .handle("publish", ({ params }) => publishSite(params.id))
        .handle("setDomain", ({ params, payload }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) =>
              repo.setDomain(params.id, requesterFor(user), payload.domain),
            ),
          ),
        )
        .handle("verifyDomain", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.verifyDomain(params.id, requesterFor(user))),
          ),
        )
        .handle("removeDomain", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.removeDomain(params.id, requesterFor(user))),
          ),
        ),
    );

    const siteLeadsGroup = HttpApi.HttpApiBuilder.group(SiteApi, "SiteLeads", (handlers) =>
      handlers
        .handle("listLeads", ({ params }) =>
          CurrentUser.use((user) =>
            LeadRepository.use((leads) => leads.listForSite(params.id, requesterFor(user))),
          ),
        )
        .handle("deleteLead", ({ params }) =>
          CurrentUser.use((user) =>
            LeadRepository.use((leads) =>
              leads.remove(params.id, params.leadId, requesterFor(user)),
            ),
          ),
        ),
    );

    // Site members can only be managed by the platform admin or the managing
    // agency (the site owner). A self-managed client owner has no invite power.
    const requireManage = (siteId: string) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        const repo = yield* SiteRepository;
        const access = yield* repo.access(siteId, requesterFor(user));
        if (access === null || access.kind !== "full") {
          return yield* new SiteNotFound({ id: siteId });
        }
        if (user.role === "client") return yield* new Forbidden({});
        return user;
      });

    const membersGroup = HttpApi.HttpApiBuilder.group(SiteApi, "Members", (handlers) =>
      handlers
        .handle("list", ({ params }) =>
          Effect.gen(function* () {
            yield* requireManage(params.id);
            const repo = yield* MemberRepository;
            return yield* repo.list(params.id);
          }),
        )
        .handle("invite", ({ params, payload }) =>
          Effect.gen(function* () {
            yield* requireManage(params.id);
            const repo = yield* MemberRepository;
            return yield* repo.invite(params.id, payload);
          }),
        )
        .handle("update", ({ params, payload }) =>
          Effect.gen(function* () {
            yield* requireManage(params.id);
            const repo = yield* MemberRepository;
            return yield* repo.update(params.id, params.email, payload);
          }),
        )
        .handle("remove", ({ params }) =>
          Effect.gen(function* () {
            yield* requireManage(params.id);
            const repo = yield* MemberRepository;
            return yield* repo.remove(params.id, params.email);
          }),
        ),
    );

    const requireAdmin = () =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;
        if (user.role !== "admin") return yield* new Forbidden({});
        return user;
      });

    const adminGroup = HttpApi.HttpApiBuilder.group(SiteApi, "Admin", (handlers) =>
      handlers
        .handle("listAgencies", () =>
          Effect.gen(function* () {
            yield* requireAdmin();
            const repo = yield* AdminRepository;
            return yield* repo.list();
          }),
        )
        .handle("inviteAgency", ({ payload }) =>
          Effect.gen(function* () {
            yield* requireAdmin();
            const repo = yield* AdminRepository;
            return yield* repo.invite(payload.email);
          }),
        )
        .handle("removeAgency", ({ params }) =>
          Effect.gen(function* () {
            yield* requireAdmin();
            const repo = yield* AdminRepository;
            return yield* repo.remove(params.email);
          }),
        ),
    );

    const meGroup = HttpApi.HttpApiBuilder.group(SiteApi, "Me", (handlers) =>
      handlers.handle("me", () =>
        CurrentUser.use((user) =>
          Effect.succeed({ id: user.id, email: user.email, role: user.role }),
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
        Layer.provide(membersGroup),
        Layer.provide(adminGroup),
        Layer.provide(meGroup),
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
    const guestUser = { id: "guest", email: "", role: "client" as const };

    const provideServices = (user: { id: string; email: string; role: GlobalRole }) =>
      httpEffect.pipe(
        Effect.provideService(CurrentUser, user),
        Effect.provideService(SiteRepository, siteRepo),
        Effect.provideService(LeadRepository, leadRepo),
        Effect.provideService(MemberRepository, memberRepo),
        Effect.provideService(AdminRepository, adminRepo),
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

        // Resolve the session, materialize any pending invites for this
        // account, and scope site queries to its global role.
        const session = yield* Effect.promise(() =>
          auth.api.getSession({ headers: nativeRequest.headers }),
        );
        if (!session) return yield* unauthorized;

        const id = session.user.id;
        const email = session.user.email.toLowerCase();
        yield* memberRepo.materialize(id, email).pipe(Effect.orDie);
        const role = yield* memberRepo.globalRole(id, email, config.adminEmails).pipe(Effect.orDie);

        return yield* provideServices({ id, email, role });
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
