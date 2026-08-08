import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"
import { SitesBucket } from "./src/site/bucket.ts"
import { Database } from "./src/site/database.ts"
import ApiWorker from "./src/worker.ts"
import WwwWorker from "./src/www.ts"

export default Alchemy.Stack(
  "SiteStudioApi",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const database = yield* Database
    const bucket = yield* SitesBucket
    const api = yield* ApiWorker
    const www = yield* WwwWorker
    return {
      apiUrl: api.url,
      wwwUrl: www.url,
      database: database.databaseId,
      bucket: bucket.bucketName,
    }
  }),
)
