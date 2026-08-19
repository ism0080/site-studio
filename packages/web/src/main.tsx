import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Set VITE_MOCK_API=true to run the web app against in-browser mocked API
// responses (src/mocks) instead of the real backend, so it runs offline.
void (async () => {
  if (import.meta.env.VITE_MOCK_API) {
    const { worker } = await import("./mocks/browser.ts");
    await worker.start({ onUnhandledRequest: "bypass" });
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
})();
