import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

/**
 * The auth environment. `AUTH_SECRET` has no default: a deployed worker must
 * never fall back to a forgeable development secret.
 */
export const AuthEnv = {
  authSecret: Config.redacted("AUTH_SECRET"),
  authBaseUrl: Config.string("AUTH_BASE_URL").pipe(Config.withDefault("http://localhost:8787")),
  trustedOrigins: Config.string("TRUSTED_ORIGINS").pipe(
    Config.withDefault("http://localhost:5173"),
  ),
  googleClientId: Config.string("GOOGLE_CLIENT_ID").pipe(Config.withDefault("")),
  googleClientSecret: Config.redacted("GOOGLE_CLIENT_SECRET").pipe(
    Config.withDefault(Redacted.make("")),
  ),
};

/**
 * Resolves the auth config at worker init. A missing `AUTH_SECRET` dies with a
 * message naming the variable and how to generate one.
 */
export const AuthConfig = Effect.all(AuthEnv).pipe(
  Effect.mapError(
    (error) =>
      new Error(
        `invalid auth config (AUTH_SECRET is required; generate one with \`openssl rand -hex 32\`): ${error.message}`,
      ),
  ),
);
