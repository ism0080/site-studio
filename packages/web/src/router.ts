import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

export interface RouterContext {
  queryClient: import("@tanstack/react-query").QueryClient;
}

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    // SAFETY: main.tsx replaces this placeholder with the real QueryClient via
    // router.update({ context }) before the router is first rendered.
    queryClient: undefined as never,
  },
});

// Registers the router instance for type-safe navigation across the app.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
