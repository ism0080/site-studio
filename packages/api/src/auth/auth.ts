import * as Context from "effect/Context";
import { betterAuth } from "better-auth";

export interface AuthConfig {
  readonly secret: string;
  readonly baseURL: string;
  readonly trustedOrigins: string[];
  readonly googleClientId: string;
  readonly googleClientSecret: string;
}

export const createAuth = (d1: D1Database, config: AuthConfig) =>
  betterAuth({
    database: d1,
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: config.trustedOrigins,
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      },
    },
  });

export type Auth = ReturnType<typeof createAuth>;

export const AUTH_PATH = "/api/auth";

/**
 * The authenticated user resolved from the session. Provided per-request by
 * the worker's fetch handler (via `Effect.provideService`) so site handlers
 * scope all queries to the owner.
 */
export class CurrentUser extends Context.Service<
  CurrentUser,
  { readonly id: string; readonly email: string }
>()("@app/CurrentUser") {}
