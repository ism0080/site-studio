import { describe, expect, test, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { makeDb, memoryD1, run } from "./helpers.ts"
import { makeSiteRepository } from "../src/site/SiteRepository.ts"

let db: Database

beforeEach(() => {
  db = makeDb()
})

const repo = () => makeSiteRepository(memoryD1(db) as never)

describe("SiteRepository", () => {
  test("create -> get -> list -> update -> remove", async () => {
    const r = repo()
    const created = await run(
      r.create({ name: "Aurora Studio", templateId: "editorial-studio" }, "owner-1"),
    )
    expect(created.id).toBeTruthy()
    expect(created.ownerId).toBe("owner-1")
    expect(created.status).toBe("draft")
    expect(created.business.name).toBe("Aurora Studio")
    expect(created.pages).toHaveLength(1)

    const got = await run(r.get(created.id, "owner-1"))
    expect(got.business.name).toBe("Aurora Studio")

    const list = await run(r.list("owner-1"))
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(created.id)

    const updated = await run(
      r.update(
        created.id,
        { ...got, business: { ...got.business, name: "Aurora 2" } },
        "owner-1",
      ),
    )
    expect(updated.business.name).toBe("Aurora 2")
    expect(updated.updatedAt).toBeTruthy()

    await run(r.remove(created.id, "owner-1"))
    expect(await run(r.list("owner-1"))).toHaveLength(0)
  })

  test("owner scoping — other owners cannot read a site", async () => {
    const r = repo()
    const created = await run(r.create({ name: "A", templateId: "t" }, "owner-1"))
    await expect(run(r.get(created.id, "owner-2"))).rejects.toMatchObject({
      _tag: "SiteNotFound",
    })
  })

  test("markPublished sets status and publishedAt", async () => {
    const r = repo()
    const created = await run(r.create({ name: "A", templateId: "t" }, "owner-1"))
    const published = await run(
      r.markPublished(created.id, "owner-1", "2026-08-09T00:00:00.000Z"),
    )
    expect(published.status).toBe("published")
    expect(published.publishedAt).toBe("2026-08-09T00:00:00.000Z")
  })

  test("setDomain -> verify (TXT ok) -> remove", async () => {
    const r = makeSiteRepository(memoryD1(db) as never, {
      verifyTxt: () => Promise.resolve(true),
    })
    const created = await run(r.create({ name: "A", templateId: "t" }, "owner-1"))

    const setup = await run(r.setDomain(created.id, "owner-1", "example.com"))
    expect(setup.domain).toBe("example.com")
    expect(setup.status).toBe("pending")
    expect(setup.txtName).toBe("_site-studio-verify.example.com")
    expect(setup.txtValue).toMatch(/^site-studio-verify=/)

    const verified = await run(r.verifyDomain(created.id, "owner-1"))
    expect(verified.customDomain).toBe("example.com")

    const removed = await run(r.removeDomain(created.id, "owner-1"))
    expect(removed.customDomain).toBeUndefined()
  })

  test("verify fails when the TXT record is missing", async () => {
    const r = makeSiteRepository(memoryD1(db) as never, {
      verifyTxt: () => Promise.resolve(false),
    })
    const created = await run(r.create({ name: "A", templateId: "t" }, "owner-1"))
    await run(r.setDomain(created.id, "owner-1", "example.com"))
    await expect(run(r.verifyDomain(created.id, "owner-1"))).rejects.toMatchObject({
      _tag: "DomainNotVerified",
    })
  })

  test("a domain already claimed by another site is rejected", async () => {
    const r = repo()
    const a = await run(r.create({ name: "A", templateId: "t" }, "owner-1"))
    const b = await run(r.create({ name: "B", templateId: "t" }, "owner-1"))
    await run(r.setDomain(a.id, "owner-1", "example.com"))
    await expect(run(r.setDomain(b.id, "owner-1", "example.com"))).rejects.toMatchObject(
      { _tag: "DomainInUse" },
    )
  })
})
