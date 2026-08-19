import { createFileRoute } from "@tanstack/react-router";

import { useWorkspace } from "../lib/workspaceContext.ts";
import Overview from "../components/Overview.tsx";

export const Route = createFileRoute("/_auth/sites/$siteId/")({
  component: OverviewView,
});

function OverviewView() {
  const { site } = useWorkspace();
  return <Overview site={site} />;
}
