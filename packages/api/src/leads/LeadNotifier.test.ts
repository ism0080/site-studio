import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import { makeNoopNotifier } from "./LeadNotifier.ts";
import { Lead } from "./leads.ts";
import { run } from "../test/helpers.ts";

describe("LeadNotifier", () => {
  it("noop notifier is a no-op success", async () => {
    const notifier = makeNoopNotifier();
    const lead = Schema.decodeUnknownSync(Lead)({
      id: "l",
      siteId: "s",
      name: "Jane",
      email: "j@x.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const result = await run(notifier.notify(lead, { name: "Aurora", email: "a@x.com" }));
    expect(result).toBeUndefined();
  });
});
