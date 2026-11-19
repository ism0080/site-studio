import * as HttpApi from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import { EmailError } from "../email/email.ts";
import { Forbidden } from "../site/site.ts";

export const Agency = Schema.Struct({
  email: Schema.String,
  /** True while the invite is pending (the agency has not signed in yet). */
  pending: Schema.Boolean,
  createdAt: Schema.String,
});
export type Agency = (typeof Agency)["Type"];

/** Payload for inviting an agency by email. */
export const AgencyInvite = Schema.Struct({
  email: Schema.String,
});
export type AgencyInvite = (typeof AgencyInvite)["Type"];

const EmailParams = Schema.Struct({
  email: Schema.String,
});

const listAgencies = HttpApi.HttpApiEndpoint.get("listAgencies", "/", {
  success: Schema.Array(Agency),
  error: Forbidden,
});

const inviteAgency = HttpApi.HttpApiEndpoint.post("inviteAgency", "/", {
  payload: AgencyInvite,
  success: Agency,
  error: Schema.Union([Forbidden, EmailError]),
});

const removeAgency = HttpApi.HttpApiEndpoint.delete("removeAgency", "/:email", {
  params: EmailParams,
  success: HttpApi.HttpApiSchema.NoContent,
  error: Forbidden,
});

export class AdminGroup extends HttpApi.HttpApiGroup.make("Admin")
  .add(listAgencies)
  .add(inviteAgency)
  .add(removeAgency)
  .prefix("/api/admin") {}
