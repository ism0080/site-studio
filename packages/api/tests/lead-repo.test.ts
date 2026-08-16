import { describe, expect, it, beforeEach } from "@effect/vitest";
import { DatabaseSync } from "node:sqlite";
import { makeDb, d1, run } from "./helpers.ts";
import { makeLeadRepository } from "../src/leads/LeadRepository.ts";
import { makeSiteRepository } from "../src/site/SiteRepository.ts";
import type { Requester } from "../src/access/access.ts";

let db: DatabaseSync;

beforeEach(() => {
  db = makeDb();
});

const _leads = () => makeLeadRepository(d1(db));
const _sites = () => makeSiteRepository(d1(db));
const _owner = (id: string): Requester => ({ id, isAdmin: false });

describe("LeadRepository", () => {
  it("create -> list -> remove", async () => {
    const site = await run(
      _sites().create({ name: "Aurora", templateId: "editorial-studio" }, _owner("owner-1")),
    );
    const l = _leads();

    const lead = await run(
      l.create({ siteId: site.id, name: "Jane", email: "jane@x.com", message: "hi" }),
    );
    expect(lead.siteId).toBe(site.id);
    expect(lead.message).toBe("hi");

    const list = await run(l.listForSite(site.id, _owner("owner-1")));
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("Jane");

    await run(l.remove(site.id, lead.id, _owner("owner-1")));
    expect(await run(l.listForSite(site.id, _owner("owner-1")))).toHaveLength(0);
  });

  it("create rejects unknown sites", async () => {
    await expect(
      run(
        _leads().create({
          siteId: "no-such-site",
          name: "Jane",
          email: "j@x.com",
          message: undefined,
        }),
      ),
    ).rejects.toMatchObject({ _tag: "SiteNotFound" });
  });

  it("list is owner-scoped", async () => {
    const site = await run(_sites().create({ name: "A", templateId: "t" }, _owner("owner-1")));
    await run(_leads().create({ siteId: site.id, name: "Jane", email: "j@x.com" }));
    await expect(run(_leads().listForSite(site.id, _owner("owner-2")))).rejects.toMatchObject({
      _tag: "SiteNotFound",
    });
  });

  it("siteContact returns business info", async () => {
    const site = await run(_sites().create({ name: "Aurora", templateId: "t" }, _owner("owner-1")));
    const contact = await run(_leads().siteContact(site.id));
    expect(contact).toEqual({
      name: "Aurora",
      email: "",
    });
    expect(await run(_leads().siteContact("missing"))).toBeNull();
  });
});
