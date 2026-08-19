import "./DomainSettings.css";
import type { DomainSetup, Site } from "../siteTypes.ts";

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
      <div data-component="domain-settings" className="field-group">
        <label>Custom domain</label>
        <p className="domain-hint">Connect the API to attach your own domain.</p>
      </div>
    );
  }

  const active = site.customDomain;

  return (
    <div data-component="domain-settings" className="field-group">
      <label>Custom domain</label>
      {active && (
        <div data-slot="active">
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
        <div data-slot="row">
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
        <div data-slot="records">
          <p className="domain-hint">
            Point your domain at the CNAME target and add these TXT records, then verify.
          </p>
          <div data-slot="record">
            <code>
              {domain} CNAME {setup.cnameTarget}
            </code>
            {setup.records.map((record) => (
              <span key={record.name}>
                <code>{record.name}</code>
                <code>{record.value}</code>
              </span>
            ))}
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
