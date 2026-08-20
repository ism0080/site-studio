import "./Templates.css";
import { useQuery } from "@tanstack/react-query";
import { TEMPLATE_CATEGORIES } from "@site-studio/site-template/templates";
import type { Template } from "../siteTypes.ts";
import { templateQueries } from "../lib/apiQueries.ts";

function TemplateArt({ template }: { template: Template }) {
  return (
    <div data-slot="art" data-template={template.id}>
      <div data-slot="art-brand">{template.brand}</div>
      <div data-slot="art-title">
        {template.title.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
      </div>
      <div data-slot="art-block" />
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
  const { data: templates = [] } = useQuery(templateQueries.list());
  const visible = category === "all" ? templates : templates.filter((t) => t.category === category);

  return (
    <div data-component="templates">
      <div data-slot="toolbar">
        <div data-slot="filter-pills">
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button key={cat} aria-pressed={category === cat} onClick={() => onCategoryChange(cat)}>
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
