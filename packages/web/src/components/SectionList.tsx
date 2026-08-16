import type { Page, Site } from "../types.ts";
import { SECTION_ORDER, SECTION_TYPES } from "../data/sections.ts";
import { addSection, findSection, moveSection, removeSection } from "../lib/siteUpdates.ts";

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
    </>
  );
}
