import "./Editor.css";
import type { Device, DomainSetup, SaveState, Site } from "../types.ts";
import EditorPanel from "./EditorPanel.tsx";
import Preview from "./Preview.tsx";

export default function Editor({
  site,
  online,
  saveState,
  device,
  readOnly,
  manager,
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
  online: boolean | null;
  saveState: SaveState;
  device: Device;
  readOnly: boolean;
  manager: boolean;
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
        manager={manager}
      />
      <div className="preview-area">
        <div className="preview-toolbar">
          <div>
            <span className="live-dot" /> Live preview <span className="toolbar-divider" />{" "}
            <span className="muted">Changes save automatically</span>
          </div>
          <div className="device-toggle">
            <button aria-pressed={device === "desktop"} onClick={() => onDevice("desktop")}>
              Desktop
            </button>
            <button aria-pressed={device === "mobile"} onClick={() => onDevice("mobile")}>
              Mobile
            </button>
          </div>
        </div>
        <Preview site={site} device={device} />
      </div>
    </div>
  );
}
