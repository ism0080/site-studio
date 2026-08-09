import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import { Lead, LeadInput, LeadId, LeadNotFound } from "./leads.ts";
import { SiteId, SiteNotFound, decodeSite } from "../site/site.ts";

type Db = Cloudflare.D1.QueryDatabaseClient;

interface LeadRow {
  id: string;
  site_id: string;
  name: string;
  email: string;
  message: string | null;
  created_at: string;
}

const parse = (row: LeadRow): Lead => ({
  id: LeadId.make(row.id),
  siteId: SiteId.make(row.site_id),
  name: row.name,
  email: row.email,
  message: row.message ?? undefined,
  createdAt: row.created_at,
});

export interface LeadRepositoryShape {
  readonly create: (input: LeadInput) => Effect.Effect<Lead, SiteNotFound, RuntimeContext>;
  readonly listForSite: (
    siteId: string,
    ownerId: string,
  ) => Effect.Effect<ReadonlyArray<Lead>, SiteNotFound, RuntimeContext>;
  readonly remove: (
    siteId: string,
    leadId: string,
    ownerId: string,
  ) => Effect.Effect<void, SiteNotFound | LeadNotFound, RuntimeContext>;
  readonly siteContact: (
    siteId: string,
  ) => Effect.Effect<{ name: string; email: string } | null, never, RuntimeContext>;
}

const siteExists = (db: Db, siteId: string, ownerId?: string) =>
  ownerId
    ? db
        .prepare("SELECT id FROM sites WHERE id = ? AND owner_id = ?")
        .bind(siteId, ownerId)
        .first<{ id: string }>()
    : db.prepare("SELECT id FROM sites WHERE id = ?").bind(siteId).first<{ id: string }>();

export const makeLeadRepository = (db: Db): LeadRepositoryShape => ({
  create: Effect.fn("LeadRepository.create")(function* (input: LeadInput) {
    const site = yield* siteExists(db, input.siteId);
    if (site === null) return yield* new SiteNotFound({ id: input.siteId });
    const lead: Lead = {
      id: LeadId.make(crypto.randomUUID()),
      siteId: input.siteId,
      name: input.name,
      email: input.email,
      message: input.message,
      createdAt: new Date().toISOString(),
    };
    yield* db
      .prepare(
        "INSERT INTO leads (id, site_id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(lead.id, lead.siteId, lead.name, lead.email, lead.message ?? null, lead.createdAt)
      .run();
    return lead;
  }),
  listForSite: Effect.fn("LeadRepository.listForSite")(function* (siteId: string, ownerId: string) {
    const site = yield* siteExists(db, siteId, ownerId);
    if (site === null) return yield* new SiteNotFound({ id: siteId });
    const rows = yield* db
      .prepare("SELECT * FROM leads WHERE site_id = ? ORDER BY created_at DESC")
      .bind(siteId)
      .all<LeadRow>();
    return rows.results.map(parse);
  }),
  remove: Effect.fn("LeadRepository.remove")(function* (
    siteId: string,
    leadId: string,
    ownerId: string,
  ) {
    const site = yield* siteExists(db, siteId, ownerId);
    if (site === null) return yield* new SiteNotFound({ id: siteId });
    const result = yield* db
      .prepare("DELETE FROM leads WHERE id = ? AND site_id = ?")
      .bind(leadId, siteId)
      .run();
    if (result.meta.changes === 0) return yield* new LeadNotFound({});
  }),
  siteContact: Effect.fn("LeadRepository.siteContact")(function* (siteId: string) {
    const row = yield* db
      .prepare("SELECT document FROM sites WHERE id = ?")
      .bind(siteId)
      .first<{ document: string }>();
    if (row === null) return null;
    const site = yield* decodeSite(JSON.parse(row.document)).pipe(
      Effect.catch(() => Effect.succeed(null)),
    );
    if (site === null) return null;
    return { name: site.business.name, email: site.business.email };
  }),
});

export class LeadRepository extends Context.Service<LeadRepository, LeadRepositoryShape>()(
  "@app/LeadRepository",
) {}

export const LeadRepositoryLayer = (db: Db) =>
  Layer.effect(
    LeadRepository,
    Effect.sync(() => makeLeadRepository(db)),
  );
