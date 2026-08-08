import * as Cloudflare from "alchemy/Cloudflare"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Http from "effect/unstable/http"
import * as HttpApi from "effect/unstable/httpapi"
import { HttpServerRequest } from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { SitesBucket } from "./site/bucket.ts"
import { Database } from "./site/database.ts"
import { SiteApi } from "./site/siteApi.ts"
import { makeSiteRepository } from "./site/SiteRepository.ts"
import { makeLeadRepository } from "./leads/LeadRepository.ts"
import {
  AUTH_PATH,
  CurrentUser,
  createAuth,
} from "./auth/auth.ts"

const HttpPlatformStub = Layer.succeed(Http.HttpPlatform.HttpPlatform, {
  platform: "web",
  compression: Http.HttpPlatform.makeCompressionWeb({
    algorithms: [],
    transform: (algorithm) => (stream) => stream,
  }),
  fileResponse: () => Effect.die("HttpPlatform.fileResponse not supported"),
  fileWebResponse: () => Effect.die("HttpPlatform.fileWebResponse not supported"),
})

export default Cloudflare.Worker(
  "api",
  { main: import.meta.url },
  Effect.gen(function* () {
    const db = yield* Cloudflare.D1.QueryDatabase(Database)
    const bucket = yield* Cloudflare.R2.ReadWriteBucket(SitesBucket)
    const env = yield* Cloudflare.WorkerEnvironment
    // Native D1 binding for Better Auth (alchemy's QueryDatabase client is a
    // wrapper; Better Auth wants the raw D1Database). Binding name matches the
    // resource's logical id ("Database").
    const rawDb = yield* Effect.sync(
      () => (env as Record<string, D1Database>)["Database"]!,
    )
    const repo = makeSiteRepository(db)
    const leads = makeLeadRepository(db)

    const config = yield* Effect.all({
      authSecret: Config.string("AUTH_SECRET").pipe(
        Config.withDefault("dev-only-secret-0123456789abcdef0123456789abcdef"),
      ),
      authBaseUrl: Config.string("AUTH_BASE_URL").pipe(
        Config.withDefault("http://localhost:8787"),
      ),
      trustedOrigins: Config.string("TRUSTED_ORIGINS").pipe(
        Config.withDefault("http://localhost:5173"),
      ),
      googleClientId: Config.string("GOOGLE_CLIENT_ID").pipe(
        Config.withDefault(""),
      ),
      googleClientSecret: Config.string("GOOGLE_CLIENT_SECRET").pipe(
        Config.withDefault(""),
      ),
    })
    const auth = createAuth(rawDb, {
      secret: config.authSecret,
      baseURL: config.authBaseUrl,
      trustedOrigins: config.trustedOrigins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      googleClientId: config.googleClientId,
      googleClientSecret: config.googleClientSecret,
    })

    const sitesGroup = HttpApi.HttpApiBuilder.group(
      SiteApi,
      "Sites",
      (handlers) =>
        handlers
          .handle("list", () => CurrentUser.use((user) => repo.list(user.id)))
          .handle("get", ({ params }) =>
            CurrentUser.use((user) => repo.get(params.id, user.id)),
          )
          .handle("create", ({ payload }) =>
            CurrentUser.use((user) => repo.create(payload, user.id)),
          )
          .handle("update", ({ params, payload }) =>
            CurrentUser.use((user) => repo.update(params.id, payload, user.id)),
          )
          .handle("remove", ({ params }) =>
            CurrentUser.use((user) => repo.remove(params.id, user.id)),
          )
          .handle("publish", ({ params }) =>
            Effect.gen(function* () {
              const user = yield* CurrentUser
              const site = yield* repo.get(params.id, user.id)
              const publishedAt = new Date().toISOString()
              // Store the site document as the buildable artifact. Static HTML
              // is generated from it by the Astro template pipeline
              // (packages/site-template) and uploaded to R2 under the same key.
              const path = `sites/${site.id}/site.json`
              yield* bucket.put(path, JSON.stringify(site, null, 2)).pipe(
                Effect.orDie,
              )
              yield* repo.markPublished(params.id, user.id, publishedAt)
              return { siteId: site.id, path, publishedAt }
            }),
          )
          .handle("setDomain", ({ params, payload }) =>
            CurrentUser.use((user) =>
              repo.setDomain(params.id, user.id, payload.domain),
            ),
          )
          .handle("verifyDomain", ({ params }) =>
            CurrentUser.use((user) => repo.verifyDomain(params.id, user.id)),
          )
          .handle("removeDomain", ({ params }) =>
            CurrentUser.use((user) => repo.removeDomain(params.id, user.id)),
          ),
    )

    const siteLeadsGroup = HttpApi.HttpApiBuilder.group(
      SiteApi,
      "SiteLeads",
      (handlers) =>
        handlers
          .handle("listLeads", ({ params }) =>
            CurrentUser.use((user) => leads.listForSite(params.id, user.id)),
          )
          .handle("deleteLead", ({ params }) =>
            CurrentUser.use((user) =>
              leads.remove(params.id, params.leadId, user.id),
            ),
          ),
    )

    // Public — visitor contact-form submissions (no session).
    const leadsPublicGroup = HttpApi.HttpApiBuilder.group(
      SiteApi,
      "LeadsPublic",
      (handlers) =>
        handlers.handle("submit", ({ payload }) => leads.create(payload)),
    )

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
    )

    const unauthorized = HttpServerResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
    // The router effect requires CurrentUser (private groups use it). Public
    // submissions never read it, so a guest identity keeps the type satisfied.
    const guestUser = { id: "guest", email: "" }

    return {
      // The fetch is the HttpEffect value the worker invokes per request.
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest
        const nativeRequest = request.source as unknown as Request

        // Better Auth handles everything under /api/auth (sign-in, callbacks,
        // session) with its own native fetch handler.
        if (new URL(nativeRequest.url).pathname.startsWith(AUTH_PATH)) {
          const response = yield* Effect.promise(() => auth.handler(nativeRequest))
          return HttpServerResponse.fromWeb(response)
        }

        // Public contact-form submissions — no session required.
        if (new URL(nativeRequest.url).pathname.startsWith("/api/leads")) {
          return yield* httpEffect.pipe(
            Effect.provideService(CurrentUser, guestUser),
          )
        }

        // Resolve the session and scope site queries to the owner.
        const session = yield* Effect.promise(() =>
          auth.api.getSession({ headers: nativeRequest.headers }),
        )
        if (!session) return yield* unauthorized

        return yield* httpEffect.pipe(
          Effect.provideService(CurrentUser, {
            id: session.user.id,
            email: session.user.email,
          }),
        )
      }),
    }
  }).pipe(
    Effect.provide(Cloudflare.D1.QueryDatabaseBinding),
    Effect.provide(Cloudflare.R2.ReadWriteBucketBinding),
  ),
)
