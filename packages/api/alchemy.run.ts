import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Command from "alchemy/Command";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import { SitesBucket } from "./src/site/bucket.ts";
import { Database } from "./src/site/database.ts";
import { BuildQueue } from "./src/publish/BuildQueue.ts";
import ApiWorker from "./src/worker.ts";
import WwwWorker from "./src/www.ts";
import BuildWorker from "./src/buildWorker.ts";

const Providers = Cloudflare.providers();

export default Alchemy.Stack(
  "SiteStudioApi",
  {
    providers: Providers,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const database = yield* Database;
    const bucket = yield* SitesBucket;
    const buildQueue = yield* BuildQueue;
    const api = yield* ApiWorker;
    const www = yield* WwwWorker;
    const build = yield* BuildWorker;
    const web = yield* Command.Dev("Web", {
      command: "node node_modules/vite/bin/vite.js",
      cwd: "../web",
      env: Output.map(www.url, (url) => ({ VITE_WWW_URL: url ?? "" })),
    });
    return {
      apiUrl: api.url,
      wwwUrl: www.url,
      webUrl: web.url,
      buildQueue: buildQueue.queueName,
      buildWorker: build.workerName,
      database: database.databaseId,
      bucket: bucket.bucketName,
    };
  }),
);
