import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { useWorkspace } from "../lib/workspaceContext.ts";
import Templates from "../components/Templates.tsx";

const templatesSearch = z.object({
  category: z.string().catch("all"),
});

export const Route = createFileRoute("/_auth/sites/$siteId/templates")({
  validateSearch: templatesSearch,
  component: TemplatesView,
});

function TemplatesView() {
  const { category } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { selectTemplate } = useWorkspace();

  return (
    <Templates
      category={category}
      onCategoryChange={(next) => navigate({ search: { category: next } })}
      onSelect={selectTemplate}
    />
  );
}
