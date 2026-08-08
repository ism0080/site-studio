// Thin client for the Site Studio API (packages/api).
// All routes live under /api (auth: /api/auth, sites: /api/sites). In dev the
// Vite server proxies /api to the API worker, keeping the frontend and API
// same-origin so Better Auth session cookies are sent automatically.

const API_BASE = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "")
const OWNER_ID = import.meta.env.VITE_OWNER_ID ?? "dev-owner"

export const timeAgo = (iso) => {
  if (!iso) return "just now"
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  return `${Math.floor(seconds / 86400)} d ago`
}

// Frontend editor model -> API Site document (drops display fields, fills
// required metadata, normalizes status to lowercase).
export const toApiSite = (site) => ({
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
})

// API Site document -> frontend editor model (adds display-only fields).
export const fromApiSite = (site) => ({
  ...site,
  lastSaved: timeAgo(site.updatedAt),
})

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  })
  if (!res.ok) {
    let detail = null
    try {
      detail = await res.json()
    } catch {
      /* no body */
    }
    const err = new Error(
      detail?._tag ?? detail?.error ?? `Request failed (${res.status})`,
    )
    err.status = res.status
    err.detail = detail
    throw err
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  listSites: () => request("/sites"),
  getSite: (id) => request(`/sites/${id}`),
  createSite: (payload) =>
    request("/sites", { method: "POST", body: JSON.stringify(payload) }),
  updateSite: (id, site) =>
    request(`/sites/${id}`, { method: "PUT", body: JSON.stringify(site) }),
  publishSite: (id) => request(`/sites/${id}/publish`, { method: "POST" }),
  setDomain: (id, domain) =>
    request(`/sites/${id}/domain`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    }),
  verifyDomain: (id) => request(`/sites/${id}/domain/verify`, { method: "POST" }),
  removeDomain: (id) => request(`/sites/${id}/domain`, { method: "DELETE" }),
  listLeads: (siteId) => request(`/sites/${siteId}/leads`),
  deleteLead: (siteId, leadId) =>
    request(`/sites/${siteId}/leads/${leadId}`, { method: "DELETE" }),
}

// Public URL for a published site: the custom domain when verified, otherwise
// the www worker URL (VITE_WWW_URL) under /<siteId>/.
export const liveUrlFor = (site) => {
  if (site.customDomain) return `https://${site.customDomain}/`
  const www = (import.meta.env?.VITE_WWW_URL ?? "").replace(/\/+$/, "")
  return www ? `${www}/${site.id}/` : null
}
