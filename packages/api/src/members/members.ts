import * as HttpApi from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import { Forbidden, SiteId, SiteNotFound } from "../site/site.ts";

export const Member = Schema.Struct({
  siteId: SiteId,
  email: Schema.String,
  canEdit: Schema.Boolean,
  canPublish: Schema.Boolean,
  canLeads: Schema.Boolean,
  /** True while the invite is pending (the client has not signed in yet). */
  pending: Schema.Boolean,
  createdAt: Schema.String,
});
export type Member = (typeof Member)["Type"];

/** Permission toggles (edit / publish / leads) for a site member or invite. */
export const MemberInput = Schema.Struct({
  email: Schema.String,
  canEdit: Schema.Boolean,
  canPublish: Schema.Boolean,
  canLeads: Schema.Boolean,
});
export type MemberInput = (typeof MemberInput)["Type"];

/** The member or invite is not present on the site. */
export class MemberNotFound extends Schema.TaggedErrorClass<MemberNotFound>()(
  "MemberNotFound",
  {},
  { httpApiStatus: 404 },
) {}

const SiteParams = Schema.Struct({
  id: Schema.String,
});

const MemberParams = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
});

const listMembers = HttpApi.HttpApiEndpoint.get("list", "/:id/members", {
  params: SiteParams,
  success: Schema.Array(Member),
  error: Schema.Union([SiteNotFound, Forbidden]),
});

const inviteMember = HttpApi.HttpApiEndpoint.post("invite", "/:id/members", {
  params: SiteParams,
  payload: MemberInput,
  success: Member,
  error: Schema.Union([SiteNotFound, Forbidden]),
});

const updateMember = HttpApi.HttpApiEndpoint.put("update", "/:id/members/:email", {
  params: MemberParams,
  payload: MemberInput,
  success: Member,
  error: Schema.Union([SiteNotFound, Forbidden, MemberNotFound]),
});

const removeMember = HttpApi.HttpApiEndpoint.delete("remove", "/:id/members/:email", {
  params: MemberParams,
  success: HttpApi.HttpApiSchema.NoContent,
  error: Schema.Union([SiteNotFound, Forbidden, MemberNotFound]),
});

export class MembersGroup extends HttpApi.HttpApiGroup.make("Members")
  .add(listMembers)
  .add(inviteMember)
  .add(updateMember)
  .add(removeMember)
  .prefix("/api/sites") {}
