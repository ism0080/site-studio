import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import Stripe from "stripe";
import { BillingNotConfigured, StripeError } from "./billing.ts";
import { narrowStripeEvent, type StripeEvent } from "./WebhookEvents.ts";

const API_VERSION: Stripe.LatestApiVersion = "2026-11-18.endive";

// Alchemy uploads only declared env entries, so the worker's `env:` block and
// this layer read the same Config declarations.
export const BillingEnv = {
  apiKey: Config.redacted("STRIPE_API_KEY").pipe(Config.withDefault(Redacted.make(""))),
  priceId: Config.string("STRIPE_PRICE_ID").pipe(Config.withDefault("")),
  webhookSecret: Config.redacted("STRIPE_WEBHOOK_SECRET").pipe(
    Config.withDefault(Redacted.make("")),
  ),
};

export interface CheckoutInput {
  readonly successUrl: string;
  readonly customerEmail: string;
  readonly customerId: string | null;
  readonly userId: string;
}

export interface CheckoutSession {
  readonly url: string;
  readonly stripeCustomerId: string;
}

export interface PortalInput {
  readonly customerId: string;
  readonly returnUrl: string;
}

export interface PortalSession {
  readonly url: string;
}

export interface StripeBillingService {
  /** False when no Stripe API key is configured (Free-only mode). */
  readonly configured: boolean;
  readonly createCheckoutSession: (
    input: CheckoutInput,
  ) => Effect.Effect<CheckoutSession, BillingNotConfigured | StripeError>;
  readonly createPortalSession: (
    input: PortalInput,
  ) => Effect.Effect<PortalSession, BillingNotConfigured | StripeError>;
  readonly verifyWebhook: (
    rawBody: string,
    signature: string,
  ) => Effect.Effect<StripeEvent, BillingNotConfigured | StripeError>;
}

const _call = <A>(call: () => Promise<A>): Effect.Effect<A, StripeError> =>
  Effect.tryPromise({
    try: call,
    catch: (cause) => {
      const error = new StripeError({
        message: cause instanceof Error ? cause.message : "Stripe request failed",
      });
      error.cause = cause;
      return error;
    },
  });

export const makeStripeBilling = (config: {
  readonly apiKey: string;
  readonly priceId: string;
  readonly webhookSecret: string;
}): StripeBillingService => {
  const client =
    config.apiKey === ""
      ? null
      : new Stripe(config.apiKey, {
          httpClient: Stripe.createFetchHttpClient(),
          apiVersion: API_VERSION,
        });

  const requireClient = (): Effect.Effect<Stripe, BillingNotConfigured> =>
    client === null ? Effect.fail(new BillingNotConfigured({})) : Effect.succeed(client);

  return {
    configured: client !== null,
    createCheckoutSession: (input) =>
      Effect.gen(function* () {
        const stripe = yield* requireClient();
        if (config.priceId === "") return yield* new BillingNotConfigured({});

        const stripeCustomerId =
          input.customerId ??
          (yield* _call(() => stripe.customers.create({ email: input.customerEmail }))).id;
        const session = yield* _call(() =>
          stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: config.priceId, quantity: 1 }],
            success_url: input.successUrl,
            cancel_url: new URL("/billing", input.successUrl).toString(),
            customer: stripeCustomerId,
            client_reference_id: input.userId,
          }),
        );
        if (session.url === null) {
          return yield* new StripeError({ message: "Stripe did not return a checkout URL" });
        }
        return { url: session.url, stripeCustomerId };
      }),
    createPortalSession: (input) =>
      Effect.gen(function* () {
        const stripe = yield* requireClient();
        const session = yield* _call(() =>
          stripe.billingPortal.sessions.create({
            customer: input.customerId,
            return_url: input.returnUrl,
          }),
        );
        return { url: session.url };
      }),
    verifyWebhook: (rawBody, signature) =>
      Effect.gen(function* () {
        const stripe = yield* requireClient();
        if (config.webhookSecret === "") return yield* new BillingNotConfigured({});
        const event = yield* _call(() =>
          stripe.webhooks.constructEventAsync(rawBody, signature, config.webhookSecret),
        );
        return narrowStripeEvent(event);
      }),
  };
};

export class StripeBilling extends Context.Service<StripeBilling, StripeBillingService>()(
  "@app/StripeBilling",
) {}

export const StripeBillingLayer = Layer.effect(
  StripeBilling,
  Effect.gen(function* () {
    const env = yield* Effect.all(BillingEnv);
    return makeStripeBilling({
      apiKey: Redacted.value(env.apiKey),
      priceId: env.priceId,
      webhookSecret: Redacted.value(env.webhookSecret),
    });
  }),
);
