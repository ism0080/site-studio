import * as Schema from "effect/Schema";
import { http, HttpResponse, type HttpHandler } from "msw";
import {
  CreateSite,
  MemberInput,
  OwnerId,
  Site,
  SiteId,
  type Agency,
  type DomainSetup,
  type Lead,
  type Member,
  type PublishResult,
  type SiteAccess,
} from "@site-studio/api/contract";
import { mockMe, mockUser, seedAgencies, seedLeads, seedMembers, seedSites } from "./mockData.ts";

const DomainInput = Schema.Struct({ domain: Schema.String });

// Mutable working copies of the seed data, so create/update/publish/delete
// flows behave like the real backend across the dev session.
const sites: Site[] = [...seedSites];
const leads: Lead[] = [...seedLeads];
const members: Member[] = [...seedMembers];
const agencies: Agency[] = [...seedAgencies];

const _now = () => new Date().toISOString();

const _siteById = (id: string): Site | undefined => sites.find((s) => s.id === id);

const _siteNotFound = (id: string) =>
  HttpResponse.json({ _tag: "SiteNotFound", id }, { status: 404 });

// The API contract (src/lib/siteApiHttpClient.ts) issues these requests to a
// same-origin /api base, and better-auth issues /api/auth/* requests. MSW
// intercepts all of them in the browser, so the web app runs fully offline with
// mock data.
export const mockApiHandlers: HttpHandler[] = [
  // --- Better Auth ---------------------------------------------------------
  http.get("/api/auth/get-session", () =>
    HttpResponse.json({
      user: mockUser,
      session: { id: "sess_mock", userId: mockUser.id, expiresAt: null },
    }),
  ),
  http.post("/api/auth/sign-in/social", () =>
    HttpResponse.json({ token: null, redirect: true, url: "" }),
  ),
  http.post("/api/auth/sign-out", () => HttpResponse.json({ success: true })),

  // --- Me -------------------------------------------------------------------
  http.get("/api/me", () => HttpResponse.json(mockMe)),

  // --- Sites ----------------------------------------------------------------
  http.get("/api/sites", () => HttpResponse.json(sites)),
  http.post("/api/sites", async ({ request }) => {
    const input = Schema.decodeUnknownSync(CreateSite)(await request.json());
    const site: Site = {
      id: SiteId.make(`site_${Date.now()}`),
      ownerId: OwnerId.make(mockMe.id),
      templateId: input.templateId,
      status: "draft",
      buildStatus: "idle",
      createdAt: _now(),
      updatedAt: _now(),
      business: { name: input.name, category: "", location: "", email: "", phone: "", logo: "" },
      settings: { accent: "#4567db", font: "Manrope", showDirectory: true },
      pages: [],
    };
    sites.push(site);
    return HttpResponse.json(site, { status: 201 });
  }),
  http.put("/api/sites/:id", async ({ params, request }) => {
    if (!_siteById(String(params.id))) return _siteNotFound(String(params.id));
    const input = Schema.decodeUnknownSync(Site)(await request.json());
    const index = sites.findIndex((s) => s.id === params.id);
    const updated = { ...input, updatedAt: _now() };
    sites[index] = updated;
    return HttpResponse.json(updated);
  }),
  http.get("/api/sites/:id", ({ params }) => {
    const site = _siteById(String(params.id));
    if (!site) return _siteNotFound(String(params.id));
    return HttpResponse.json(site);
  }),
  http.get("/api/sites/:id/access", (): Response => {
    const access: SiteAccess = { kind: "full" };
    return HttpResponse.json(access);
  }),
  http.post("/api/sites/:id/publish", ({ params }): Response => {
    const index = sites.findIndex((s) => s.id === params.id);
    if (index === -1) return _siteNotFound(String(params.id));
    sites[index] = {
      ...sites[index],
      status: "published",
      buildStatus: "built",
      publishedAt: _now(),
      updatedAt: _now(),
    };
    const result: PublishResult = {
      siteId: SiteId.make(String(params.id)),
      path: "/",
      publishedAt: _now(),
    };
    return HttpResponse.json(result);
  }),
  http.post("/api/sites/:id/domain", async ({ params, request }): Promise<Response> => {
    const site = _siteById(String(params.id));
    if (!site) return _siteNotFound(String(params.id));
    const { domain } = Schema.decodeUnknownSync(DomainInput)(await request.json());
    const setup: DomainSetup = {
      domain,
      status: "pending",
      txtName: `_aquira.${domain}`,
      txtValue: "mock-txt-value",
      site,
    };
    return HttpResponse.json(setup);
  }),
  http.post("/api/sites/:id/domain/verify", () =>
    HttpResponse.json({ _tag: "DomainNotVerified", domain: "" }, { status: 409 }),
  ),
  http.delete("/api/sites/:id/domain", ({ params }): Response => {
    const site = _siteById(String(params.id));
    if (!site) return _siteNotFound(String(params.id));
    return HttpResponse.json(site);
  }),

  // --- Leads ----------------------------------------------------------------
  http.get("/api/sites/:id/leads", ({ params }) =>
    HttpResponse.json(leads.filter((l) => l.siteId === String(params.id))),
  ),
  http.delete("/api/sites/:id/leads/:leadId", ({ params }) => {
    const index = leads.findIndex(
      (l) => l.siteId === String(params.id) && l.id === String(params.leadId),
    );
    if (index !== -1) leads.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // --- Members --------------------------------------------------------------
  http.get("/api/sites/:id/members", ({ params }) =>
    HttpResponse.json(members.filter((m) => m.siteId === String(params.id))),
  ),
  http.post("/api/sites/:id/members", async ({ params, request }) => {
    const input = Schema.decodeUnknownSync(MemberInput)(await request.json());
    const member: Member = {
      siteId: SiteId.make(String(params.id)),
      email: input.email,
      canEdit: input.canEdit,
      canPublish: input.canPublish,
      canLeads: input.canLeads,
      pending: true,
      createdAt: _now(),
    };
    members.push(member);
    return HttpResponse.json(member, { status: 201 });
  }),
  http.put("/api/sites/:id/members/:email", async ({ params, request }) => {
    const index = members.findIndex(
      (m) => m.siteId === String(params.id) && m.email === String(params.email),
    );
    if (index === -1) return HttpResponse.json({ _tag: "MemberNotFound" }, { status: 404 });
    const input = Schema.decodeUnknownSync(MemberInput)(await request.json());
    const updated = { ...members[index], ...input };
    members[index] = updated;
    return HttpResponse.json(updated);
  }),
  http.delete("/api/sites/:id/members/:email", ({ params }) => {
    const index = members.findIndex(
      (m) => m.siteId === String(params.id) && m.email === String(params.email),
    );
    if (index !== -1) members.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // --- Admin ----------------------------------------------------------------
  http.get("/api/admin", () => HttpResponse.json(agencies)),
  http.post("/api/admin", async ({ request }) => {
    const { email } = Schema.decodeUnknownSync(Schema.Struct({ email: Schema.String }))(
      await request.json(),
    );
    const agency: Agency = { email, pending: true, createdAt: _now() };
    agencies.push(agency);
    return HttpResponse.json(agency, { status: 201 });
  }),
  http.delete("/api/admin/:email", ({ params }) => {
    const index = agencies.findIndex((a) => a.email === String(params.email));
    if (index !== -1) agencies.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
