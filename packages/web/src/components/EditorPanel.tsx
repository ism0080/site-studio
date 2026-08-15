import type { DomainSetup, SaveState, Site, StringSettingKey } from "../types.ts";
import { SECTION_ORDER, SECTION_TYPES } from "../data/sections.ts";
import { FONTS, templates } from "../data/site.ts";
import {
  findPage,
  findSection,
  updateBusiness,
  updateSetting,
  updateSectionProp,
  updateSectionItem,
  addSection,
  removeSection,
  moveSection,
} from "../lib/siteUpdates.ts";

type ColorKey = Exclude<StringSettingKey, "font">;

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

function DomainSettings({
  site,
  online,
  domain,
  setup,
  error,
  busy,
  onDomainInput,
  onConnect,
  onVerify,
  onRemove,
}: {
  site: Site;
  online: boolean | null;
  domain: string;
  setup: DomainSetup | null;
  error: string | null;
  busy: boolean;
  onDomainInput: (domain: string) => void;
  onConnect: () => void;
  onVerify: () => void;
  onRemove: () => void;
}) {
  if (online !== true) {
    return (
      <div className="field-group">
        <label>Custom domain</label>
        <p className="domain-hint">Connect the API to attach your own domain.</p>
      </div>
    );
  }

  const active = site.customDomain;

  return (
    <div className="field-group">
      <label>Custom domain</label>
      {active && (
        <div className="domain-active">
          <span className="status-pill">
            <i /> {active}
          </span>
          <button
            className="section-btn remove"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove domain"
          >
            ×
          </button>
        </div>
      )}
      {!active && !setup && (
        <div className="domain-row">
          <input
            placeholder="example.com"
            value={domain}
            onChange={(e) => onDomainInput(e.target.value)}
          />
          <button className="dark-button" onClick={onConnect} disabled={busy}>
            Connect
          </button>
        </div>
      )}
      {setup && (
        <div className="domain-records">
          <p className="domain-hint">Add this TXT record at your DNS provider, then verify.</p>
          <div className="record">
            <code>{setup.txtName}</code>
            <code>{setup.txtValue}</code>
          </div>
          <button className="dark-button" onClick={onVerify} disabled={busy}>
            Verify ownership
          </button>
        </div>
      )}
      {error && <p className="domain-error">{error}</p>}
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
}) {
  const page = findPage(site);
  const hero = findSection(page, "hero");
  const services = findSection(page, "services");

  const addable = SECTION_ORDER.filter((type) => !findSection(page, type)).map(
    (type) => [type, SECTION_TYPES[type]] as const,
  );

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
        <div className="field-group">
          <label>Business name</label>
          <input
            value={site.business.name}
            onChange={(e) => onUpdate(updateBusiness(site, { name: e.target.value }))}
          />
        </div>

        <div className="content-divider" />

        <div className="section-title">
          <span>Theme</span>
        </div>
        <ThemeSettings site={site} onUpdate={onUpdate} />

        <div className="content-divider" />

        {hero && (
          <>
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

            <div className="field-group">
              <label>Primary button</label>
              <input
                value={hero.props.primaryCta}
                onChange={(e) =>
                  onUpdate(updateSectionProp(site, page.id, hero.id, "primaryCta", e.target.value))
                }
              />
            </div>
          </>
        )}

        {services &&
          services.props.items.map((item, i) => (
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
            </div>
          ))}

        <div className="content-divider" />

        <div className="section-title">
          <span>Homepage sections</span>
        </div>

        {page.sections.map((block, i) => {
          const meta = SECTION_TYPES[block.type];
          return (
            <div className="section-card" key={block.id}>
              <div className="drag" aria-hidden="true">
                ⠿
              </div>
              <div className="section-card-body">
                <strong>{meta ? meta.label : block.type}</strong>
                <small>{SECTION_TYPES[block.type].sub(block.props)}</small>
              </div>
              <div className="section-actions">
                <button
                  type="button"
                  className="section-btn"
                  aria-label="Move section up"
                  disabled={i === 0}
                  onClick={() => onUpdate(moveSection(site, page.id, block.id, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="section-btn"
                  aria-label="Move section down"
                  disabled={i === page.sections.length - 1}
                  onClick={() => onUpdate(moveSection(site, page.id, block.id, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="section-btn remove"
                  aria-label="Remove section"
                  onClick={() => onUpdate(removeSection(site, page.id, block.id))}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}

        {addable.map(([type, meta]) => (
          <div className="section-card muted-card" key={type}>
            <div className="drag" aria-hidden="true">
              +
            </div>
            <div className="section-card-body">
              <strong>{meta.label}</strong>
              <small>{meta.hint}</small>
            </div>
            <button
              type="button"
              className="add-small"
              onClick={() => onUpdate(addSection(site, page.id, SECTION_TYPES[type].create()))}
            >
              Add
            </button>
          </div>
        ))}

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
      </div>
    </aside>
  );
}
