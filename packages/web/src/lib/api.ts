import type { CreateSitePayload, DomainSetup, Lead, PublishResult, Site } from "../types.ts";

// Thin client for the Site Studio API (packages/api).
// All routes live under /api (auth: /api/auth, sites: /api/sites). In dev the
// Vite server proxies /api to the API worker, keeping the frontend and API
// same-origin so Better Auth session cookies are sent automatically.

const API_BASE: string = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");
const OWNER_ID: string = import.meta.env.VITE_OWNER_ID ?? "dev-owner";

export const timeAgo = (iso: string | undefined): string => {
  if (!iso) return "just now";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

export const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

interface ApiErrorDetail {
  _tag?: string;
  error?: string;
}

class ApiError extends Error {
  status: number;
  detail: ApiErrorDetail | null;

  constructor(message: string, status: number, detail: ApiErrorDetail | null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// Frontend editor model -> API Site document (drops display fields, fills
// required metadata, normalizes status to lowercase).
export const toApiSite = (site: Site): Site => ({
  id: site.id,
  ownerId: site.ownerId ?? OWNER_ID,
  templateId: site.templateId,
  status: site.status?.toLowerCase() === "published" ? "published" : "draft",
  business: site.business,
  settings: site.settings,
  pages: site.pages,
  createdAt: site.createdAt ?? new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  publishedAt: site.publishedAt,
  customDomain: site.customDomain,
});

// API Site document -> frontend editor model (adds display-only fields).
export const fromApiSite = (site: Site): Site => ({
  ...site,
  lastSaved: timeAgo(site.updatedAt),
});

async function _request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    let detail: ApiErrorDetail | null = null;
    try {
      // SAFETY: The API's error responses are Effect HttpApi errors, which
      // carry `_tag` (the error name) and optionally `error`; the message
      // extraction below only reads those two optional fields.
      detail = (await res.json()) as ApiErrorDetail | null;
    } catch {
      /* no body */
    }
    throw new ApiError(
      detail?._tag ?? detail?.error ?? `Request failed (${res.status})`,
      res.status,
      detail,
    );
  }
  // SAFETY: A 204 No Content response confirms a mutation without a body; the
  // caller's type expects the empty result for those endpoints.
  return res.status === 204 ? (null as T) : res.json();
}

export const api = {
  listSites: (): Promise<Site[]> => _request<Site[]>("/sites"),
  getSite: (id: string): Promise<Site> => _request<Site>(`/sites/${id}`),
  createSite: (payload: CreateSitePayload): Promise<Site> =>
    _request<Site>("/sites", { method: "POST", body: JSON.stringify(payload) }),
  updateSite: (id: string, site: Site): Promise<Site> =>
    _request<Site>(`/sites/${id}`, { method: "PUT", body: JSON.stringify(site) }),
  publishSite: (id: string): Promise<PublishResult> =>
    _request<PublishResult>(`/sites/${id}/publish`, { method: "POST" }),
  setDomain: (id: string, domain: string): Promise<DomainSetup> =>
    _request<DomainSetup>(`/sites/${id}/domain`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    }),
  verifyDomain: (id: string): Promise<Site> =>
    _request<Site>(`/sites/${id}/domain/verify`, { method: "POST" }),
  removeDomain: (id: string): Promise<Site> =>
    _request<Site>(`/sites/${id}/domain`, { method: "DELETE" }),
  listLeads: (siteId: string): Promise<Lead[]> => _request<Lead[]>(`/sites/${siteId}/leads`),
  deleteLead: (siteId: string, leadId: string): Promise<null> =>
    _request<null>(`/sites/${siteId}/leads/${leadId}`, { method: "DELETE" }),
};

// Public URL for a published site: the custom domain when verified, otherwise
// the www worker URL (VITE_WWW_URL) under /<siteId>/.
export const liveUrlFor = (site: Site): string | null => {
  if (site.customDomain) return `https://${site.customDomain}/`;
  const www = (import.meta.env?.VITE_WWW_URL ?? "").replace(/\/+$/, "");
  return www ? `${www}/${site.id}/` : null;
};
