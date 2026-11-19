import { describe, expect, it } from "@effect/vitest";
import { resolveRequestKey, subdomainLabel } from "./objectKeys.ts";

describe("subdomainLabel", () => {
  it("extracts the single label under the zone", () => {
    expect(subdomainLabel("bobs-plumbing.sitestudio.site", "sitestudio.site")).toBe(
      "bobs-plumbing",
    );
  });

  it("rejects labels containing a dot", () => {
    expect(subdomainLabel("a.b.sitestudio.site", "sitestudio.site")).toBeNull();
  });

  it("rejects hosts outside the zone", () => {
    expect(subdomainLabel("bobs.other.site", "sitestudio.site")).toBeNull();
  });

  it("rejects an empty zone", () => {
    expect(subdomainLabel("bobs.sitestudio.site", "")).toBeNull();
  });

  it("rejects the zone root", () => {
    expect(subdomainLabel("sitestudio.site", "sitestudio.site")).toBeNull();
  });
});

describe("resolveRequestKey", () => {
  it("treats a domain-routed root request as the site root", () => {
    expect(resolveRequestKey("/", "site_a")).toBe("sites/site_a/index.html");
  });

  it("treats a domain-routed page request as site-relative", () => {
    expect(resolveRequestKey("/about/", "site_a")).toBe("sites/site_a/about/index.html");
  });

  it("falls back to path routing when no host matched", () => {
    expect(resolveRequestKey("/site_b/contact", null)).toBe("sites/site_b/contact/index.html");
  });
});
