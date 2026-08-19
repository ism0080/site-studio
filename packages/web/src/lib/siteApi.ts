import type {
  Agency,
  CreateSitePayload,
  DomainSetup,
  Lead,
  Member,
  MemberInput,
  Me,
  PublishResult,
  Site,
  SiteAccess,
} from "../siteTypes.ts";
import type { Site as ApiSite } from "@site-studio/api/contract";
import { formatTimeAgo } from "./formatting.ts";
import { siteApiHttpClient } from "./siteApiHttpClient.ts";

// Frontend editor model -> API Site document. The editor model is the API
// schema plus a display-only `lastSaved`, so this drops that field.
/** Converts the editor model to the API Site document (drops display-only fields). */
export const toApiSite = ({ lastSaved: _lastSaved, ...site }: Site): ApiSite => site;

// API Site document -> frontend editor model (adds display-only fields).
/** Converts an API Site document to the editor model (adds a relative `lastSaved`). */
export const fromApiSite = (site: ApiSite): Site => ({
  ...site,
  buildStatus: site.buildStatus ?? "idle",
  lastSaved: formatTimeAgo(site.updatedAt),
});

/** App-facing API facade over the site-studio HTTP client, with editor-model mapping. */
export const siteApi = {
  me: (): Promise<Me> => siteApiHttpClient.me(),
  listSites: (): Promise<readonly Site[]> => siteApiHttpClient.listSites(),
  getSite: (id: string): Promise<Site> => siteApiHttpClient.getSite(id),
  getSiteAccess: (id: string): Promise<SiteAccess> => siteApiHttpClient.getSiteAccess(id),
  createSite: (payload: CreateSitePayload): Promise<Site> =>
    siteApiHttpClient.createSite(payload),
  updateSite: (id: string, site: Site): Promise<Site> =>
    siteApiHttpClient.updateSite(id, toApiSite(site)),
  publishSite: (id: string): Promise<PublishResult> => siteApiHttpClient.publishSite(id),
  setDomain: (id: string, domain: string): Promise<DomainSetup> =>
    siteApiHttpClient.setDomain(id, domain),
  verifyDomain: (id: string): Promise<Site> => siteApiHttpClient.verifyDomain(id),
  removeDomain: (id: string): Promise<Site> => siteApiHttpClient.removeDomain(id),
  listLeads: (siteId: string): Promise<readonly Lead[]> => siteApiHttpClient.listLeads(siteId),
  deleteLead: (siteId: string, leadId: string): Promise<void> =>
    siteApiHttpClient.deleteLead(siteId, leadId),
  listMembers: (siteId: string): Promise<readonly Member[]> =>
    siteApiHttpClient.listMembers(siteId),
  inviteMember: (siteId: string, input: MemberInput): Promise<Member> =>
    siteApiHttpClient.inviteMember(siteId, input),
  updateMember: (siteId: string, email: string, input: MemberInput): Promise<Member> =>
    siteApiHttpClient.updateMember(siteId, email, input),
  removeMember: (siteId: string, email: string): Promise<void> =>
    siteApiHttpClient.removeMember(siteId, email),
  listAgencies: (): Promise<readonly Agency[]> => siteApiHttpClient.listAgencies(),
  inviteAgency: (email: string): Promise<Agency> => siteApiHttpClient.inviteAgency(email),
  removeAgency: (email: string): Promise<void> => siteApiHttpClient.removeAgency(email),
};

// Public URL for a published site: the custom domain when verified, otherwise
// the www worker URL (VITE_WWW_URL) under /<siteId>/.
/** Public URL for a published site, or null when it is not built or not live. */
export const liveUrlFor = (site: Site): string | null => {
  if (site.status !== "published" || site.buildStatus !== "built") return null;
  if (site.customDomain) return `https://${site.customDomain}/`;
  const www = (import.meta.env?.VITE_WWW_URL ?? "").replace(/\/+$/, "");
  return www ? `${www}/${site.id}/` : null;
};