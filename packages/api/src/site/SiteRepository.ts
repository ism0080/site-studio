import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import {
  CreateSite,
  OwnerId,
  SiteId,
  DomainInUse,
  DomainNotVerified,
  DomainSetup,
  Site,
  SiteNotFound,
  decodeSite,
} from "./site.ts";
import { normalizeDomain } from "./keys.ts";
import { newVerificationToken, verifyTxtRecord } from "./dns.ts";

type Db = Cloudflare.D1.QueryDatabaseClient;

export interface SiteRepositoryShape {
  readonly list: (ownerId: string) => Effect.Effect<ReadonlyArray<Site>, never, RuntimeContext>;
  readonly get: (id: string, ownerId: string) => Effect.Effect<Site, SiteNotFound, RuntimeContext>;
  readonly create: (
    payload: CreateSite,
    ownerId: string,
  ) => Effect.Effect<Site, never, RuntimeContext>;
  readonly update: (
    id: string,
    site: Site,
    ownerId: string,
  ) => Effect.Effect<Site, SiteNotFound, RuntimeContext>;
  readonly remove: (
    id: string,
    ownerId: string,
  ) => Effect.Effect<void, SiteNotFound, RuntimeContext>;
  readonly markPublished: (
    id: string,
    ownerId: string,
    publishedAt: string,
  ) => Effect.Effect<Site, SiteNotFound, RuntimeContext>;
  readonly setDomain: (
    id: string,
    ownerId: string,
    domain: string,
  ) => Effect.Effect<DomainSetup, SiteNotFound | DomainInUse, RuntimeContext>;
  readonly verifyDomain: (
    id: string,
    ownerId: string,
  ) => Effect.Effect<Site, SiteNotFound | DomainNotVerified, RuntimeContext>;
  readonly removeDomain: (
    id: string,
    ownerId: string,
  ) => Effect.Effect<Site, SiteNotFound, RuntimeContext>;
}

const parse = (document: string) => decodeSite(JSON.parse(document)).pipe(Effect.orDie);

// The `document` column is TEXT; encode the schema then serialize to JSON.
const serialize = (site: Site) => JSON.stringify(site);

export const makeSiteRepository = (
  db: Db,
  deps: { verifyTxt?: typeof verifyTxtRecord } = {},
): SiteRepositoryShape => {
  const checkTxt = deps.verifyTxt ?? verifyTxtRecord;
  return {
    list: Effect.fn("SiteRepository.list")(function* (ownerId: string) {
      return yield* db
        .prepare("SELECT document FROM sites WHERE owner_id = ? ORDER BY updated_at DESC")
        .bind(ownerId)
        .all<{ document: string }>()
        .pipe(
          Effect.map((result) => result.results.map((row) => row.document)),
          Effect.flatMap((documents) => Effect.all(documents.map(parse))),
        );
    }),
    get: Effect.fn("SiteRepository.get")(function* (id: string, ownerId: string) {
      const row = yield* db
        .prepare("SELECT document FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .first<{ document: string }>();
      if (row === null) return yield* new SiteNotFound({ id });
      return yield* parse(row.document);
    }),
    create: Effect.fn("SiteRepository.create")(function* (payload: CreateSite, ownerId: string) {
      const now = new Date().toISOString();
      const site: Site = {
        id: SiteId.make(crypto.randomUUID()),
        ownerId: OwnerId.make(ownerId),
        templateId: payload.templateId,
        status: "draft",
        business: {
          name: payload.name,
          category: "",
          location: "",
          email: "",
          phone: "",
          logo: payload.name.slice(0, 6).toUpperCase(),
        },
        settings: {
          accent: "#e56645",
          font: "Manrope",
          showDirectory: true,
          analytics: undefined,
        },
        pages: [
          {
            id: crypto.randomUUID(),
            slug: "/",
            title: "Homepage",
            sections: [],
          },
        ],
        createdAt: now,
        updatedAt: now,
        publishedAt: undefined,
      };
      return yield* db
        .prepare(
          "INSERT INTO sites (id, owner_id, template_id, status, document, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          site.id,
          site.ownerId,
          site.templateId,
          site.status,
          serialize(site),
          site.createdAt,
          site.updatedAt,
        )
        .run()
        .pipe(Effect.as(site));
    }),
    update: Effect.fn("SiteRepository.update")(function* (id: string, site: Site, ownerId: string) {
      const existing = yield* db
        .prepare("SELECT id FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .first<{ id: string }>();
      if (existing === null) return yield* new SiteNotFound({ id });
      const updated = {
        ...site,
        id: SiteId.make(id),
        ownerId: OwnerId.make(ownerId),
        updatedAt: new Date().toISOString(),
      };
      yield* db
        .prepare(
          "UPDATE sites SET template_id = ?, status = ?, document = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
        )
        .bind(
          updated.templateId,
          updated.status,
          serialize(updated),
          updated.updatedAt,
          id,
          ownerId,
        )
        .run();
      return updated;
    }),
    remove: Effect.fn("SiteRepository.remove")(function* (id: string, ownerId: string) {
      const result = yield* db
        .prepare("DELETE FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .run();
      if (result.meta.changes === 0) return yield* new SiteNotFound({ id });
    }),
    markPublished: Effect.fn("SiteRepository.markPublished")(function* (
      id: string,
      ownerId: string,
      publishedAt: string,
    ) {
      const row = yield* db
        .prepare("SELECT document FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .first<{ document: string }>();
      if (row === null) return yield* new SiteNotFound({ id });
      const current = yield* parse(row.document);
      const updated = {
        ...current,
        status: "published" as const,
        publishedAt,
        updatedAt: publishedAt,
      };
      yield* db
        .prepare(
          "UPDATE sites SET status = ?, document = ?, updated_at = ?, published_at = ? WHERE id = ? AND owner_id = ?",
        )
        .bind(
          updated.status,
          serialize(updated),
          updated.updatedAt,
          updated.publishedAt,
          id,
          ownerId,
        )
        .run();
      return updated;
    }),
    setDomain: Effect.fn("SiteRepository.setDomain")(function* (
      id: string,
      ownerId: string,
      inputDomain: string,
    ) {
      const site = yield* db
        .prepare("SELECT document FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .first<{ document: string }>();
      if (site === null) return yield* new SiteNotFound({ id });
      const current = yield* parse(site.document);

      const domain = normalizeDomain(inputDomain);
      if (!domain) return yield* new SiteNotFound({ id });

      const existing = yield* db
        .prepare("SELECT site_id FROM site_domains WHERE domain = ?")
        .bind(domain)
        .first<{ site_id: string }>();
      if (existing !== null) return yield* new DomainInUse({ domain });

      const token = newVerificationToken();
      const now = new Date().toISOString();
      yield* db
        .prepare(
          "INSERT OR IGNORE INTO site_domains (domain, site_id, verification_token, verified, created_at) VALUES (?, ?, ?, 0, ?)",
        )
        .bind(domain, id, token, now)
        .run();

      return {
        domain,
        status: "pending" as const,
        txtName: "_site-studio-verify." + domain,
        txtValue: token,
        site: current,
      };
    }),
    verifyDomain: Effect.fn("SiteRepository.verifyDomain")(function* (id: string, ownerId: string) {
      const site = yield* db
        .prepare("SELECT document FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .first<{ document: string }>();
      if (site === null) return yield* new SiteNotFound({ id });
      const current = yield* parse(site.document);

      const pending = yield* db
        .prepare(
          "SELECT domain, verification_token FROM site_domains WHERE site_id = ? AND verified = 0 LIMIT 1",
        )
        .bind(id)
        .first<{ domain: string; verification_token: string }>();
      if (pending === null) return yield* new SiteNotFound({ id });

      const verified = yield* Effect.tryPromise(() =>
        checkTxt(pending.domain, pending.verification_token),
      ).pipe(Effect.catch(() => Effect.succeed(false)));
      if (!verified) {
        return yield* new DomainNotVerified({ domain: pending.domain });
      }

      const now = new Date().toISOString();
      const twin = pending.domain.startsWith("www.")
        ? pending.domain.slice(4)
        : "www." + pending.domain;
      yield* db.prepare("UPDATE site_domains SET verified = 1 WHERE site_id = ?").bind(id).run();
      yield* db
        .prepare(
          "INSERT OR IGNORE INTO site_domains (domain, site_id, verification_token, verified, created_at) VALUES (?, ?, ?, 1, ?)",
        )
        .bind(twin, id, pending.verification_token, now)
        .run();

      const updated = { ...current, customDomain: pending.domain, updatedAt: now };
      yield* db
        .prepare(
          "UPDATE sites SET document = ?, custom_domain = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
        )
        .bind(serialize(updated), pending.domain, now, id, ownerId)
        .run();
      return updated;
    }),
    removeDomain: Effect.fn("SiteRepository.removeDomain")(function* (id: string, ownerId: string) {
      const site = yield* db
        .prepare("SELECT document FROM sites WHERE id = ? AND owner_id = ?")
        .bind(id, ownerId)
        .first<{ document: string }>();
      if (site === null) return yield* new SiteNotFound({ id });
      const current = yield* parse(site.document);

      const now = new Date().toISOString();
      yield* db.prepare("DELETE FROM site_domains WHERE site_id = ?").bind(id).run();
      const updated = { ...current, customDomain: undefined, updatedAt: now };
      yield* db
        .prepare(
          "UPDATE sites SET document = ?, custom_domain = NULL, updated_at = ? WHERE id = ? AND owner_id = ?",
        )
        .bind(serialize(updated), now, id, ownerId)
        .run();
      return updated;
    }),
  };
};
export class SiteRepository extends Context.Service<SiteRepository, SiteRepositoryShape>()(
  "@app/SiteRepository",
) {}

export const SiteRepositoryLayer = (db: Db) =>
  Layer.effect(
    SiteRepository,
    Effect.sync(() => makeSiteRepository(db)),
  );
