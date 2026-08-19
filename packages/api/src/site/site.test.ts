import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";
import { Lead } from "../leads/leads.ts";
import { Site, SiteJson } from "./site.ts";

const sample = Schema.decodeUnknownSync(Site)({
  id: "site_1",
  ownerId: "owner-1",
  templateId: "editorial-studio",
  status: "published",
  business: {
    name: "Aurora Studio",
    category: "Independent creative studio",
    location: "Portland, Oregon",
    email: "hello@aurorastudio.co",
    phone: "(503) 555-0148",
    logo: "AURORA",
  },
  settings: { accent: "#e56645", font: "Manrope", showDirectory: true },
  pages: [
    {
      id: "page_home",
      slug: "/",
      title: "Homepage",
      sections: [
        {
          id: "b1",
          type: "hero",
          props: {
            eyebrow: "Eyebrow",
            headline: "Headline",
            description: "Description",
            primaryCta: "Start",
            secondaryCta: "Learn",
            image: "",
          },
        },
      ],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("site schema", () => {
  it("Site round-trips through encode/decode", () => {
    const decoded = Schema.decodeUnknownSync(SiteJson)(Schema.encodeSync(SiteJson)(sample));
    expect(decoded.id).toBe(sample.id);
    expect(decoded.status).toBe("published");
    expect(decoded.pages[0]!.sections[0]!.type).toBe("hero");
    expect(decoded.settings.accent).toBe("#e56645");
  });

  it("Lead schema decodes", () => {
    const lead = Schema.decodeUnknownSync(Lead)({
      id: "lead_1",
      siteId: "site_1",
      name: "Jane",
      email: "jane@x.com",
      message: "hi",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(lead.siteId).toBe("site_1");
  });
});
