import { describe, expect, it, beforeEach } from "@effect/vitest";
import { DatabaseSync } from "node:sqlite";
import { makeDb, d1, run } from "./helpers.ts";
import { makeMemberRepository } from "../src/members/MemberRepository.ts";
import { makeAdminRepository } from "../src/admin/AdminRepository.ts";
import { makeSiteRepository } from "../src/site/SiteRepository.ts";

let db: DatabaseSync;

beforeEach(() => {
  db = makeDb();
});

const _members = () => makeMemberRepository(d1(db));
const _admin = () => makeAdminRepository(d1(db));
const _sites = () => makeSiteRepository(d1(db));

const _owner = (id: string) => ({ id, isAdmin: false });
const _toggles = (
  partial: Partial<{ canEdit: boolean; canPublish: boolean; canLeads: boolean }> = {},
) => ({
  canEdit: partial.canEdit ?? false,
  canPublish: partial.canPublish ?? false,
  canLeads: partial.canLeads ?? false,
});

describe("MemberRepository", () => {
  it("invites a not-yet-signed-up client as pending, then materializes on sign-in", async () => {
    const m = _members();
    const site = await run(_sites().create({ name: "A", templateId: "t" }, _owner("agency-1")));

    const invited = await run(
      m.invite(site.id, { email: "client@example.com", ..._toggles({ canEdit: true }) }),
    );
    expect(invited.pending).toBe(true);
    expect(invited.canEdit).toBe(true);

    // No account for that email yet — the invite is stored, not a member.
    let list = await run(m.list(site.id));
    expect(list).toHaveLength(1);
    expect(list[0]!.pending).toBe(true);

    // Client signs up: invite becomes a resolved member, then is consumed.
    await run(m.materialize("client-1", "client@example.com"));
    list = await run(m.list(site.id));
    expect(list).toHaveLength(1);
    expect(list[0]!.pending).toBe(false);

    // Materializing again is idempotent.
    await run(m.materialize("client-1", "client@example.com"));
    expect(await run(m.list(site.id))).toHaveLength(1);
  });

  it("adds an existing account directly (not pending)", async () => {
    const m = _members();
    const site = await run(_sites().create({ name: "A", templateId: "t" }, _owner("agency-1")));
    db.prepare(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u-1', 'Client', 'existing@example.com', 1, '2026-01-01', '2026-01-01')`,
    ).run();

    const added = await run(
      m.invite(site.id, { email: "existing@example.com", ..._toggles({ canLeads: true }) }),
    );
    expect(added.pending).toBe(false);
    const list = await run(m.list(site.id));
    expect(list[0]!.email).toBe("existing@example.com");
    expect(list[0]!.canLeads).toBe(true);
  });

  it("update changes toggles for members and pending invites", async () => {
    const m = _members();
    const site = await run(_sites().create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await run(m.invite(site.id, { email: "client@example.com", ..._toggles() }));

    const updated = await run(
      m.update(site.id, "client@example.com", _toggles({ canPublish: true })),
    );
    expect(updated.pending).toBe(true);
    expect(updated.canPublish).toBe(true);

    await expect(run(m.update(site.id, "nobody@example.com", _toggles()))).rejects.toMatchObject({
      _tag: "MemberNotFound",
    });
  });

  it("remove revokes both members and invites, and errors when absent", async () => {
    const m = _members();
    const site = await run(_sites().create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await run(m.invite(site.id, { email: "client@example.com", ..._toggles() }));
    await run(m.materialize("client-1", "client@example.com"));

    await run(m.remove(site.id, "client@example.com"));
    expect(await run(m.list(site.id))).toHaveLength(0);

    await expect(run(m.remove(site.id, "client@example.com"))).rejects.toMatchObject({
      _tag: "MemberNotFound",
    });
  });

  it("revoking an invite removes the pending row", async () => {
    const m = _members();
    const site = await run(_sites().create({ name: "A", templateId: "t" }, _owner("agency-1")));
    await run(m.invite(site.id, { email: "client@example.com", ..._toggles() }));
    await run(m.remove(site.id, "client@example.com"));
    expect(await run(m.list(site.id))).toHaveLength(0);
  });

  it("globalRole: env admin wins, then user_roles, else client", async () => {
    const m = _members();
    expect(await run(m.globalRole("u-1", "admin@example.com", ["admin@example.com"]))).toBe(
      "admin",
    );
    expect(await run(m.globalRole("u-1", "anyone@example.com", []))).toBe("client");

    db.prepare(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u-1', 'Role', 'role@example.com', 1, '2026-01-01', '2026-01-01')`,
    ).run();
    db.prepare(
      "INSERT INTO user_roles (user_id, role, created_at) VALUES ('u-1', 'agency', '2026-01-01')",
    ).run();
    expect(await run(m.globalRole("u-1", "agency@example.com", []))).toBe("agency");
  });
});

describe("AdminRepository", () => {
  it("invite -> list -> remove for existing users and pending emails", async () => {
    const a = _admin();
    db.prepare(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u-1', 'Agency', 'agency@example.com', 1, '2026-01-01', '2026-01-01')`,
    ).run();

    const promoted = await run(a.invite("agency@example.com"));
    expect(promoted.pending).toBe(false);

    const invited = await run(a.invite("new-agency@example.com"));
    expect(invited.pending).toBe(true);

    let list = await run(a.list());
    expect(list.map((x) => x.email).toSorted()).toEqual([
      "agency@example.com",
      "new-agency@example.com",
    ]);

    await run(a.remove("agency@example.com"));
    await run(a.remove("new-agency@example.com"));
    list = await run(a.list());
    expect(list).toHaveLength(0);
  });

  it("an agency invite materializes into a role on sign-in", async () => {
    const m = _members();
    const a = _admin();
    await run(a.invite("future-agency@example.com"));

    db.prepare(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u-2', 'Future', 'future-agency@example.com', 1, '2026-01-01', '2026-01-01')`,
    ).run();
    await run(m.materialize("u-2", "future-agency@example.com"));
    expect(await run(m.globalRole("u-2", "future-agency@example.com", []))).toBe("agency");
  });
});
