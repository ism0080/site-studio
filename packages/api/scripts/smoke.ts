import * as Schema from "effect/Schema"
import { Site, decodeSite, encodeSite } from "../src/site/site.ts"

const site = Schema.decodeUnknownSync(Site)({
  id: "site_test",
  ownerId: "dev-owner",
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
  settings: {
    accent: "#e56645",
    font: "Manrope",
    showDirectory: true,
    analytics: { provider: "onedollarstats", siteId: "aurora" },
  },
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
            eyebrow: "Thoughtful work",
            headline: "Make space.",
            description: "A small studio.",
            primaryCta: "Start",
            secondaryCta: "Learn",
            image: "",
          },
        },
        {
          id: "b2",
          type: "services",
          props: {
            title: "How we can help",
            items: [{ id: "s1", title: "Brand", description: "Clarity." }],
          },
        },
      ],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  publishedAt: "2026-01-01T00:00:00.000Z",
})

const encoded = encodeSite(site)
const decoded = Schema.decodeUnknownSync(Site)(
  JSON.parse(JSON.stringify(encoded)),
)
console.log(
  "round-trip ok:",
  decoded.id === site.id &&
    decoded.status === site.status &&
    decoded.pages.length === 1 &&
    decoded.pages[0].sections[0].type === "hero",
)
console.log("settings.analytics:", decoded.settings.analytics?.siteId)
