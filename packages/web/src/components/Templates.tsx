import type { Template } from "../types.ts";
import { templates } from "../data/site.ts";

function TemplateArt({ template }: { template: Template }) {
  return (
    <div className="template-art" style={{ background: template.palette[0] }}>
      <div className="art-brand" style={{ color: template.palette[2] }}>
        {template.brand}
      </div>
      <div className="art-title" style={{ color: template.palette[2] }}>
        {template.title.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
      </div>
      <div className="art-block" style={{ background: template.palette[1] }} />
    </div>
  );
}

export default function Templates({ onSelect }: { onSelect: (template: Template) => void }) {
  return (
    <div className="templates-page">
      <div className="template-toolbar">
        <div className="filter-pills">
          <button className="selected">All templates</button>
          <button>Services</button>
          <button>Retail</button>
          <button>Creative</button>
        </div>
        <button className="light-button">
          Sort by <span>Featured⌄</span>
        </button>
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <button className="template-card" key={template.id} onClick={() => onSelect(template)}>
            <TemplateArt template={template} />
            <div className="template-card-footer">
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
