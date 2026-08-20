import type {
  Business,
  Page,
  Section,
  SectionType,
  ServiceItem,
  Site,
  StringSettingKey,
  TestimonialItem,
} from "../siteTypes.ts";

function _mapPage(site: Site, pageId: string, callback: (page: Page) => Page): Page[] {
  return site.pages.map((page) => (page.id !== pageId ? page : callback(page)));
}

/** The page in a site whose slug matches, falling back to the first page. */
export function findPage(site: Site, slug = "/"): Page {
  return site.pages.find((page) => page.slug === slug) || site.pages[0];
}

/** The first section of the given type on a page, or undefined if absent. */
export function findSection<T extends SectionType>(
  page: Page,
  type: T,
): Extract<Section, { type: T }> | undefined {
  return page.sections.find(
    (section): section is Extract<Section, { type: T }> => section.type === type,
  );
}

/** Returns a new site with the given business fields overridden. */
export function updateBusiness(site: Site, patch: Partial<Business>): Site {
  return { ...site, business: { ...site.business, ...patch } };
}

/** Returns a new site with a string setting (e.g. accent, font) overridden. */
export function updateSetting(site: Site, key: StringSettingKey, value: string): Site {
  return { ...site, settings: { ...site.settings, [key]: value } };
}

/** Returns a new site with analytics set to OneDollarStats, or cleared when siteId is null. */
export function updateAnalytics(site: Site, siteId: string | null): Site {
  return {
    ...site,
    settings: {
      ...site.settings,
      analytics: siteId === null ? undefined : { provider: "onedollarstats", siteId },
    },
  };
}

export function updateSectionProp(
  site: Site,
  pageId: string,
  sectionId: string,
  key: string,
  value: string,
): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (section.id !== sectionId) return section;
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
  sectionId: string,
  itemId: string,
  key: string,
  value: string,
): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (section.id !== sectionId) return section;
        if (section.type === "services") {
          return {
            ...section,
            props: {
              ...section.props,
              items: section.props.items.map((item) =>
                item.id === itemId ? item : { ...item, [key]: value },
              ),
            },
          };
        }
        if (section.type === "testimonials") {
          return {
            ...section,
            props: {
              ...section.props,
              items: section.props.items.map((item) =>
                item.id === itemId ? item : { ...item, [key]: value },
              ),
            },
          };
        }
        return section;
      }),
    })),
  };
}

export function addSectionItem(
  site: Site,
  pageId: string,
  sectionId: string,
  item: ServiceItem | TestimonialItem,
): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (section.id !== sectionId) return section;
        if (section.type === "services") {
          // SAFETY: the caller supplies a service item for service sections;
          // the union narrows at the call site, so casting is safe.
          return {
            ...section,
            props: { ...section.props, items: [...section.props.items, item as ServiceItem] },
          };
        }
        if (section.type === "testimonials") {
          // SAFETY: the caller supplies a testimonial item for testimonial
          // sections; the union narrows at the call site, so casting is safe.
          return {
            ...section,
            props: { ...section.props, items: [...section.props.items, item as TestimonialItem] },
          };
        }
        return section;
      }),
    })),
  };
}

export function removeSectionItem(
  site: Site,
  pageId: string,
  sectionId: string,
  itemId: string,
): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (section.id !== sectionId) return section;
        if (section.type === "services") {
          return {
            ...section,
            props: {
              ...section.props,
              items: section.props.items.filter((item) => item.id !== itemId),
            },
          };
        }
        if (section.type === "testimonials") {
          return {
            ...section,
            props: {
              ...section.props,
              items: section.props.items.filter((item) => item.id !== itemId),
            },
          };
        }
        return section;
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

export function removeSection(site: Site, pageId: string, sectionId: string): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.filter((section) => section.id !== sectionId),
    })),
  };
}

export function moveSection(
  site: Site,
  pageId: string,
  sectionId: string,
  direction: number,
): Site {
  return {
    ...site,
    pages: _mapPage(site, pageId, (page) => {
      const sections = [...page.sections];
      const index = sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= sections.length) return page;
      const [section] = sections.splice(index, 1);
      sections.splice(target, 0, section);
      return { ...page, sections };
    }),
  };
}
