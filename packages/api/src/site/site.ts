import * as Schema from "effect/Schema";

const HeroProps = Schema.Struct({
  eyebrow: Schema.String,
  headline: Schema.String,
  description: Schema.String,
  primaryCta: Schema.String,
  secondaryCta: Schema.String,
  image: Schema.String,
});

const ServiceItem = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
});

const ServicesProps = Schema.Struct({
  title: Schema.String,
  items: Schema.Array(ServiceItem),
});

const AboutProps = Schema.Struct({
  eyebrow: Schema.String,
  title: Schema.String,
  body: Schema.String,
});

const TestimonialItem = Schema.Struct({
  id: Schema.String,
  quote: Schema.String,
  author: Schema.String,
  role: Schema.String,
});

const TestimonialsProps = Schema.Struct({
  title: Schema.String,
  items: Schema.Array(TestimonialItem),
});

export class HeroSection extends Schema.Class<HeroSection>("HeroSection")({
  id: Schema.String,
  type: Schema.Literal("hero"),
  props: HeroProps,
}) {}

export class ServicesSection extends Schema.Class<ServicesSection>("ServicesSection")({
  id: Schema.String,
  type: Schema.Literal("services"),
  props: ServicesProps,
}) {}

export class AboutSection extends Schema.Class<AboutSection>("AboutSection")({
  id: Schema.String,
  type: Schema.Literal("about"),
  props: AboutProps,
}) {}

export class TestimonialsSection extends Schema.Class<TestimonialsSection>("TestimonialsSection")({
  id: Schema.String,
  type: Schema.Literal("testimonials"),
  props: TestimonialsProps,
}) {}

export const Section = Schema.Union([
  HeroSection,
  ServicesSection,
  AboutSection,
  TestimonialsSection,
]);
export type Section = (typeof Section)["Type"];

export class Page extends Schema.Class<Page>("Page")({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  sections: Schema.Array(Section),
}) {}

export class Business extends Schema.Class<Business>("Business")({
  name: Schema.String,
  category: Schema.String,
  location: Schema.String,
  email: Schema.String,
  phone: Schema.String,
  logo: Schema.String,
}) {}

/**
 * The `analytics` slot is reserved for the optional $1/mo OneDollarStats
 * integration — each site can connect a OneDollarStats site id and the
 * published HTML embeds their tracking script.
 */
export class Analytics extends Schema.Class<Analytics>("Analytics")({
  provider: Schema.Literal("onedollarstats"),
  siteId: Schema.String,
}) {}

export class Settings extends Schema.Class<Settings>("Settings")({
  accent: Schema.String,
  font: Schema.String,
  showDirectory: Schema.Boolean,
  bg: Schema.optional(Schema.String),
  ink: Schema.optional(Schema.String),
  surface: Schema.optional(Schema.String),
  border: Schema.optional(Schema.String),
  muted: Schema.optional(Schema.String),
  analytics: Schema.optional(Analytics),
}) {}

export const SiteStatus = Schema.Literals(["draft", "published"]);
export type SiteStatus = (typeof SiteStatus)["Type"];

/**
 * Where the published site's static build stands. `building` is set when a
 * site is published (a build job is enqueued); the background build worker
 * moves it to `built` (with `lastBuiltAt`) or `failed` (with `buildError`).
 * Older documents without the field decode as `idle` (never built).
 */
export const BuildStatus = Schema.Literals(["idle", "building", "built", "failed"]);
export type BuildStatus = (typeof BuildStatus)["Type"];

export const SiteId = Schema.String.pipe(Schema.brand("SiteId"));
export type SiteId = (typeof SiteId)["Type"];

export const OwnerId = Schema.String.pipe(Schema.brand("OwnerId"));
export type OwnerId = (typeof OwnerId)["Type"];

/**
 * The site document: identity, status, business profile, settings, pages,
 * publish state, custom domain, and build outcome. Stored in D1 and
 * serialized to JSON for the build pipeline.
 */
export class Site extends Schema.Class<Site>("Site")({
  id: SiteId,
  ownerId: OwnerId,
  templateId: Schema.String,
  /** Reserved public subdomain selected during onboarding. */
  subdomain: Schema.optional(Schema.String),
  status: SiteStatus,
  business: Business,
  settings: Settings,
  pages: Schema.Array(Page),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  publishedAt: Schema.optional(Schema.String),
  customDomain: Schema.optional(Schema.String),
  buildStatus: Schema.optional(BuildStatus),
  lastBuiltAt: Schema.optional(Schema.String),
  buildError: Schema.optional(Schema.String),
}) {}

/** Payload for creating a site from the onboarding profile. */
export const CreateSite = Schema.Struct({
  name: Schema.String,
  subdomain: Schema.optional(Schema.String),
  business: Schema.optional(Business),
  templateId: Schema.String,
});
export type CreateSite = (typeof CreateSite)["Type"];

/** Confirmation of a publish: the site id, the stored artifact path, and when it was published. */
export const PublishResult = Schema.Struct({
  siteId: SiteId,
  path: Schema.String,
  publishedAt: Schema.String,
});
export type PublishResult = (typeof PublishResult)["Type"];

/** A template's theme palette (the parts the editor surfaces as colour fields). */
export const TemplateTheme = Schema.Struct({
  bg: Schema.String,
  accent: Schema.String,
  ink: Schema.String,
  surface: Schema.String,
  border: Schema.String,
  muted: Schema.String,
});

/**
 * A site template as served to the editor: the metadata the gallery shows and
 * the theme the editor derives its colour defaults from. Sourced from the
 * site-template template registry (the single source of truth).
 */
export const TemplateInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  font: Schema.String,
  category: Schema.String,
  brand: Schema.String,
  title: Schema.Array(Schema.String),
  theme: TemplateTheme,
});
export type TemplateInfo = (typeof TemplateInfo)["Type"];

/**
 * The build job could not be handed to the build queue. The site is already
 * marked published; retrying the publish re-enqueues the build.
 */
export class PublishError extends Schema.TaggedErrorClass<PublishError>()(
  "PublishError",
  { message: Schema.String },
  { httpApiStatus: 500 },
) {}

/** The site does not exist, or the requester has no relationship to it (404). */
export class SiteNotFound extends Schema.TaggedErrorClass<SiteNotFound>()(
  "SiteNotFound",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {}

/**
 * The requester can see the site but is not allowed to perform the requested
 * operation (e.g. a client editing without the `canEdit` grant).
 */
export class Forbidden extends Schema.TaggedErrorClass<Forbidden>()(
  "Forbidden",
  {},
  { httpApiStatus: 403 },
) {}

/** The custom-domain TXT ownership record has not been published yet (409). */
export class DomainNotVerified extends Schema.TaggedErrorClass<DomainNotVerified>()(
  "DomainNotVerified",
  { domain: Schema.String },
  { httpApiStatus: 409 },
) {}

/** Another site already claims this custom domain (409). */
export class DomainInUse extends Schema.TaggedErrorClass<DomainInUse>()(
  "DomainInUse",
  { domain: Schema.String },
  { httpApiStatus: 409 },
) {}

/** Bare apex domains require Cloudflare's separately priced apex product (400). */
export class DomainUnsupported extends Schema.TaggedErrorClass<DomainUnsupported>()(
  "DomainUnsupported",
  { domain: Schema.String },
  { httpApiStatus: 400 },
) {}

/** Cloudflare could not provision or inspect the custom hostname (502). */
export class CloudflareSaasError extends Schema.TaggedErrorClass<CloudflareSaasError>()(
  "CloudflareSaasError",
  { message: Schema.String },
  { httpApiStatus: 502 },
) {}

/** Another site already claims the requested public subdomain (409). */
export class SubdomainInUse extends Schema.TaggedErrorClass<SubdomainInUse>()(
  "SubdomainInUse",
  { subdomain: Schema.String },
  { httpApiStatus: 409 },
) {}

/**
 * Response for a pending custom-domain request. The owner must point the
 * hostname at the SaaS CNAME target and publish the returned TXT records,
 * then call `POST /sites/:id/domain/verify` to activate the domain.
 */
export const DomainDnsRecord = Schema.Struct({
  name: Schema.String,
  value: Schema.String,
});
export type DomainDnsRecord = (typeof DomainDnsRecord)["Type"];

export const DomainSetup = Schema.Struct({
  domain: Schema.String,
  status: Schema.Literal("pending"),
  cnameTarget: Schema.String,
  records: Schema.Array(DomainDnsRecord),
  site: Site,
});
export type DomainSetup = (typeof DomainSetup)["Type"];

/** Union of the custom-domain failure responses. */
export const DomainError = Schema.Union([
  SiteNotFound,
  DomainNotVerified,
  DomainInUse,
  DomainUnsupported,
  CloudflareSaasError,
]);

/** Compact JSON of the Site, used for the D1 `document` column and build-queue payloads. */
export const SiteJson = Schema.fromJsonString(Site);

/** Pretty-printed JSON of the Site (2-space indent), used for the stored R2 build artifact. */
export const SiteDocument = Schema.fromJsonString(Site, { space: 2 });

/** Encodes a Site to compact JSON. */
export const encodeSiteJson = Schema.encodeUnknownSync(SiteJson);

/** Encodes a Site to pretty-printed JSON for the stored artifact. */
export const encodeSiteDocument = Schema.encodeUnknownSync(SiteDocument);

/** Decodes compact Site JSON back to a Site. */
export const decodeSiteJson = Schema.decodeUnknownEffect(SiteJson);
