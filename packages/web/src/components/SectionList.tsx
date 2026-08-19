import type { Page, Site } from "../types.ts";
import { SECTION_ORDER, SECTION_TYPES } from "../data/sections.ts";
import { addSection, findSection, moveSection, removeSection } from "../lib/siteUpdates.ts";
import SectionTitle from "./SectionTitle.tsx";

export default function SectionList({
  site,
  page,
  onUpdate,
}: {
  site: Site;
  page: Page;
  onUpdate: (site: Site) => void;
}) {
  const addable = SECTION_ORDER.filter((type) => !findSection(page, type)).map(
    (type) => [type, SECTION_TYPES[type]] as const,
  );

  return (
    <>
      <SectionTitle>Homepage sections</SectionTitle>

      {page.sections.map((block, i) => {
        const meta = SECTION_TYPES[block.type];
        return (
          <div data-slot="section-card" key={block.id}>
            <div data-slot="drag" aria-hidden="true">
              ⠿
            </div>
            <div data-slot="section-card-body">
              <strong>{meta ? meta.label : block.type}</strong>
              <small>{SECTION_TYPES[block.type].sub(block.props)}</small>
            </div>
            <div data-slot="section-actions">
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
            onClick={() => onUpdate(addSection(site, page.id, SECTION_TYPES[type].create()))}
          >
            Add
          </button>
        </div>
      ))}
    </>
  );
}
