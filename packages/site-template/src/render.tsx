import { renderToStaticMarkup } from "react-dom/server";
import type {
  AboutProps,
  HeroProps,
  Page,
  ServicesProps,
  Settings,
  Site,
  TestimonialsProps,
} from "./site.ts";
import { templateFor, type TemplateLayout } from "./templates.ts";

export interface RenderOptions {
  apiBase?: string;
}

export const DEFAULT_API_BASE = "https://api.site-studio.dev";

// The site document is validated against the Site schema at the render
// boundary (the API encodes it before the sandbox build); these props are
// trusted domain values from that point on.

interface SectionProps<P> {
  props: P;
  layout: TemplateLayout;
}

const mod = (layout: TemplateLayout): string =>
  layout === "warm" ? " warm" : layout === "grid" ? " grid" : "";

function Hero({ props, layout }: SectionProps<HeroProps>) {
  return (
    <section className={`hero${mod(layout)}`}>
      {props.eyebrow && <p className="eyebrow">{props.eyebrow}</p>}
      <h1>{props.headline}</h1>
      <p className="lede">{props.description}</p>
      <div className="cta-row">
        <a className="cta-primary" href="#contact">
          {props.primaryCta}
        </a>
        {props.secondaryCta && (
          <a className="cta-secondary" href="#contact">
            {props.secondaryCta}
          </a>
        )}
      </div>
      {props.image && <img className="hero-image" src={props.image} alt="" loading="eager" />}
    </section>
  );
}

function Services({ props, layout }: SectionProps<ServicesProps>) {
  return (
    <section className={`services${mod(layout)}`}>
      <h2>{props.title}</h2>
      <div className="grid">
        {props.items.map((item) => (
          <article className="card" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function About({ props, layout }: SectionProps<AboutProps>) {
  return (
    <section className={`about${mod(layout)}`}>
      {props.eyebrow && <p className="eyebrow">{props.eyebrow}</p>}
      <h2>{props.title}</h2>
      <p className="body">{props.body}</p>
    </section>
  );
}

function Testimonials({ props, layout }: SectionProps<TestimonialsProps>) {
  return (
    <section className={`testimonials${mod(layout)}`}>
      <h2>{props.title}</h2>
      <div className="grid">
        {props.items.map((item) => (
          <blockquote className="card" key={item.id}>
            <p className="quote">“{item.quote}”</p>
            <footer>
              <span className="author">{item.author}</span>
              <span className="role">{item.role}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function themeCss(site: Site): string {
  const template = templateFor(site);
  const layout = template.layout;
  const settings: Settings = site.settings;
  const accent = settings.accent || template.theme.accent;
  const font = settings.font || template.font;
  const bg = settings.bg || template.theme.bg;
  const ink = settings.ink || template.theme.ink;
  const surface = settings.surface || template.theme.surface;
  const border = settings.border || template.theme.border;
  const muted = settings.muted || template.theme.muted;

  return `
  :root {
    --accent: ${accent};
    --font: ${font};
    --surface: ${surface};
    --border: ${border};
    --muted: ${muted};
    --ink: ${ink};
    --bg: ${bg};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ${font}, system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    color: var(--ink);
    background: var(--bg);
  }
  main { max-width: 64rem; margin: 0 auto; padding: 0 1.5rem 6rem; }
  section { padding: 3.5rem 0; }
  header.site-header { display: flex; align-items: center; max-width: 64rem; margin: 0 auto; padding: 1.5rem; }
  header.site-header .logo { font-weight: 800; letter-spacing: 0.08em; text-decoration: none; color: inherit; }
  footer.site-footer { text-align: center; padding: 2rem 1rem 3rem; color: var(--muted); font-size: 0.9rem; }
  .lead-form { display: grid; gap: 0.75rem; max-width: 26rem; margin-top: 1.5rem; }
  .lead-form input, .lead-form textarea { font: inherit; padding: 0.7rem 0.9rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--surface); }
  .lead-form button { justify-self: start; border: 0; background: var(--accent); color: #fff; font: inherit; font-weight: 700; padding: 0.7rem 1.4rem; border-radius: 999px; cursor: pointer; }
  .lead-status { font-size: 0.9rem; margin: 0; }
  .template-warm main { max-width: 52rem; }
  .template-grid main { max-width: 68rem; }
  ${sectionCss(layout)}
  `.trim();
}

// Section styles are scoped under their root class (the repo's scoping
// convention) instead of Astro's hashed attributes, so each section's bare
// element selectors (h2, p, .grid, .card) cannot leak into its neighbours.
function sectionCss(layout: TemplateLayout): string {
  return `
  .hero {
    display: grid;
    gap: 1rem;
    max-width: 46rem;
  }
  .hero .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--accent);
    margin: 0;
  }
  .hero h1 {
    font-size: clamp(2.5rem, 6vw, 4rem);
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0;
  }
  .hero .lede {
    font-size: 1.15rem;
    max-width: 36rem;
    margin: 0;
  }
  .hero .cta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .hero .cta-primary,
  .hero .cta-secondary {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    border-radius: 999px;
    text-decoration: none;
    font-weight: 700;
  }
  .hero .cta-primary {
    background: var(--accent);
    color: #fff;
  }
  .hero .cta-secondary {
    border: 1px solid currentColor;
  }
  .hero .hero-image {
    width: 100%;
    max-height: 28rem;
    object-fit: cover;
    border-radius: 1.25rem;
    margin-top: 1.5rem;
  }

  .services h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    letter-spacing: -0.02em;
    margin: 0 0 1.5rem;
  }
  .services .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
  }
  .services .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: 1.5rem;
  }
  .services .card h3 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
  }
  .services .card p {
    margin: 0;
  }

  .about {
    max-width: 40rem;
  }
  .about .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--accent);
    margin: 0 0 0.5rem;
  }
  .about h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
  }
  .about .body {
    font-size: 1.1rem;
    line-height: 1.7;
    margin: 0;
  }

  .testimonials h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    letter-spacing: -0.02em;
    margin: 0 0 1.5rem;
  }
  .testimonials .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
  }
  .testimonials .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: 1.5rem;
    margin: 0;
  }
  .testimonials .card .quote {
    font-size: 1.05rem;
    line-height: 1.6;
    margin: 0 0 1rem;
  }
  .testimonials .card footer {
    display: grid;
    gap: 0.15rem;
    font-size: 0.9rem;
  }
  .testimonials .author {
    font-weight: 700;
  }
  .testimonials .role {
    color: var(--muted);
  }

  ${layout === "warm" ? warmCss(layout) : layout === "grid" ? gridCss(layout) : ""}
  `.trim();
}

function warmCss(_layout: TemplateLayout): string {
  return `
  .hero.warm {
    max-width: 40rem;
    justify-items: center;
    text-align: center;
    margin: 0 auto;
  }
  .hero.warm h1 {
    font-size: clamp(2.5rem, 7vw, 4.5rem);
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .hero.warm .lede {
    max-width: 30rem;
  }
  .hero.warm .cta-row {
    justify-content: center;
  }
  .hero.warm .hero-image {
    max-height: 24rem;
    border-radius: 2rem;
  }

  .services.warm h2 {
    text-align: center;
  }
  .services.warm .card {
    border-radius: 1.5rem;
    padding: 2rem;
    text-align: center;
  }

  .about.warm {
    max-width: 34rem;
    margin: 0 auto;
    text-align: center;
  }

  .testimonials.warm h2 {
    text-align: center;
  }
  .testimonials.warm .card {
    border-radius: 1.5rem;
    text-align: center;
  }
  .testimonials.warm .card footer {
    justify-items: center;
  }
  `.trim();
}

function gridCss(_layout: TemplateLayout): string {
  return `
  .hero.grid {
    max-width: 100%;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 3rem;
  }
  .hero.grid h1 {
    font-size: clamp(2.5rem, 5vw, 3.5rem);
    letter-spacing: -0.03em;
  }
  .hero.grid .hero-image {
    max-height: 22rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border);
    margin-top: 0;
  }

  .services.grid h2 {
    font-size: 1.25rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .services.grid .card {
    background: transparent;
    border-radius: 0;
    border-width: 1px;
  }
  .services.grid .card h3 {
    text-transform: uppercase;
    font-size: 0.9rem;
    letter-spacing: 0.05em;
  }

  .about.grid {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 3rem;
    max-width: 100%;
    align-items: start;
  }
  .about.grid .eyebrow {
    grid-column: 1 / -1;
  }
  .about.grid .body {
    font-size: 1rem;
  }

  .testimonials.grid h2 {
    font-size: 1.25rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .testimonials.grid .card {
    background: transparent;
    border-radius: 0;
  }
  `.trim();
}

function SectionSwitch({
  section,
  layout,
}: {
  section: Page["sections"][number];
  layout: TemplateLayout;
}) {
  switch (section.type) {
    case "hero":
      return <Hero props={section.props} layout={layout} />;
    case "services":
      return <Services props={section.props} layout={layout} />;
    case "about":
      return <About props={section.props} layout={layout} />;
    case "testimonials":
      return <Testimonials props={section.props} layout={layout} />;
  }
}

function SiteDocument({ site, page, apiBase }: { site: Site; page: Page; apiBase: string }) {
  const { business, settings } = site;
  const year = new Date().getFullYear();
  const template = templateFor(site);
  const layout = template.layout;
  const font = settings.font || template.font;
  // A brand-new site has no saved sections yet; render the template's default
  // content so the published page (and the editor preview) is never blank.
  const sections = page.sections.length > 0 ? page.sections : template.defaultSections;

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content={business.category} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={business.name} />
        <meta property="og:description" content={business.category} />
        <link rel="canonical" href={`https://sites.site-studio.dev${page.slug}`} />
        <title>{`${business.name}${page.title !== "Homepage" ? ` — ${page.title}` : ""}`}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${font.replaceAll(" ", "+")}:wght@400;600;800&display=swap`}
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: themeCss(site) }} />
      </head>
      <body className={`template-${layout}`}>
        <header className="site-header">
          <a className="logo" href="/">
            {business.logo}
          </a>
        </header>
        <main>
          {sections.map((section) => (
            <SectionSwitch key={section.id} section={section} layout={layout} />
          ))}
          <section id="contact">
            <h2>Get in touch</h2>
            {business.email && (
              <p>
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </p>
            )}
            {business.phone && <p>{business.phone}</p>}
            {business.location && <p>{business.location}</p>}
            <form className="lead-form" data-api={apiBase} data-site={site.id}>
              <input type="text" name="name" placeholder="Your name" required />
              <input type="email" name="email" placeholder="Email" required />
              <textarea name="message" placeholder="How can we help?" rows={3}></textarea>
              <button type="submit">Send message</button>
              <p className="lead-status" hidden></p>
            </form>
          </section>
        </main>
        <footer className="site-footer">
          © {year} {business.name}
        </footer>
        {settings.analytics && (
          <script
            data-goatcounter={`https://${settings.analytics.siteId}.goatcounter.com/count`}
            async
            src="//gc.zgo.at/count.js"
          />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
document.querySelectorAll(".lead-form").forEach((form) => {
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    const status = form.querySelector(".lead-status")
    const data = Object.fromEntries(new FormData(form))
    data.siteId = form.dataset.site
    try {
      const res = await fetch(form.dataset.api + "/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        form.querySelectorAll("input, textarea, button").forEach(
          (el) => (el.style.display = "none"),
        )
        status.textContent = "Thanks — we'll be in touch soon."
      } else {
        status.textContent = "Something went wrong. Please try again."
      }
    } catch {
      status.textContent = "Network error — please try again."
    }
    status.hidden = false
  })
})
`,
          }}
        />
      </body>
    </html>
  );
}

export function renderPage(site: Site, page: Page, options: RenderOptions = {}): string {
  return `<!doctype html>\n${renderToStaticMarkup(
    <SiteDocument site={site} page={page} apiBase={options.apiBase ?? DEFAULT_API_BASE} />,
  )}`;
}

export function renderSite(site: Site, options: RenderOptions = {}) {
  return Object.fromEntries(
    site.pages.map((page) => {
      const key = page.slug === "/" ? "index.html" : `${page.slug.replace(/^\//, "")}/index.html`;
      return [key, renderPage(site, page, options)];
    }),
  );
}
