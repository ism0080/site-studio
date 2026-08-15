import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeR2SiteStorage } from "../src/storage/SiteStorage.ts";
import { run } from "./helpers.ts";

/** Minimal ReadWriteBucketClient fake — in-memory Map. */
const _makeFakeBucket = () => {
  const store = new Map<string, string>();
  return {
    put: (key: string, value: string) => {
      store.set(key, value);
      return Effect.succeed(undefined);
    },
    get: (key: string) =>
      Effect.succeed(store.has(key) ? { text: () => Effect.succeed(store.get(key)!) } : null),
  };
};

// SAFETY: The in-memory fake implements the put/get surface SiteStorage uses; the cast narrows the R2 client type for tests.
const _storage = () => makeR2SiteStorage(_makeFakeBucket() as never);

describe("SiteStorage (R2 layer)", () => {
  it("put/getSiteDocument round-trips", async () => {
    const s = _storage();
    await run(s.putSiteDocument("site_1", '{"id":"site_1"}'));
    expect(await run(s.getSiteDocument("site_1"))).toBe('{"id":"site_1"}');
  });

  it("getSiteDocument returns null when missing", async () => {
    const s = _storage();
    expect(await run(s.getSiteDocument("missing"))).toBeNull();
  });

  it("each site's document is keyed independently", async () => {
    const s = _storage();
    await run(s.putSiteDocument("a", "A"));
    await run(s.putSiteDocument("b", "B"));
    expect(await run(s.getSiteDocument("a"))).toBe("A");
    expect(await run(s.getSiteDocument("b"))).toBe("B");
  });
});
