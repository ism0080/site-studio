import { createAuthClient } from "better-auth/react";

// Same-origin in dev via the Vite /api proxy; point VITE_AUTH_URL at the API
// origin if it's deployed separately.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL ?? window.location.origin,
});
