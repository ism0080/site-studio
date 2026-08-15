import * as Effect from "effect/Effect";
import { CurrentUser } from "../auth/auth.ts";
import { BuildJobSink } from "../publish/BuildJobSink.ts";
import { nowIso } from "../platform/Time.ts";
import { SiteStorage } from "../storage/SiteStorage.ts";
import { encodeSiteDocument, PublishError } from "./site.ts";
import { SiteRepository } from "./SiteRepository.ts";

// Marks a site published, stores its buildable document, then hands the build
// to the queue (BuildJobSink). The build runs asynchronously in the `build`
// consumer worker; the site's buildStatus records the outcome.
export const publishSite = Effect.fn("api.publishSite")(function* (siteId: string) {
  const user = yield* CurrentUser;
  const repo = yield* SiteRepository;
  const storage = yield* SiteStorage;
  const site = yield* repo.get(siteId, user.id);
  const publishedAt = yield* nowIso;
  // Store the site document as the buildable artifact, then build the static
  // HTML from it in the background (Astro template pipeline,
  // packages/site-template) and upload it to R2.
  const path = `sites/${site.id}/site.json`;
  yield* storage.putSiteDocument(site.id, encodeSiteDocument(site)).pipe(Effect.orDie);
  yield* repo.markPublished(siteId, user.id, publishedAt);
  const sink = yield* BuildJobSink;
  yield* sink
    .send({
      siteId: site.id,
      ownerId: user.id,
      document: encodeSiteDocument(site),
    })
    .pipe(
      Effect.mapError(
        () => new PublishError({ message: "could not hand the site to the build queue" }),
      ),
    );
  return { siteId: site.id, path, publishedAt };
});
