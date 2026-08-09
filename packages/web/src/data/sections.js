let idCounter = 0;

export function nextId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

export const SECTION_TYPES = {
  hero: {
    label: "Hero",
    sub: "Intro + call to action",
    hint: "Intro + call to action",
    create: () => ({
      id: nextId("block_hero"),
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
    sub: (props) => `${props.items.length} items`,
    hint: "A list of services",
    create: () => ({
      id: nextId("block_services"),
      type: "services",
      props: {
        title: "How we can help",
        items: [
          {
            id: nextId("service"),
            title: "First service",
            description: "Describe what you offer.",
          },
          {
            id: nextId("service"),
            title: "Second service",
            description: "Describe what you offer.",
          },
          {
            id: nextId("service"),
            title: "Third service",
            description: "Describe what you offer.",
          },
        ],
      },
    }),
  },
  about: {
    label: "About",
    sub: "Rich text content",
    hint: "Rich text content",
    create: () => ({
      id: nextId("block_about"),
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
    sub: (props) => `${props.items.length} items`,
    hint: "Quotes from your clients",
    create: () => ({
      id: nextId("block_testimonials"),
      type: "testimonials",
      props: {
        title: "Kind words from clients",
        items: [
          {
            id: nextId("testimonial"),
            quote: "Working with this team was a genuine delight.",
            author: "Maya Chen",
            role: "Founder, Field Notes",
          },
          {
            id: nextId("testimonial"),
            quote: "Clear, kind, and incredibly skilled throughout.",
            author: "Jon Bell",
            role: "Creative Director",
          },
        ],
      },
    }),
  },
};
