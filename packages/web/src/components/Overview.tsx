import "./Overview.css";
import type { Site } from "../types.ts";
import { buildStatusLabel } from "../lib/api.ts";
import { ArrowRightIcon } from "@phosphor-icons/react";

interface OverviewProps {
  onEdit: () => void;
  site: Site;
  sites: readonly Site[];
}

export default function Overview({ onEdit, site, sites }: OverviewProps) {
  const publishedCount = sites.filter((s) => s.status === "published").length;
  return (
    <div data-component="overview">
      <section className="stat-grid">
        <div className="stat-card">
          <span>Published sites</span>
          <strong>{publishedCount || (site.status === "published" ? 1 : 0)}</strong>
          <small>
            <b>↗</b> connected to API
          </small>
        </div>
        <div className="stat-card">
          <span>Site visits</span>
          <strong>—</strong>
          <small>coming with analytics</small>
        </div>
        <div className="stat-card">
          <span>New leads</span>
          <strong>—</strong>
          <small>coming soon</small>
        </div>
      </section>

      <section className="section-header">
        <div>
          <p className="overline">Your sites</p>
          <h2>Keep building your presence</h2>
        </div>
        <button data-component="button" onClick={onEdit}>
          Open editor <ArrowRightIcon data-slot="icon" />
        </button>
      </section>

      <div className="site-list-card">
        <div className="site-info">
          <div className="site-info-title">
            <div>
              <h3>{site.business.name}</h3>
              <p>{site.customDomain || "no custom domain yet"}</p>
            </div>
            <span className="status-pill">
              <i /> {buildStatusLabel(site)}
            </span>
          </div>
          <div className="site-meta">
            <span>Edited {site.lastSaved}</span>
            <span>Editorial Studio</span>
            <button data-component="button" onClick={onEdit}>
              Edit site <ArrowRightIcon data-slot="icon" />
            </button>
          </div>
        </div>
      </div>

      <div className="tip-card">
        <div className="tip-icon">✦</div>
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
