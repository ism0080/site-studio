import {
  createFileRoute,
  Link,
  Outlet,
  useMatch,
  useMatches,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { User } from "better-auth";

import { useWorkspace } from "../lib/workspaceContext.ts";
import { siteQueries } from "../lib/apiQueries.ts";
import Header from "../components/Header.tsx";
import Brand from "../components/Brand.tsx";
import Avatar from "../components/Avatar.tsx";
import { liveUrlFor } from "../lib/siteApi.ts";
import type { View } from "../siteTypes.ts";
import {
  GaugeIcon,
  PenIcon,
  StackSimpleIcon,
  UsersIcon,
  ShareIcon,
  ShieldIcon,
  SignOutIcon,
  type Icon,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const workspace = useWorkspace();
  const matches = useMatches();
  const navigate = useNavigate();
  const { user, canPublish, canLeads, canManageMembers, isAdmin, signOut, publish } = workspace;

  // The site id lives on the /sites/$siteId child routes; read it from the
  // active match (absent on the index route that redirects to the first site).
  const siteMatch = useMatch({ from: "/_auth/sites/$siteId", shouldThrow: false });
  const siteId = siteMatch?.params.siteId;

  const last = matches[matches.length - 1];
  const segment = last?.routeId?.split("/").pop() ?? "";
  const view: View =
    segment === "editor"
      ? "editor"
      : segment === "templates"
        ? "templates"
        : segment === "leads"
          ? "leads"
          : segment === "access"
            ? "access"
            : segment === "admin"
              ? "admin"
              : "overview";

  const { data: sites = [] } = useQuery({ ...siteQueries.list(), enabled: true });

  // The index route redirects to the first site, so a site link only exists
  // once a siteId is present in the URL.
  if (!siteId) {
    return (
      <div data-component="app">
        <main data-slot="main-content">
          <Outlet />
        </main>
      </div>
    );
  }

  type NavItem = { to: string; params?: { siteId: string }; label: string; Icon: Icon; exact: boolean };
  const items: NavItem[] = [
    { to: "/sites/$siteId", params: { siteId }, label: "Overview", Icon: GaugeIcon, exact: true },
    { to: "/sites/$siteId/editor", params: { siteId }, label: "Site editor", Icon: PenIcon, exact: true },
    { to: "/sites/$siteId/templates", params: { siteId }, label: "Templates", Icon: StackSimpleIcon, exact: false },
  ];
  if (canLeads)
    items.push({ to: "/sites/$siteId/leads", params: { siteId }, label: "Leads", Icon: UsersIcon, exact: false });
  if (canManageMembers)
    items.push({ to: "/sites/$siteId/access", params: { siteId }, label: "Access", Icon: ShareIcon, exact: false });
  if (isAdmin)
    items.push({ to: "/sites/$siteId/admin", params: { siteId }, label: "Admin", Icon: ShieldIcon, exact: false });

  return (
    <div data-component="workspace">
      <Sidebar items={items} user={user} onSignOut={signOut} />
      <main data-slot="main-content">
        <Header
          active={view}
          site={workspace.site}
          online
          publishing={workspace.publishing}
          sites={sites}
          user={user!}
          liveUrl={liveUrlFor(workspace.site)}
          canPublish={canPublish}
          onPublish={publish}
          onSelectSite={(id) => {
            navigate({ to: "/sites/$siteId/editor", params: { siteId: id } });
          }}
        />
        <Outlet />
      </main>
    </div>
  );
}

function Sidebar({
  items,
  user,
  onSignOut,
}: {
  items: Array<{ to: string; params?: { siteId: string }; label: string; Icon: Icon; exact: boolean }>;
  user: User | null;
  onSignOut: () => void;
}) {
  return (
    <aside data-component="sidebar">
      <Brand />
      <div data-slot="workspace-label">Workspace</div>
      <nav>
        {items.map(({ to, params, label, Icon, exact }) => (
          <Link
            key={to}
            to={to}
            params={params}
            data-slot="nav-item"
            activeOptions={{ exact }}
            activeProps={{ "data-active": "true" }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div data-slot="sidebar-bottom">
        <div data-slot="profile">
          <Avatar name={user?.name} />
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <SignOutIcon onClick={onSignOut} size={18} />
        </div>
      </div>
    </aside>
  );
}
