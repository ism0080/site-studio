import "./Editor.css";
import type { Device, DomainSetup, SaveState, Site } from "../siteTypes.ts";
import EditorPanel from "./EditorPanel.tsx";
import Preview from "./Preview.tsx";

export default function Editor({
  site,
  previewSite,
  online,
  saveState,
  device,
  readOnly,
  fullAccess,
  onDevice,
  onUpdate,
  domain,
  setup,
  domainError,
  domainBusy,
  onDomainInput,
  onDomainConnect,
  onDomainVerify,
  onDomainRemove,
}: {
  site: Site;
  previewSite: Site;
  online: boolean | null;
  saveState: SaveState;
  device: Device;
  readOnly: boolean;
  fullAccess: boolean;
  onDevice: (device: Device) => void;
  onUpdate: (site: Site) => void;
  domain: string;
  setup: DomainSetup | null;
  domainError: string | null;
  domainBusy: boolean;
  onDomainInput: (domain: string) => void;
  onDomainConnect: () => void;
  onDomainVerify: () => void;
  onDomainRemove: () => void;
}) {
  return (
    <div data-component="editor">
      <EditorPanel
        site={site}
        online={online}
        saveState={saveState}
        onUpdate={onUpdate}
        domain={domain}
        setup={setup}
        domainError={domainError}
        domainBusy={domainBusy}
        onDomainInput={onDomainInput}
        onDomainConnect={onDomainConnect}
        onDomainVerify={onDomainVerify}
        onDomainRemove={onDomainRemove}
        readOnly={readOnly}
        fullAccess={fullAccess}
      />
      <div data-slot="preview-area">
        <div data-slot="preview-toolbar">
          <div>
            <span className="live-dot" /> Live preview <span data-slot="toolbar-divider" />{" "}
            <span className="muted">Changes save automatically</span>
          </div>
          <div data-slot="device-toggle">
            <button
              aria-pressed={device === "desktop"}
              aria-label="Desktop preview"
              onClick={() => onDevice("desktop")}
            >
              <span aria-hidden>🖥</span> Desktop
            </button>
            <button
              aria-pressed={device === "mobile"}
              aria-label="Mobile preview"
              onClick={() => onDevice("mobile")}
            >
              <span aria-hidden>📱</span> Mobile
            </button>
          </div>
        </div>
        <Preview site={previewSite} device={device} />
      </div>
    </div>
  );
}
