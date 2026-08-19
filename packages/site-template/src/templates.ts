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

// The starting content for a brand-new site: what the editor (and the
// published render) shows before the owner has saved any of their own.
// Mirrors the hero/services/about/testimonials sample document.
const defaultHomeSections: ReadonlyArray<Section> = [
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
      body: "We believe the most useful things are made with care. Our process is collaborative, clear, and shaped around the people we work with.",
    },
  },
  {
    id: "block_testimonials_01",
    type: "testimonials",
    props: {
      title: "Kind words from clients",
      items: [
        {
          id: "t_01",
          quote: "Working with this team was a genuine delight.",
          author: "Maya Chen",
          role: "Founder, Field Notes",
        },
        {
          id: "t_02",
          quote: "Clear, kind, and incredibly skilled throughout.",
          author: "Jon Bell",
          role: "Creative Director",
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
const editorialStudio: SiteTemplate = {
  id: "editorial-studio",
  name: "Editorial Studio",
  font: "Manrope",
  layout: "editorial",
  category: "Creative",
  brand: "AURORA",
  title: ["Make space", "for what", "matters."],
  theme: {
    bg: "#f7f7f3",
    accent: "#e56645",
    ink: "#202320",
    surface: "#ffffff",
    border: "#e2e3dd",
    muted: "#6b7280",
  },
  defaultSections: defaultHomeSections,
};
const warmMinimal: SiteTemplate = {
  id: "warm-minimal",
  name: "Warm Minimal",
  font: "Fraunces",
  layout: "warm",
  category: "Retail",
  brand: "NORTH",
  title: ["Good work,", "warmly."],
  theme: {
    bg: "#f2e9dc",
    accent: "#a8764e",
    ink: "#322d29",
    surface: "#faf5ea",
    border: "#e3d5bf",
    muted: "#7d7362",
  },
  defaultSections: defaultHomeSections,
};
const cleanGrid: SiteTemplate = {
  id: "clean-grid",
  name: "Clean Grid",
  font: "Space Grotesk",
  layout: "grid",
  category: "Services",
  brand: "FORM /",
  title: ["Make it", "clear."],
  theme: {
    bg: "#f6f8fa",
    accent: "#4567db",
    ink: "#18202b",
    surface: "#ffffff",
    border: "#e1e6ee",
    muted: "#64748b",
  },
  defaultSections: defaultHomeSections,
};

export const TEMPLATES = new Map<string, SiteTemplate>([
  ["editorial-studio", editorialStudio],
  ["warm-minimal", warmMinimal],
  ["clean-grid", cleanGrid],
]);

export const templateFor = (site: { templateId?: string }): SiteTemplate =>
  TEMPLATES.get(site.templateId ?? "") ?? editorialStudio;
