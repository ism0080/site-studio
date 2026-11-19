import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { siteObjectKey, resolveRequestKey } from "../site/objectKeys.ts";
import { Site } from "../site/site.ts";
import { run } from "../test/helpers.ts";
import { makeRenderBuildRunner, type CachePurge } from "./RenderBuildRunner.ts";

const site = Schema.decodeUnknownSync(Site)({
  id: "site_test_build",
  ownerId: "owner-1",
  templateId: "clean-grid",
  status: "published",
  business: {
    name: "Test Studio",
    category: "Test",
    location: "Portland",
    email: "hello@test.studio",
    phone: "",
    logo: "TEST",
  },
  settings: {
    accent: "#4567db",
    font: "Space Grotesk",
    showDirectory: true,
    bg: "#101422",
    ink: "#f5f7ff",
    surface: "#1a2138",
  },
  pages: [
    {
      id: "page_home",
      slug: "/",
      title: "Homepage",
      sections: [
        {
          id: "b1",
          type: "hero",
          props: {
            eyebrow: "Eyebrow",
            headline: "Headline",
            description: "Description",
            primaryCta: "Start",
            secondaryCta: "Learn",
            image: "",
          },
        },
      ],
    },
    {
      id: "page_about",
      slug: "/about",
      title: "About",
      sections: [],
    },
  ],
  subdomain: "test-studio",
  customDomain: "aurora.test",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

/** Minimal ReadWriteBucketClient fake — in-memory Map. */
const _fakeBucket = () => {
  const objects = new Map<string, string>();
  return {
    objects,
    put: (key: string, value: string) => {
      objects.set(key, value);
      return Effect.succeed(undefined);
    },
  };
};

const _fakeFetch = (response: () => Response) => {
  const calls: Array<{ url: string; body: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), body: String(init?.body ?? "") });
    return response();
  };
  return { calls, fetcher };
};

const _runner = (options: {
  bucket: ReturnType<typeof _fakeBucket>;
  fetcher: typeof fetch;
  purge?: CachePurge;
}) =>
  makeRenderBuildRunner({
    // SAFETY: The in-memory fake implements the `put` surface the runner uses.
    bucket: options.bucket as never,
    config: {
      apiBase: "https://api.test",
      purge: options.purge ?? { _tag: "disabled" },
    },
    fetcher: options.fetcher,
  });

const PurgeRequest = Schema.fromJsonString(Schema.Struct({ files: Schema.Array(Schema.String) }));

const _enabledPurge: CachePurge = {
  _tag: "enabled",
  zoneId: "zone_1",
  apiToken: Redacted.make("token"),
  wwwDomain: "sites.test",
};

describe("RenderBuildRunner", () => {
  it("writes each page to the keys the www worker resolves", async () => {
    const bucket = _fakeBucket();
    const { fetcher } = _fakeFetch(() => Response.json({ success: true }));

    const result = await run(_runner({ bucket, fetcher }).publish(site));

    expect(result.keys).toEqual([
      "sites/site_test_build/index.html",
      "sites/site_test_build/about/index.html",
    ]);
    expect([...bucket.objects.keys()]).toEqual(result.keys);
    expect(resolveRequestKey("/", site.id)).toBe(result.keys[0]);
    expect(resolveRequestKey("/about/", site.id)).toBe(result.keys[1]);
    expect(siteObjectKey(site.id, "about")).toBe(result.keys[1]);
  });

  it("renders each page with the configured api base", async () => {
    const bucket = _fakeBucket();
    const { fetcher } = _fakeFetch(() => Response.json({ success: true }));

    await run(_runner({ bucket, fetcher }).publish(site));

    const home = bucket.objects.get("sites/site_test_build/index.html");
    expect(home).toContain("<!doctype html>");
    expect(home).toContain('data-api="https://api.test"');
    expect(bucket.objects.get("sites/site_test_build/about/index.html")).toContain("About");
  });

  it("skips the purge cleanly when purge is not configured", async () => {
    const bucket = _fakeBucket();
    const { calls, fetcher } = _fakeFetch(() => Response.json({ success: true }));

    const result = await run(_runner({ bucket, fetcher }).publish(site));

    expect(result.keys).toHaveLength(2);
    expect(calls).toEqual([]);
  });

  it("purges the custom domain, www, and subdomain routes for every page", async () => {
    const bucket = _fakeBucket();
    const { calls, fetcher } = _fakeFetch(() => Response.json({ success: true }));

    await run(_runner({ bucket, fetcher, purge: _enabledPurge }).publish(site));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.cloudflare.com/client/v4/zones/zone_1/purge_cache");
    const files = Schema.decodeUnknownSync(PurgeRequest)(calls[0]!.body).files;
    expect(files).toHaveLength(10);
    expect(files).toEqual(
      expect.arrayContaining([
        "https://sites.test",
        "https://sites.test/site_test_build/",
        "https://sites.test/about",
        "https://sites.test/site_test_build/about",
        "https://test-studio.sites.test",
        "https://test-studio.sites.test/about",
        "https://aurora.test",
        "https://aurora.test/site_test_build/",
      ]),
    );
  });

  it("does not fail the build when the purge fails", async () => {
    const bucket = _fakeBucket();
    const { calls, fetcher } = _fakeFetch(() => new Response("denied", { status: 403 }));

    const result = await run(_runner({ bucket, fetcher, purge: _enabledPurge }).publish(site));

    expect(result.keys).toHaveLength(2);
    expect(calls).toHaveLength(1);
  });

  it("fails with a BuildError when an upload fails", async () => {
    const bucket = {
      put: (key: string) => Effect.fail(new Error(`r2 unavailable for ${key}`)),
    };

    const failure = await run(
      // SAFETY: The failing fake implements the `put` surface the runner uses; its failure is what this test asserts.
      Effect.flip(
        _runner({
          bucket: bucket as never,
          fetcher: _fakeFetch(() => Response.json({})).fetcher,
        }).publish(site),
      ),
    );

    expect(failure._tag).toBe("BuildError");
    expect(failure.message).toContain("upload");
  });
});
