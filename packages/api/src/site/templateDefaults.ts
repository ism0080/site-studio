import * as Schema from "effect/Schema";
import { TEMPLATES, type SiteTemplate } from "@site-studio/site-template/templates";
import { Site, TemplateInfo } from "./site.ts";

/**
 * A brand-new site is created with empty sections. The stored document stays
 * empty (so template default edits propagate to never-touched sites), but every
 * response the editor sees resolves those empty pages to the template's default
 * content — "start from the template, then make it yours".
 */
export const withDefaultSections = (site: Site): Site => {
  const defaults = TEMPLATES.get(site.templateId)?.defaultSections;
  if (!defaults) return site;
  const pages = site.pages.map((page) =>
    page.sections.length === 0 ? { ...page, sections: defaults } : page,
  );
  return Schema.decodeUnknownSync(Site)({ ...site, pages });
};

/** Maps a registry template to the API's gallery/theme shape. */
export const toTemplateInfo = (template: SiteTemplate): TemplateInfo => ({
  id: template.id,
  name: template.name,
  font: template.font,
  tier: template.tier,
  category: template.category,
  brand: template.brand,
  title: template.title,
  theme: template.theme,
});

/**
 * The plan a template requires. Unknown ids read as Pro: only registered
 * templates are creatable, and the conservative answer never unlocks a paid
 * template for a free account.
 */
export const templateTier = (templateId: string): TemplateInfo["tier"] =>
  TEMPLATES.get(templateId)?.tier ?? "pro";

/** The full template list served to the editor's template gallery. */
export const listTemplateInfo = (): ReadonlyArray<TemplateInfo> =>
  [...TEMPLATES.values()].map(toTemplateInfo);
