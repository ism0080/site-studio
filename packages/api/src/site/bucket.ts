import * as Cloudflare from "alchemy/Cloudflare"

/**
 * Stores published site builds. This is the R2 home for rendered output
 * today; when Cloudflare Artifacts goes GA (it is still in closed beta),
 * this migrates to a versioned Git-compatible artifact store.
 */
export const SitesBucket = Cloudflare.R2.Bucket("Sites")
