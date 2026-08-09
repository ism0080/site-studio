import Icon from "./Icon.jsx";
import { findPage, findSection } from "../lib/siteUpdates.js";

export default function Overview({ onEdit, site, sites }) {
  const hero = findSection(findPage(site), "hero");
  const publishedCount = sites.filter((s) => s.status === "published").length;
  return (
    <div className="overview">
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
        <button className="dark-button" onClick={onEdit}>
          Open editor <Icon name="arrow" size={16} />
        </button>
      </section>

      <div className="site-list-card">
        <div className="site-preview-thumb">
          <div className="thumb-header">
            {site.business.logo}
            <span>About　Services　Contact</span>
          </div>
          <div className="thumb-body">
            <small>{hero?.props.eyebrow}</small>
            <b>{hero?.props.headline}</b>
            <i />
          </div>
        </div>
        <div className="site-info">
          <div className="site-info-title">
            <div>
              <h3>{site.business.name}</h3>
              <p>{site.customDomain || "no custom domain yet"}</p>
            </div>
            <span className="status-pill">
              <i /> {site.status === "published" ? "Published" : "Draft"}
            </span>
          </div>
          <div className="site-meta">
            <span>Edited {site.lastSaved}</span>
            <span>Editorial Studio</span>
            <button onClick={onEdit}>
              Edit site <Icon name="arrow" size={15} />
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
        <button>
          View checklist <Icon name="arrow" size={15} />
        </button>
      </div>
    </div>
  );
}
