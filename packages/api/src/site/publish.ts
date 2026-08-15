import * as Effect from "effect/Effect";
import { CurrentUser } from "../auth/auth.ts";
import { nowIso } from "../platform/Time.ts";
import { SiteStorage } from "../storage/SiteStorage.ts";
import { encodeSiteDocument } from "./site.ts";
import { SiteRepository } from "./SiteRepository.ts";

export const publishSite = Effect.fn("api.publishSite")(function* (siteId: string) {
  const user = yield* CurrentUser;
  const repo = yield* SiteRepository;
  const storage = yield* SiteStorage;
  const site = yield* repo.get(siteId, user.id);
  const publishedAt = yield* nowIso;
  // Store the site document as the buildable artifact. Static HTML is
  // generated from it by the Astro template pipeline
  // (packages/site-template) and uploaded to R2 under the same key.
  const path = `sites/${site.id}/site.json`;
  yield* storage.putSiteDocument(site.id, encodeSiteDocument(site)).pipe(Effect.orDie);
  yield* repo.markPublished(siteId, user.id, publishedAt);
  return { siteId: site.id, path, publishedAt };
});
