import {
  contentTypeFor,
  normalizeDomain,
  resolveRequestKey,
  resolveSiteObjectKey,
} from "../src/site/keys.ts";

let failed = 0;
type ExpectedKey = string | null;
const _check = (label: string, got: ExpectedKey, expected: ExpectedKey) => {
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} -> ${String(got)}`);
};

// Path-based routing (www.<host>/<siteId>/...)
_check("no site in path", resolveSiteObjectKey("/"), null);
_check("root page", resolveSiteObjectKey("/site_a"), "sites/site_a/index.html");
_check("root page with slash", resolveSiteObjectKey("/site_a/"), "sites/site_a/index.html");
_check("nested page", resolveSiteObjectKey("/site_a/about"), "sites/site_a/about/index.html");
_check(
  "nested page with slash",
  resolveSiteObjectKey("/site_a/about/"),
  "sites/site_a/about/index.html",
);
_check("file passthrough", resolveSiteObjectKey("/site_a/logo.png"), "sites/site_a/logo.png");
_check(
  "deep nested",
  resolveSiteObjectKey("/site_a/blog/post"),
  "sites/site_a/blog/post/index.html",
);

// Host-based routing (custom domain, resolved via site_domains)
_check("custom domain root", resolveRequestKey("/", "site_a"), "sites/site_a/index.html");
_check(
  "custom domain page",
  resolveRequestKey("/about/", "site_a"),
  "sites/site_a/about/index.html",
);
_check("custom domain file", resolveRequestKey("/logo.png", "site_a"), "sites/site_a/logo.png");
_check("no domain match, no site in path", resolveRequestKey("/", null), null);
_check(
  "no domain match falls back to path routing",
  resolveRequestKey("/site_b/contact", null),
  "sites/site_b/contact/index.html",
);

// Domain normalization
_check("lowercase", normalizeDomain("Aurora.co"), "aurora.co");
_check("strips scheme", normalizeDomain("https://aurora.co"), "aurora.co");
_check("strips port", normalizeDomain("aurora.co:8443"), "aurora.co");
_check("strips trailing slash", normalizeDomain("aurora.co/"), "aurora.co");
_check("strips trailing dot", normalizeDomain("aurora.co."), "aurora.co");
_check("strips www path prefix", normalizeDomain("www.aurora.co"), "www.aurora.co");

_check("content-type html", contentTypeFor("index.html"), "text/html; charset=utf-8");
_check("content-type png", contentTypeFor("logo.png"), "image/png");
_check("content-type bin", contentTypeFor("archive.bin"), "application/octet-stream");

if (failed > 0) process.exit(1);
console.log("serving tests passed");
