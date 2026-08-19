import type { Site } from "@site-studio/api/contract";
import { renderPage } from "@site-studio/site-template";
import type { Plugin } from "vite";

// Dev-only live preview. The editor's app machine posts the current site
// document here (debounced) and the preview iframe GETs the real template
// render back, so the editor preview is byte-for-byte what the publish
// pipeline renders.
export function sitePreview(): Plugin {
  let current: Site | null = null;
  return {
    name: "site-preview",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname !== "/__site-preview") return next();
        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              // SAFETY: The web app posts the decoded site document, which the
              // API client already validated against the Site schema.
              current = JSON.parse(body) as Site;
            } catch {
              res.statusCode = 400;
              res.end("bad site document");
              return;
            }
            res.statusCode = 204;
            res.end();
          });
          return;
        }
        if (req.method === "GET") {
          if (current === null) {
            res.statusCode = 404;
            res.end("no site document yet");
            return;
          }
          const page = current.pages.find((p) => p.slug === "/") ?? current.pages[0];
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(renderPage(current, page, { apiBase: "/api" }));
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}
