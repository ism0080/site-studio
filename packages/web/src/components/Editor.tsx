import "./Editor.css";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { Device, DomainSetup, SaveState, Site } from "../siteTypes.ts";
import { templateQueries } from "../lib/apiQueries.ts";
import EditorPanel from "./EditorPanel.tsx";
import Preview from "./Preview.tsx";
import { ArrowUpRightIcon } from "@phosphor-icons/react";

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
  const { data: templates = [] } = useQuery(templateQueries.list());
  const template = templates.find((t) => t.id === site.templateId);

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
          <div data-slot="preview-info">
            <span className="live-dot" /> Live preview <span data-slot="toolbar-divider" />{" "}
            <span className="muted">Changes save automatically</span>
            {template && (
              <>
                <span data-slot="toolbar-divider" />
                <span data-slot="preview-template">
                  Template: <strong>{template.name}</strong>
                  <Link
                    to="/sites/$siteId/templates"
                    params={{ siteId: site.id }}
                    search={{ category: "all" }}
                    data-slot="template-change-link"
                  >
                    Change <ArrowUpRightIcon size={12} />
                  </Link>
                </span>
              </>
            )}
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
