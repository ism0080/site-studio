import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { z } from "zod";

import { useWorkspace } from "../lib/workspaceContext.ts";
import Editor from "../components/Editor.tsx";

const editorSearch = z.object({
  device: z.enum(["desktop", "mobile"]).optional().catch("desktop"),
});

export const Route = createFileRoute("/_auth/sites/$siteId/editor")({
  validateSearch: editorSearch,
  component: EditorView,
});

function EditorView() {
  const { device = "desktop" } = Route.useSearch();
  const { siteId } = useParams({ from: "/_auth/sites/$siteId" });
  const navigate = useNavigate({ from: "/sites/$siteId/editor" });
  const workspace = useWorkspace();
  const { site, canEdit, isFull, domain, setup, domainError, domainBusy, previewRevision } =
    workspace;

  return (
    <Editor
      site={site}
      online
      saveState={workspace.saveState}
      device={device}
      previewRevision={previewRevision}
      readOnly={!canEdit}
      fullAccess={isFull}
      onDevice={(next) => {
        navigate({ to: "/sites/$siteId/editor", params: { siteId }, search: { device: next } });
      }}
      onUpdate={workspace.updateSite}
      domain={domain}
      setup={setup}
      domainError={domainError}
      domainBusy={domainBusy}
      onDomainInput={workspace.domainInput}
      onDomainConnect={workspace.domainConnect}
      onDomainVerify={workspace.domainVerify}
      onDomainRemove={workspace.domainRemove}
    />
  );
}
