import "./Header.css";
import type { User } from "better-auth";
import type { Site, View } from "../siteTypes.ts";
import Avatar from "./Avatar.tsx";
import { buildStatusLabel } from "../lib/formatting.ts";
import { ArrowRightIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";

const HEADINGS = {
  editor: ["Edit your site", "Make updates, see them live."],
  templates: ["Templates", "A starting point for every kind of business."],
  leads: ["Leads", "Keep track of new opportunities."],
  access: ["Access", "Invite clients to edit and publish their site."],
  admin: ["Admin", "Manage the agencies on your platform."],
} satisfies Partial<Record<View, [string, string]>>;

const OVERVIEW_SUBTITLE = "Here’s what’s happening with your site.";

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
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greeting = (user.name ?? "there").trim().split(/\s+/)[0];
  const [title, subtitle] =
    active === "overview" ? [`Good ${period}, ${greeting}`, OVERVIEW_SUBTITLE] : HEADINGS[active];
  const inEditor = active === "editor";
  return (
    <header data-component="header">
      <div>
        <p data-slot="crumb">
          {inEditor ? `My site / ${site.business.name}` : "Workspace"}
          {online === false && <span data-slot="crumb-offline"> · offline demo</span>}
        </p>
        <h1>{title}</h1>
        <p data-slot="subtitle">{subtitle}</p>
      </div>
      <div data-slot="actions">
        {sites.length > 1 && (
          <select
            data-slot="site-switcher"
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
            View live site <ArrowRightIcon size={16} />
          </a>
        )}
        {inEditor && canPublish && (
          <button
            className="dark-button"
            data-slot="publish-button"
            onClick={onPublish}
            disabled={publishing || online === false}
          >
            <ArrowSquareOutIcon size={15} />
            {publishing ? "Publishing…" : `Publish · ${buildStatusLabel(site)}`}
          </button>
        )}
        <Avatar variant="user" name={user?.name} title={user?.email} />
      </div>
    </header>
  );
}
