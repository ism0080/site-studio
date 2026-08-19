import "./Preview.css";
import type { Device } from "../types.ts";

// Dev-only live preview. The app machine posts the current site document to
// the vite dev server and bumps `revision` on every successful render; this
// component just frames the result at the requested device width.
const PREVIEW_URL = "/__site-preview";

export default function Preview({ device, revision }: { device: Device; revision: number }) {
  return (
    <div data-component="preview" data-device={device}>
      {revision > 0 && (
        <iframe
          key={revision}
          src={`${PREVIEW_URL}?v=${revision}`}
          sandbox="allow-scripts"
          title="Site preview"
        />
      )}
    </div>
  );
}
