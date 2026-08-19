import { createFileRoute } from "@tanstack/react-router";

import { useWorkspace } from "../lib/workspaceContext.ts";
import Access from "../components/Access.tsx";

export const Route = createFileRoute("/_auth/sites/$siteId/access")({
  component: AccessView,
});

function AccessView() {
  const workspace = useWorkspace();
  return (
    <Access
      site={workspace.site}
      online
      email={workspace.accessEmail}
      toggles={workspace.accessToggles}
      busy={workspace.accessBusy}
      error={workspace.accessError}
      onEmailInput={workspace.accessEmailInput}
      onToggle={workspace.accessToggle}
      onInvite={workspace.accessInvite}
    />
  );
}
