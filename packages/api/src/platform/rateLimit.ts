import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** The caller exceeded a rate limit (429). */
export class TooManyRequests extends Schema.TaggedErrorClass<TooManyRequests>()(
  "TooManyRequests",
  {},
  { httpApiStatus: 429 },
) {}

/**
 * Rate-limit boundary for authenticated mutations, keyed by user id. The
 * Cloudflare impl lives in the worker wiring (imperative shell); the guard
 * only sees a boolean.
 */
export class MutationRateLimiter extends Context.Service<
  MutationRateLimiter,
  { readonly limit: (key: string) => Effect.Effect<boolean> }
>()("@app/MutationRateLimiter") {}

/** Rejects the mutation when the account has exceeded its request budget. */
export const guardMutation = Effect.fn("api.guardMutation")(function* (userId: string) {
  const allowed = yield* (yield* MutationRateLimiter).limit(userId);
  if (!allowed) return yield* new TooManyRequests({});
});
