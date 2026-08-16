import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import type { RuntimeContext } from "alchemy";
import type { Requester, SiteAccess } from "../access/access.ts";

/**
 * SQL condition narrowing `sites` rows a requester may see: the owner or a
 * granted member; admins see everything. Used verbatim in repository queries.
 */
export const accessibleWhere = (requester: Requester): string =>
  requester.isAdmin
    ? "1 = 1"
    : "(owner_id = ? OR EXISTS (SELECT 1 FROM site_members WHERE site_members.site_id = sites.id AND site_members.user_id = ?))";

export const accessibleBinds = (requester: Requester): ReadonlyArray<string> =>
  requester.isAdmin ? [] : [requester.id, requester.id];

/**
 * Resolves a requester's access to a site. Returns `null` when the site does
 * not exist or the requester has no relationship to it.
 */
export const resolveSiteAccess = (
  db: Cloudflare.D1.QueryDatabaseClient,
  siteId: string,
  requester: Requester,
): Effect.Effect<SiteAccess | null, never, RuntimeContext> =>
  Effect.gen(function* () {
    const row = yield* db
      .prepare("SELECT owner_id FROM sites WHERE id = ?")
      .bind(siteId)
      .first<{ owner_id: string }>();
    if (row === null) return null;
    if (requester.isAdmin || row.owner_id === requester.id) return { kind: "full" };

    const member = yield* db
      .prepare(
        "SELECT can_edit, can_publish, can_leads FROM site_members WHERE site_id = ? AND user_id = ?",
      )
      .bind(siteId, requester.id)
      .first<{ can_edit: number; can_publish: number; can_leads: number }>();
    if (member === null) return null;

    return {
      kind: "client",
      canEdit: member.can_edit === 1,
      canPublish: member.can_publish === 1,
      canLeads: member.can_leads === 1,
    };
  });
