export const initialSite = {
  id: "site_aurora_01",
  templateId: "editorial-studio",
  status: "Published",
  lastSaved: "2 min ago",
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
            body: "We believe the most useful things are made with care. Our process is collaborative, clear, and shaped around the people we work with.",
          },
        },
      ],
    },
  ],
};

export const templates = [
  {
    id: "editorial-studio",
    name: "Editorial Studio",
    category: "Bold & considered",
    palette: ["#f7f7f3", "#e56645", "#202320"],
    surface: "#ffffff",
    font: "Manrope",
    brand: "AURORA",
    title: ["Make space", "for what", "matters."],
  },
  {
    id: "warm-minimal",
    name: "Warm Minimal",
    category: "Calm & welcoming",
    palette: ["#f2e9dc", "#a8764e", "#322d29"],
    surface: "#faf5ea",
    font: "Fraunces",
    brand: "NORTH",
    title: ["Good work,", "warmly."],
  },
  {
    id: "clean-grid",
    name: "Clean Grid",
    category: "Clear & confident",
    palette: ["#f6f8fa", "#4567db", "#18202b"],
    surface: "#ffffff",
    font: "Space Grotesk",
    brand: "FORM /",
    title: ["Make it", "clear."],
  },
];

export const FONTS = ["Manrope", "Fraunces", "Space Grotesk", "Inter", "DM Sans", "Lora"];
