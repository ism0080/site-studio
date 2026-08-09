import * as HttpApi from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import { SiteNotFound } from "../site/site.ts";

export const LeadInput = Schema.Struct({
  siteId: Schema.String,
  name: Schema.String,
  email: Schema.String,
  message: Schema.optional(Schema.String),
});
export type LeadInput = (typeof LeadInput)["Type"];

export const Lead = Schema.Struct({
  id: Schema.String,
  siteId: Schema.String,
  name: Schema.String,
  email: Schema.String,
  message: Schema.optional(Schema.String),
  createdAt: Schema.String,
});
export type Lead = (typeof Lead)["Type"];

export class LeadNotFound extends Schema.TaggedErrorClass<LeadNotFound>()(
  "LeadNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class TooManyRequests extends Schema.TaggedErrorClass<TooManyRequests>()(
  "TooManyRequests",
  {},
  { httpApiStatus: 429 },
) {}

const LeadParams = Schema.Struct({
  id: Schema.String,
  leadId: Schema.String,
});

/**
 * Public group — visitor contact-form submissions. Mounted at /api/leads and
 * deliberately NOT behind the session check.
 */
const submitLead = HttpApi.HttpApiEndpoint.post("submit", "/", {
  payload: LeadInput,
  success: Lead,
  error: Schema.Union([SiteNotFound, TooManyRequests]),
});

export class LeadsPublicGroup extends HttpApi.HttpApiGroup.make("LeadsPublic")
  .add(submitLead)
  .prefix("/api/leads") {}

/**
 * Owner-facing group mounted under /api/sites/:id/leads.
 */
const listLeads = HttpApi.HttpApiEndpoint.get("listLeads", "/:id/leads", {
  params: Schema.Struct({ id: Schema.String }),
  success: Schema.Array(Lead),
  error: SiteNotFound,
});

const deleteLead = HttpApi.HttpApiEndpoint.delete("deleteLead", "/:id/leads/:leadId", {
  params: LeadParams,
  success: HttpApi.HttpApiSchema.NoContent,
  error: Schema.Union([SiteNotFound, LeadNotFound]),
});

export class SiteLeadsGroup extends HttpApi.HttpApiGroup.make("SiteLeads")
  .add(listLeads)
  .add(deleteLead)
  .prefix("/api/sites") {}
