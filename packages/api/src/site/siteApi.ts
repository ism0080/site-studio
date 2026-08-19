import * as HttpApi from "effect/unstable/httpapi";
import * as Schema from "effect/Schema";
import { LeadsPublicGroup, SiteLeadsGroup } from "../leads/leads.ts";
import { MembersGroup } from "../members/members.ts";
import { AdminGroup } from "../admin/admin.ts";
import { MeGroup } from "../access/me.ts";
import { SiteAccess } from "../access/access.ts";
import {
  CreateSite,
  DomainInUse,
  DomainNotVerified,
  DomainSetup,
  Forbidden,
  PublishError,
  PublishResult,
  Site,
  SiteNotFound,
  SubdomainInUse,
  TemplateInfo,
} from "./site.ts";

const SiteParams = Schema.Struct({
  id: Schema.String,
});

const listTemplates = HttpApi.HttpApiEndpoint.get("listTemplates", "/templates", {
  success: Schema.Array(TemplateInfo),
});

const listSites = HttpApi.HttpApiEndpoint.get("list", "/", {
  success: Schema.Array(Site),
});

const createSite = HttpApi.HttpApiEndpoint.post("create", "/", {
  payload: CreateSite,
  success: Site,
  error: SubdomainInUse,
});

const getSite = HttpApi.HttpApiEndpoint.get("get", "/:id", {
  params: SiteParams,
  success: Site,
  error: SiteNotFound,
});

const getSiteAccess = HttpApi.HttpApiEndpoint.get("access", "/:id/access", {
  params: SiteParams,
  success: SiteAccess,
  error: SiteNotFound,
});

const updateSite = HttpApi.HttpApiEndpoint.put("update", "/:id", {
  params: SiteParams,
  payload: Site,
  success: Site,
  error: Schema.Union([SiteNotFound, Forbidden, SubdomainInUse]),
});

const deleteSite = HttpApi.HttpApiEndpoint.delete("remove", "/:id", {
  params: SiteParams,
  success: HttpApi.HttpApiSchema.NoContent,
  error: Schema.Union([SiteNotFound, Forbidden]),
});

const publishSite = HttpApi.HttpApiEndpoint.post("publish", "/:id/publish", {
  params: SiteParams,
  success: PublishResult,
  error: Schema.Union([SiteNotFound, PublishError, Forbidden]),
});

const DomainInput = Schema.Struct({
  domain: Schema.String,
});

const setDomain = HttpApi.HttpApiEndpoint.post("setDomain", "/:id/domain", {
  params: SiteParams,
  payload: DomainInput,
  success: DomainSetup,
  error: Schema.Union([SiteNotFound, DomainInUse, Forbidden]),
});

const verifyDomain = HttpApi.HttpApiEndpoint.post("verifyDomain", "/:id/domain/verify", {
  params: SiteParams,
  success: Site,
  error: Schema.Union([SiteNotFound, DomainNotVerified, Forbidden]),
});

const removeDomain = HttpApi.HttpApiEndpoint.delete("removeDomain", "/:id/domain", {
  params: SiteParams,
  success: Site,
  error: Schema.Union([SiteNotFound, Forbidden]),
});

export class SitesGroup extends HttpApi.HttpApiGroup.make("Sites")
  .add(listTemplates)
  .add(listSites)
  .add(createSite)
  .add(getSite)
  .add(getSiteAccess)
  .add(updateSite)
  .add(deleteSite)
  .add(publishSite)
  .add(setDomain)
  .add(verifyDomain)
  .add(removeDomain)
  .prefix("/api/sites") {}

export class SiteApi extends HttpApi.HttpApi.make("SiteApi")
  .add(SitesGroup)
  .add(SiteLeadsGroup)
  .add(LeadsPublicGroup)
  .add(MembersGroup)
  .add(AdminGroup)
  .add(MeGroup) {}
