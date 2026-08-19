import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { siteQueries } from "../lib/apiQueries.ts";

export const Route = createFileRoute("/_auth/")({
  component: SitesIndex,
});

/** The workspace root shows the first site's overview, else an empty prompt. */
function SitesIndex() {
  const { data: sites = [] } = useQuery({ ...siteQueries.list(), enabled: true });

  if (sites.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/sites/$siteId" params={{ siteId: sites[0].id }} replace />;
}
