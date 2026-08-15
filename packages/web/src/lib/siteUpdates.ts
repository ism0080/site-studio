import type { Business, Page, Section, SectionType, Site, StringSettingKey } from "../types.ts";

export function findPage(site: Site, slug = "/"): Page {
  return site.pages.find((page) => page.slug === slug) || site.pages[0];
}

export function findSection<T extends SectionType>(
  page: Page,
  type: T,
): Extract<Section, { type: T }> | undefined {
  return page.sections.find(
    (section): section is Extract<Section, { type: T }> => section.type === type,
  );
}

export function updateBusiness(site: Site, patch: Partial<Business>): Site {
  return { ...site, business: { ...site.business, ...patch } };
}

export function updateSetting(site: Site, key: StringSettingKey, value: string): Site {
  return { ...site, settings: { ...site.settings, [key]: value } };
}

function _mapPage(site: Site, pageId: string, callback: (page: Page) => Page): Page[] {
  return site.pages.map((page) => (page.id !== pageId ? page : callback(page)));
}

export function updateSectionProp(
  site: Site,
  pageId: string,
  blockId: string,
  key: string,
  value: string,
): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (section.id !== blockId) return section;
        // SAFETY: The callback replaces `props` wholesale with an object built
        // from the same section's props, so the section's shape is preserved;
        // only the targeted key is overridden.
        return { ...section, props: { ...section.props, [key]: value } } as Section;
      }),
    })),
  };
}

export function updateSectionItem(
  site: Site,
  pageId: string,
  blockId: string,
  itemId: string,
  key: string,
  value: string,
): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (section.id !== blockId || section.type !== "services") return section;
        return {
          ...section,
          props: {
            ...section.props,
            items: section.props.items.map((item) =>
              item.id !== itemId ? item : { ...item, [key]: value },
            ),
          },
        };
      }),
    })),
  };
}

export function addSection(site: Site, pageId: string, section: Section): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: [...page.sections, section],
    })),
  };
}

export function removeSection(site: Site, pageId: string, blockId: string): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.filter((section) => section.id !== blockId),
    })),
  };
}

export function moveSection(site: Site, pageId: string, blockId: string, direction: number): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => {
      const sections = [...page.sections];
      const index = sections.findIndex((section) => section.id === blockId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= sections.length) return page;
      const [section] = sections.splice(index, 1);
      sections.splice(target, 0, section);
      return { ...page, sections };
    }),
  };
}
