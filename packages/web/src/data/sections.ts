import type { SectionMeta, SectionType } from "../siteTypes.ts";

let idCounter = 0;

export function nextPrefixedId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

/** Registry of every section type: label, hint, and a factory that creates a default section. */
export const SECTION_TYPES = {
  hero: {
    label: "Hero",
    sub: () => "Intro + call to action",
    hint: "Intro + call to action",
    create: () => ({
      id: nextPrefixedId("block_hero"),
      type: "hero",
      props: {
        eyebrow: "Welcome",
        headline: "A fresh start.",
        description: "Tell visitors what you do in a sentence or two.",
        primaryCta: "Get in touch",
        secondaryCta: "Learn more",
        image: "",
      },
    }),
  },
  services: {
    label: "Services",
    sub: (props) => ("items" in props ? `${props.items.length} items` : "Services"),
    hint: "A list of services",
    create: () => ({
      id: nextPrefixedId("block_services"),
      type: "services",
      props: {
        title: "How we can help",
        items: [
          {
            id: nextPrefixedId("service"),
            title: "First service",
            description: "Describe what you offer.",
          },
          {
            id: nextPrefixedId("service"),
            title: "Second service",
            description: "Describe what you offer.",
          },
          {
            id: nextPrefixedId("service"),
            title: "Third service",
            description: "Describe what you offer.",
          },
        ],
      },
    }),
  },
  about: {
    label: "About",
    sub: () => "Rich text content",
    hint: "Rich text content",
    create: () => ({
      id: nextPrefixedId("block_about"),
      type: "about",
      props: {
        eyebrow: "A little about us",
        title: "A new section.",
        body: "Tell your story here.",
      },
    }),
  },
  testimonials: {
    label: "Testimonials",
    sub: (props) => ("items" in props ? `${props.items.length} items` : "Testimonials"),
    hint: "Quotes from your clients",
    create: () => ({
      id: nextPrefixedId("block_testimonials"),
      type: "testimonials",
      props: {
        title: "Kind words from clients",
        items: [
          {
            id: nextPrefixedId("testimonial"),
            quote: "Working with this team was a genuine delight.",
            author: "Maya Chen",
            role: "Founder, Field Notes",
          },
          {
            id: nextPrefixedId("testimonial"),
            quote: "Clear, kind, and incredibly skilled throughout.",
            author: "Jon Bell",
            role: "Creative Director",
          },
        ],
      },
    }),
  },
} satisfies Record<SectionType, SectionMeta>;

/** Order in which section types appear in the "add a section" picker. */
export const SECTION_ORDER: SectionType[] = ["hero", "services", "about", "testimonials"];
