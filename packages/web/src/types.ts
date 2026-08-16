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

export type SectionProps = Section["props"];
export type SectionType = Section["type"];

type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

export type ServiceItem = SectionOf<"services">["props"]["items"][number];
export type TestimonialItem = SectionOf<"testimonials">["props"]["items"][number];

export type SiteSettings = Settings;

/** Frontend editor model: the API Site schema plus a display-only `lastSaved`. */
export type Site = ApiSite & { lastSaved?: string };

export type CreateSitePayload = CreateSite;

export interface SectionMeta {
  label: string;
  hint: string;
  sub: (props: SectionProps) => string;
  create: () => Section;
}

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

export type View = "overview" | "editor" | "templates" | "leads" | "access" | "admin";

export type Device = "desktop" | "mobile";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type StringSettingKey = Exclude<keyof SiteSettings, "showDirectory" | "analytics">;

export type { BuildStatus };
