import * as HttpApi from "effect/unstable/httpapi"
import * as Schema from "effect/Schema"
import {
  LeadsPublicGroup,
  SiteLeadsGroup,
} from "../leads/leads.ts"
import {
  CreateSite,
  DomainInUse,
  DomainNotVerified,
  DomainSetup,
  PublishResult,
  Site,
  SiteNotFound,
} from "./site.ts"

const SiteParams = Schema.Struct({
  id: Schema.String,
})

const listSites = HttpApi.HttpApiEndpoint.get("list", "/", {
  success: Schema.Array(Site),
})

const createSite = HttpApi.HttpApiEndpoint.post("create", "/", {
  payload: CreateSite,
  success: Site,
})

const getSite = HttpApi.HttpApiEndpoint.get("get", "/:id", {
  params: SiteParams,
  success: Site,
  error: SiteNotFound,
})

const updateSite = HttpApi.HttpApiEndpoint.put("update", "/:id", {
  params: SiteParams,
  payload: Site,
  success: Site,
  error: SiteNotFound,
})

const deleteSite = HttpApi.HttpApiEndpoint.delete("remove", "/:id", {
  params: SiteParams,
  success: HttpApi.HttpApiSchema.NoContent,
  error: SiteNotFound,
})

const publishSite = HttpApi.HttpApiEndpoint.post("publish", "/:id/publish", {
  params: SiteParams,
  success: PublishResult,
  error: SiteNotFound,
})

const DomainInput = Schema.Struct({
  domain: Schema.String,
})

const setDomain = HttpApi.HttpApiEndpoint.post("setDomain", "/:id/domain", {
  params: SiteParams,
  payload: DomainInput,
  success: DomainSetup,
  error: Schema.Union([SiteNotFound, DomainInUse]),
})

const verifyDomain = HttpApi.HttpApiEndpoint.post(
  "verifyDomain",
  "/:id/domain/verify",
  {
    params: SiteParams,
    success: Site,
    error: Schema.Union([SiteNotFound, DomainNotVerified]),
  },
)

const removeDomain = HttpApi.HttpApiEndpoint.delete(
  "removeDomain",
  "/:id/domain",
  {
    params: SiteParams,
    success: Site,
    error: SiteNotFound,
  },
)

export class SitesGroup extends HttpApi.HttpApiGroup.make("Sites")
  .add(listSites)
  .add(createSite)
  .add(getSite)
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
  .add(LeadsPublicGroup) {}
