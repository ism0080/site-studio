import type { Site } from "../types.ts";

// Dev-only live preview: the vite dev server renders the site document through
// the same renderer the publish pipeline uses.
export const PREVIEW_URL = "/__site-preview";

export const postPreview = (site: Site): Promise<void> =>
  fetch(PREVIEW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(site),
  }).then((res) => {
    if (!res.ok) throw new Error(`preview failed: ${res.status}`);
  });
