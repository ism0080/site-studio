import * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { RuntimeContext } from "alchemy";
import { type BillingRow } from "./billing.ts";

type Db = Cloudflare.D1.QueryDatabaseClient;

interface BillingRowRecord {
  readonly user_id: string;
  readonly plan: string;
  readonly stripe_customer_id: string | null;
  readonly stripe_subscription_id: string | null;
  readonly updated_at: string;
}

export interface BillingRepositoryService {
  /** Creates the free row on first touch and returns the current state. */
  readonly ensure: (
    userId: string,
    now: string,
  ) => Effect.Effect<BillingRow, never, RuntimeContext>;
  readonly forUser: (userId: string) => Effect.Effect<BillingRow | null, never, RuntimeContext>;
  /** Resolves the account that owns a Stripe customer (used by webhooks). */
  readonly forCustomer: (
    stripeCustomerId: string,
  ) => Effect.Effect<BillingRow | null, never, RuntimeContext>;
  readonly setStripeCustomer: (
    userId: string,
    stripeCustomerId: string,
    now: string,
  ) => Effect.Effect<void, never, RuntimeContext>;
  readonly activatePro: (
    userId: string,
    input: {
      readonly stripeCustomerId: string;
      readonly stripeSubscriptionId: string;
      readonly now: string;
    },
  ) => Effect.Effect<void, never, RuntimeContext>;
  readonly revokePro: (userId: string, now: string) => Effect.Effect<void, never, RuntimeContext>;
}

const _row = (record: BillingRowRecord): BillingRow => ({
  userId: record.user_id,
  plan: record.plan === "pro" ? "pro" : "free",
  stripeCustomerId: record.stripe_customer_id,
  stripeSubscriptionId: record.stripe_subscription_id,
  updatedAt: record.updated_at,
});

const _columns = "user_id, plan, stripe_customer_id, stripe_subscription_id, updated_at";

export const makeBillingRepository = (db: Db): BillingRepositoryService => ({
  ensure: Effect.fn("BillingRepository.ensure")(function* (userId: string, now: string) {
    yield* db
      .prepare(`INSERT OR IGNORE INTO user_billing (${_columns}) VALUES (?, 'free', NULL, NULL, ?)`)
      .bind(userId, now)
      .run();
    const row = yield* db
      .prepare(`SELECT ${_columns} FROM user_billing WHERE user_id = ?`)
      .bind(userId)
      .first<BillingRowRecord>();
    if (row === null) return yield* Effect.die("billing row was not created");
    return _row(row);
  }),
  forUser: Effect.fn("BillingRepository.forUser")(function* (userId: string) {
    const row = yield* db
      .prepare(`SELECT ${_columns} FROM user_billing WHERE user_id = ?`)
      .bind(userId)
      .first<BillingRowRecord>();
    return row === null ? null : _row(row);
  }),
  forCustomer: Effect.fn("BillingRepository.forCustomer")(function* (stripeCustomerId: string) {
    const row = yield* db
      .prepare(`SELECT ${_columns} FROM user_billing WHERE stripe_customer_id = ?`)
      .bind(stripeCustomerId)
      .first<BillingRowRecord>();
    return row === null ? null : _row(row);
  }),
  setStripeCustomer: Effect.fn("BillingRepository.setStripeCustomer")(function* (
    userId: string,
    stripeCustomerId: string,
    now: string,
  ) {
    yield* db
      .prepare("UPDATE user_billing SET stripe_customer_id = ?, updated_at = ? WHERE user_id = ?")
      .bind(stripeCustomerId, now, userId)
      .run();
  }),
  activatePro: Effect.fn("BillingRepository.activatePro")(function* (
    userId: string,
    input: {
      readonly stripeCustomerId: string;
      readonly stripeSubscriptionId: string;
      readonly now: string;
    },
  ) {
    yield* db
      .prepare(
        `INSERT INTO user_billing (${_columns}) VALUES (?, 'pro', ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           plan = 'pro',
           stripe_customer_id = excluded.stripe_customer_id,
           stripe_subscription_id = excluded.stripe_subscription_id,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, input.stripeCustomerId, input.stripeSubscriptionId, input.now)
      .run();
  }),
  revokePro: Effect.fn("BillingRepository.revokePro")(function* (userId: string, now: string) {
    yield* db
      .prepare(
        "UPDATE user_billing SET plan = 'free', stripe_subscription_id = NULL, updated_at = ? WHERE user_id = ?",
      )
      .bind(now, userId)
      .run();
  }),
});

export class BillingRepository extends Context.Service<
  BillingRepository,
  BillingRepositoryService
>()("@app/BillingRepository") {}

export const BillingRepositoryLayer = (db: Db) =>
  Layer.effect(
    BillingRepository,
    Effect.sync(() => makeBillingRepository(db)),
  );
