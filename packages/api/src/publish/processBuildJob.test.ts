import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { makeDb, d1, run } from "../test/helpers.ts";
import { BuildError, BuildRunner } from "../publish/BuildRunner.ts";
import { encodeBuildJob } from "../publish/BuildQueue.ts";
import { processBuildJob } from "../publish/processBuildJob.ts";
import { makeSiteRepository, SiteRepository } from "../site/SiteRepository.ts";
import { encodeSiteDocument, Site } from "../site/site.ts";
import type { Requester } from "../access/access.ts";

const owner = { id: "owner-1", isAdmin: false } satisfies Requester;

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

const _job = (site: Site) =>
  encodeBuildJob({
    siteId: site.id,
    ownerId: site.ownerId,
    document: encodeSiteDocument(site),
  });

const _seed = async (db: ReturnType<typeof makeDb>) => {
  const repo = makeSiteRepository(d1(db));
  const created = await run(
    repo.create({ name: "Aurora Studio", templateId: "editorial-studio" }, owner),
  );
  const site = Schema.decodeUnknownSync(Site)({ ...sample, id: created.id });
  return { repo, site };
};

describe("processBuildJob", () => {
  it("marks the site built when the build succeeds", async () => {
    const db = makeDb();
    const { repo, site } = await _seed(db);

    const build: BuildRunner["Service"] = {
      publish: (s) => Effect.succeed({ buildId: `build-${s.id}`, exitCode: 0, output: "rendered" }),
    };

    await run(
      processBuildJob(_job(site)).pipe(
        Effect.provideService(SiteRepository, repo),
        Effect.provideService(BuildRunner, build),
      ),
    );

    const stored = await run(repo.get(site.id, owner));
    expect(stored.buildStatus).toBe("built");
    expect(stored.lastBuiltAt).toBeTruthy();
    expect(stored.buildError).toBeUndefined();
  });

  it("marks the site failed and re-throws so the queue retries", async () => {
    const db = makeDb();
    const { repo, site } = await _seed(db);

    const build: BuildRunner["Service"] = {
      publish: () => Effect.fail(new BuildError({ message: "astro build failed" })),
    };

    const failure = await run(
      Effect.flip(
        processBuildJob(_job(site)).pipe(
          Effect.provideService(SiteRepository, repo),
          Effect.provideService(BuildRunner, build),
        ),
      ),
    );

    expect(failure._tag).toBe("BuildError");
    const stored = await run(repo.get(site.id, owner));
    expect(stored.buildStatus).toBe("failed");
    expect(stored.buildError).toContain("astro build failed");
  });
});
