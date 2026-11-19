-- 0009_free_plan.sql
-- Freemium replaces the 14-day trial: every account starts on the free plan and
-- upgrades to Pro through Stripe. SQLite cannot alter a CHECK constraint, so the
-- table is rebuilt and the old trial rows are carried over as free rows.

CREATE TABLE user_billing_new (
  user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO user_billing_new (user_id, plan, stripe_customer_id, stripe_subscription_id, updated_at)
SELECT
  user_id,
  CASE plan WHEN 'pro' THEN 'pro' ELSE 'free' END,
  stripe_customer_id,
  stripe_subscription_id,
  updated_at
FROM user_billing;

DROP TABLE user_billing;

ALTER TABLE user_billing_new RENAME TO user_billing;
