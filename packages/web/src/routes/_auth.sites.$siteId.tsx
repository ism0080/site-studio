import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { Site } from "../siteTypes.ts";
import { siteApi } from "../lib/siteApi.ts";
import { notifySiteLoaded } from "../lib/routerBridge.ts";

export const Route = createFileRoute("/_auth/sites/$siteId")({
  loader: ({ params: { siteId } }): Promise<Site> => siteApi.getSite(siteId),
  // Runs on every navigation to this route, including a $siteId change, so the
  // machine's editable working copy follows the URL without React effects.
  beforeLoad: ({ params: { siteId } }) => {
    notifySiteLoaded(siteId);
  },
  component: SiteLayout,
});

function SiteLayout() {
  return <Outlet />;
}
