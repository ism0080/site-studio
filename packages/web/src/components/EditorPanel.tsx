import type { DomainSetup, SaveState, Site, StringSettingKey } from "../types.ts";
import { FONTS, templates } from "../data/site.ts";
import {
  findPage,
  findSection,
  updateAnalytics,
  updateBusiness,
  updateSetting,
} from "../lib/siteUpdates.ts";
import DomainSettings from "./DomainSettings.tsx";
import SectionList from "./SectionList.tsx";
import { AboutFields, HeroFields, ServicesFields, TestimonialsFields } from "./SectionFields.tsx";

type ColorKey = Exclude<StringSettingKey, "font" | "border" | "muted">;

const _colorValue = (
  settings: Site["settings"],
  key: ColorKey,
  fallback: Record<ColorKey, string>,
): string => settings[key] ?? fallback[key];

const _colorChange = (site: Site, key: ColorKey, onUpdate: (site: Site) => void) => (v: string) =>
  onUpdate(updateSetting(site, key, v));

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-group">
      <label>{label}</label>
      <div className="color-input">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span>{value}</span>
      </div>
    </div>
  );
}

function ThemeSettings({ site, onUpdate }: { site: Site; onUpdate: (site: Site) => void }) {
  const template = templates.find((t) => t.id === site.templateId) ?? templates[0];
  const fallback = {
    accent: template.palette[1],
    bg: template.palette[0],
    ink: template.palette[2],
    surface: template.surface,
  };

  return (
    <div className="theme-settings">
      <div className="field-group">
        <label>Font</label>
        <select
          className="font-select"
          value={site.settings.font}
          onChange={(e) => onUpdate(updateSetting(site, "font", e.target.value))}
        >
          {FONTS.map((font) => (
            <option key={font}>{font}</option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <ColorField
          label="Accent"
          value={_colorValue(site.settings, "accent", fallback)}
          onChange={_colorChange(site, "accent", onUpdate)}
        />
        <ColorField
          label="Background"
          value={_colorValue(site.settings, "bg", fallback)}
          onChange={_colorChange(site, "bg", onUpdate)}
        />
      </div>
      <div className="field-row">
        <ColorField
          label="Text"
          value={_colorValue(site.settings, "ink", fallback)}
          onChange={_colorChange(site, "ink", onUpdate)}
        />
        <ColorField
          label="Cards"
          value={_colorValue(site.settings, "surface", fallback)}
          onChange={_colorChange(site, "surface", onUpdate)}
        />
      </div>
      <p className="theme-hint">
        Custom colours override the {template.name} palette. The font and accent already do.
      </p>
    </div>
  );
}

function BusinessFields({ site, onUpdate }: { site: Site; onUpdate: (site: Site) => void }) {
  return (
    <>
      <div className="field-group">
        <label>Business name</label>
        <input
          value={site.business.name}
          onChange={(e) => onUpdate(updateBusiness(site, { name: e.target.value }))}
        />
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Category</label>
          <input
            value={site.business.category}
            onChange={(e) => onUpdate(updateBusiness(site, { category: e.target.value }))}
            placeholder="Independent creative studio"
          />
        </div>
        <div className="field-group">
          <label>Location</label>
          <input
            value={site.business.location}
            onChange={(e) => onUpdate(updateBusiness(site, { location: e.target.value }))}
            placeholder="Portland, Oregon"
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field-group">
          <label>Email</label>
          <input
            value={site.business.email}
            onChange={(e) => onUpdate(updateBusiness(site, { email: e.target.value }))}
            placeholder="hello@studio.co"
          />
        </div>
        <div className="field-group">
          <label>Phone</label>
          <input
            value={site.business.phone}
            onChange={(e) => onUpdate(updateBusiness(site, { phone: e.target.value }))}
            placeholder="(503) 555-0100"
          />
        </div>
      </div>
      <div className="field-group">
        <label>
          Logo <span className="field-type">business.logo</span>
        </label>
        <input
          value={site.business.logo}
          onChange={(e) => onUpdate(updateBusiness(site, { logo: e.target.value }))}
          placeholder="AURORA"
        />
      </div>
    </>
  );
}

function AnalyticsField({ site, onUpdate }: { site: Site; onUpdate: (site: Site) => void }) {
  const siteId = site.settings.analytics?.siteId ?? "";
  return (
    <div className="field-group">
      <label>Analytics (OneDollarStats)</label>
      <input
        value={siteId}
        onChange={(e) =>
          onUpdate(updateAnalytics(site, e.target.value.trim() ? e.target.value : null))
        }
        placeholder="your site id — leave empty to disable"
      />
      <p className="domain-hint">
        Connect a $1/mo OneDollarStats site id to embed their tracking snippet on your published
        site.
      </p>
    </div>
  );
}

export default function EditorPanel({
  site,
  online,
  saveState,
  onUpdate,
  domain,
  setup,
  domainError,
  domainBusy,
  onDomainInput,
  onDomainConnect,
  onDomainVerify,
  onDomainRemove,
  readOnly,
  manager,
}: {
  site: Site;
  online: boolean | null;
  saveState: SaveState;
  onUpdate: (site: Site) => void;
  domain: string;
  setup: DomainSetup | null;
  domainError: string | null;
  domainBusy: boolean;
  onDomainInput: (domain: string) => void;
  onDomainConnect: () => void;
  onDomainVerify: () => void;
  onDomainRemove: () => void;
  readOnly: boolean;
  manager: boolean;
}) {
  const page = findPage(site);
  const hero = findSection(page, "hero");
  const services = findSection(page, "services");
  const about = findSection(page, "about");
  const testimonials = findSection(page, "testimonials");

  const savedLabel =
    saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved";

  return (
    <aside className="editor-panel">
      <div className="panel-heading">
        <div>
          <p className="overline">Site editor</p>
          <h2>Homepage</h2>
        </div>
        <span className="saved">
          <i /> {savedLabel}
        </span>
      </div>

      <div className="panel-scroll">
        {readOnly && (
          <p className="readonly-hint">
            You have view-only access to this site — your manager decides when changes can be made.
          </p>
        )}
        <fieldset className="editor-fields" disabled={readOnly}>
          <div className="section-title">
            <span>Business</span>
          </div>
          <BusinessFields site={site} onUpdate={onUpdate} />

          <div className="content-divider" />

          <div className="section-title">
            <span>Theme</span>
          </div>
          <ThemeSettings site={site} onUpdate={onUpdate} />

          <div className="content-divider" />

          {hero && (
            <>
              <div className="section-title">
                <span>Hero</span>
              </div>
              <HeroFields site={site} onUpdate={onUpdate} hero={hero} page={page} />
              <div className="content-divider" />
            </>
          )}

          {services && (
            <>
              <div className="section-title">
                <span>Services</span>
              </div>
              <ServicesFields site={site} onUpdate={onUpdate} services={services} page={page} />
              <div className="content-divider" />
            </>
          )}

          {about && (
            <>
              <div className="section-title">
                <span>About</span>
              </div>
              <AboutFields site={site} onUpdate={onUpdate} about={about} page={page} />
              <div className="content-divider" />
            </>
          )}

          {testimonials && (
            <>
              <div className="section-title">
                <span>Testimonials</span>
              </div>
              <TestimonialsFields
                site={site}
                onUpdate={onUpdate}
                testimonials={testimonials}
                page={page}
              />
              <div className="content-divider" />
            </>
          )}

          <SectionList site={site} page={page} onUpdate={onUpdate} />

          {manager && (
            <>
              <div className="content-divider" />

              <div className="section-title">
                <span>Extras</span>
              </div>
              <AnalyticsField site={site} onUpdate={onUpdate} />

              <div className="content-divider" />

              <DomainSettings
                site={site}
                online={online}
                domain={domain}
                setup={setup}
                error={domainError}
                busy={domainBusy}
                onDomainInput={onDomainInput}
                onConnect={onDomainConnect}
                onVerify={onDomainVerify}
                onRemove={onDomainRemove}
              />
            </>
          )}
        </fieldset>
      </div>
    </aside>
  );
}
