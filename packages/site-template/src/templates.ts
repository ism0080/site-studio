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
}

/**
 * The visual language for each template. `settings.accent` / `settings.font`
 * in the site document override the accent/font below (set by the editor);
 * the rest of the palette and the layout come from here.
 */
export const TEMPLATES: Record<string, SiteTemplate> = {
  "editorial-studio": {
    id: "editorial-studio",
    name: "Editorial Studio",
    font: "Manrope",
    layout: "editorial",
    theme: {
      bg: "#f7f7f3",
      accent: "#e56645",
      ink: "#202320",
      surface: "#ffffff",
      border: "#e2e3dd",
      muted: "#6b7280",
    },
  },
  "warm-minimal": {
    id: "warm-minimal",
    name: "Warm Minimal",
    font: "Fraunces",
    layout: "warm",
    theme: {
      bg: "#f2e9dc",
      accent: "#a8764e",
      ink: "#322d29",
      surface: "#faf5ea",
      border: "#e3d5bf",
      muted: "#7d7362",
    },
  },
  "clean-grid": {
    id: "clean-grid",
    name: "Clean Grid",
    font: "Space Grotesk",
    layout: "grid",
    theme: {
      bg: "#f6f8fa",
      accent: "#4567db",
      ink: "#18202b",
      surface: "#ffffff",
      border: "#e1e6ee",
      muted: "#64748b",
    },
  },
};

export const templateFor = (site: { templateId?: string }): SiteTemplate =>
  TEMPLATES[site.templateId ?? ""] ?? TEMPLATES["editorial-studio"];
