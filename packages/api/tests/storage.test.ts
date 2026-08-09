import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { makeR2SiteStorage } from "../src/storage/SiteStorage.ts"
import { run } from "./helpers.ts"

/** Minimal ReadWriteBucketClient fake — in-memory Map. */
const makeFakeBucket = () => {
  const store = new Map<string, string>()
  return {
    put: (key: string, value: string) => {
      store.set(key, value)
      return Effect.succeed(undefined)
    },
    get: (key: string) =>
      Effect.succeed(
        store.has(key) ? { text: () => Effect.succeed(store.get(key)!) } : null,
      ),
  }
}

describe("SiteStorage (R2 layer)", () => {
  test("put/getSiteDocument round-trips", async () => {
    const storage = makeR2SiteStorage(makeFakeBucket() as never)
    await run(storage.putSiteDocument("site_1", '{"id":"site_1"}'))
    expect(await run(storage.getSiteDocument("site_1"))).toBe('{"id":"site_1"}')
  })

  test("getSiteDocument returns null when missing", async () => {
    const storage = makeR2SiteStorage(makeFakeBucket() as never)
    expect(await run(storage.getSiteDocument("missing"))).toBeNull()
  })

  test("each site's document is keyed independently", async () => {
    const storage = makeR2SiteStorage(makeFakeBucket() as never)
    await run(storage.putSiteDocument("a", "A"))
    await run(storage.putSiteDocument("b", "B"))
    expect(await run(storage.getSiteDocument("a"))).toBe("A")
    expect(await run(storage.getSiteDocument("b"))).toBe("B")
  })
})
