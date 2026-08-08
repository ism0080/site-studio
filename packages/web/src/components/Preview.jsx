import { findPage } from '../lib/siteUpdates.js'

function Hero({ block }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">{block.props.eyebrow}</p>
        <h1>{block.props.headline}</h1>
        <p className="hero-description">{block.props.description}</p>
        <div className="hero-actions">
          <button className="site-primary">{block.props.primaryCta} <span>↗</span></button>
          <button className="site-secondary">{block.props.secondaryCta} <span>↓</span></button>
        </div>
      </div>
      {block.props.image && (
        <div className="hero-image">
          <img src={block.props.image} alt="A bright creative workspace" />
          <span className="image-note">01 / 04</span>
        </div>
      )}
    </section>
  )
}

function Services({ block, index }) {
  return (
    <section className="services">
      <div className="section-intro">
        <span className="section-number">{String(index + 1).padStart(2, '0')}</span>
        <h2>{block.props.title}</h2>
      </div>
      <div className="service-list">
        {block.props.items.map((service, itemIndex) => (
          <article className="service" key={service.id}>
            <span>0{itemIndex + 1}</span>
            <div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </div>
            <span className="service-arrow">↗</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function About({ block }) {
  return (
    <section className="about">
      <p className="eyebrow">{block.props.eyebrow}</p>
      <h2>{block.props.title}</h2>
      <p>{block.props.body}</p>
    </section>
  )
}

function Testimonials({ block, index }) {
  return (
    <section className="testimonials">
      <div className="section-intro">
        <span className="section-number">{String(index + 1).padStart(2, '0')}</span>
        <h2>{block.props.title}</h2>
      </div>
      <div className="testimonial-list">
        {block.props.items.map((item) => (
          <blockquote className="testimonial" key={item.id}>
            <p>“{item.quote}”</p>
            <footer>
              <strong>{item.author}</strong>
              <span>{item.role}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}

const renderers = {
  hero: Hero,
  services: Services,
  about: About,
  testimonials: Testimonials,
}

export default function Preview({ site, device }) {
  const page = findPage(site)
  return (
    <div className={`preview-canvas ${device}`}>
      <div className="public-site" style={{ '--accent': site.settings.accent }}>
        <div className="site-topbar"><span>{site.business.category}</span><span>{site.business.location}</span></div>
        <header className="site-header">
          <div className="site-logo">{site.business.logo}</div>
          <nav><span>About</span><span>Services</span><span>Journal</span></nav>
          <button className="site-menu">Menu <span>↘</span></button>
        </header>
        <main>
          {page.sections.map((block, index) => {
            const Component = renderers[block.type]
            return Component ? <Component key={block.id} block={block} index={index} /> : null
          })}
        </main>
        <footer className="site-footer">
          <span>{site.business.name}</span>
          <span>© 2024</span>
          <span>{site.business.email}</span>
        </footer>
      </div>
    </div>
  )
}
