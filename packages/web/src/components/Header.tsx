import type { User } from "better-auth";
import type { Site, View } from "../types.ts";
import Icon from "./Icon.tsx";
import { buildStatusLabel } from "../lib/api.ts";

const HEADINGS = {
  overview: ["Good morning, Jordan", "Here’s what’s happening with your sites."],
  editor: ["Edit your site", "Make updates, see them live."],
  templates: ["Templates", "A starting point for every kind of business."],
  leads: ["Leads", "Keep track of new opportunities."],
  access: ["Access", "Invite clients to edit and publish their site."],
  admin: ["Admin", "Manage the agencies on your platform."],
} satisfies Record<View, [string, string]>;

export default function Header({
  active,
  site,
  online,
  publishing,
  sites,
  user,
  liveUrl,
  canPublish,
  onPublish,
  onSelectSite,
}: {
  active: View;
  site: Site;
  online: boolean | null;
  publishing: boolean;
  sites: readonly Site[];
  user: User;
  liveUrl: string | null;
  canPublish: boolean;
  onPublish: () => void;
  onSelectSite: (id: string) => void;
}) {
  const [title, subtitle] = HEADINGS[active] || HEADINGS.overview;
  const inEditor = active === "editor";
  return (
    <header className="top-header">
      <div>
        <p className="crumb">
          {inEditor ? `My sites / ${site.business.name}` : "Workspace"}
          {online === false && <span className="crumb-offline"> · offline demo</span>}
        </p>
        <h1>{title}</h1>
        <p className="header-subtitle">{subtitle}</p>
      </div>
      <div className="header-actions">
        {sites.length > 1 && (
          <select
            className="site-switcher"
            value={site.id}
            onChange={(e) => onSelectSite(e.target.value)}
            aria-label="Switch site"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.business.name}
              </option>
            ))}
          </select>
        )}
        {liveUrl && (
          <a className="preview-link" href={liveUrl} target="_blank" rel="noreferrer">
            View live site <Icon name="arrow" size={16} />
          </a>
        )}
        {inEditor && canPublish && (
          <button
            className="dark-button publish-button"
            onClick={onPublish}
            disabled={publishing || online === false}
          >
            <Icon name="external" size={15} />
            {publishing ? "Publishing…" : `Publish · ${buildStatusLabel(site)}`}
          </button>
        )}
        <button className="user-avatar" title={user?.email}>
          {(user?.name ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("")}
        </button>
      </div>
    </header>
  );
}
