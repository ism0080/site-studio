import "./Preview.css";
import { useMemo } from "react";
import { renderPage } from "@site-studio/site-template";
import type { Device, Site } from "../siteTypes.ts";
import { API_ORIGIN } from "../lib/siteApiHttpClient.ts";

// Live preview: renders the current site document through the very same
// `renderPage` the publish pipeline uses, then frames that HTML in an iframe.
// Because it renders in the browser, the preview stays live in production (no
// dev-only vite middleware), and stays byte-for-byte what a publish would
// produce — the iframe just isolates its styles/scripts from the editor chrome.

export default function Preview({ site, device }: { site: Site; device: Device }) {
  const html = useMemo(() => {
    const page = site.pages.find((p) => p.slug === "/") ?? site.pages[0];
    return page ? renderPage(site, page, { apiBase: API_ORIGIN }) : "";
  }, [site]);

  return (
    <div data-component="preview" data-device={device}>
      {html && <iframe srcDoc={html} sandbox="allow-scripts" title="Site preview" />}
    </div>
  );
}
