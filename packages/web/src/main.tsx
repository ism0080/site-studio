import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { WorkspaceProvider } from "./lib/workspace.tsx";
import { router } from "./router.ts";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

router.update({ context: { queryClient } });

// Set VITE_MOCK_API=true to run the web app against in-browser mocked API
// responses (src/mocks) instead of the real backend, so it runs offline.
void (async () => {
  if (import.meta.env.VITE_MOCK_API) {
    const { mockWorker } = await import("./mocks/mockWorker.ts");
    await mockWorker.start({ onUnhandledRequest: "bypass" });
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider>
          <RouterProvider router={router} />
        </WorkspaceProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
})();
