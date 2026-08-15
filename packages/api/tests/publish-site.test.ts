import { describe, expect, it } from "@effect/vitest";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { makeDb, d1, run } from "./helpers.ts";
import { CurrentUser } from "../src/auth/auth.ts";
import { BuildJobSink } from "../src/publish/BuildJobSink.ts";
import { SiteStorage, type SiteStorageService } from "../src/storage/SiteStorage.ts";
import {
  makeSiteRepository,
  SiteRepository,
  type SiteRepositoryService,
} from "../src/site/SiteRepository.ts";
import { publishSite } from "../src/site/publish.ts";

const owner = { id: "owner-1", email: "a@b.co" };

const noopSink: BuildJobSink["Service"] = {
  send: () => Effect.void,
};

describe("publishSite", () => {
  it("stores the site document, marks it published+building, then enqueues a build", async () => {
    const db = makeDb();
    const repo = makeSiteRepository(d1(db));
    const created = await run(
      repo.create({ name: "Aurora Studio", templateId: "editorial-studio" }, owner.id),
    );

    const events: string[] = [];
    let storedDocument: string | undefined;
    const trackingRepo: SiteRepositoryService = {
      ...repo,
      markPublished: (id, ownerId, publishedAt) => {
        events.push("markPublished");
        return repo.markPublished(id, ownerId, publishedAt);
      },
    };
    const storage: SiteStorageService = {
      putSiteDocument: (siteId: string, document: string) =>
        Effect.sync(() => {
          events.push(`putSiteDocument:${siteId}`);
          storedDocument = document;
        }),
      getSiteDocument: () => Effect.succeed(null),
    };
    const sink: BuildJobSink["Service"] = {
      send: (job) =>
        Effect.sync(() => {
          events.push(`enqueue:${job.siteId}`);
        }),
    };

    const result = await run(
      publishSite(created.id).pipe(
        Effect.provideService(CurrentUser, owner),
        Effect.provideService(SiteRepository, trackingRepo),
        Effect.provideService(SiteStorage, storage),
        Effect.provideService(BuildJobSink, sink),
      ),
    );

    expect(result.path).toBe(`sites/${created.id}/site.json`);
    expect(result.publishedAt).toBeTruthy();
    expect(storedDocument).toContain("Aurora Studio");
    expect(events).toEqual([
      `putSiteDocument:${created.id}`,
      "markPublished",
      `enqueue:${created.id}`,
    ]);

    const site = await run(repo.get(created.id, owner.id));
    expect(site.status).toBe("published");
    expect(site.buildStatus).toBe("building");
    expect(site.publishedAt).toBe(result.publishedAt);
  });

  it("fails with PublishError when the build cannot be enqueued", async () => {
    const db = makeDb();
    const repo = makeSiteRepository(d1(db));
    const created = await run(
      repo.create({ name: "Aurora Studio", templateId: "editorial-studio" }, owner.id),
    );

    const storage: SiteStorageService = {
      putSiteDocument: () => Effect.void,
      getSiteDocument: () => Effect.succeed(null),
    };
    const failingSink: BuildJobSink["Service"] = {
      send: () => Effect.fail(new Cloudflare.Queues.SendError({ message: "queue down" })),
    };

    await expect(
      run(
        publishSite(created.id).pipe(
          Effect.provideService(CurrentUser, owner),
          Effect.provideService(SiteRepository, repo),
          Effect.provideService(SiteStorage, storage),
          Effect.provideService(BuildJobSink, failingSink),
        ),
      ),
    ).rejects.toMatchObject({ _tag: "PublishError" });
  });

  it("fails fast when the site is not found", async () => {
    const db = makeDb();
    const repo = makeSiteRepository(d1(db));

    await expect(
      run(
        publishSite("missing").pipe(
          Effect.provideService(CurrentUser, owner),
          Effect.provideService(SiteRepository, repo),
          Effect.provideService(SiteStorage, {
            putSiteDocument: () => Effect.void,
            getSiteDocument: () => Effect.succeed(null),
          }),
          Effect.provideService(BuildJobSink, noopSink),
        ),
      ),
    ).rejects.toMatchObject({ _tag: "SiteNotFound" });
  });
});
