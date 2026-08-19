import "./Templates.css";
import type { Template } from "../siteTypes.ts";
import { siteTemplates } from "../data/site.ts";

const CATEGORIES = ["all", "Services", "Retail", "Creative"];

function TemplateArt({ template }: { template: Template }) {
  return (
    <div data-slot="art" style={{ background: template.palette[0] }}>
      <div data-slot="art-brand" style={{ color: template.palette[2] }}>
        {template.brand}
      </div>
      <div data-slot="art-title" style={{ color: template.palette[2] }}>
        {template.title.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
      </div>
      <div data-slot="art-block" style={{ background: template.palette[1] }} />
    </div>
  );
}

export default function Templates({
  category,
  onCategoryChange,
  onSelect,
}: {
  category: string;
  onCategoryChange: (category: string) => void;
  onSelect: (template: Template) => void;
}) {
  const visible =
    category === "all"
      ? siteTemplates
      : siteTemplates.filter((t) => t.category === category);

  return (
    <div data-component="templates">
      <div data-slot="toolbar">
        <div data-slot="filter-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              aria-pressed={category === cat}
              onClick={() => onCategoryChange(cat)}
            >
              {cat === "all" ? "All templates" : cat}
            </button>
          ))}
        </div>
        <button className="light-button">
          Sort by <span>Featured⌄</span>
        </button>
      </div>
      <div data-slot="grid">
        {visible.map((template) => (
          <button data-slot="card" key={template.id} onClick={() => onSelect(template)}>
            <TemplateArt template={template} />
            <div data-slot="card-footer">
              <div>
                <strong>{template.name}</strong>
                <small>{template.category}</small>
              </div>
              <span>Use template ↗</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
