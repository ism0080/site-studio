// Bridges the router (which owns the URL's $siteId) to the workspace machine
// so the editor's working copy follows navigation — without React effects.
// The provider registers a handler; the site route's `beforeLoad` fires it.
let siteLoadHandler: ((id: string) => void) | undefined;

/** Registers the handler that swaps the machine's working site on navigation. */
export const setSiteLoadHandler = (handler: ((id: string) => void) | undefined) => {
  siteLoadHandler = handler;
};

/** Notifies the machine that the active site changed to `id`. */
export const notifySiteLoaded = (id: string) => {
  siteLoadHandler?.(id);
};
