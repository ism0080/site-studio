import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import type { Lead } from "./leads.ts";

export class LeadNotifierError extends Data.TaggedError("LeadNotifierError")<{
  message: string;
  cause?: unknown;
}> {}

export interface NotifyTarget {
  readonly name: string;
  readonly email: string;
}

/**
 * Sends a notification when a site gets a new lead. Cloudflare's send_email
 * binding only reaches verified destination addresses, so the default layer
 * sends to a platform inbox; a provider like Resend/Postmark can swap in.
 */
export interface LeadNotifierShape {
  readonly notify: (
    lead: Lead,
    site: NotifyTarget,
  ) => Effect.Effect<void, LeadNotifierError, RuntimeContext>;
}

export class LeadNotifier extends Context.Service<LeadNotifier, LeadNotifierShape>()(
  "LeadNotifier",
) {}

export const makeNoopNotifier = (): LeadNotifierShape => ({
  notify: () => Effect.void,
});

/**
 * Sends via Cloudflare's `send_email` binding. Requires Email Routing on the
 * zone + a verified destination (LEADS_NOTIFY_EMAIL) and sender
 * (LEADS_FROM_EMAIL).
 */
export const makeCloudflareNotifier = () =>
  Effect.gen(function* () {
    const notifyEmail = yield* Config.string("LEADS_NOTIFY_EMAIL");
    const fromEmail = yield* Config.string("LEADS_FROM_EMAIL");
    const sender = yield* Cloudflare.Email.SendEmail("LeadsNotify", {
      allowedDestinationAddresses: [notifyEmail],
      allowedSenderAddresses: [fromEmail],
    });
    const mail = yield* Cloudflare.Email.Send(sender);

    return {
      notify: (lead, site) =>
        mail
          .send({
            from: fromEmail,
            to: notifyEmail,
            subject: `New lead on ${site.name}`,
            text:
              `New contact form submission:\n\n` +
              `Name: ${lead.name}\n` +
              `Email: ${lead.email}\n` +
              `Message: ${lead.message ?? "(none)"}\n\n` +
              `Site: ${site.name} (${site.email})`,
          })
          .pipe(
            Effect.as(undefined),
            Effect.mapError(
              (cause) =>
                new LeadNotifierError({
                  message: cause instanceof Error ? cause.message : String(cause),
                  cause,
                }),
            ),
          ),
    } satisfies LeadNotifierShape;
  });

export const NoopLeadNotifier = Layer.effect(LeadNotifier, Effect.succeed(makeNoopNotifier()));

export const CloudflareLeadNotifier = Layer.effect(LeadNotifier, makeCloudflareNotifier());
