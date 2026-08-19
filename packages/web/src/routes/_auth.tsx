import {
  createFileRoute,
  Outlet,
  useMatch,
  useMatches,
  useNavigate,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "../lib/workspaceContext.ts";
import { siteQueries } from "../lib/apiQueries.ts";
import Header from "../components/Header.tsx";
import Sidebar from "../components/Sidebar.tsx";
import { liveUrlFor } from "../lib/siteApi.ts";
import type { View } from "../siteTypes.ts";
import "../App.css";

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

  return (
    <div data-component="app">
      <Sidebar
        siteId={siteId}
        user={user}
        onSignOut={signOut}
        canLeads={canLeads}
        canManageMembers={canManageMembers}
        isAdmin={isAdmin}
      />
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
