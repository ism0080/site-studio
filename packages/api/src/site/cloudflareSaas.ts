import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { FetchHttpClient } from "effect/unstable/http";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { CloudflareSaasError } from "./site.ts";

const Verification = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  value: Schema.String,
});

const ValidationRecord = Schema.Struct({
  txt_name: Schema.optional(Schema.String),
  txt_value: Schema.optional(Schema.String),
});

const CustomHostnameResult = Schema.Struct({
  id: Schema.String,
  hostname: Schema.String,
  status: Schema.String,
  ownership_verification: Schema.optional(Verification),
  ssl: Schema.optional(
    Schema.Struct({
      status: Schema.String,
      validation_records: Schema.optional(Schema.Array(ValidationRecord)),
    }),
  ),
});

const CloudflareResponse = Schema.Struct({
  success: Schema.Boolean,
  errors: Schema.Array(Schema.Unknown),
  result: Schema.NullOr(CustomHostnameResult),
});

export type CloudflareHostname = typeof CustomHostnameResult.Type;

export interface CloudflareSaas {
  readonly create: (hostname: string) => Promise<CloudflareHostname>;
  readonly get: (id: string) => Promise<CloudflareHostname>;
  readonly remove: (id: string) => Promise<void>;
}

export const makeCloudflareSaas = (config: {
  readonly zoneId: string;
  readonly apiToken: string;
}): CloudflareSaas => {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames`;

  const withAuth = HttpClientRequest.setHeaders({
    authorization: `Bearer ${config.apiToken}`,
    "content-type": "application/json",
  });

  const execute = (request: HttpClientRequest.HttpClientRequest) =>
    Effect.gen(function* () {
      const response = yield* HttpClient.execute(request);
      const parsed = yield* HttpClientResponse.schemaJson(
        Schema.Struct({ body: CloudflareResponse }),
      )(response);
      if (!parsed.body.success || parsed.body.result === null) {
        return yield* new CloudflareSaasError({
          message: `Cloudflare custom hostname request failed (${response.status})`,
        });
      }
      return parsed.body.result;
    }).pipe(Effect.provide(FetchHttpClient.layer), Effect.runPromise);

  const remove = (request: HttpClientRequest.HttpClientRequest) =>
    Effect.gen(function* () {
      const response = yield* HttpClient.execute(request);
      if (response.status < 200 || response.status >= 300) {
        return yield* new CloudflareSaasError({
          message: `Cloudflare custom hostname removal failed (${response.status})`,
        });
      }
    }).pipe(Effect.provide(FetchHttpClient.layer), Effect.runPromise);

  return {
    create: (hostname) =>
      execute(
        HttpClientRequest.post(endpoint).pipe(
          withAuth,
          HttpClientRequest.bodyJsonUnsafe({ hostname, ssl: { method: "txt", type: "dv" } }),
        ),
      ),
    get: (id) =>
      execute(HttpClientRequest.get(`${endpoint}/${encodeURIComponent(id)}`).pipe(withAuth)),
    remove: (id) =>
      remove(
        HttpClientRequest.delete(`${endpoint}/${encodeURIComponent(id)}`).pipe(
          HttpClientRequest.setHeaders({ authorization: `Bearer ${config.apiToken}` }),
        ),
      ),
  };
};

export class CloudflareSaasService extends Context.Service<CloudflareSaasService, CloudflareSaas>()(
  "@app/CloudflareSaas",
) {}

export const CloudflareSaasLayer = (config: {
  readonly zoneId: string;
  readonly apiToken: string;
}) =>
  Layer.effect(
    CloudflareSaasService,
    Effect.sync(() => makeCloudflareSaas(config)),
  );
