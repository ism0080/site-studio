-- 0007_cloudflare_custom_hostnames.sql
-- Tracks the Cloudflare for SaaS custom hostname provisioned for a site domain.

ALTER TABLE site_domains ADD COLUMN provider_id TEXT;
