export function findPage(site, slug = "/") {
  return site.pages.find((page) => page.slug === slug) || site.pages[0];
}

export function findSection(page, type) {
  return page.sections.find((section) => section.type === type);
}

export function updateBusiness(site, patch) {
  return { ...site, business: { ...site.business, ...patch } };
}

export function updateSetting(site, key, value) {
  return { ...site, settings: { ...site.settings, [key]: value } };
}

function mapSectionProps(page, blockId, callback) {
  return page.sections.map((section) =>
    section.id !== blockId ? section : { ...section, props: callback(section.props) },
  );
}

function mapPage(site, pageId, callback) {
  return site.pages.map((page) => (page.id !== pageId ? page : callback(page)));
}

export function updateSectionProp(site, pageId, blockId, key, value) {
  return {
    ...site,
    pages: mapPage(site, pageId, (page) => ({
      ...page,
      sections: mapSectionProps(page, blockId, (props) => ({ ...props, [key]: value })),
    })),
  };
}

export function updateSectionItem(site, pageId, blockId, itemId, key, value) {
  return {
    ...site,
    pages: mapPage(site, pageId, (page) => ({
      ...page,
      sections: mapSectionProps(page, blockId, (props) => ({
        ...props,
        items: props.items.map((item) => (item.id !== itemId ? item : { ...item, [key]: value })),
      })),
    })),
  };
}

export function addSection(site, pageId, section) {
  return {
    ...site,
    pages: mapPage(site, pageId, (page) => ({
      ...page,
      sections: [...page.sections, section],
    })),
  };
}

export function removeSection(site, pageId, blockId) {
  return {
    ...site,
    pages: mapPage(site, pageId, (page) => ({
      ...page,
      sections: page.sections.filter((section) => section.id !== blockId),
    })),
  };
}

export function moveSection(site, pageId, blockId, direction) {
  return {
    ...site,
    pages: mapPage(site, pageId, (page) => {
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
