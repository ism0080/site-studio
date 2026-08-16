import { describe, expect, it, beforeEach } from "@effect/vitest";
import { DatabaseSync } from "node:sqlite";
import { makeDb, d1, run } from "./helpers.ts";
import { makeSiteRepository } from "../src/site/SiteRepository.ts";
import { makeMemberRepository } from "../src/members/MemberRepository.ts";
import { makeLeadRepository } from "../src/leads/LeadRepository.ts";
import type { Requester } from "../src/access/access.ts";

let db: DatabaseSync;

beforeEach(() => {
  db = makeDb();
});

const _repo = () => makeSiteRepository(d1(db));

const _owner = (id: string): Requester => ({ id, isAdmin: false });
const admin = { id: "admin-1", isAdmin: true };

describe("SiteRepository", () => {
  it("create -> get -> list -> update -> remove", async () => {
    const r = _repo();
    const created = await run(
      r.create({ name: "Aurora Studio", templateId: "editorial-studio" }, _owner("owner-1")),
    );
    expect(created.id).toBeTruthy();
    expect(created.ownerId).toBe("owner-1");
    expect(created.status).toBe("draft");
    expect(created.business.name).toBe("Aurora Studio");
    expect(created.pages).toHaveLength(1);

    const got = await run(r.get(created.id, _owner("owner-1")));
    expect(got.business.name).toBe("Aurora Studio");

    const list = await run(r.list(_owner("owner-1")));
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(created.id);

    const updated = await run(
      r.update(
        created.id,
        { ...got, business: { ...got.business, name: "Aurora 2" } },
        _owner("owner-1"),
      ),
    );
    expect(updated.business.name).toBe("Aurora 2");
    expect(updated.updatedAt).toBeTruthy();

    await run(r.remove(created.id, _owner("owner-1")));
    expect(await run(r.list(_owner("owner-1")))).toHaveLength(0);
  });

  it("owner scoping — other users cannot read a site", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));
    await expect(run(r.get(created.id, _owner("owner-2")))).rejects.toMatchObject({
      _tag: "SiteNotFound",
    });
  });

  it("admins can read any site", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));
    const got = await run(r.get(created.id, admin));
    expect(got.id).toBe(created.id);
  });

  it("access resolves full for the owner and null for strangers", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));
    expect(await run(r.access(created.id, _owner("owner-1")))).toEqual({ kind: "full" });
    expect(await run(r.access(created.id, admin))).toEqual({ kind: "full" });
    expect(await run(r.access(created.id, _owner("stranger")))).toBeNull();
    expect(await run(r.access("missing", _owner("owner-1")))).toBeNull();
  });

  it("markPublished sets status, publishedAt and buildStatus building", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));
    const published = await run(
      r.markPublished(created.id, _owner("owner-1"), "2026-08-09T00:00:00.000Z"),
    );
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBe("2026-08-09T00:00:00.000Z");
    expect(published.buildStatus).toBe("building");
  });

  it("markBuildResult records built/failed outcomes", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));

    const built = await run(
      r.markBuildResult(created.id, "owner-1", "built", "2026-08-09T01:00:00.000Z"),
    );
    expect(built.buildStatus).toBe("built");
    expect(built.lastBuiltAt).toBe("2026-08-09T01:00:00.000Z");
    expect(built.buildError).toBeUndefined();

    const failed = await run(
      r.markBuildResult(created.id, "owner-1", "failed", "2026-08-09T02:00:00.000Z", "boom"),
    );
    expect(failed.buildStatus).toBe("failed");
    expect(failed.buildError).toBe("boom");
    expect(failed.lastBuiltAt).toBeUndefined();
  });

  it("new sites are idle, and documents without buildStatus decode as idle", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));
    expect(created.buildStatus).toBe("idle");
    const got = await run(r.get(created.id, _owner("owner-1")));
    expect(got.buildStatus).toBe("idle");
  });

  it("setDomain -> verify (TXT ok) -> remove", async () => {
    const r = makeSiteRepository(d1(db), {
      verifyTxt: () => Promise.resolve(true),
    });
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));

    const setup = await run(r.setDomain(created.id, _owner("owner-1"), "example.com"));
    expect(setup.domain).toBe("example.com");
    expect(setup.status).toBe("pending");
    expect(setup.txtName).toBe("_site-studio-verify.example.com");
    expect(setup.txtValue).toMatch(/^site-studio-verify=/);

    const verified = await run(r.verifyDomain(created.id, _owner("owner-1")));
    expect(verified.customDomain).toBe("example.com");

    const removed = await run(r.removeDomain(created.id, _owner("owner-1")));
    expect(removed.customDomain).toBeUndefined();
  });

  it("verify fails when the TXT record is missing", async () => {
    const r = makeSiteRepository(d1(db), {
      verifyTxt: () => Promise.resolve(false),
    });
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));
    await run(r.setDomain(created.id, _owner("owner-1"), "example.com"));
    await expect(run(r.verifyDomain(created.id, _owner("owner-1")))).rejects.toMatchObject({
      _tag: "DomainNotVerified",
    });
  });

  it("a domain already claimed by another site is rejected", async () => {
    const r = _repo();
    const a = await run(r.create({ name: "A", templateId: "t" }, _owner("owner-1")));
    const b = await run(r.create({ name: "B", templateId: "t" }, _owner("owner-1")));
    await run(r.setDomain(a.id, _owner("owner-1"), "example.com"));
    await expect(run(r.setDomain(b.id, _owner("owner-1"), "example.com"))).rejects.toMatchObject({
      _tag: "DomainInUse",
    });
  });
});

describe("SiteRepository client access", () => {
  const addClient = (
    siteId: string,
    userId: string,
    email: string,
    toggles: {
      canEdit?: boolean;
      canPublish?: boolean;
      canLeads?: boolean;
    },
  ) => {
    db.prepare(
      `INSERT OR IGNORE INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES (?, 'Client', ?, 1, '2026-01-01', '2026-01-01')`,
    ).run(userId, email);
    return run(
      makeMemberRepository(d1(db)).invite(siteId, {
        email,
        canEdit: toggles.canEdit ?? false,
        canPublish: toggles.canPublish ?? false,
        canLeads: toggles.canLeads ?? false,
      }),
    );
  };

  it("a granted client can list and read the site", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await addClient(created.id, "client-1", "client@example.com", { canEdit: true });

    const list = await run(r.list(_owner("client-1")));
    expect(list.map((s) => s.id)).toEqual([created.id]);
    const got = await run(r.get(created.id, _owner("client-1")));
    expect(got.id).toBe(created.id);
  });

  it("a client can update content but never manager-only fields", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await run(r.markPublished(created.id, _owner("agency-1"), "2026-08-09T00:00:00.000Z"));
    const current = await run(r.get(created.id, _owner("agency-1")));
    await addClient(created.id, "client-1", "client@example.com", { canEdit: true });

    const clientEdit = await run(
      r.update(
        created.id,
        {
          ...current,
          business: { ...current.business, name: "Client's edit" },
          status: "published",
          customDomain: "evil.example.com",
          settings: {
            ...current.settings,
            analytics: { provider: "onedollarstats", siteId: "hacked" },
          },
        },
        _owner("client-1"),
      ),
    );
    expect(clientEdit.business.name).toBe("Client's edit");
    expect(clientEdit.status).toBe("published");
    expect(clientEdit.customDomain).toBeUndefined();
    expect(clientEdit.settings.analytics).toBeUndefined();
    expect(clientEdit.ownerId).toBe("agency-1");
  });

  it("a client without canEdit cannot update, publish, delete, or touch the domain", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("agency-1")));
    const current = await run(r.get(created.id, _owner("agency-1")));
    await addClient(created.id, "client-1", "client@example.com", {});

    await expect(run(r.update(created.id, current, _owner("client-1")))).rejects.toMatchObject({
      _tag: "Forbidden",
    });
    await expect(
      run(r.markPublished(created.id, _owner("client-1"), "2026-08-09T00:00:00.000Z")),
    ).rejects.toMatchObject({ _tag: "Forbidden" });
    await expect(run(r.remove(created.id, _owner("client-1")))).rejects.toMatchObject({
      _tag: "Forbidden",
    });
    await expect(
      run(r.setDomain(created.id, _owner("client-1"), "example.com")),
    ).rejects.toMatchObject({ _tag: "Forbidden" });
  });

  it("a client with canPublish can publish but not delete", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await addClient(created.id, "client-1", "client@example.com", { canPublish: true });

    const published = await run(
      r.markPublished(created.id, _owner("client-1"), "2026-08-09T00:00:00.000Z"),
    );
    expect(published.status).toBe("published");

    await expect(run(r.remove(created.id, _owner("client-1")))).rejects.toMatchObject({
      _tag: "Forbidden",
    });
  });

  it("leads are gated by canLeads", async () => {
    const r = _repo();
    const l = makeLeadRepository(d1(db));
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await run(l.create({ siteId: created.id, name: "N", email: "n@x.com" }));
    await addClient(created.id, "client-1", "client@example.com", { canLeads: false });

    await expect(run(l.listForSite(created.id, _owner("client-1")))).rejects.toMatchObject({
      _tag: "Forbidden",
    });

    await addClient(created.id, "client-1", "client@example.com", { canLeads: true });
    const leads = await run(l.listForSite(created.id, _owner("client-1")));
    expect(leads).toHaveLength(1);
  });

  it("a user with no relationship sees the site as not found", async () => {
    const r = _repo();
    const created = await run(r.create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await expect(run(r.get(created.id, _owner("stranger")))).rejects.toMatchObject({
      _tag: "SiteNotFound",
    });
  });
});
