import { describe, expect, it } from "@effect/vitest";
import { d1, makeDb, run } from "../test/helpers.ts";
import { makeBillingRepository } from "./BillingRepository.ts";
import { handleStripeEvent } from "./WebhookEvents.ts";

const now = "2026-02-01T00:00:00.000Z";

const _makeRepo = () => {
  const db = makeDb();
  db.prepare(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ('user-1', 'Test', 'user-1@example.test', 1, '2026-01-01', '2026-01-01')`,
  ).run();
  return makeBillingRepository(d1(db));
};

const _repoWithCustomer = async () => {
  const repo = _makeRepo();
  await run(repo.ensure("user-1", "2026-01-01T00:00:00.000Z"));
  await run(repo.setStripeCustomer("user-1", "cus_1", "2026-01-01T00:00:00.000Z"));
  return repo;
};

describe("handleStripeEvent", () => {
  it("activates Pro when checkout completes", async () => {
    const repo = _makeRepo();
    await run(
      handleStripeEvent(
        {
          kind: "checkout.completed",
          userId: "user-1",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
        },
        repo,
        now,
      ),
    );

    const row = await run(repo.forUser("user-1"));
    expect(row?.plan).toBe("pro");
    expect(row?.stripeSubscriptionId).toBe("sub_1");
  });

  it("activates Pro for an active subscription update", async () => {
    const repo = await _repoWithCustomer();
    await run(
      handleStripeEvent(
        {
          kind: "subscription.activated",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_2",
        },
        repo,
        now,
      ),
    );

    const row = await run(repo.forUser("user-1"));
    expect(row?.plan).toBe("pro");
    expect(row?.stripeSubscriptionId).toBe("sub_2");
  });

  it("revokes Pro when the subscription ends", async () => {
    const repo = await _repoWithCustomer();
    await run(
      handleStripeEvent(
        {
          kind: "subscription.activated",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
        },
        repo,
        now,
      ),
    );
    await run(
      handleStripeEvent(
        {
          kind: "subscription.inactive",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
        },
        repo,
        now,
      ),
    );

    const row = await run(repo.forUser("user-1"));
    expect(row?.plan).toBe("free");
  });

  it("leaves billing untouched for ignored events", async () => {
    const repo = await _repoWithCustomer();
    await run(handleStripeEvent({ kind: "ignored", type: "invoice.paid" }, repo, now));

    const row = await run(repo.forUser("user-1"));
    expect(row?.plan).toBe("free");
  });
});
