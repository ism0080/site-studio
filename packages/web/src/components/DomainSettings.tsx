import "./DomainSettings.css";
import type { DomainSetup, Site } from "../types.ts";

export default function DomainSettings({
  site,
  online,
  domain,
  setup,
  error,
  busy,
  onDomainInput,
  onConnect,
  onVerify,
  onRemove,
}: {
  site: Site;
  online: boolean | null;
  domain: string;
  setup: DomainSetup | null;
  error: string | null;
  busy: boolean;
  onDomainInput: (domain: string) => void;
  onConnect: () => void;
  onVerify: () => void;
  onRemove: () => void;
}) {
  if (online !== true) {
    return (
      <div className="field-group">
        <label>Custom domain</label>
        <p className="domain-hint">Connect the API to attach your own domain.</p>
      </div>
    );
  }

  const active = site.customDomain;

  return (
    <div className="field-group">
      <label>Custom domain</label>
      {active && (
        <div className="domain-active">
          <span className="status-pill">
            <i /> {active}
          </span>
          <button
            className="section-btn remove"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove domain"
          >
            ×
          </button>
        </div>
      )}
      {!active && !setup && (
        <div className="domain-row">
          <input
            placeholder="example.com"
            value={domain}
            onChange={(e) => onDomainInput(e.target.value)}
          />
          <button className="dark-button" onClick={onConnect} disabled={busy}>
            Connect
          </button>
        </div>
      )}
      {setup && (
        <div className="domain-records">
          <p className="domain-hint">Add this TXT record at your DNS provider, then verify.</p>
          <div className="record">
            <code>{setup.txtName}</code>
            <code>{setup.txtValue}</code>
          </div>
          <button className="dark-button" onClick={onVerify} disabled={busy}>
            Verify ownership
          </button>
        </div>
      )}
      {error && <p className="domain-error">{error}</p>}
    </div>
  );
}
