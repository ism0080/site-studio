-- 0006_user_roles.sql
-- Global account roles (admin/agency/client) and pending admin -> agency
-- invites. Admins are granted by the ADMIN_EMAILS env var and never need a
-- row here; agencies are promoted from role_invites on sign-in.

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agency', 'client')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_invites (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
