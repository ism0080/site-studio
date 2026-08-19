import { createFileRoute } from "@tanstack/react-router";

import { useWorkspace } from "../lib/workspaceContext.ts";
import Leads from "../components/Leads.tsx";

export const Route = createFileRoute("/_auth/sites/$siteId/leads")({
  component: LeadsView,
});

function LeadsView() {
  const { site } = useWorkspace();
  return <Leads site={site} online />;
}
