import * as Schema from "effect/Schema";

/**
 * Global account roles. Admins are the platform operator (from the
 * `ADMIN_EMAILS` env var) with full access everywhere; agencies manage client
 * sites and may invite clients; clients self-manage their own site but can
 * never invite anyone.
 */
export const GlobalRole = Schema.Literals(["admin", "agency", "client"]);
export type GlobalRole = (typeof GlobalRole)["Type"];

/**
 * What a requester may do on a given site. `full` is manager powers (the site
 * owner or a platform admin); `client` is a granted membership with explicit
 * toggles on top of read access.
 */
export const SiteAccess = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("full") }),
  Schema.Struct({
    kind: Schema.Literal("client"),
    canEdit: Schema.Boolean,
    canPublish: Schema.Boolean,
    canLeads: Schema.Boolean,
  }),
]);
export type SiteAccess = (typeof SiteAccess)["Type"];

/** A request-time actor for repository operations. */
export interface Requester {
  readonly id: string;
  readonly isAdmin: boolean;
}

export const requesterFor = (user: { id: string; role: GlobalRole }): Requester => ({
  id: user.id,
  isAdmin: user.role === "admin",
});
