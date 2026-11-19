import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { guardMutation, MutationRateLimiter } from "./rateLimit.ts";

const _limiter = (keys: string[], allowed: boolean) => ({
  limit: (key: string) =>
    Effect.sync(() => {
      keys.push(key);
      return allowed;
    }),
});

describe("guardMutation", () => {
  it("keys the limit by user id and allows the mutation", async () => {
    const keys: string[] = [];
    await Effect.runPromise(
      guardMutation("user-1").pipe(
        Effect.provideService(MutationRateLimiter, _limiter(keys, true)),
      ),
    );

    expect(keys).toEqual(["user-1"]);
  });

  it("returns TooManyRequests when the account is over budget", async () => {
    const keys: string[] = [];
    await expect(
      Effect.runPromise(
        guardMutation("user-1").pipe(
          Effect.provideService(MutationRateLimiter, _limiter(keys, false)),
        ),
      ),
    ).rejects.toMatchObject({ _tag: "TooManyRequests" });

    expect(keys).toEqual(["user-1"]);
  });
});
