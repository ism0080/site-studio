import * as HttpApi from "effect/unstable/httpapi"
import * as Schema from "effect/Schema"

const HeroProps = Schema.Struct({
  eyebrow: Schema.String,
  headline: Schema.String,
  description: Schema.String,
  primaryCta: Schema.String,
  secondaryCta: Schema.String,
  image: Schema.String,
})

const ServiceItem = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.String,
})

const ServicesProps = Schema.Struct({
  title: Schema.String,
  items: Schema.Array(ServiceItem),
})

const AboutProps = Schema.Struct({
  eyebrow: Schema.String,
  title: Schema.String,
  body: Schema.String,
})

const TestimonialItem = Schema.Struct({
  id: Schema.String,
  quote: Schema.String,
  author: Schema.String,
  role: Schema.String,
})

const TestimonialsProps = Schema.Struct({
  title: Schema.String,
  items: Schema.Array(TestimonialItem),
})

const HeroSection = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("hero"),
  props: HeroProps,
})

const ServicesSection = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("services"),
  props: ServicesProps,
})

const AboutSection = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("about"),
  props: AboutProps,
})

const TestimonialsSection = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("testimonials"),
  props: TestimonialsProps,
})

export const Section = Schema.Union([
  HeroSection,
  ServicesSection,
  AboutSection,
  TestimonialsSection,
])
export type Section = typeof Section["Type"]

export const Page = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  sections: Schema.Array(Section),
})
export type Page = typeof Page["Type"]

export const Business = Schema.Struct({
  name: Schema.String,
  category: Schema.String,
  location: Schema.String,
  email: Schema.String,
  phone: Schema.String,
  logo: Schema.String,
})
export type Business = typeof Business["Type"]

/**
 * The `analytics` slot is reserved for the optional $1/mo OneDollarStats
 * integration — each site can connect a OneDollarStats site id and the
 * published HTML embeds their tracking script.
 */
export const Analytics = Schema.Struct({
  provider: Schema.Literal("onedollarstats"),
  siteId: Schema.String,
})
export type Analytics = typeof Analytics["Type"]

export const Settings = Schema.Struct({
  accent: Schema.String,
  font: Schema.String,
  showDirectory: Schema.Boolean,
  bg: Schema.optional(Schema.String),
  ink: Schema.optional(Schema.String),
  surface: Schema.optional(Schema.String),
  border: Schema.optional(Schema.String),
  muted: Schema.optional(Schema.String),
  analytics: Schema.optional(Analytics),
})
export type Settings = typeof Settings["Type"]

export const SiteStatus = Schema.Literals(["draft", "published"])
export type SiteStatus = typeof SiteStatus["Type"]

export const Site = Schema.Struct({
  id: Schema.String,
  ownerId: Schema.String,
  templateId: Schema.String,
  status: SiteStatus,
  business: Business,
  settings: Settings,
  pages: Schema.Array(Page),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  publishedAt: Schema.optional(Schema.String),
  customDomain: Schema.optional(Schema.String),
})
export type Site = typeof Site["Type"]

export const CreateSite = Schema.Struct({
  name: Schema.String,
  templateId: Schema.String,
})
export type CreateSite = typeof CreateSite["Type"]

export const PublishResult = Schema.Struct({
  siteId: Schema.String,
  path: Schema.String,
  publishedAt: Schema.String,
})
export type PublishResult = typeof PublishResult["Type"]

export class SiteNotFound extends Schema.TaggedErrorClass<SiteNotFound>()(
  "SiteNotFound",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {}

export class DomainNotVerified extends Schema.TaggedErrorClass<DomainNotVerified>()(
  "DomainNotVerified",
  { domain: Schema.String },
  { httpApiStatus: 409 },
) {}

export class DomainInUse extends Schema.TaggedErrorClass<DomainInUse>()(
  "DomainInUse",
  { domain: Schema.String },
  { httpApiStatus: 409 },
) {}

/**
 * Response for a pending custom-domain request. The owner must publish a TXT
 * record (`txtName` = `txtValue`) at their DNS provider, then call
 * `POST /sites/:id/domain/verify` to activate the domain.
 */
export const DomainSetup = Schema.Struct({
  domain: Schema.String,
  status: Schema.Literal("pending"),
  txtName: Schema.String,
  txtValue: Schema.String,
  site: Site,
})
export type DomainSetup = typeof DomainSetup["Type"]

export const DomainError = Schema.Union([SiteNotFound, DomainNotVerified, DomainInUse])

export const decodeSite = Schema.decodeUnknownEffect(Site)
export const encodeSite = Schema.encodeUnknownSync(Site)
