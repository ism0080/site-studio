// GENERATED FILE — written by scripts/render.mjs. Do not edit by hand.
import type { Site } from "./site.ts";

export const site =
  /* SAFETY: The document was decoded from the site document JSON at the render boundary; its structure matches the Site schema. */ {
    id: "site_test_build",
    ownerId: "owner-1",
    templateId: "clean-grid",
    status: "published",
    business: {
      name: "Test Studio",
      category: "Test",
      location: "Portland",
      email: "hello@test.studio",
      phone: "",
      logo: "TEST",
    },
    settings: {
      accent: "#4567db",
      font: "Space Grotesk",
      showDirectory: true,
      bg: "#101422",
      ink: "#f5f7ff",
      surface: "#1a2138",
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
  } as Site;
