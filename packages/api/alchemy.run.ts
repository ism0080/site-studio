import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Command from "alchemy/Command"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { SitesBucket } from "./src/site/bucket.ts"
import { Database } from "./src/site/database.ts"
import ApiWorker from "./src/worker.ts"
import WwwWorker from "./src/www.ts"

const Providers = Layer.mergeAll(
  Cloudflare.providers(),
  Command.providers(),
)

export default Alchemy.Stack(
  "SiteStudioApi",
  {
    providers: Providers,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const database = yield* Database
    const bucket = yield* SitesBucket
    const api = yield* ApiWorker
    const www = yield* WwwWorker
    // Run the Vite frontend alongside the Workers during `alchemy dev`. The
    // dev server proxies /api to the api worker (port 8787) and reads
    // VITE_WWW_URL (default localhost:8788) for "view live site" links.
    const web = yield* Command.Dev("Web", {
      command: "bun run dev",
      cwd: new URL("../web/", import.meta.url).pathname,
    })
    return {
      apiUrl: api.url,
      wwwUrl: www.url,
      webUrl: web.url,
      database: database.databaseId,
      bucket: bucket.bucketName,
    }
  }),
)
