import type {
  AboutSection,
  HeroSection,
  Page,
  ServicesSection,
  Site,
  TestimonialsSection,
} from "../siteTypes.ts";
import { nextPrefixedId } from "../data/sections.ts";
import {
  addSectionItem,
  removeSectionItem,
  updateSectionItem,
  updateSectionProp,
} from "../lib/siteUpdates.ts";

export function HeroFields({
  site,
  onUpdate,
  hero,
  page,
}: {
  site: Site;
  onUpdate: (site: Site) => void;
  hero: HeroSection;
  page: Page;
}) {
  return (
    <>
      <div className="field-group">
        <label>
          Eyebrow <span className="field-type">hero.eyebrow</span>
        </label>
        <input
          value={hero.props.eyebrow}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, hero.id, "eyebrow", e.target.value))
          }
        />
      </div>
      <div className="field-group">
        <label>
          Headline <span className="field-type">hero.headline</span>
        </label>
        <textarea
          rows={3}
          value={hero.props.headline}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, hero.id, "headline", e.target.value))
          }
        />
      </div>
      <div className="field-group">
        <label>
          Short description <span className="field-type">hero.description</span>
        </label>
        <textarea
          rows={3}
          value={hero.props.description}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, hero.id, "description", e.target.value))
          }
        />
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Primary button</label>
          <input
            value={hero.props.primaryCta}
            onChange={(e) =>
              onUpdate(updateSectionProp(site, page.id, hero.id, "primaryCta", e.target.value))
            }
          />
        </div>
        <div className="field-group">
          <label>Secondary button</label>
          <input
            value={hero.props.secondaryCta}
            onChange={(e) =>
              onUpdate(updateSectionProp(site, page.id, hero.id, "secondaryCta", e.target.value))
            }
          />
        </div>
      </div>
      <div className="field-group">
        <label>
          Hero image <span className="field-type">hero.image</span>
        </label>
        <input
          value={hero.props.image}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, hero.id, "image", e.target.value))
          }
          placeholder="https://…"
        />
        <p className="domain-hint">Leave empty to hide the image and keep a text-only hero.</p>
      </div>
    </>
  );
}

export function ServicesFields({
  site,
  onUpdate,
  services,
  page,
}: {
  site: Site;
  onUpdate: (site: Site) => void;
  services: ServicesSection;
  page: Page;
}) {
  return (
    <>
      <div className="field-group">
        <label>Section title</label>
        <input
          value={services.props.title}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, services.id, "title", e.target.value))
          }
        />
      </div>
      {services.props.items.map((item, i) => (
        <div className="field-group service-fields" key={item.id}>
          <label>
            Service {i + 1} <span className="field-type">services.items</span>
          </label>
          <input
            value={item.title}
            onChange={(e) =>
              onUpdate(
                updateSectionItem(site, page.id, services.id, item.id, "title", e.target.value),
              )
            }
          />
          <textarea
            rows={2}
            value={item.description}
            onChange={(e) =>
              onUpdate(
                updateSectionItem(
                  site,
                  page.id,
                  services.id,
                  item.id,
                  "description",
                  e.target.value,
                ),
              )
            }
          />
          <button
            type="button"
            className="section-btn remove"
            aria-label="Remove service"
            onClick={() => onUpdate(removeSectionItem(site, page.id, services.id, item.id))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="add-small"
        onClick={() =>
          onUpdate(
            addSectionItem(site, page.id, services.id, {
              id: nextPrefixedId("service"),
              title: "New service",
              description: "",
            }),
          )
        }
      >
        Add service
      </button>
    </>
  );
}

export function AboutFields({
  site,
  onUpdate,
  about,
  page,
}: {
  site: Site;
  onUpdate: (site: Site) => void;
  about: AboutSection;
  page: Page;
}) {
  return (
    <>
      <div className="field-group">
        <label>Eyebrow</label>
        <input
          value={about.props.eyebrow}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, about.id, "eyebrow", e.target.value))
          }
        />
      </div>
      <div className="field-group">
        <label>Title</label>
        <input
          value={about.props.title}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, about.id, "title", e.target.value))
          }
        />
      </div>
      <div className="field-group">
        <label>Body</label>
        <textarea
          rows={4}
          value={about.props.body}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, about.id, "body", e.target.value))
          }
        />
      </div>
    </>
  );
}

export function TestimonialsFields({
  site,
  onUpdate,
  testimonials,
  page,
}: {
  site: Site;
  onUpdate: (site: Site) => void;
  testimonials: TestimonialsSection;
  page: Page;
}) {
  return (
    <>
      <div className="field-group">
        <label>Section title</label>
        <input
          value={testimonials.props.title}
          onChange={(e) =>
            onUpdate(updateSectionProp(site, page.id, testimonials.id, "title", e.target.value))
          }
        />
      </div>
      {testimonials.props.items.map((item, i) => (
        <div className="field-group service-fields" key={item.id}>
          <label>
            Testimonial {i + 1} <span className="field-type">testimonials.items</span>
          </label>
          <textarea
            rows={2}
            value={item.quote}
            onChange={(e) =>
              onUpdate(
                updateSectionItem(site, page.id, testimonials.id, item.id, "quote", e.target.value),
              )
            }
          />
          <div className="field-row">
            <input
              value={item.author}
              onChange={(e) =>
                onUpdate(
                  updateSectionItem(
                    site,
                    page.id,
                    testimonials.id,
                    item.id,
                    "author",
                    e.target.value,
                  ),
                )
              }
              placeholder="Author"
            />
            <input
              value={item.role}
              onChange={(e) =>
                onUpdate(
                  updateSectionItem(
                    site,
                    page.id,
                    testimonials.id,
                    item.id,
                    "role",
                    e.target.value,
                  ),
                )
              }
              placeholder="Role"
            />
          </div>
          <button
            type="button"
            className="section-btn remove"
            aria-label="Remove testimonial"
            onClick={() => onUpdate(removeSectionItem(site, page.id, testimonials.id, item.id))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="add-small"
        onClick={() =>
          onUpdate(
            addSectionItem(site, page.id, testimonials.id, {
              id: nextPrefixedId("testimonial"),
              quote: "",
              author: "",
              role: "",
            }),
          )
        }
      >
        Add testimonial
      </button>
    </>
  );
}
