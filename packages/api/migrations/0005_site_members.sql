-- 0005_site_members.sql
-- Clients granted access to a site, plus pending email invites. `site_members`
-- only ever holds client memberships; the managing account is `sites.owner_id`.

CREATE TABLE IF NOT EXISTS site_members (
  site_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  can_edit INTEGER NOT NULL DEFAULT 0,
  can_publish INTEGER NOT NULL DEFAULT 0,
  can_leads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (site_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_site_members_user ON site_members (user_id);

-- Invites are consumed into `site_members` when the invited email signs in.
CREATE TABLE IF NOT EXISTS site_invites (
  site_id TEXT NOT NULL,
  email TEXT NOT NULL,
  can_edit INTEGER NOT NULL DEFAULT 0,
  can_publish INTEGER NOT NULL DEFAULT 0,
  can_leads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (site_id, email)
);
