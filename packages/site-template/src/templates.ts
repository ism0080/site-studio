import type { Section } from "./site.ts";

export interface TemplateTheme {
  bg: string;
  accent: string;
  ink: string;
  surface: string;
  border: string;
  muted: string;
}

export type TemplateLayout = "editorial" | "warm" | "grid";

export interface SiteTemplate {
  id: string;
  name: string;
  font: string;
  layout: TemplateLayout;
  theme: TemplateTheme;
  /** Short label shown in the template gallery. */
  category: string;
  /** Demo brand mark rendered in the gallery card. */
  brand: string;
  /** Demo headline lines rendered in the gallery card. */
  title: string[];
  /** The home-page sections a brand-new site starts from (empty page fallback). */
  defaultSections: ReadonlyArray<Section>;
}

/**
 * Authoring entry point for a template. An identity function today, it gives
 * every template one place to gain dev-time validation later (e.g. asserting
 * the font is a known Google font). Prefer this over a bare object literal so
 * the authoring surface stays uniform.
 */
export const defineTemplate = (template: SiteTemplate): SiteTemplate => template;

// The starting content for brand-new sites: what the editor (and the
// published render) shows before the owner has saved any of their own.
// Built to reflect real small New Zealand businesses (plumbing, bakery, and craft collective).

const servicesDefaultSections: ReadonlyArray<Section> = [
  {
    id: "block_hero_01",
    type: "hero",
    props: {
      eyebrow: "Reliable & local plumbing services",
      headline: "Plumbing done right, the first time.",
      description:
        "From blocked drains and leaky taps to full home renovations, we provide honest, professional plumbing across the Nelson and Tasman region.",
      primaryCta: "Request a booking",
      secondaryCta: "Call 027 555 1234",
      image:
        "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1000&q=85",
    },
  },
  {
    id: "block_services_01",
    type: "services",
    props: {
      title: "Our plumbing services",
      items: [
        {
          id: "service_01",
          title: "Residential plumbing",
          description: "Maintenance, repairs, leaky pipe fixes, and kitchen or bathroom plumbing renovations.",
        },
        {
          id: "service_02",
          title: "Gas fitting & heating",
          description: "Safe installation and servicing of gas hobs, water heaters, and home heating systems.",
        },
        {
          id: "service_03",
          title: "24/7 emergency service",
          description: "Unexpected leaks or hot water issues? Call us anytime for urgent plumbing support.",
        },
      ],
    },
  },
  {
    id: "block_about_01",
    type: "about",
    props: {
      eyebrow: "About Tasman Plumbing",
      title: "Your trusted local plumbers.",
      body: "We are a fully licensed team with over 15 years of experience serving Nelson and Tasman homes. We pride ourselves on being on time, leaving a clean workspace, and giving you an honest upfront price.",
    },
  },
  {
    id: "block_testimonials_01",
    type: "testimonials",
    props: {
      title: "What our local customers say",
      items: [
        {
          id: "t_01",
          quote: "Fast, friendly, and fixed our hot water cylinder within hours of calling. Highly recommended!",
          author: "Sarah Jenkins",
          role: "Homeowner, Stoke",
        },
        {
          id: "t_02",
          quote: "The team did an amazing job on our bathroom renovation. Honest pricing and fantastic communication.",
          author: "Mark Thompson",
          role: "Property Manager, Richmond",
        },
      ],
    },
  },
];

const retailDefaultSections: ReadonlyArray<Section> = [
  {
    id: "block_hero_01",
    type: "hero",
    props: {
      eyebrow: "Sourdough, pastries & hot coffee",
      headline: "Baked fresh in Raglan every morning.",
      description:
        "A local, independent bakery dedicated to traditional long-fermentation sourdough, flaky pastries, and great organic coffee.",
      primaryCta: "See today's bake",
      secondaryCta: "Find our shop",
      image:
        "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&q=85",
    },
  },
  {
    id: "block_services_01",
    type: "services",
    props: {
      title: "From our ovens to you",
      items: [
        {
          id: "service_01",
          title: "Artisan sourdough",
          description: "Naturally leavened loaves baked daily using organic New Zealand flour.",
        },
        {
          id: "service_02",
          title: "Daily pastries",
          description: "Flaky croissants, sweet tarts, and seasonal brioche made fresh in-house.",
        },
        {
          id: "service_03",
          title: "Hot filter & espresso",
          description: "Expertly brewed coffee using beans sourced from local boutique roasters.",
        },
      ],
    },
  },
  {
    id: "block_about_01",
    type: "about",
    props: {
      eyebrow: "Our story",
      title: "Made with care, served with love.",
      body: "We started Aroha Bakery with a simple goal: to bring the joy of real, slow-fermented bread to our Raglan community. Every loaf is shaped by hand and baked with patience using locally sourced ingredients.",
    },
  },
  {
    id: "block_testimonials_01",
    type: "testimonials",
    props: {
      title: "Kind words from the community",
      items: [
        {
          id: "t_01",
          quote: "The best sourdough in the country, hands down. Get in early before the almond croissants sell out!",
          author: "Liam Wright",
          role: "Raglan Local",
        },
        {
          id: "t_02",
          quote: "A beautiful, warm atmosphere and the friendliest staff. It has become our daily morning ritual.",
          author: "Emma Davis",
          role: "Regular Visitor",
        },
      ],
    },
  },
];

const creativeDefaultSections: ReadonlyArray<Section> = [
  {
    id: "block_hero_01",
    type: "hero",
    props: {
      eyebrow: "Handmade ceramic wares & textiles",
      headline: "Beautiful things made slowly by hand.",
      description:
        "A collaborative showcase of independent New Zealand potters, weavers, and artists based in the heart of Wanaka.",
      primaryCta: "Explore the collection",
      secondaryCta: "Visit our gallery",
      image:
        "https://images.unsplash.com/photo-1523726491678-bf852e717f6a?auto=format&fit=crop&w=1000&q=85",
    },
  },
  {
    id: "block_services_01",
    type: "services",
    props: {
      title: "What we curate",
      items: [
        {
          id: "service_01",
          title: "Studio pottery",
          description: "Tactile, functional stoneware and porcelain thrown by hand in local studios.",
        },
        {
          id: "service_02",
          title: "Woven textiles",
          description: "Throws, cushions, and linen dyed with natural botanicals and hand-woven.",
        },
        {
          id: "service_03",
          title: "Artisan workshops",
          description: "Hands-on weekend classes teaching pottery, clay sculpting, and traditional weaving.",
        },
      ],
    },
  },
  {
    id: "block_about_01",
    type: "about",
    props: {
      eyebrow: "About the collective",
      title: "Connecting local makers with people who care.",
      body: "We believe the objects in our homes should carry stories. Kōwhai Craft Collective brings together independent South Island artists who share a deep respect for natural materials, sustainable practices, and timeless craft.",
    },
  },
  {
    id: "block_testimonials_01",
    type: "testimonials",
    props: {
      title: "From our supporters",
      items: [
        {
          id: "t_01",
          quote: "A stunning collection of unique pieces. I've bought several mugs and a gorgeous linen throw that I cherish.",
          author: "Sophia Morris",
          role: "Wanaka Local",
        },
        {
          id: "t_02",
          quote: "It is wonderful to have a space that truly values and supports independent New Zealand artisans.",
          author: "David Taylor",
          role: "Studio Potter & Member",
        },
      ],
    },
  },
];

/**
 * The visual language for each template. `settings.accent` / `settings.font`
 * in the site document override the accent/font below (set by the editor);
 * the rest of the palette and the layout come from here.
 */
const editorialStudio = defineTemplate({
  id: "editorial-studio",
  name: "Editorial Studio",
  font: "Manrope",
  layout: "editorial",
  category: "Creative",
  brand: "KŌWHAI",
  title: ["Local craft,", "thoughtfully", "made."],
  theme: {
    bg: "#f7f7f3",
    accent: "#e56645",
    ink: "#202320",
    surface: "#ffffff",
    border: "#e2e3dd",
    muted: "#6b7280",
  },
  defaultSections: creativeDefaultSections,
});
const warmMinimal = defineTemplate({
  id: "warm-minimal",
  name: "Warm Minimal",
  font: "Fraunces",
  layout: "warm",
  category: "Retail",
  brand: "AROHA",
  title: ["Fresh daily,", "warmly", "served."],
  theme: {
    bg: "#f2e9dc",
    accent: "#a8764e",
    ink: "#322d29",
    surface: "#faf5ea",
    border: "#e3d5bf",
    muted: "#7d7362",
  },
  defaultSections: retailDefaultSections,
});
const cleanGrid = defineTemplate({
  id: "clean-grid",
  name: "Clean Grid",
  font: "Space Grotesk",
  layout: "grid",
  category: "Services",
  brand: "TASMAN",
  title: ["Local plumbing,", "done right,", "first time."],
  theme: {
    bg: "#f6f8fa",
    accent: "#4567db",
    ink: "#18202b",
    surface: "#ffffff",
    border: "#e1e6ee",
    muted: "#64748b",
  },
  defaultSections: servicesDefaultSections,
});

/**
 * Every template, in gallery order. Add a new template's constant here — the
 * registry, the derived category list, the API gallery, and the editor all read
 * from this one array, so there is no separate registration step to forget.
 */
export const ALL_TEMPLATES: ReadonlyArray<SiteTemplate> = [
  editorialStudio,
  warmMinimal,
  cleanGrid,
];

export const TEMPLATES = new Map<string, SiteTemplate>(
  ALL_TEMPLATES.map((template) => [template.id, template]),
);

/**
 * Gallery filter options, derived from the templates themselves so a template
 * with a new `category` appears in the filter without touching the editor.
 * `"all"` leads; the rest follow first-seen order.
 */
export const TEMPLATE_CATEGORIES: ReadonlyArray<string> = [
  "all",
  ...new Set(ALL_TEMPLATES.map((template) => template.category)),
];

export const templateFor = (site: { templateId?: string }): SiteTemplate =>
  TEMPLATES.get(site.templateId ?? "") ?? editorialStudio;
