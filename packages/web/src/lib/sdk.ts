import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { SiteApi, type CreateSite, type Site } from "@site-studio/api/contract";

type ApiClient = HttpApiClient.ForApi<typeof SiteApi>;

// The HttpApi group prefixes already include `/api/sites`/`/api/leads`, so the
// client base is the API origin (empty = same-origin, proxied by Vite in dev).
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

let clientPromise: Promise<ApiClient> | undefined;

const _run = <A>(call: (c: ApiClient) => Effect.Effect<A, unknown, never>): Promise<A> => {
  clientPromise ??= Effect.runPromise(
    HttpApiClient.make(SiteApi, { baseUrl: API_ORIGIN }).pipe(
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.RequestInit, { credentials: "include" }),
    ),
  );
  return clientPromise.then((c) => Effect.runPromise(call(c)));
};

export const sdk = {
  listSites: () => _run((c) => c.Sites.list({})),
  getSite: (id: string) => _run((c) => c.Sites.get({ params: { id } })),
  createSite: (payload: CreateSite) => _run((c) => c.Sites.create({ payload })),
  updateSite: (id: string, payload: Site) =>
    _run((c) => c.Sites.update({ params: { id }, payload })),
  publishSite: (id: string) => _run((c) => c.Sites.publish({ params: { id } })),
  setDomain: (id: string, domain: string) =>
    _run((c) => c.Sites.setDomain({ params: { id }, payload: { domain } })),
  verifyDomain: (id: string) => _run((c) => c.Sites.verifyDomain({ params: { id } })),
  removeDomain: (id: string) => _run((c) => c.Sites.removeDomain({ params: { id } })),
  listLeads: (siteId: string) => _run((c) => c.SiteLeads.listLeads({ params: { id: siteId } })),
  deleteLead: (siteId: string, leadId: string) =>
    _run((c) => c.SiteLeads.deleteLead({ params: { id: siteId, leadId } })),
};
