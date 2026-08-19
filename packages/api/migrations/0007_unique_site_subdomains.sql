-- 0007_unique_site_subdomains.sql
-- Reserve onboarding subdomains in D1 so concurrent creates cannot claim one twice.

ALTER TABLE sites ADD COLUMN subdomain TEXT;

UPDATE sites
SET subdomain = json_extract(document, '$.subdomain')
WHERE subdomain IS NULL AND json_extract(document, '$.subdomain') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_subdomain_unique
  ON sites (subdomain)
  WHERE subdomain IS NOT NULL;
