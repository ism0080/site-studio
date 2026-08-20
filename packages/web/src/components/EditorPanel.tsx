import "./EditorPanel.css";
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  DomainSetup,
  Page,
  SaveState,
  Section as SiteSection,
  Site,
  StringSettingKey,
} from "../siteTypes.ts";
import { templateFonts } from "../data/site.ts";
import { SECTION_ORDER, SECTION_TYPES } from "../data/sections.ts";
import {
  addSection,
  findPage,
  findSection,
  moveSection,
  removeSection,
  updateAnalytics,
  updateBusiness,
  updateSetting,
} from "../lib/siteUpdates.ts";
import DomainSettings from "./DomainSettings.tsx";
import { AboutFields, HeroFields, ServicesFields, TestimonialsFields } from "./SectionFields.tsx";
import { templateQueries } from "../lib/apiQueries.ts";

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
      <div data-slot="color-input">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <span>{value}</span>
      </div>
    </div>
  );
}

function ThemeSettings({ site, onUpdate }: { site: Site; onUpdate: (site: Site) => void }) {
  const { data: templates = [] } = useQuery(templateQueries.list());
  const template = templates.find((t) => t.id === site.templateId);
  const fallback = {
    accent: template?.theme.accent ?? site.settings.accent,
    bg: template?.theme.bg ?? "#f7f7f3",
    ink: template?.theme.ink ?? "#202320",
    surface: template?.theme.surface ?? "#ffffff",
  };

  return (
    <div data-slot="theme-settings">
      <div className="field-group">
        <label>Font</label>
        <select
          data-slot="font-select"
          value={site.settings.font}
          onChange={(e) => onUpdate(updateSetting(site, "font", e.target.value))}
        >
          {templateFonts.map((font) => (
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
      <p data-slot="theme-hint">
        Custom colours override the {template?.name ?? site.templateId} palette. The font and accent
        already do.
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
        <label>Logo</label>
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

/** A collapsible editor section with a heading that toggles its body. */
function Section({
  id,
  title,
  defaultOpen = true,
  action,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details data-slot="editor-section" id={`section-${id}`} open={defaultOpen}>
      <summary data-slot="section-toggle">
        <span data-slot="section-chevron" aria-hidden>
          ▸
        </span>
        <span data-slot="section-label">{title}</span>
        {action && <span data-slot="section-header-actions">{action}</span>}
      </summary>
      <div data-slot="section-body">{children}</div>
    </details>
  );
}

/** Renders the edit fields for a single section, dispatched by its type. */
function BlockFields({
  site,
  page,
  section,
  onUpdate,
}: {
  site: Site;
  page: Page;
  section: SiteSection;
  onUpdate: (site: Site) => void;
}) {
  if (section.type === "hero")
    return <HeroFields site={site} onUpdate={onUpdate} hero={section} page={page} />;
  if (section.type === "services")
    return <ServicesFields site={site} onUpdate={onUpdate} services={section} page={page} />;
  if (section.type === "about")
    return <AboutFields site={site} onUpdate={onUpdate} about={section} page={page} />;
  return <TestimonialsFields site={site} onUpdate={onUpdate} testimonials={section} page={page} />;
}

/** One content block: a collapsible accordion with move/remove controls in its header. */
function BlockSection({
  site,
  page,
  section,
  index,
  count,
  onUpdate,
}: {
  site: Site;
  page: Page;
  section: SiteSection;
  index: number;
  count: number;
  onUpdate: (site: Site) => void;
}) {
  const label = SECTION_TYPES[section.type].label;
  return (
    <Section
      id={section.type}
      title={label}
      action={
        <span
          data-slot="block-actions"
          onClick={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="section-btn"
            aria-label={`Move ${label} up`}
            disabled={index === 0}
            onClick={() => onUpdate(moveSection(site, page.id, section.id, -1))}
          >
            ↑
          </button>
          <button
            type="button"
            className="section-btn"
            aria-label={`Move ${label} down`}
            disabled={index === count - 1}
            onClick={() => onUpdate(moveSection(site, page.id, section.id, 1))}
          >
            ↓
          </button>
          <button
            type="button"
            className="section-btn remove"
            aria-label={`Remove ${label}`}
            onClick={() => onUpdate(removeSection(site, page.id, section.id))}
          >
            ×
          </button>
        </span>
      }
    >
      <BlockFields site={site} page={page} section={section} onUpdate={onUpdate} />
    </Section>
  );
}

/** Picker for adding section types that aren't yet on the page. */
function AddBlock({
  site,
  page,
  onUpdate,
}: {
  site: Site;
  page: Page;
  onUpdate: (site: Site) => void;
}) {
  const addable = SECTION_ORDER.filter((type) => !findSection(page, type));
  if (addable.length === 0) return null;
  return (
    <div data-slot="add-block">
      <p data-slot="add-block-label">Add a block</p>
      {addable.map((type) => {
        const meta = SECTION_TYPES[type];
        return (
          <div data-slot="section-card" data-slot-variant="muted" key={type}>
            <div data-slot="drag" aria-hidden="true">
              +
            </div>
            <div data-slot="section-card-body">
              <strong>{meta.label}</strong>
              <small>{meta.hint}</small>
            </div>
            <button
              type="button"
              className="add-small"
              onClick={() => onUpdate(addSection(site, page.id, meta.create()))}
            >
              Add
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Compact save indicator with a retry affordance when the last save failed. */
function SaveStatus({
  saveState,
  onRetry,
}: {
  saveState: SaveState;
  onRetry: () => void;
}) {
  if (saveState === "error") {
    return (
      <button type="button" className="saved" data-slot="save-error" onClick={onRetry}>
        <i /> Save failed — retry
      </button>
    );
  }
  const label = saveState === "saving" ? "Saving…" : "Saved";
  return (
    <span className="saved" data-slot={saveState === "saving" ? "save-busy" : undefined}>
      <i /> {label}
    </span>
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
  fullAccess,
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
  fullAccess: boolean;
}) {
  const page = findPage(site);
  const blocks = page.sections;

  const nav: { id: string; label: string }[] = [
    { id: "business", label: "Business" },
    { id: "theme", label: "Theme" },
    ...blocks.map((section) => ({ id: section.type, label: SECTION_TYPES[section.type].label })),
    { id: "add-block", label: "Add" },
    ...(fullAccess ? [{ id: "extras", label: "Extras" }] : []),
  ];

  return (
    <aside data-component="editor-panel">
      <div data-slot="panel-heading">
        <div>
          <p className="overline">Site editor</p>
          <h2>Homepage</h2>
        </div>
        <SaveStatus saveState={saveState} onRetry={() => onUpdate(site)} />
      </div>

      <nav data-slot="section-nav" aria-label="Jump to section">
        {nav.map((item) => (
          <a key={item.id} href={`#section-${item.id}`}>
            {item.label}
          </a>
        ))}
      </nav>

      <div data-slot="panel-scroll">
        {readOnly && (
          <p data-slot="readonly-hint">
            <span data-slot="lock" aria-hidden>
              🔒
            </span>{" "}
            You have view-only access to this site — your manager decides when changes can be made.
          </p>
        )}
        <fieldset data-slot="editor-fields" disabled={readOnly}>
          <Section id="business" title="Business">
            <BusinessFields site={site} onUpdate={onUpdate} />
          </Section>

          <Section id="theme" title="Theme">
            <ThemeSettings site={site} onUpdate={onUpdate} />
          </Section>

          {blocks.map((section, index) => (
            <BlockSection
              key={section.id}
              site={site}
              page={page}
              section={section}
              index={index}
              count={blocks.length}
              onUpdate={onUpdate}
            />
          ))}

          <div data-slot="add-block-anchor" id="section-add-block" />
          <AddBlock site={site} page={page} onUpdate={onUpdate} />

          {fullAccess && (
            <Section id="extras" title="Extras" defaultOpen={false}>
              <AnalyticsField site={site} onUpdate={onUpdate} />

              <div data-slot="content-divider" />

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
            </Section>
          )}
        </fieldset>
      </div>
    </aside>
  );
}
