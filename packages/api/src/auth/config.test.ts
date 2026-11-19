import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { AuthConfig } from "./config.ts";

const _resolve = (env: string) =>
  AuthConfig.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromDotEnvContents(env))));

describe("AuthConfig", () => {
  it("requires AUTH_SECRET at init", async () => {
    const error = await Effect.runPromise(
      _resolve("AUTH_BASE_URL=http://localhost:8787").pipe(Effect.flip),
    );

    expect(error.message).toContain("AUTH_SECRET");
    expect(error.message).toContain("openssl rand -hex 32");
  });

  it("resolves when AUTH_SECRET is present", async () => {
    const config = await Effect.runPromise(
      _resolve(
        [
          "AUTH_SECRET=0123456789abcdef0123456789abcdef",
          "TRUSTED_ORIGINS=http://localhost:5173,https://site-studio.dev",
        ].join("\n"),
      ),
    );

    expect(config.trustedOrigins).toBe("http://localhost:5173,https://site-studio.dev");
  });
});
