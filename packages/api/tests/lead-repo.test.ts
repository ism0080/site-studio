import { describe, expect, test, beforeEach } from "bun:test"
import { Database } from "bun:sqlite"
import { makeDb, memoryD1, run } from "./helpers.ts"
import { makeLeadRepository } from "../src/leads/LeadRepository.ts"
import { makeSiteRepository } from "../src/site/SiteRepository.ts"

let db: Database

beforeEach(() => {
  db = makeDb()
})

const leads = () => makeLeadRepository(memoryD1(db) as never)
const sites = () => makeSiteRepository(memoryD1(db) as never)

describe("LeadRepository", () => {
  test("create -> list -> remove", async () => {
    const site = await run(
      sites().create({ name: "Aurora", templateId: "editorial-studio" }, "owner-1"),
    )
    const l = leads()

    const lead = await run(
      l.create({ siteId: site.id, name: "Jane", email: "jane@x.com", message: "hi" }),
    )
    expect(lead.siteId).toBe(site.id)
    expect(lead.message).toBe("hi")

    const list = await run(l.listForSite(site.id, "owner-1"))
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe("Jane")

    await run(l.remove(site.id, lead.id, "owner-1"))
    expect(await run(l.listForSite(site.id, "owner-1"))).toHaveLength(0)
  })

  test("create rejects unknown sites", async () => {
    await expect(
      run(
        leads().create({
          siteId: "no-such-site",
          name: "Jane",
          email: "j@x.com",
          message: undefined,
        }),
      ),
    ).rejects.toMatchObject({ _tag: "SiteNotFound" })
  })

  test("list is owner-scoped", async () => {
    const site = await run(
      sites().create({ name: "A", templateId: "t" }, "owner-1"),
    )
    await run(leads().create({ siteId: site.id, name: "Jane", email: "j@x.com" }))
    await expect(
      run(leads().listForSite(site.id, "owner-2")),
    ).rejects.toMatchObject({ _tag: "SiteNotFound" })
  })

  test("siteContact returns business info", async () => {
    const site = await run(
      sites().create({ name: "Aurora", templateId: "t" }, "owner-1"),
    )
    const contact = await run(leads().siteContact(site.id))
    expect(contact).toEqual({
      name: "Aurora",
      email: "",
    })
    expect(await run(leads().siteContact("missing"))).toBeNull()
  })
})
