import type Stripe from "stripe";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Predicate from "effect/Predicate";
import type { RuntimeContext } from "alchemy";
import type { BillingRepositoryService } from "./BillingRepository.ts";

/** The narrow event surface the billing domain reacts to. */
export type StripeEvent =
  | {
      readonly kind: "checkout.completed";
      readonly userId: string | null;
      readonly stripeCustomerId: string;
      readonly stripeSubscriptionId: string | null;
    }
  | {
      readonly kind: "subscription.activated";
      readonly stripeCustomerId: string;
      readonly stripeSubscriptionId: string;
    }
  | {
      readonly kind: "subscription.inactive";
      readonly stripeCustomerId: string;
      readonly stripeSubscriptionId: string;
    }
  | { readonly kind: "ignored"; readonly type: string };

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(["active", "trialing"]);

const _idOf = (value: string | { id: string } | null): string | null =>
  value === null ? null : Predicate.isString(value) ? value : value.id;

const _subscriptionEvent = (
  event:
    | Stripe.CustomerSubscriptionCreatedEvent
    | Stripe.CustomerSubscriptionUpdatedEvent
    | Stripe.CustomerSubscriptionDeletedEvent,
): StripeEvent => {
  const subscription = event.data.object;
  const stripeCustomerId = _idOf(subscription.customer);
  if (stripeCustomerId === null) return { kind: "ignored", type: event.type };
  if (event.type === "customer.subscription.deleted" || !ACTIVE_STATUSES.has(subscription.status)) {
    return {
      kind: "subscription.inactive",
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
    };
  }
  return {
    kind: "subscription.activated",
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
  };
};

/** Narrows a verified Stripe event to the billing cases we act on. */
export const narrowStripeEvent = (event: Stripe.Event): StripeEvent =>
  Match.value(event).pipe(
    Match.when({ type: "checkout.session.completed" }, (matched): StripeEvent => {
      const session = matched.data.object;
      const stripeCustomerId = _idOf(session.customer);
      if (stripeCustomerId === null) return { kind: "ignored", type: matched.type };
      return {
        kind: "checkout.completed",
        userId: session.client_reference_id,
        stripeCustomerId,
        stripeSubscriptionId: _idOf(session.subscription),
      };
    }),
    Match.when({ type: "customer.subscription.created" }, _subscriptionEvent),
    Match.when({ type: "customer.subscription.updated" }, _subscriptionEvent),
    Match.when({ type: "customer.subscription.deleted" }, _subscriptionEvent),
    Match.orElse((matched): StripeEvent => ({ kind: "ignored", type: matched.type })),
  );

/** Applies a narrowed Stripe event to the account's billing row. */
export const handleStripeEvent = (
  event: StripeEvent,
  repo: BillingRepositoryService,
  now: string,
): Effect.Effect<void, never, RuntimeContext> =>
  Effect.gen(function* () {
    if (event.kind === "ignored") {
      yield* Effect.logInfo(`Ignoring Stripe event: ${event.type}`);
      return;
    }

    const userId =
      event.kind === "checkout.completed" && event.userId !== null
        ? event.userId
        : ((yield* repo.forCustomer(event.stripeCustomerId))?.userId ?? null);
    if (userId === null) {
      yield* Effect.logWarning(`No billing account for Stripe customer ${event.stripeCustomerId}`);
      return;
    }

    yield* Match.value(event).pipe(
      Match.when({ kind: "checkout.completed" }, (matched) => {
        if (matched.stripeSubscriptionId === null) {
          return Effect.logWarning("Checkout completed without a subscription");
        }
        return repo.activatePro(userId, {
          stripeCustomerId: matched.stripeCustomerId,
          stripeSubscriptionId: matched.stripeSubscriptionId,
          now,
        });
      }),
      Match.when({ kind: "subscription.activated" }, (matched) =>
        repo.activatePro(userId, {
          stripeCustomerId: matched.stripeCustomerId,
          stripeSubscriptionId: matched.stripeSubscriptionId,
          now,
        }),
      ),
      Match.when({ kind: "subscription.inactive" }, () => repo.revokePro(userId, now)),
      Match.exhaustive,
    );
  });
