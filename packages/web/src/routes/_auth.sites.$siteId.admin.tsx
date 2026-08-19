import { createFileRoute } from "@tanstack/react-router";

import { useWorkspace } from "../lib/workspaceContext.ts";
import Admin from "../components/Admin.tsx";

export const Route = createFileRoute("/_auth/sites/$siteId/admin")({
  component: AdminView,
});

function AdminView() {
  const workspace = useWorkspace();
  return (
    <Admin
      online
      email={workspace.adminEmail}
      busy={workspace.adminBusy}
      error={workspace.adminError}
      onEmailInput={workspace.adminEmailInput}
      onInvite={workspace.adminInvite}
    />
  );
}
