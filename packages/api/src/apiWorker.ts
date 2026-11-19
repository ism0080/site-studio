import * as Cloudflare from "alchemy/Cloudflare";
import type { RateLimitClient } from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Http from "effect/unstable/http";
import * as HttpApi from "effect/unstable/httpapi";
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { SitesBucket } from "./site/bucket.ts";
import { Database } from "./site/database.ts";
import { SiteApi } from "./site/siteApi.ts";
import { publishSite } from "./site/publishSite.ts";
import { SiteRepository, SiteRepositoryLayer } from "./site/SiteRepository.ts";
import { listTemplateInfo } from "./site/templateDefaults.ts";
import { LeadRepository, LeadRepositoryLayer } from "./leads/LeadRepository.ts";
import { LeadNotifier, LeadNotifierLayer } from "./leads/LeadNotifier.ts";
import { LeadRateLimiter, submitLead } from "./leads/submitLead.ts";
import { EmailEnv, EmailSender, EmailSenderLayer } from "./email/EmailSender.ts";
import { agencyInviteEmail, siteInviteEmail } from "./email/inviteEmails.ts";
import { SiteStorage, R2SiteStorageLayer } from "./storage/SiteStorage.ts";
import { WebCrypto } from "./platform/WebCrypto.ts";
import { BuildQueue, encodeBuildJob } from "./publish/BuildQueue.ts";
import { BuildJobSink } from "./publish/BuildJobSink.ts";
import { AUTH_PATH, CurrentUser, createAuth } from "./auth/auth.ts";
import { AuthConfig, AuthEnv } from "./auth/config.ts";
import { requesterFor, type GlobalRole, type Requester } from "./access/access.ts";
import { MemberRepository, MemberRepositoryLayer } from "./members/MemberRepository.ts";
import { AdminRepository, AdminRepositoryLayer } from "./admin/AdminRepository.ts";
import { Forbidden, SiteNotFound } from "./site/site.ts";
import { CloudflareSaasLayer, CloudflareSaasService } from "./site/cloudflareSaas.ts";
import { BillingRepository, BillingRepositoryLayer } from "./billing/BillingRepository.ts";
import { BillingEnv, StripeBilling, StripeBillingLayer } from "./billing/StripeBilling.ts";
import { handleStripeEvent } from "./billing/WebhookEvents.ts";
import { BillingCustomerNotFound, billingStatus } from "./billing/billing.ts";
import { planGate, type PlanAction } from "./billing/planGates.ts";
import { guardMutation, MutationRateLimiter } from "./platform/rateLimit.ts";
import { nowIso } from "./platform/Time.ts";

const CloudflareSaasEnv = {
  zoneId: Config.string("CF_SAAS_ZONE_ID"),
  apiToken: Config.redacted("CF_API_TOKEN"),
  cnameTarget: Config.string("CF_SAAS_CNAME_TARGET"),
};

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
    // Invocation + error logs in the dashboard and `wrangler tail`.
    observability: { enabled: true, logs: { enabled: true, invocationLogs: true } },
    env: {
      AUTH_SECRET: AuthEnv.authSecret,
      AUTH_BASE_URL: AuthEnv.authBaseUrl,
      TRUSTED_ORIGINS: AuthEnv.trustedOrigins,
      GOOGLE_CLIENT_ID: AuthEnv.googleClientId,
      GOOGLE_CLIENT_SECRET: AuthEnv.googleClientSecret,
      CF_SAAS_ZONE_ID: CloudflareSaasEnv.zoneId,
      CF_API_TOKEN: CloudflareSaasEnv.apiToken,
      CF_SAAS_CNAME_TARGET: CloudflareSaasEnv.cnameTarget,
      STRIPE_API_KEY: BillingEnv.apiKey,
      STRIPE_PRICE_ID: BillingEnv.priceId,
      STRIPE_WEBHOOK_SECRET: BillingEnv.webhookSecret,
      RESEND_API_KEY: EmailEnv.apiKey,
      EMAIL_FROM: EmailEnv.from,
      WEB_URL: EmailEnv.webUrl,
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

    // Rate-limit better-auth endpoints per IP (30/min).
    const authThrottle = yield* Cloudflare.RateLimit("AuthRateLimit", {
      namespaceId: 1002,
      simple: { limit: 30, period: 60 },
    });

    // Rate-limit expensive authenticated mutations per account (20/min).
    const mutationThrottle = yield* Cloudflare.RateLimit("MutationRateLimit", {
      namespaceId: 1003,
      simple: { limit: 20, period: 60 },
    });

    // Service implementations. These are the swap points: the interfaces are
    // the Context tags above, and each impl is built here in init and provided
    // per-request to the router. Each impl is produced by providing its owning
    // layer, so requirements resolve at this composition root.
    const cloudflareConfig = yield* Effect.all(CloudflareSaasEnv).pipe(Effect.orDie);
    const cloudflareSaas = yield* CloudflareSaasService.pipe(
      Effect.provide(
        CloudflareSaasLayer({
          zoneId: cloudflareConfig.zoneId,
          apiToken: Redacted.value(cloudflareConfig.apiToken),
        }),
      ),
    );
    const siteRepo = yield* Effect.gen(function* () {
      return yield* SiteRepository;
    }).pipe(
      Effect.provide(
        SiteRepositoryLayer(db, {
          cloudflareSaas,
          cnameTarget: cloudflareConfig.cnameTarget,
        }),
      ),
    );
    const leadRepo = yield* Effect.gen(function* () {
      return yield* LeadRepository;
    }).pipe(Effect.provide(LeadRepositoryLayer(db)));
    const memberRepo = yield* Effect.gen(function* () {
      return yield* MemberRepository;
    }).pipe(Effect.provide(MemberRepositoryLayer(db)));
    const adminRepo = yield* Effect.gen(function* () {
      return yield* AdminRepository;
    }).pipe(Effect.provide(AdminRepositoryLayer(db)));
    const billingRepo = yield* Effect.gen(function* () {
      return yield* BillingRepository;
    }).pipe(Effect.provide(BillingRepositoryLayer(db)));
    const stripeBilling = yield* Effect.gen(function* () {
      return yield* StripeBilling;
    }).pipe(Effect.provide(StripeBillingLayer));
    const siteStorage = yield* Effect.gen(function* () {
      return yield* SiteStorage;
    }).pipe(Effect.provide(R2SiteStorageLayer(bucket)));
    const leadNotifier = yield* Effect.gen(function* () {
      return yield* LeadNotifier;
    }).pipe(Effect.provide(LeadNotifierLayer));
    const emailSender = yield* Effect.gen(function* () {
      return yield* EmailSender;
    }).pipe(Effect.provide(EmailSenderLayer));

    const config = yield* Effect.all({
      auth: AuthConfig.pipe(Effect.orDie),
      webUrl: EmailEnv.webUrl,
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
    // One parsed list shared by Better Auth and CORS.
    const trustedOrigins = config.auth.trustedOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const auth = createAuth(rawDb, {
      secret: Redacted.value(config.auth.authSecret),
      baseURL: config.auth.authBaseUrl,
      trustedOrigins,
      googleClientId: config.auth.googleClientId,
      googleClientSecret: Redacted.value(config.auth.googleClientSecret),
    });

    const limiterFor = (binding: RateLimitClient) => ({
      limit: (key: string) =>
        binding.limit({ key }).pipe(
          // Fail open: allow the request if the limiter itself errors.
          Effect.catchTag("RateLimitError", () => Effect.succeed({ success: true })),
          Effect.map((result) => result.success),
        ),
    });

    const leadRateLimiter = limiterFor(throttle);
    const authRateLimiter = limiterFor(authThrottle);
    const mutationRateLimiter = limiterFor(mutationThrottle);

    // Published sites are handed to the build queue; the `build` worker runs
    // the static build and reports the outcome back onto the site.
    const buildQueue = yield* Cloudflare.Queues.WriteQueue(BuildQueue);
    const buildJobSink: BuildJobSink["Service"] = {
      send: (job) => buildQueue.send(encodeBuildJob(job)),
    };

    // The account's plan, creating its free row on first touch.
    const planFor = (userId: string) =>
      Effect.gen(function* () {
        const billing = yield* BillingRepository;
        const now = yield* nowIso;
        return (yield* billing.ensure(userId, now)).plan;
      });

    // Rejects the request when the account's plan does not cover the action.
    const planGuard = (userId: string, action: PlanAction) =>
      Effect.gen(function* () {
        const sites = yield* SiteRepository;
        const rejection = planGate(action, {
          plan: yield* planFor(userId),
          siteCount: action.kind === "createSite" ? yield* sites.countForOwner(userId) : 0,
        });
        if (rejection !== null) return yield* rejection;
      });

    // Null when the site does not exist or the requester cannot see it; the
    // repository's own update then reports SiteNotFound.
    const currentTemplateId = (siteId: string, requester: Requester) =>
      Effect.gen(function* () {
        const repo = yield* SiteRepository;
        const access = yield* repo.access(siteId, requester);
        if (access === null) return null;
        return (yield* repo.get(siteId, requester)).templateId;
      });

    const sitesGroup = HttpApi.HttpApiBuilder.group(SiteApi, "Sites", (handlers) =>
      handlers
        .handle("listTemplates", () => Effect.sync(listTemplateInfo))
        .handle("list", () =>
          CurrentUser.use((user) => SiteRepository.use((repo) => repo.list(requesterFor(user)))),
        )
        .handle("get", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.get(params.id, requesterFor(user))),
          ),
        )
        .handle("getDomain", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.getDomainSetup(params.id, requesterFor(user))),
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
            Effect.gen(function* () {
              yield* guardMutation(user.id);
              yield* planGuard(user.id, { kind: "createSite", templateId: payload.templateId });
              const repo = yield* SiteRepository;
              return yield* repo.create(payload, requesterFor(user));
            }),
          ),
        )
        .handle("update", ({ params, payload }) =>
          CurrentUser.use((user) =>
            Effect.gen(function* () {
              const requester = requesterFor(user);
              yield* planGuard(user.id, {
                kind: "updateSite",
                templateId: payload.templateId,
                currentTemplateId: yield* currentTemplateId(params.id, requester),
                analytics: payload.settings.analytics !== undefined,
              });
              const repo = yield* SiteRepository;
              return yield* repo.update(params.id, payload, requester);
            }),
          ),
        )
        .handle("remove", ({ params }) =>
          CurrentUser.use((user) =>
            SiteRepository.use((repo) => repo.remove(params.id, requesterFor(user))),
          ),
        )
        .handle("publish", ({ params }) =>
          CurrentUser.use((user) =>
            Effect.gen(function* () {
              yield* guardMutation(user.id);
              return yield* publishSite(params.id);
            }),
          ),
        )
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
            const user = yield* requireManage(params.id);
            const members = yield* MemberRepository;
            const member = yield* members.invite(params.id, payload);
            const sites = yield* SiteRepository;
            const site = yield* sites.get(params.id, requesterFor(user));
            const email = yield* EmailSender;
            yield* email.send(
              siteInviteEmail({
                to: payload.email,
                siteName: site.business.name,
                siteId: params.id,
                webUrl: config.webUrl,
                inviterEmail: user.email,
              }),
            );
            return member;
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
            const user = yield* requireAdmin();
            const repo = yield* AdminRepository;
            const agency = yield* repo.invite(payload.email);
            const email = yield* EmailSender;
            yield* email.send(
              agencyInviteEmail({
                to: payload.email,
                webUrl: config.webUrl,
                inviterEmail: user.email,
              }),
            );
            return agency;
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

    const billingGroup = HttpApi.HttpApiBuilder.group(SiteApi, "Billing", (handlers) =>
      handlers
        .handle("status", () =>
          CurrentUser.use((user) =>
            Effect.gen(function* () {
              const repo = yield* BillingRepository;
              const stripe = yield* StripeBilling;
              const now = yield* nowIso;
              const row = yield* repo.ensure(user.id, now);
              return billingStatus(row, stripe.configured);
            }),
          ),
        )
        .handle("checkout", ({ payload }) =>
          CurrentUser.use((user) =>
            Effect.gen(function* () {
              yield* guardMutation(user.id);
              const repo = yield* BillingRepository;
              const stripe = yield* StripeBilling;
              const now = yield* nowIso;
              const row = yield* repo.ensure(user.id, now);
              const session = yield* stripe.createCheckoutSession({
                successUrl: payload.successUrl,
                customerEmail: user.email,
                customerId: row.stripeCustomerId,
                userId: user.id,
              });
              if (row.stripeCustomerId === null) {
                yield* repo.setStripeCustomer(user.id, session.stripeCustomerId, now);
              }
              return { url: session.url };
            }),
          ),
        )
        .handle("portal", ({ payload }) =>
          CurrentUser.use((user) =>
            Effect.gen(function* () {
              const repo = yield* BillingRepository;
              const stripe = yield* StripeBilling;
              const now = yield* nowIso;
              const row = yield* repo.ensure(user.id, now);
              if (row.stripeCustomerId === null) return yield* new BillingCustomerNotFound({});
              const session = yield* stripe.createPortalSession({
                customerId: row.stripeCustomerId,
                returnUrl: payload.returnUrl,
              });
              return { url: session.url };
            }),
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
        Layer.provide(billingGroup),
        Layer.provide([Http.Etag.layer, HttpPlatformStub, Path.layer]),
        Layer.provide(
          Http.HttpRouter.cors({
            allowedOrigins: trustedOrigins,
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
        Effect.provideService(BillingRepository, billingRepo),
        Effect.provideService(StripeBilling, stripeBilling),
        Effect.provideService(SiteStorage, siteStorage),
        Effect.provideService(LeadNotifier, leadNotifier),
        Effect.provideService(EmailSender, emailSender),
        Effect.provideService(LeadRateLimiter, leadRateLimiter),
        Effect.provideService(MutationRateLimiter, mutationRateLimiter),
        Effect.provideService(BuildJobSink, buildJobSink),
      );

    return {
      // The fetch is the HttpEffect value the worker invokes per request.
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        // SAFETY: The web adapter stores the incoming platform Request on HttpServerRequest.source.
        const nativeRequest = request.source as Request;
        const pathname = new URL(nativeRequest.url).pathname;

        // Better Auth handles everything under /api/auth (sign-in, callbacks,
        // session) with its own native fetch handler.
        if (pathname.startsWith(AUTH_PATH)) {
          const allowed = yield* authRateLimiter.limit(
            nativeRequest.headers.get("cf-connecting-ip") ?? "unknown",
          );
          if (!allowed) {
            return yield* HttpServerResponse.json({ error: "Too many requests" }, { status: 429 });
          }
          const response = yield* Effect.promise(() => auth.handler(nativeRequest));
          return HttpServerResponse.fromWeb(response);
        }

        // Stripe webhooks are signature-verified against the raw body, so they
        // bypass the typed router and session lookup.
        if (pathname === "/api/billing/webhook") {
          if (!stripeBilling.configured) {
            return yield* HttpServerResponse.json(
              { error: "Billing is not configured" },
              { status: 503 },
            );
          }
          const rawBody = yield* Effect.promise(() => nativeRequest.text());
          const signature = nativeRequest.headers.get("stripe-signature") ?? "";
          const verified = yield* Effect.result(stripeBilling.verifyWebhook(rawBody, signature));
          if (verified._tag === "Failure") {
            return yield* verified.failure._tag === "BillingNotConfigured"
              ? HttpServerResponse.json({ error: "Billing is not configured" }, { status: 503 })
              : HttpServerResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
          }
          const now = yield* nowIso;
          yield* handleStripeEvent(verified.success, billingRepo, now);
          return yield* HttpServerResponse.json({ received: true });
        }

        // Public contact-form submissions — no session required.
        if (pathname.startsWith("/api/leads")) {
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
