import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import {
  CreateSite,
  CloudflareSaasError,
  OwnerId,
  SiteId,
  DomainInUse,
  DomainUnsupported,
  DomainNotVerified,
  DomainSetup,
  Forbidden,
  Site,
  SiteNotFound,
  SubdomainInUse,
  decodeSiteJson,
  encodeSiteJson,
  type BuildStatus,
} from "./site.ts";
import { accessibleBinds, accessibleWhere, resolveSiteAccess } from "./siteAccess.ts";
import type { Requester, SiteAccess } from "../access/access.ts";
import { normalizeDomain } from "./objectKeys.ts";
import { newVerificationToken, verifyTxtRecord } from "./dns.ts";
import type { CloudflareSaas } from "./cloudflareSaas.ts";
import { nowIso } from "../platform/Time.ts";
import { withDefaultSections } from "./templateDefaults.ts";

const _normalizeSubdomain = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

type Db = Cloudflare.D1.QueryDatabaseClient;

export interface SiteRepositoryService {
  readonly list: (
    requester: Requester,
  ) => Effect.Effect<ReadonlyArray<Site>, never, RuntimeContext>;
  readonly get: (
    id: string,
    requester: Requester,
  ) => Effect.Effect<Site, SiteNotFound, RuntimeContext>;
  readonly getDomainSetup: (
    id: string,
    requester: Requester,
  ) => Effect.Effect<
    DomainSetup | null,
    SiteNotFound | Forbidden | CloudflareSaasError,
    RuntimeContext
  >;
  readonly access: (
    id: string,
    requester: Requester,
  ) => Effect.Effect<SiteAccess | null, never, RuntimeContext>;
  readonly create: (
    payload: CreateSite,
    requester: Requester,
  ) => Effect.Effect<Site, SubdomainInUse, RuntimeContext | Crypto.Crypto>;
  readonly update: (
    id: string,
    site: Site,
    requester: Requester,
  ) => Effect.Effect<Site, SiteNotFound | Forbidden | SubdomainInUse, RuntimeContext>;
  readonly remove: (
    id: string,
    requester: Requester,
  ) => Effect.Effect<void, SiteNotFound | Forbidden, RuntimeContext>;
  readonly markPublished: (
    id: string,
    requester: Requester,
    publishedAt: string,
  ) => Effect.Effect<Site, SiteNotFound | Forbidden, RuntimeContext>;
  readonly markBuildResult: (
    id: string,
    ownerId: string,
    buildStatus: BuildStatus,
    builtAt: string,
    error?: string,
  ) => Effect.Effect<Site, SiteNotFound, RuntimeContext>;
  readonly setDomain: (
    id: string,
    requester: Requester,
    domain: string,
  ) => Effect.Effect<
    DomainSetup,
    SiteNotFound | Forbidden | DomainInUse | DomainUnsupported | CloudflareSaasError,
    RuntimeContext | Crypto.Crypto
  >;
  readonly verifyDomain: (
    id: string,
    requester: Requester,
  ) => Effect.Effect<
    Site,
    SiteNotFound | Forbidden | DomainNotVerified | CloudflareSaasError,
    RuntimeContext
  >;
  readonly removeDomain: (
    id: string,
    requester: Requester,
  ) => Effect.Effect<Site, SiteNotFound | Forbidden | CloudflareSaasError, RuntimeContext>;
}

// Normalizes documents that predate `buildStatus` (or lack it) to a concrete
// value so the domain never sees an undefined build state.
const _parseSiteDocument = (document: string) =>
  decodeSiteJson(document).pipe(
    Effect.map((site) => new Site({ ...site, buildStatus: site.buildStatus ?? "idle" })),
    Effect.orDie,
  );

const _domainSetup = (
  domain: string,
  site: Site,
  hostname: Awaited<ReturnType<CloudflareSaas["get"]>>,
  cnameTarget: string,
): DomainSetup => ({
  domain,
  status: "pending",
  cnameTarget,
  records: [
    ...(hostname.ownership_verification
      ? [
          {
            name: hostname.ownership_verification.name,
            value: hostname.ownership_verification.value,
          },
        ]
      : []),
    ...(hostname.ssl?.validation_records ?? []).flatMap((record) =>
      record.txt_name && record.txt_value
        ? [{ name: record.txt_name, value: record.txt_value }]
        : [],
    ),
  ],
  site,
});

export const makeSiteRepository = (
  db: Db,
  deps: {
    cloudflareSaas?: CloudflareSaas;
    cnameTarget?: string;
    verifyTxt?: typeof verifyTxtRecord;
  } = {},
): SiteRepositoryService => {
  const cloudflareSaas = deps.cloudflareSaas;
  const cnameTarget = deps.cnameTarget ?? "customers.site-studio.dev";
  const providerError = (cause: unknown) =>
    cause instanceof CloudflareSaasError
      ? cause
      : new CloudflareSaasError({ message: "Cloudflare custom hostname request failed" });
  return {
    list: Effect.fn("SiteRepository.list")(function* (requester: Requester) {
      return yield* db
        .prepare(
          `SELECT document FROM sites WHERE ${accessibleWhere(requester)} ORDER BY updated_at DESC`,
        )
        .bind(...accessibleBinds(requester))
        .all<{ document: string }>()
        .pipe(
          Effect.map((result) => result.results.map((row) => row.document)),
          Effect.flatMap((documents) => Effect.all(documents.map(_parseSiteDocument))),
        );
    }),
    get: Effect.fn("SiteRepository.get")(function* (id: string, requester: Requester) {
      const row = yield* db
        .prepare(`SELECT document FROM sites WHERE id = ? AND ${accessibleWhere(requester)}`)
        .bind(id, ...accessibleBinds(requester))
        .first<{ document: string }>();
      if (row === null) return yield* new SiteNotFound({ id });
      const parsed = yield* _parseSiteDocument(row.document);
      return withDefaultSections(parsed);
    }),
    getDomainSetup: Effect.fn("SiteRepository.getDomainSetup")(function* (
      id: string,
      requester: Requester,
    ) {
      const access = yield* resolveSiteAccess(db, id, requester);
      if (access === null) return yield* new SiteNotFound({ id });
      if (access.kind === "client") return yield* new Forbidden({});
      if (cloudflareSaas === undefined) return null;

      const site = yield* db
        .prepare("SELECT document FROM sites WHERE id = ?")
        .bind(id)
        .first<{ document: string }>();
      if (site === null) return yield* new SiteNotFound({ id });
      const current = yield* _parseSiteDocument(site.document);
      const pending = yield* db
        .prepare(
          "SELECT domain, provider_id FROM site_domains WHERE site_id = ? AND verified = 0 LIMIT 1",
        )
        .bind(id)
        .first<{ domain: string; provider_id: string | null }>();
      if (pending === null || pending.provider_id === null) return null;

      const providerId = pending.provider_id;
      const hostname = yield* Effect.tryPromise({
        try: () => cloudflareSaas.get(providerId),
        catch: providerError,
      });
      return _domainSetup(pending.domain, current, hostname, cnameTarget);
    }),
    access: Effect.fn("SiteRepository.access")(function* (id: string, requester: Requester) {
      return yield* resolveSiteAccess(db, id, requester);
    }),
    create: Effect.fn("SiteRepository.create")(function* (
      payload: CreateSite,
      requester: Requester,
    ) {
      const now = yield* nowIso;
      const crypto = yield* Crypto.Crypto;
      const business = payload.business ?? {
        name: payload.name,
        category: "",
        location: "",
        email: "",
        phone: "",
        logo: "",
      };
      const subdomain = _normalizeSubdomain(payload.subdomain ?? payload.name);
      const site = new Site({
        id: SiteId.make(yield* crypto.randomUUIDv4.pipe(Effect.orDie)),
        ownerId: OwnerId.make(requester.id),
        templateId: payload.templateId,
        subdomain,
        status: "draft",
        business: {
          ...business,
          name: payload.name,
          logo: business.logo || payload.name.slice(0, 6).toUpperCase(),
        },
        settings: {
          accent: "#e56645",
          font: "Manrope",
          showDirectory: true,
        },
        buildStatus: "idle",
        pages: [
          {
            id: yield* crypto.randomUUIDv4.pipe(Effect.orDie),
            slug: "/",
            title: "Homepage",
            sections: [],
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
      return yield* db
        .prepare(
          "INSERT INTO sites (id, owner_id, template_id, status, document, created_at, updated_at, subdomain) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          site.id,
          site.ownerId,
          site.templateId,
          site.status,
          encodeSiteJson(site),
          site.createdAt,
          site.updatedAt,
          site.subdomain ?? null,
        )
        .run()
        .pipe(
          Effect.catch((cause) =>
            String(cause).toUpperCase().includes("UNIQUE")
              ? Effect.fail(new SubdomainInUse({ subdomain }))
              : Effect.die(cause),
          ),
        )
        .pipe(Effect.as(withDefaultSections(site)));
    }),
    update: Effect.fn("SiteRepository.update")(function* (
      id: string,
      site: Site,
      requester: Requester,
    ) {
      const row = yield* db
        .prepare("SELECT document FROM sites WHERE id = ?")
        .bind(id)
        .first<{ document: string }>();
      if (row === null) return yield* new SiteNotFound({ id });
      const current = yield* _parseSiteDocument(row.document);

      const access = yield* resolveSiteAccess(db, id, requester);
      if (access === null) return yield* new SiteNotFound({ id });

      let updated: Site;
      if (access.kind === "full") {
        updated = new Site({
          ...site,
          subdomain: site.subdomain ? _normalizeSubdomain(site.subdomain) : undefined,
          id: SiteId.make(id),
          ownerId: current.ownerId,
          updatedAt: yield* nowIso,
        });
      } else if (!access.canEdit) {
        return yield* new Forbidden({});
      } else {
        // A client editor's update must not reach manager-only fields
        // (publish state, domain, build metadata, analytics) — those come
        // from the current document.
        updated = new Site({
          ...site,
          subdomain: site.subdomain ? _normalizeSubdomain(site.subdomain) : undefined,
          id: current.id,
          ownerId: current.ownerId,
          status: current.status,
          publishedAt: current.publishedAt,
          customDomain: current.customDomain,
          buildStatus: current.buildStatus,
          lastBuiltAt: current.lastBuiltAt,
          buildError: current.buildError,
          settings: { ...site.settings, analytics: current.settings.analytics },
        });
      }

      yield* db
        .prepare(
          `UPDATE sites SET template_id = ?, status = ?, document = ?, updated_at = ?, subdomain = ? WHERE id = ? AND ${accessibleWhere(requester)}`,
        )
        .bind(
          updated.templateId,
          updated.status,
          encodeSiteJson(updated),
          updated.updatedAt,
          updated.subdomain ?? null,
          id,
          ...accessibleBinds(requester),
        )
        .run()
        .pipe(
          Effect.catch((cause) =>
            String(cause).toUpperCase().includes("UNIQUE")
              ? Effect.fail(new SubdomainInUse({ subdomain: updated.subdomain ?? "" }))
              : Effect.die(cause),
          ),
        );
      return updated;
    }),
    remove: Effect.fn("SiteRepository.remove")(function* (id: string, requester: Requester) {
      const access = yield* resolveSiteAccess(db, id, requester);
      if (access === null) return yield* new SiteNotFound({ id });
      if (access.kind === "client") return yield* new Forbidden({});
      const result = yield* db
        .prepare(`DELETE FROM sites WHERE id = ? AND ${accessibleWhere(requester)}`)
        .bind(id, ...accessibleBinds(requester))
        .run();
      if (result.meta.changes === 0) return yield* new SiteNotFound({ id });
    }),
    markPublished: Effect.fn("SiteRepository.markPublished")(function* (
      id: string,
      requester: Requester,
      publishedAt: string,
    ) {
      const access = yield* resolveSiteAccess(db, id, requester);
      if (access === null) return yield* new SiteNotFound({ id });
      if (access.kind === "client" && !access.canPublish) return yield* new Forbidden({});

      const row = yield* db
        .prepare("SELECT document FROM sites WHERE id = ?")
        .bind(id)
        .first<{ document: string }>();
      if (row === null) return yield* new SiteNotFound({ id });
      const current = yield* _parseSiteDocument(row.document);
      const updated = new Site({
        ...current,
        status: "published",
        publishedAt,
        buildStatus: "building",
        updatedAt: publishedAt,
      });
      yield* db
        .prepare(
          `UPDATE sites SET status = ?, document = ?, updated_at = ?, published_at = ? WHERE id = ? AND ${accessibleWhere(requester)}`,
        )
        .bind(
          updated.status,
          encodeSiteJson(updated),
          updated.updatedAt,
          updated.publishedAt,
          id,
          ...accessibleBinds(requester),
        )
        .run();
      return updated;
    }),
    markBuildResult: Effect.fn("SiteRepository.markBuildResult")(function* (
      id: string,
      ownerId: string,
      buildStatus: BuildStatus,
      builtAt: string,
      error?: string,
    ) {
      const row = yield* db
        .prepare("SELECT document FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .first<{ document: string }>();
      if (row === null) return yield* new SiteNotFound({ id });
      const current = yield* _parseSiteDocument(row.document);
      const updated = new Site({
        ...current,
        buildStatus,
        updatedAt: builtAt,
        lastBuiltAt: buildStatus === "built" ? builtAt : undefined,
        buildError: buildStatus === "failed" ? error : undefined,
      });
      yield* db
        .prepare("UPDATE sites SET document = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
        .bind(encodeSiteJson(updated), builtAt, id, ownerId)
        .run();
      return updated;
    }),
    setDomain: Effect.fn("SiteRepository.setDomain")(function* (
      id: string,
      requester: Requester,
      inputDomain: string,
    ) {
      const access = yield* resolveSiteAccess(db, id, requester);
      if (access === null) return yield* new SiteNotFound({ id });
      if (access.kind === "client") return yield* new Forbidden({});

      const site = yield* db
        .prepare("SELECT document FROM sites WHERE id = ?")
        .bind(id)
        .first<{ document: string }>();
      if (site === null) return yield* new SiteNotFound({ id });
      const current = yield* _parseSiteDocument(site.document);

      const domain = normalizeDomain(inputDomain);
      if (!domain) return yield* new SiteNotFound({ id });
      if (domain.split(".").length < 3) return yield* new DomainUnsupported({ domain });

      const existing = yield* db
        .prepare("SELECT site_id FROM site_domains WHERE domain = ?")
        .bind(domain)
        .first<{ site_id: string }>();
      if (existing !== null) return yield* new DomainInUse({ domain });

      if (cloudflareSaas === undefined)
        return yield* new CloudflareSaasError({ message: "Cloudflare SaaS is not configured" });
      const token = yield* newVerificationToken;
      const hostname = yield* Effect.tryPromise({
        try: () => cloudflareSaas.create(domain),
        catch: providerError,
      });
      const now = yield* nowIso;
      yield* db
        .prepare(
          "INSERT OR IGNORE INTO site_domains (domain, site_id, verification_token, verified, created_at, provider_id) VALUES (?, ?, ?, 0, ?, ?)",
        )
        .bind(domain, id, token, now, hostname.id)
        .run();

      return _domainSetup(domain, current, hostname, cnameTarget);
    }),
    verifyDomain: Effect.fn("SiteRepository.verifyDomain")(function* (
      id: string,
      requester: Requester,
    ) {
      const access = yield* resolveSiteAccess(db, id, requester);
      if (access === null) return yield* new SiteNotFound({ id });
      if (access.kind === "client") return yield* new Forbidden({});

      const site = yield* db
        .prepare("SELECT document FROM sites WHERE id = ?")
        .bind(id)
        .first<{ document: string }>();
      if (site === null) return yield* new SiteNotFound({ id });
      const current = yield* _parseSiteDocument(site.document);

      const pending = yield* db
        .prepare(
          "SELECT domain, provider_id FROM site_domains WHERE site_id = ? AND verified = 0 LIMIT 1",
        )
        .bind(id)
        .first<{ domain: string; provider_id: string | null }>();
      if (pending === null) return yield* new SiteNotFound({ id });
      if (cloudflareSaas === undefined || pending.provider_id === null) {
        return yield* new CloudflareSaasError({ message: "Cloudflare SaaS is not configured" });
      }
      const providerId = pending.provider_id;
      const hostname = yield* Effect.tryPromise({
        try: () => cloudflareSaas.get(providerId),
        catch: providerError,
      });
      if (hostname.status !== "active" || hostname.ssl?.status !== "active") {
        return yield* new DomainNotVerified({ domain: pending.domain });
      }

      const now = yield* nowIso;
      yield* db.prepare("UPDATE site_domains SET verified = 1 WHERE site_id = ?").bind(id).run();

      const updated = new Site({ ...current, customDomain: pending.domain, updatedAt: now });
      yield* db
        .prepare(
          "UPDATE sites SET document = ?, custom_domain = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
        )
        .bind(encodeSiteJson(updated), pending.domain, now, id, requester.id)
        .run();
      return updated;
    }),
    removeDomain: Effect.fn("SiteRepository.removeDomain")(function* (
      id: string,
      requester: Requester,
    ) {
      const access = yield* resolveSiteAccess(db, id, requester);
      if (access === null) return yield* new SiteNotFound({ id });
      if (access.kind === "client") return yield* new Forbidden({});

      const site = yield* db
        .prepare("SELECT document FROM sites WHERE id = ?")
        .bind(id)
        .first<{ document: string }>();
      if (site === null) return yield* new SiteNotFound({ id });
      const current = yield* _parseSiteDocument(site.document);

      const domainRows = yield* db
        .prepare("SELECT provider_id FROM site_domains WHERE site_id = ?")
        .bind(id)
        .all<{ provider_id: string | null }>();
      if (cloudflareSaas !== undefined) {
        for (const row of domainRows.results) {
          if (row.provider_id !== null) {
            const providerId = row.provider_id;
            yield* Effect.tryPromise({
              try: () => cloudflareSaas.remove(providerId),
              catch: providerError,
            });
          }
        }
      }
      const now = yield* nowIso;
      yield* db.prepare("DELETE FROM site_domains WHERE site_id = ?").bind(id).run();
      const updated = new Site({ ...current, customDomain: undefined, updatedAt: now });
      yield* db
        .prepare(
          "UPDATE sites SET document = ?, custom_domain = NULL, updated_at = ? WHERE id = ? AND owner_id = ?",
        )
        .bind(encodeSiteJson(updated), now, id, requester.id)
        .run();
      return updated;
    }),
  };
};
export class SiteRepository extends Context.Service<SiteRepository, SiteRepositoryService>()(
  "@app/SiteRepository",
) {}

export const SiteRepositoryLayer = (db: Db, deps: Parameters<typeof makeSiteRepository>[1] = {}) =>
  Layer.effect(
    SiteRepository,
    Effect.sync(() => makeSiteRepository(db, deps)),
  );
