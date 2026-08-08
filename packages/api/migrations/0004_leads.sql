-- 0004_leads.sql
-- Contact-form submissions attached to a site. Writes are public (visitor
-- form posts to /api/leads); reads/deletes are scoped to the site owner.

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_site ON leads (site_id);
