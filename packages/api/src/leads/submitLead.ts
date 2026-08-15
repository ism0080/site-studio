import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { LeadRepository } from "./LeadRepository.ts";
import { LeadNotifier } from "./LeadNotifier.ts";
import { LeadInput, TooManyRequests } from "./leads.ts";

/**
 * Rate-limit boundary for public lead submissions. The Cloudflare impl lives
 * in the worker wiring (imperative shell); the use case only sees a boolean.
 */
export class LeadRateLimiter extends Context.Service<
  LeadRateLimiter,
  { readonly limit: (key: string) => Effect.Effect<boolean> }
>()("@app/LeadRateLimiter") {}

export const submitLead = Effect.fn("api.submitLead")(function* (payload: LeadInput, ip: string) {
  const allowed = yield* (yield* LeadRateLimiter).limit(ip);
  if (!allowed) return yield* new TooManyRequests({});

  const leads = yield* LeadRepository;
  const lead = yield* leads.create(payload);

  // Best-effort notification — a failed email must not fail the submission.
  const site = yield* leads.siteContact(lead.siteId);
  if (site) {
    const notifier = yield* LeadNotifier;
    yield* notifier
      .notify(lead, site)
      .pipe(Effect.catch((cause) => Effect.logError("lead notification failed", cause)));
  }

  return lead;
});
