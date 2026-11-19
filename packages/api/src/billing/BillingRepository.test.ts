import { describe, expect, it } from "@effect/vitest";
import { d1, makeDb, run } from "../test/helpers.ts";
import { makeBillingRepository } from "./BillingRepository.ts";

const _makeRepo = () => {
  const db = makeDb();
  db.prepare(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ('user-1', 'Test', 'user-1@example.test', 1, '2026-01-01', '2026-01-01')`,
  ).run();
  return makeBillingRepository(d1(db));
};

describe("BillingRepository", () => {
  it("creates a Free plan row on first touch and keeps it", async () => {
    const repo = _makeRepo();
    const first = await run(repo.ensure("user-1", "2026-01-01T00:00:00.000Z"));
    const second = await run(repo.ensure("user-1", "2026-01-02T00:00:00.000Z"));

    expect(first.plan).toBe("free");
    expect(first.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(second.updatedAt).toBe(first.updatedAt);
  });

  it("activates Pro and resolves the account by Stripe customer", async () => {
    const repo = _makeRepo();
    await run(repo.ensure("user-1", "2026-01-01T00:00:00.000Z"));
    await run(
      repo.activatePro("user-1", {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        now: "2026-01-05T00:00:00.000Z",
      }),
    );

    const row = await run(repo.forCustomer("cus_1"));
    expect(row?.plan).toBe("pro");
    expect(row?.userId).toBe("user-1");
    expect(row?.stripeSubscriptionId).toBe("sub_1");
  });

  it("revokes Pro back to the Free plan", async () => {
    const repo = _makeRepo();
    await run(
      repo.activatePro("user-1", {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        now: "2026-01-05T00:00:00.000Z",
      }),
    );
    await run(repo.revokePro("user-1", "2026-02-01T00:00:00.000Z"));

    const row = await run(repo.forUser("user-1"));
    expect(row?.plan).toBe("free");
    expect(row?.stripeSubscriptionId).toBeNull();
  });
});
