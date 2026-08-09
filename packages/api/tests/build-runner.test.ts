import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { BuildRunner } from "../src/publish/BuildRunner.ts"
import { LocalBuildRunner } from "../scripts/build-runner/local.ts"
import { Site } from "../src/site/site.ts"

const site = Schema.decodeUnknownSync(Site)({
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
})

describe("LocalBuildRunner", () => {
  test(
    "publishes a site through the template publish.mjs",
    async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const runner = yield* BuildRunner
          return yield* runner.publish(site)
        }).pipe(Effect.provide(LocalBuildRunner)),
      )

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain("rendered")
      expect(result.buildId).toContain(site.id)
    },
    { timeout: 30000 },
  )
})
