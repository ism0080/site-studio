# Tasks

## Live-verify the Daytona build integration

The `build` worker runs site builds through a fetch-based Daytona REST client
(`packages/api/src/publish/daytona.ts`) written against the SDK's generated
API contracts, but it has never been exercised against a real Daytona account.
Validate it before trusting production publishes.

**Steps**

1. Configure a Daytona account and set the worker env vars:
   - `DAYTONA_API_KEY`
   - `DAYTONA_SNAPSHOT` (a sandbox snapshot containing the site-template repo
     with deps installed + bun), or `DAYTONA_IMAGE`
   - `DAYTONA_REPO_DIR` (default `/home/daytona/site-template`)
   - `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
   - `PUBLIC_API_URL`
2. Run one publish end-to-end (deployed or `alchemy dev`) and watch the
   consumer:
   - Sandbox creation succeeds (`POST /sandbox`).
   - `toolboxProxyUrl` is present in the create response (otherwise the
     `/sandbox/{id}/toolbox-proxy-url` fallback path must be exercised).
   - The multipart upload (`POST .../files/bulk-upload`) with `files[0].path` /
     `files[0].file` fields is accepted.
   - `POST .../process/execute` returns `exitCode`/`stdout` and the R2 upload
     inside the sandbox (`publish.mjs --upload`) lands the static HTML.
3. Confirm the site's `buildStatus` transitions `building -> built` with
   `lastBuiltAt`, and that a deliberately broken build (e.g. bad snapshot)
   records `failed` with `buildError` and retries per the queue `maxRetries`.
4. Note any drift between the generated API contracts and the real wire
   format, and fix `daytona.ts` accordingly.
