-- 0002_site_domains.sql
-- Maps custom hostnames to sites so the www worker can route by Host header.
-- Domains are only active for routing once `verified = 1`, which happens after
-- the owner proves control by publishing a TXT record matching
-- `verification_token`.

CREATE TABLE IF NOT EXISTS site_domains (
  domain TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_domains_site ON site_domains (site_id);
