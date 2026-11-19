import * as Schema from "effect/Schema";

/** The account's plan: free forever, or Pro via the Stripe subscription. */
export const Plan = Schema.Literals(["free", "pro"]);
export type Plan = (typeof Plan)["Type"];

/** The persisted billing row for one account. */
export interface BillingRow {
  readonly userId: string;
  readonly plan: Plan;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
  readonly updatedAt: string;
}

/** The client-facing billing state: the plan and whether checkout/portal are wired. */
export const BillingStatus = Schema.Struct({
  plan: Plan,
  billingConfigured: Schema.Boolean,
});
export type BillingStatus = (typeof BillingStatus)["Type"];

/** Builds the client-facing status from a billing row. */
export const billingStatus = (row: BillingRow, billingConfigured: boolean): BillingStatus => ({
  plan: row.plan,
  billingConfigured,
});

/** The plan does not include this feature; upgrading to Pro unlocks it (402). */
export class UpgradeRequired extends Schema.TaggedErrorClass<UpgradeRequired>()(
  "UpgradeRequired",
  { feature: Schema.Literals(["sites", "templates", "analytics"]) },
  { httpApiStatus: 402 },
) {}

/** Stripe is not configured on this deployment; checkout and portal are unavailable (503). */
export class BillingNotConfigured extends Schema.TaggedErrorClass<BillingNotConfigured>()(
  "BillingNotConfigured",
  {},
  { httpApiStatus: 503 },
) {}

/** The account has no Stripe customer yet, so there is no portal to open (404). */
export class BillingCustomerNotFound extends Schema.TaggedErrorClass<BillingCustomerNotFound>()(
  "BillingCustomerNotFound",
  {},
  { httpApiStatus: 404 },
) {}

/** Stripe rejected or could not complete the request (502). */
export class StripeError extends Schema.TaggedErrorClass<StripeError>()(
  "StripeError",
  { message: Schema.String },
  { httpApiStatus: 502 },
) {}
