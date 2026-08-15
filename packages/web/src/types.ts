export interface Business {
  name: string;
  category: string;
  location: string;
  email: string;
  phone: string;
  logo: string;
}

export interface HeroProps {
  eyebrow: string;
  headline: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  image: string;
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
}

export interface ServicesProps {
  title: string;
  items: ServiceItem[];
}

export interface AboutProps {
  eyebrow: string;
  title: string;
  body: string;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
}

export interface TestimonialsProps {
  title: string;
  items: TestimonialItem[];
}

export type SectionProps = HeroProps | ServicesProps | AboutProps | TestimonialsProps;

export interface HeroSection {
  id: string;
  type: "hero";
  props: HeroProps;
}

export interface ServicesSection {
  id: string;
  type: "services";
  props: ServicesProps;
}

export interface AboutSection {
  id: string;
  type: "about";
  props: AboutProps;
}

export interface TestimonialsSection {
  id: string;
  type: "testimonials";
  props: TestimonialsProps;
}

export type Section = HeroSection | ServicesSection | AboutSection | TestimonialsSection;

export type SectionType = Section["type"];

export interface SectionMeta {
  label: string;
  hint: string;
  sub: (props: SectionProps) => string;
  create: () => Section;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  sections: Section[];
}

export interface SiteSettings {
  accent: string;
  font: string;
  showDirectory: boolean;
  bg?: string;
  ink?: string;
  surface?: string;
  analytics?: Analytics;
}

export type Analytics = {
  provider: "onedollarstats";
  siteId: string;
};

export type SiteStatus = "draft" | "published";

export type BuildStatus = "idle" | "building" | "built" | "failed";

export type StringSettingKey = Exclude<keyof SiteSettings, "showDirectory" | "analytics">;

export interface Site {
  id: string;
  ownerId?: string;
  templateId: string;
  status: SiteStatus;
  buildStatus: BuildStatus;
  business: Business;
  settings: SiteSettings;
  pages: Page[];
  lastSaved?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  customDomain?: string;
  lastBuiltAt?: string;
  buildError?: string;
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

export interface CreateSitePayload {
  name: string;
  templateId: string;
}

export interface PublishResult {
  siteId: string;
  path: string;
  publishedAt: string;
}

export interface DomainSetup {
  domain: string;
  status: "pending";
  txtName: string;
  txtValue: string;
  site: Site;
}

export interface Lead {
  id: string;
  siteId: string;
  name: string;
  email: string;
  message?: string;
  createdAt: string;
}

export type View = "overview" | "editor" | "templates" | "leads";

export type Device = "desktop" | "mobile";

export type SaveState = "idle" | "saving" | "saved" | "error";
