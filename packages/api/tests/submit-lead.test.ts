import { describe, expect, it, beforeEach } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { DatabaseSync } from "node:sqlite";
import { makeDb, d1, run } from "./helpers.ts";
import { makeLeadRepository, LeadRepository } from "../src/leads/LeadRepository.ts";
import { LeadNotifier, type NotifyTarget } from "../src/leads/LeadNotifier.ts";
import { LeadRateLimiter, submitLead } from "../src/leads/submitLead.ts";
import { makeSiteRepository } from "../src/site/SiteRepository.ts";
import type { Lead } from "../src/leads/leads.ts";

let db: DatabaseSync;

beforeEach(() => {
  db = makeDb();
});

describe("submitLead", () => {
  it("creates the lead and notifies the site owner, in order", async () => {
    const siteRepo = makeSiteRepository(d1(db));
    const created = await run(
      siteRepo.create({ name: "Aurora Studio", templateId: "editorial-studio" }, "owner-1"),
    );
    const leads = makeLeadRepository(d1(db));

    const events: string[] = [];
    const notifier = {
      notify: (_lead: Lead, _site: NotifyTarget) =>
        Effect.sync(() => {
          events.push("notify");
        }),
    };

    const lead = await run(
      submitLead(
        {
          siteId: created.id,
          name: "Ada",
          email: "ada@example.com",
          message: "Hello",
        },
        "1.2.3.4",
      ).pipe(
        Effect.provideService(LeadRateLimiter, { limit: () => Effect.succeed(true) }),
        Effect.provideService(LeadRepository, leads),
        Effect.provideService(LeadNotifier, notifier),
      ),
    );

    expect(events).toEqual(["notify"]);
    expect(lead.name).toBe("Ada");
    expect(lead.email).toBe("ada@example.com");

    const listed = await run(leads.listForSite(created.id, "owner-1"));
    expect(listed).toHaveLength(1);
    expect(listed[0]!.email).toBe("ada@example.com");
  });

  it("returns TooManyRequests before creating a lead when throttled", async () => {
    const leads = makeLeadRepository(d1(db));

    await expect(
      run(
        submitLead(
          { siteId: "site_test", name: "Ada", email: "ada@example.com", message: "Hello" },
          "1.2.3.4",
        ).pipe(
          Effect.provideService(LeadRateLimiter, { limit: () => Effect.succeed(false) }),
          Effect.provideService(LeadRepository, leads),
          Effect.provideService(LeadNotifier, { notify: () => Effect.void }),
        ),
      ),
    ).rejects.toMatchObject({ _tag: "TooManyRequests" });
  });
});
