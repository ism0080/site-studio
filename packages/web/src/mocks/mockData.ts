import { LeadId, OwnerId, SiteId } from "@site-studio/api/contract";
import type { Agency, Lead, Me, Member, Site } from "@site-studio/api/contract";

/** The signed-in mock user's "me" profile (admin role). */
export const mockMe: Me = {
  id: "user_mock_admin",
  email: "admin@aquira.cloud",
  role: "admin",
};

/** The mock better-auth user returned by the session endpoint. */
export const mockUser = {
  id: mockMe.id,
  name: "Jordan",
  email: mockMe.email,
  emailVerified: true,
  image: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const _now = () => new Date().toISOString();

export const seedSites: Site[] = [
  {
    id: SiteId.make("site_aurora_01"),
    ownerId: OwnerId.make("dev-owner"),
    templateId: "editorial-studio",
    status: "published",
    buildStatus: "built",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-02T00:00:00.000Z",
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
            id: "block_hero_01",
            type: "hero",
            props: {
              eyebrow: "Thoughtful work, beautifully made",
              headline: "Make space for what matters.",
              description:
                "A small, independent studio helping people and brands bring their best ideas into focus.",
              primaryCta: "Start a conversation",
              secondaryCta: "Explore our work",
              image:
                "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?auto=format&fit=crop&w=1000&q=85",
            },
          },
          {
            id: "block_services_01",
            type: "services",
            props: {
              title: "How we can help",
              items: [
                {
                  id: "service_01",
                  title: "Brand direction",
                  description: "Clarity, character, and a visual language that feels like you.",
                },
                {
                  id: "service_02",
                  title: "Digital experiences",
                  description: "Websites and tools that make good ideas easier to find.",
                },
                {
                  id: "service_03",
                  title: "Ongoing support",
                  description: "A thoughtful partner for the next chapter, whenever it arrives.",
                },
              ],
            },
          },
          {
            id: "block_about_01",
            type: "about",
            props: {
              eyebrow: "A little about us",
              title: "A considered approach to better work.",
              body: "We believe the most useful things are made with care.",
            },
          },
        ],
      },
    ],
  },
  {
    id: SiteId.make("site_north_02"),
    ownerId: OwnerId.make("dev-owner"),
    templateId: "warm-minimal",
    status: "draft",
    buildStatus: "idle",
    createdAt: "2026-02-10T00:00:00.000Z",
    updatedAt: "2026-02-12T00:00:00.000Z",
    business: {
      name: "North Supply Co",
      category: "Outdoor goods",
      location: "Boise, Idaho",
      email: "hello@northsupply.co",
      phone: "(208) 555-0132",
      logo: "NORTH",
    },
    settings: { accent: "#a8764e", font: "Fraunces", showDirectory: false },
    pages: [
      {
        id: "page_home",
        slug: "/",
        title: "Homepage",
        sections: [
          {
            id: "block_hero_01",
            type: "hero",
            props: {
              eyebrow: "Gear for the long way round",
              headline: "Made to be carried.",
              description: "Dependable outdoor gear, built for the trips that matter.",
              primaryCta: "Shop the range",
              secondaryCta: "Our story",
              image: "",
            },
          },
        ],
      },
    ],
  },
];

export const seedLeads: Lead[] = [
  {
    id: LeadId.make("lead_001"),
    siteId: SiteId.make("site_aurora_01"),
    name: "Maya Chen",
    email: "maya@fieldnotes.co",
    message: "Hi, we'd love to talk about a rebrand for our studio.",
    createdAt: _now(),
  },
  {
    id: LeadId.make("lead_002"),
    siteId: SiteId.make("site_aurora_01"),
    name: "Jon Bell",
    email: "jon@example.com",
    message: "Interested in a new website for our design consultancy.",
    createdAt: _now(),
  },
];

export const seedMembers: Member[] = [
  {
    siteId: SiteId.make("site_aurora_01"),
    email: "client@example.com",
    canEdit: true,
    canPublish: false,
    canLeads: true,
    pending: false,
    createdAt: _now(),
  },
  {
    siteId: SiteId.make("site_aurora_01"),
    email: "invitee@example.com",
    canEdit: false,
    canPublish: false,
    canLeads: false,
    pending: true,
    createdAt: _now(),
  },
];

export const seedAgencies: Agency[] = [
  { email: "agency@studio.co", pending: false, createdAt: _now() },
  { email: "pending@studio.co", pending: true, createdAt: _now() },
];
