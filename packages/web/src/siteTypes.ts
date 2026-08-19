import type {
  AboutSection,
  Agency,
  Analytics,
  BuildStatus,
  Business,
  CreateSite,
  DomainSetup,
  GlobalRole,
  HeroSection,
  Lead,
  Member,
  MemberInput,
  Me,
  Page,
  PublishResult,
  Section,
  ServicesSection,
  Settings,
  Site as ApiSite,
  SiteAccess,
  SiteStatus,
  TestimonialsSection,
} from "@site-studio/api/contract";

export type {
  Agency,
  Analytics,
  Business,
  DomainSetup,
  GlobalRole,
  Lead,
  Member,
  MemberInput,
  Me,
  Page,
  PublishResult,
  SiteAccess,
  SiteStatus,
};

export type { AboutSection, HeroSection, ServicesSection, TestimonialsSection };

export type { Section };

/** Union of all section `props` shapes (the mutable content of a section). */
export type SectionProps = Section["props"];
/** Discriminating `type` field shared by every section. */
export type SectionType = Section["type"];

type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

/** A single entry in a services section (title + description). */
export type ServiceItem = SectionOf<"services">["props"]["items"][number];
/** A single quote in a testimonials section (quote + author + role). */
export type TestimonialItem = SectionOf<"testimonials">["props"]["items"][number];

export type SiteSettings = Settings;

/** Frontend editor model: the API Site schema plus a display-only `lastSaved`. */
export type Site = ApiSite & { lastSaved?: string };

export type CreateSitePayload = CreateSite;

/** Editing metadata for a section type: display label, hint, and a default factory. */
export interface SectionMeta {
  label: string;
  hint: string;
  sub: (props: SectionProps) => string;
  create: () => Section;
}

/** A site template: id, name, palette, fonts, and demo brand/title for the gallery art. */
export interface Template {
  id: string;
  name: string;
  category: string;
  palette: [string, string, string];
  surface: string;
  font: string;
  brand: string;
  title: string[];
}

/** The top-level workspace view shown in the sidebar (overview/editor/templates/…). */
export type View = "overview" | "editor" | "templates" | "leads" | "access" | "admin";

/** The preview frame width the editor renders the live preview at. */
export type Device = "desktop" | "mobile";

/** Auto-save status shown in the editor ("Saving…", "Saved", "Save failed"). */
export type SaveState = "idle" | "saving" | "saved" | "error";

/** Settings keys that hold a plain string (excludes the analytics object and directory toggle). */
export type StringSettingKey = Exclude<keyof SiteSettings, "showDirectory" | "analytics">;

export type { BuildStatus };
