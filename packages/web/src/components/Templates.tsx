import "./Templates.css";
import type { Template } from "../siteTypes.ts";
import { siteTemplates } from "../data/site.ts";

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

export default function Templates({ onSelect }: { onSelect: (template: Template) => void }) {
  return (
    <div data-component="templates">
      <div data-slot="toolbar">
        <div data-slot="filter-pills">
          <button aria-pressed="true">All templates</button>
          <button aria-pressed="false">Services</button>
          <button aria-pressed="false">Retail</button>
          <button aria-pressed="false">Creative</button>
        </div>
        <button className="light-button">
          Sort by <span>Featured⌄</span>
        </button>
      </div>
      <div data-slot="grid">
        {siteTemplates.map((template) => (
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
