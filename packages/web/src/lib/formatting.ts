import type { Site } from "../siteTypes.ts";

/** Human-friendly relative time (e.g. "3 min ago") for an ISO timestamp; `undefined` means "just now". */
export const formatTimeAgo = (iso: string | undefined): string => {
  if (!iso) return "just now";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
};

// The client surfaces HttpApi errors as tagged schema errors (Error subclasses
// whose `String()` renders the tag) and network failures as Errors, so an Error
// message with a readable fallback covers both.
/** Readable message for an unknown error (HttpApi tag, Error, or raw value). */
export const readableErrorMessage = (cause: unknown): string =>
  cause instanceof Error && cause.message ? cause.message : String(cause);

/** Human label for a site's publish/build state (used by pills and buttons). */
export const buildStatusLabel = (site: Pick<Site, "status" | "buildStatus">): string => {
  if (site.status !== "published") return "Draft";
  switch (site.buildStatus) {
    case "building":
      return "Building…";
    case "built":
      return "Live";
    case "failed":
      return "Build failed";
    default:
      return "Published";
  }
};
