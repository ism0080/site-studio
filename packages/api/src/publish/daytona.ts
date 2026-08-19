import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import type { Site } from "../site/site.ts";
import { encodeSiteDocument } from "../site/site.ts";
import { BuildError, type BuildResult } from "./BuildRunner.ts";

/**
 * workerd-safe Daytona build runner. The @daytona/sdk is Node-only (axios,
 * socket.io, node fs), so this speaks to the Daytona REST API with native
 * fetch + FormData. Endpoint and payload shapes are lifted from the SDK's
 * generated clients (@daytona/api-client, @daytona/toolbox-api-client):
 *   - POST /sandbox                               create sandbox (Bearer)
 *   - GET  /sandbox/{id}/toolbox-proxy-url
 *   - POST {toolboxProxyUrl}/{id}/files/bulk-upload  (multipart)
 *   - POST {toolboxProxyUrl}/{id}/process/execute
 *   - DELETE /sandbox/{id}
 * The sandbox runs the site-template `publish.mjs --upload`, which renders the
 * site document to static HTML and uploads the output to R2.
 */

const EnvVars = Schema.Record(Schema.String, Schema.String);

const CreateSandboxRequest = Schema.Struct({
  env: EnvVars,
  labels: EnvVars,
  cpu: Schema.optional(Schema.Number),
  memory: Schema.optional(Schema.Number),
  autoDeleteInterval: Schema.Number,
  snapshot: Schema.optional(Schema.String),
  buildInfo: Schema.optional(Schema.Struct({ dockerfileContent: Schema.String })),
  language: Schema.String,
});

const SandboxResponse = Schema.Struct({
  id: Schema.String,
  toolboxProxyUrl: Schema.optional(Schema.String),
});

const ToolboxProxyUrlResponse = Schema.Struct({ url: Schema.String });

const ExecuteRequest = Schema.Struct({
  command: Schema.String,
  cwd: Schema.String,
  envs: EnvVars,
  timeout: Schema.Number,
});

const ExecuteResponse = Schema.Struct({
  exitCode: Schema.optional(Schema.Number),
  stdout: Schema.optional(Schema.String),
});

const CreateSandboxBody = Schema.fromJsonString(CreateSandboxRequest);
const ExecuteRequestBody = Schema.fromJsonString(ExecuteRequest);

export interface DaytonaEnv {
  readonly apiKey: Redacted.Redacted<string>;
  readonly apiUrl: string;
  readonly snapshot: Option.Option<string>;
  readonly image: Option.Option<string>;
  readonly repoDir: string;
  readonly cpu: number;
  readonly memory: number;
  readonly r2Endpoint: string;
  readonly r2Bucket: string;
  readonly r2AccessKeyId: string;
  readonly r2SecretAccessKey: Redacted.Redacted<string>;
  readonly publicApiUrl: Option.Option<string>;
}

const config = Effect.all({
  apiKey: Config.redacted("DAYTONA_API_KEY"),
  apiUrl: Config.string("DAYTONA_API_URL").pipe(Config.withDefault("https://app.daytona.io/api")),
  snapshot: Config.option(Config.string("DAYTONA_SNAPSHOT")),
  image: Config.option(Config.string("DAYTONA_IMAGE")),
  repoDir: Config.string("DAYTONA_REPO_DIR").pipe(
    Config.withDefault("/home/daytona/site-template"),
  ),
  cpu: Config.number("DAYTONA_CPU").pipe(Config.withDefault(2)),
  memory: Config.number("DAYTONA_MEMORY").pipe(Config.withDefault(2)),
  r2Endpoint: Config.string("R2_ENDPOINT").pipe(Config.withDefault("")),
  r2Bucket: Config.string("R2_BUCKET").pipe(Config.withDefault("")),
  r2AccessKeyId: Config.string("R2_ACCESS_KEY_ID").pipe(Config.withDefault("")),
  r2SecretAccessKey: Config.redacted("R2_SECRET_ACCESS_KEY").pipe(
    Config.withDefault(Redacted.make("")),
  ),
  publicApiUrl: Config.option(Config.string("PUBLIC_API_URL")),
});

const _error = (message: string, cause: unknown) => new BuildError({ message, cause });

export const makeClient = (env: DaytonaEnv, fetcher: typeof fetch) => {
  const auth = { Authorization: `Bearer ${Redacted.value(env.apiKey)}` };

  const buildEnvVars = () => ({
    R2_ENDPOINT: env.r2Endpoint,
    R2_BUCKET: env.r2Bucket,
    R2_ACCESS_KEY_ID: env.r2AccessKeyId,
    R2_SECRET_ACCESS_KEY: Redacted.value(env.r2SecretAccessKey),
    PUBLIC_API_URL: Option.isSome(env.publicApiUrl) ? env.publicApiUrl.value : "",
  });

  const createSandbox = async (site: Site): Promise<{ id: string; toolboxUrl: string }> => {
    const body = Schema.encodeSync(CreateSandboxBody)({
      env: buildEnvVars(),
      labels: { app: "site-studio", site: site.id },
      cpu: Option.isSome(env.image) ? env.cpu : undefined,
      memory: Option.isSome(env.image) ? env.memory : undefined,
      autoDeleteInterval: 30,
      snapshot: Option.isSome(env.snapshot) ? env.snapshot.value : undefined,
      buildInfo: Option.isSome(env.image)
        ? { dockerfileContent: `FROM ${env.image.value}\n` }
        : undefined,
      language: "typescript",
    });

    const response = await fetcher(`${env.apiUrl}/sandbox`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      throw _error(
        `daytona: create sandbox failed (${response.status}) ${await response.text()}`,
        undefined,
      );
    }

    const sandbox = Schema.decodeUnknownSync(SandboxResponse)(await response.json());
    const toolboxProxyUrl = sandbox.toolboxProxyUrl ?? (await fetchToolboxProxyUrl(sandbox.id));
    return {
      id: sandbox.id,
      toolboxUrl: `${toolboxProxyUrl.replace(/\/+$/, "")}/${sandbox.id}`,
    };
  };

  const fetchToolboxProxyUrl = async (id: string): Promise<string> => {
    const response = await fetcher(
      `${env.apiUrl}/sandbox/${encodeURIComponent(id)}/toolbox-proxy-url`,
      { headers: auth },
    );
    if (!response.ok) {
      throw _error(
        `daytona: toolbox proxy url failed (${response.status}) ${await response.text()}`,
        undefined,
      );
    }
    return Schema.decodeUnknownSync(ToolboxProxyUrlResponse)(await response.json()).url;
  };

  const uploadSiteDocument = async (toolboxUrl: string, site: Site) => {
    const form = new FormData();
    form.append("files[0].path", `${env.repoDir}/site.json`);
    form.append(
      "files[0].file",
      new Blob([encodeSiteDocument(site)], { type: "application/json" }),
      "site.json",
    );
    const response = await fetcher(`${toolboxUrl}/files/bulk-upload`, {
      method: "POST",
      headers: auth,
      body: form,
    });
    if (!response.ok) {
      throw _error(
        `daytona: upload site document failed (${response.status}) ${await response.text()}`,
        undefined,
      );
    }
  };

  const executeBuild = async (
    toolboxUrl: string,
  ): Promise<{ exitCode: number; output: string }> => {
    const response = await fetcher(`${toolboxUrl}/process/execute`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: Schema.encodeSync(ExecuteRequestBody)({
        command: "bun run publish site.json --upload",
        cwd: env.repoDir,
        envs: buildEnvVars(),
        timeout: 600,
      }),
    });
    if (!response.ok) {
      throw _error(
        `daytona: build command failed (${response.status}) ${await response.text()}`,
        undefined,
      );
    }
    const executed = Schema.decodeUnknownSync(ExecuteResponse)(await response.json());
    return {
      exitCode: executed.exitCode ?? -1,
      output: executed.stdout ?? "",
    };
  };

  const deleteSandbox = async (id: string) => {
    const response = await fetcher(`${env.apiUrl}/sandbox/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: auth,
    });
    if (!response.ok) {
      throw _error(
        `daytona: delete sandbox failed (${response.status}) ${await response.text()}`,
        undefined,
      );
    }
  };

  return {
    publish: (site: Site) =>
      Effect.tryPromise({
        try: async (): Promise<BuildResult> => {
          const sandbox = await createSandbox(site);
          return buildAndUpload(sandbox, site).finally(() => {
            void deleteSandbox(sandbox.id);
          });
        },
        catch: (cause) =>
          new BuildError({
            message: cause instanceof Error ? cause.message : String(cause),
            cause,
          }),
      }),
  };

  async function buildAndUpload(
    sandbox: { id: string; toolboxUrl: string },
    site: Site,
  ): Promise<BuildResult> {
    await uploadSiteDocument(sandbox.toolboxUrl, site);
    const executed = await executeBuild(sandbox.toolboxUrl);
    return {
      buildId: sandbox.id,
      exitCode: executed.exitCode,
      output: executed.output,
    };
  }
};

export const makeDaytonaBuildRunner = (deps: { fetch?: typeof fetch } = {}) =>
  Effect.gen(function* () {
    const env = yield* config;
    const fetcher = deps.fetch ?? globalThis.fetch;
    return makeClient(env, fetcher);
  });
