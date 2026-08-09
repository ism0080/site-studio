import {
  contentTypeFor,
  normalizeDomain,
  resolveRequestKey,
  resolveSiteObjectKey,
} from "../src/site/keys.ts";

let failed = 0;
const check = (label: string, got: unknown, expected: unknown) => {
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label} -> ${JSON.stringify(got)}`);
};

// Path-based routing (www.<host>/<siteId>/...)
check("no site in path", resolveSiteObjectKey("/"), null);
check("root page", resolveSiteObjectKey("/site_a"), "sites/site_a/index.html");
check("root page with slash", resolveSiteObjectKey("/site_a/"), "sites/site_a/index.html");
check("nested page", resolveSiteObjectKey("/site_a/about"), "sites/site_a/about/index.html");
check(
  "nested page with slash",
  resolveSiteObjectKey("/site_a/about/"),
  "sites/site_a/about/index.html",
);
check("file passthrough", resolveSiteObjectKey("/site_a/logo.png"), "sites/site_a/logo.png");
check(
  "deep nested",
  resolveSiteObjectKey("/site_a/blog/post"),
  "sites/site_a/blog/post/index.html",
);

// Host-based routing (custom domain, resolved via site_domains)
check("custom domain root", resolveRequestKey("/", "site_a"), "sites/site_a/index.html");
check(
  "custom domain page",
  resolveRequestKey("/about/", "site_a"),
  "sites/site_a/about/index.html",
);
check("custom domain file", resolveRequestKey("/logo.png", "site_a"), "sites/site_a/logo.png");
check("no domain match, no site in path", resolveRequestKey("/", null), null);
check(
  "no domain match falls back to path routing",
  resolveRequestKey("/site_b/contact", null),
  "sites/site_b/contact/index.html",
);

// Domain normalization
check("lowercase", normalizeDomain("Aurora.co"), "aurora.co");
check("strips scheme", normalizeDomain("https://aurora.co"), "aurora.co");
check("strips port", normalizeDomain("aurora.co:8443"), "aurora.co");
check("strips trailing slash", normalizeDomain("aurora.co/"), "aurora.co");
check("strips trailing dot", normalizeDomain("aurora.co."), "aurora.co");
check("strips www path prefix", normalizeDomain("www.aurora.co"), "www.aurora.co");

check("content-type html", contentTypeFor("index.html"), "text/html; charset=utf-8");
check("content-type png", contentTypeFor("logo.png"), "image/png");
check("content-type bin", contentTypeFor("archive.bin"), "application/octet-stream");

if (failed > 0) process.exit(1);
console.log("serving tests passed");
