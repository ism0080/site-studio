import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import { Lead, LeadInput, LeadId, LeadNotFound } from "./leads.ts";
import { Forbidden, SiteId, SiteNotFound, decodeSiteJson } from "../site/site.ts";
import { resolveSiteAccess } from "../site/access.ts";
import type { Requester } from "../access/access.ts";
import { nowIso } from "../platform/Time.ts";

type Db = Cloudflare.D1.QueryDatabaseClient;

export interface LeadRepositoryService {
  readonly create: (
    input: LeadInput,
  ) => Effect.Effect<Lead, SiteNotFound, RuntimeContext | Crypto.Crypto>;
  readonly listForSite: (
    siteId: string,
    requester: Requester,
  ) => Effect.Effect<ReadonlyArray<Lead>, SiteNotFound | Forbidden, RuntimeContext>;
  readonly remove: (
    siteId: string,
    leadId: string,
    requester: Requester,
  ) => Effect.Effect<void, SiteNotFound | Forbidden | LeadNotFound, RuntimeContext>;
  readonly siteContact: (
    siteId: string,
  ) => Effect.Effect<{ name: string; email: string } | null, never, RuntimeContext>;
}

// Leads are only readable by managers or clients granted `canLeads`.
const _requireLeads = (db: Db, siteId: string, requester: Requester) =>
  Effect.gen(function* () {
    const access = yield* resolveSiteAccess(db, siteId, requester);
    if (access === null) return yield* new SiteNotFound({ id: siteId });
    if (access.kind === "client" && !access.canLeads) return yield* new Forbidden({});
  });

export const makeLeadRepository = (db: Db): LeadRepositoryService => ({
  create: Effect.fn("LeadRepository.create")(function* (input: LeadInput) {
    const site = yield* db
      .prepare("SELECT id FROM sites WHERE id = ?")
      .bind(input.siteId)
      .first<{ id: string }>();
    if (site === null) return yield* new SiteNotFound({ id: input.siteId });
    const crypto = yield* Crypto.Crypto;
    const lead: Lead = {
      id: LeadId.make(yield* crypto.randomUUIDv4.pipe(Effect.orDie)),
      siteId: input.siteId,
      name: input.name,
      email: input.email,
      message: input.message,
      createdAt: yield* nowIso,
    };
    yield* db
      .prepare(
        "INSERT INTO leads (id, site_id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(lead.id, lead.siteId, lead.name, lead.email, lead.message ?? null, lead.createdAt)
      .run();
    return lead;
  }),
  listForSite: Effect.fn("LeadRepository.listForSite")(function* (
    siteId: string,
    requester: Requester,
  ) {
    yield* _requireLeads(db, siteId, requester);
    const rows = yield* db
      .prepare("SELECT * FROM leads WHERE site_id = ? ORDER BY created_at DESC")
      .bind(siteId)
      .all<{
        id: string;
        site_id: string;
        name: string;
        email: string;
        message: string | null;
        created_at: string;
      }>();
    return rows.results.map((row) => ({
      id: LeadId.make(row.id),
      siteId: SiteId.make(row.site_id),
      name: row.name,
      email: row.email,
      message: row.message ?? undefined,
      createdAt: row.created_at,
    }));
  }),
  remove: Effect.fn("LeadRepository.remove")(function* (
    siteId: string,
    leadId: string,
    requester: Requester,
  ) {
    yield* _requireLeads(db, siteId, requester);
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
    const site = yield* decodeSiteJson(row.document).pipe(Effect.catch(() => Effect.succeed(null)));
    if (site === null) return null;
    return { name: site.business.name, email: site.business.email };
  }),
});

export class LeadRepository extends Context.Service<LeadRepository, LeadRepositoryService>()(
  "@app/LeadRepository",
) {}

export const LeadRepositoryLayer = (db: Db) =>
  Layer.effect(
    LeadRepository,
    Effect.sync(() => makeLeadRepository(db)),
  );
