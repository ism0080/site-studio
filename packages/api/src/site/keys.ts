const CONTENT_TYPES = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
]);

export const contentTypeFor = (key: string): string => {
  const dot = key.lastIndexOf(".");
  const ext = dot === -1 ? "" : key.slice(dot);
  return CONTENT_TYPES.get(ext) ?? "application/octet-stream";
};

/**
 * Normalizes a hostname for the `site_domains` lookup: lowercase, no scheme,
 * no port, no trailing slash or dot.
 */
export const normalizeDomain = (input: string): string =>
  input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .split(":")[0]!
    .replace(/\.$/, "");

/**
 * Resolves a site-relative request path to the object path within a site's
 * R2 prefix. Directory-style paths map to `index.html`; paths with a file
 * extension are returned as-is. An empty path (site root) maps to `index.html`.
 */
export const siteObjectPath = (sitePath: string): string => {
  const restPath = sitePath.replace(/^\/+/, "").replace(/\/+$/, "") || "index.html";
  return /\.\w+$/.test(restPath) ? restPath : `${restPath}/index.html`;
};

/**
 * Full R2 object key for `sitePath` inside `siteId`'s published tree.
 */
export const siteObjectKey = (siteId: string, sitePath: string): string =>
  `sites/${siteId}/${siteObjectPath(sitePath)}`;

/**
 * Legacy path-based resolution: maps a request pathname like
 * `/<siteId>/about/` to its R2 object key. Returns `null` when no site id is
 * present in the path.
 */
export const resolveSiteObjectKey = (pathname: string): string | null => {
  const segments = pathname.split("/").filter(Boolean);
  const siteId = segments[0];
  if (!siteId) return null;
  return siteObjectKey(siteId, segments.slice(1).join("/"));
};

/**
 * Resolves a request to an R2 object key. When `siteIdByDomain` (from the
 * `site_domains` lookup for the Host header) is present, the site id comes
 * from the domain and `pathname` is site-relative. Otherwise it falls back
 * to path-based routing: `/<siteId>/<path>`. Returns `null` when no site
 * can be determined.
 */
export const resolveRequestKey = (
  pathname: string,
  siteIdByDomain: string | null,
): string | null => {
  let siteId = siteIdByDomain;
  let sitePath = pathname.replace(/^\//, "");
  if (siteId === null) {
    const segments = pathname.split("/").filter(Boolean);
    siteId = segments[0] ?? null;
    sitePath = segments.slice(1).join("/");
  }
  if (siteId === null) return null;
  return siteObjectKey(siteId, sitePath);
};
