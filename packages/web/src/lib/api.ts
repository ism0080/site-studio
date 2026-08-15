import type { CreateSitePayload, DomainSetup, Lead, PublishResult, Site } from "../types.ts";
import type { Site as ApiSite } from "@site-studio/api/contract";
import { sdk } from "./sdk.ts";

export const timeAgo = (iso: string | undefined): string => {
  if (!iso) return "just now";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

// The client surfaces HttpApi errors as tagged schema errors (Error subclasses
// whose `String()` renders the tag) and network failures as Errors, so an Error
// message with a readable fallback covers both.
export const errorMessage = (cause: unknown): string =>
  cause instanceof Error && cause.message ? cause.message : String(cause);

/** Human label for a site's publish/build state (used by pills and buttons). */
export const buildStatusLabel = (site: Pick<Site, "status" | "buildStatus">): string => {
  if (site.status !== "published") return "Draft";
  switch (site.buildStatus) {
    case "building":
      return "Building…";
    case "built":
      return "Live";
    case "failed":
      return "Build failed";
    default:
      return "Published";
  }
};

// Frontend editor model -> API Site document. The editor model is the API
// schema plus a display-only `lastSaved`, so this drops that field.
export const toApiSite = ({ lastSaved: _lastSaved, ...site }: Site): ApiSite => site;

// API Site document -> frontend editor model (adds display-only fields).
export const fromApiSite = (site: ApiSite): Site => ({
  ...site,
  buildStatus: site.buildStatus ?? "idle",
  lastSaved: timeAgo(site.updatedAt),
});

export const api = {
  listSites: (): Promise<readonly Site[]> => sdk.listSites(),
  getSite: (id: string): Promise<Site> => sdk.getSite(id),
  createSite: (payload: CreateSitePayload): Promise<Site> => sdk.createSite(payload),
  updateSite: (id: string, site: Site): Promise<Site> => sdk.updateSite(id, toApiSite(site)),
  publishSite: (id: string): Promise<PublishResult> => sdk.publishSite(id),
  setDomain: (id: string, domain: string): Promise<DomainSetup> => sdk.setDomain(id, domain),
  verifyDomain: (id: string): Promise<Site> => sdk.verifyDomain(id),
  removeDomain: (id: string): Promise<Site> => sdk.removeDomain(id),
  listLeads: (siteId: string): Promise<readonly Lead[]> => sdk.listLeads(siteId),
  deleteLead: (siteId: string, leadId: string): Promise<void> => sdk.deleteLead(siteId, leadId),
};

// Public URL for a published site: the custom domain when verified, otherwise
// the www worker URL (VITE_WWW_URL) under /<siteId>/.
export const liveUrlFor = (site: Site): string | null => {
  if (site.customDomain) return `https://${site.customDomain}/`;
  const www = (import.meta.env?.VITE_WWW_URL ?? "").replace(/\/+$/, "");
  return www ? `${www}/${site.id}/` : null;
};
