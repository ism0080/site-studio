-- 0008_billing.sql
-- Per-account billing state: the trial clock, the active plan, and the Stripe
-- identifiers that drive checkout, the customer portal, and webhook updates.

CREATE TABLE IF NOT EXISTS user_billing (
  user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  trial_started_at TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('trial', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  updated_at TEXT NOT NULL
);
