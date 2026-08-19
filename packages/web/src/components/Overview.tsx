import "./Overview.css";
import type { Site } from "../types.ts";
import { buildStatusLabel } from "../lib/api.ts";
import { ArrowRightIcon } from "@phosphor-icons/react";

interface OverviewProps {
  onEdit: () => void;
  site: Site;
}

export default function Overview({ onEdit, site }: OverviewProps) {
  return (
    <div data-component="overview">
      <section data-slot="stat-grid">
        <div data-slot="stat-card">
          <span>Site visits</span>
          <strong>—</strong>
          <small>coming with analytics</small>
        </div>
        <div data-slot="stat-card">
          <span>New leads</span>
          <strong>—</strong>
          <small>coming soon</small>
        </div>
      </section>

      <section className="section-header">
        <div>
          <p className="overline">Your site</p>
          <h2>Keep building your presence</h2>
        </div>
        <div>
          <button data-component="button" onClick={onEdit}>
            Open editor <ArrowRightIcon data-slot="icon" />
          </button>
          <div data-slot="site-meta">
            <span>Edited {site.lastSaved}</span>
          </div>
        </div>
      </section>

      <div data-slot="site-list-card">
        <div data-slot="site-info">
          <div data-slot="site-info-title">
            <div>
              <h3>{site.business.name}</h3>
              <p>{site.customDomain || "no custom domain yet"}</p>
            </div>
            <span className="status-pill">
              <i /> {buildStatusLabel(site)}
            </span>
          </div>
        </div>
      </div>

      <div data-slot="tip-card">
        <div data-slot="tip-icon">✦</div>
        <div>
          <strong>Make your first impression count</strong>
          <p>Add a profile photo and your best work to help visitors get to know your business.</p>
        </div>
        <button data-component="button">
          View checklist <ArrowRightIcon data-slot="icon" size={15} />
        </button>
      </div>
    </div>
  );
}
