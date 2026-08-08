export type Section =
  | { id: string; type: "hero"; props: HeroProps }
  | { id: string; type: "services"; props: ServicesProps }
  | { id: string; type: "about"; props: AboutProps }
  | { id: string; type: "testimonials"; props: TestimonialsProps }

export interface HeroProps {
  eyebrow: string
  headline: string
  description: string
  primaryCta: string
  secondaryCta: string
  image: string
}

export interface ServicesProps {
  title: string
  items: Array<{ id: string; title: string; description: string }>
}

export interface AboutProps {
  eyebrow: string
  title: string
  body: string
}

export interface TestimonialsProps {
  title: string
  items: Array<{ id: string; quote: string; author: string; role: string }>
}

export interface Page {
  id: string
  slug: string
  title: string
  sections: Section[]
}

export interface Business {
  name: string
  category: string
  location: string
  email: string
  phone: string
  logo: string
}

export interface Analytics {
  provider: "onedollarstats"
  siteId: string
}

export interface Settings {
  accent: string
  font: string
  showDirectory: boolean
  bg?: string
  ink?: string
  surface?: string
  border?: string
  muted?: string
  analytics?: Analytics
}

export type SiteStatus = "draft" | "published"

export interface Site {
  id: string
  ownerId: string
  templateId: string
  status: SiteStatus
  business: Business
  settings: Settings
  pages: Page[]
  createdAt: string
  updatedAt: string
  publishedAt?: string
  customDomain?: string
}
