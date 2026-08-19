import * as Schema from "effect/Schema";
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

  const request = async (
    input: RequestInfo | URL,
    init: RequestInit,
  ): Promise<CloudflareHostname> => {
    const response = await fetch(input, {
      ...init,
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    const parsed = await Schema.decodeUnknownPromise(CloudflareResponse)(await response.json());
    if (!response.ok || !parsed.success || parsed.result === null) {
      throw new CloudflareSaasError({
        message: `Cloudflare custom hostname request failed (${response.status})`,
      });
    }
    return parsed.result;
  };

  return {
    create: (hostname) =>
      request(endpoint, {
        method: "POST",
        body: JSON.stringify({ hostname, ssl: { method: "txt", type: "dv" } }),
      }),
    get: (id) => request(`${endpoint}/${encodeURIComponent(id)}`, { method: "GET" }),
    remove: async (id) => {
      const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${config.apiToken}` },
      });
      if (!response.ok) {
        throw new CloudflareSaasError({
          message: `Cloudflare custom hostname removal failed (${response.status})`,
        });
      }
    },
  };
};
