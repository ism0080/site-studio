import "./Preview.css";
import { useMemo, useRef } from "react";
import type { Device, Page, Site } from "../siteTypes.ts";
import { API_ORIGIN } from "../lib/siteApiHttpClient.ts";
import previewClientSource from "@site-studio/site-template/preview-client?raw";

// Live preview: renders the current site through the very same `PageBody` the
// publish pipeline uses, but the page runs INSIDE the iframe (its own realm)
// via a client bundle inlined in `srcDoc`. The parent only pushes the debounced
// site over postMessage, so React reconciles just the changed nodes — edits
// don't reload the page and the user's scroll / in-progress input survive.
// The iframe is same-origin so the client pulls authoritative state on mount.

interface PreviewState {
  site: Site;
  page: Page;
  apiBase: string;
}

declare global {
  interface Window {
    __previewState?: PreviewState | null;
  }
}

export default function Preview({ site, device }: { site: Site; device: Device }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastPostedRef = useRef<Site | null>(null);

  const page = useMemo(() => site.pages.find((p) => p.slug === "/") ?? site.pages[0], [site]);

  // Static shell; the in-iframe client pulls the current site on mount and
  // populates the head and body itself, so this never rebuilds on edits.
  // The inlined bundle must not contain a raw `</script` or the HTML parser
  // closes the enclosing <script> early; `<\/script` is identical in JS.
  const srcDoc = useMemo(
    () => `<!doctype html><html lang="en"><head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"/>
      <link id="preview-font" href="" rel="stylesheet"/>
      <style id="preview-theme"></style>
    </head>
    <body>
      <div id="root"></div>
      <script>${previewClientSource.replace(/<\/script/gi, "<\\/script")}</script>
    </body></html>`,
    [],
  );

  // Expose the authoritative state for the iframe client to pull on mount.
  window.__previewState = page ? { site, page, apiBase: API_ORIGIN } : null;

  // Push the latest (debounced) site to the live iframe.
  if (page && lastPostedRef.current !== site) {
    lastPostedRef.current = site;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "render", site, page, apiBase: API_ORIGIN } satisfies PreviewState & {
        type: "render";
      },
      "*",
    );
  }

  return (
    <div data-component="preview" data-device={device}>
      {srcDoc && (
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          title="Site preview"
        />
      )}
    </div>
  );
}
