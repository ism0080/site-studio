import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeDb, d1, run } from "./helpers.ts";
import { CurrentUser } from "../src/auth/auth.ts";
import { SiteStorage, type SiteStorageService } from "../src/storage/SiteStorage.ts";
import {
  makeSiteRepository,
  SiteRepository,
  type SiteRepositoryService,
} from "../src/site/SiteRepository.ts";
import { publishSite } from "../src/site/publish.ts";

const owner = { id: "owner-1", email: "a@b.co" };

describe("publishSite", () => {
  it("stores the site document, then marks the site published", async () => {
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

    const result = await run(
      publishSite(created.id).pipe(
        Effect.provideService(CurrentUser, owner),
        Effect.provideService(SiteRepository, trackingRepo),
        Effect.provideService(SiteStorage, storage),
      ),
    );

    expect(result.path).toBe(`sites/${created.id}/site.json`);
    expect(result.publishedAt).toBeTruthy();
    expect(storedDocument).toContain("Aurora Studio");
    expect(events).toEqual([`putSiteDocument:${created.id}`, "markPublished"]);

    const site = await run(repo.get(created.id, owner.id));
    expect(site.status).toBe("published");
    expect(site.publishedAt).toBe(result.publishedAt);
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
        ),
      ),
    ).rejects.toMatchObject({ _tag: "SiteNotFound" });
  });
});
