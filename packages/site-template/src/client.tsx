import { createRoot, type Root } from "react-dom/client";
import { PageBody, pageHead } from "./render.tsx";
import type { Page, Site } from "./site.ts";

// Live editor preview entry. This bundle is loaded INSIDE the preview iframe
// (its own JavaScript realm) so it can own the iframe's document and let
// React reconcile just the changed nodes on each edit — preserving the
// user's scroll and in-progress form input instead of reloading the page.
//
// Because the iframe is same-origin with the editor, the parent pushes edits
// over postMessage and the client can also pull the authoritative state from
// the parent on mount (closing the window between iframe load and the first
// pushed edit).

type PreviewData = { site: Site; page: Page; apiBase: string };

interface PreviewHost extends Window {
  __previewState?: PreviewData | null;
}

// SAFETY: The host editor window is same-origin (the iframe runs with
// allow-same-origin), so reading window.parent never throws and is not a
// cross-origin access.
const host = window.parent as PreviewHost;

// SAFETY: The preview shell in Preview.tsx always renders #root, #preview-theme
// and #preview-font with these exact ids, so they are present when this bundle runs.
const rootEl = document.getElementById("root");
// SAFETY: see above — the shell guarantees #root exists.
const root: Root = createRoot(rootEl as HTMLElement);
// SAFETY: see above — the shell guarantees #preview-theme exists.
const themeStyle = document.getElementById("preview-theme") as HTMLStyleElement;
// SAFETY: see above — the shell guarantees #preview-font exists.
const fontLink = document.getElementById("preview-font") as HTMLLinkElement;

function applyHead(site: Site, page: Page) {
  const head = pageHead(site, page);
  document.title = head.title;
  fontLink.href = head.fontHref;
  themeStyle.textContent = head.themeCss;
}

function apply({ site, page, apiBase }: PreviewData) {
  if (!site || !page) return;
  applyHead(site, page);
  root.render(<PageBody site={site} page={page} apiBase={apiBase} />);
}

// Render the authoritative state on mount. Pulling it closes the window
// between iframe load and the first pushed edit (a message sent before this
// listener attached would otherwise be lost).
if (host.__previewState) {
  apply(host.__previewState);
}

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "render") {
    // SAFETY: The parent pushes only well-formed PreviewData (built from the
    // trusted Site/Page domain values), gated by the "render" tag below.
    apply(event.data as PreviewData);
  }
});

// Intercept all link clicks to prevent the iframe from navigating and loading the editor.
document.addEventListener("click", (event) => {
  // SAFETY: Any clicked DOM target is an instance of HTMLElement.
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest("a");
  if (!anchor) return;

  const href = anchor.getAttribute("href");
  if (!href) return;

  // Let local hash anchors scroll naturally; block other navigations.
  if (!href.startsWith("#")) {
    event.preventDefault();
  }
});
