# Deploy runbook

Site Studio is three Cloudflare Workers (`api`, `www`, `build`) over D1, R2, Queues,
Rate Limiting, and Cloudflare for SaaS custom hostnames — all declared in
`packages/api/alchemy.run.ts`. Deploys run from the owner's machine; CI only checks.

## Prereqs

| Prereq                          | Detail                                                                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare account + zone       | The `WWW_DOMAIN` zone (e.g. `site-studio.dev`) must already exist in the account. Custom hostnames need Cloudflare for SaaS available on the zone.                                                       |
| Stripe                          | Account activated and the Pro monthly price created. Follow `tasks.md` → "Stripe production setup" (do not duplicate it here).                                                                           |
| Resend                          | Sending domain verified (DKIM + SPF). Follow `tasks.md` → "Email (Resend) production setup".                                                                                                             |
| Google OAuth (optional)         | Web application credentials for `AUTH_BASE_URL` (see `packages/api/.env.schema` `@docs` link).                                                                                                           |
| 1Password (this repo's default) | `.env.schema` starts with `@initOp` / `@setValuesBulk` for the owner's 1Password vault. On a machine without that vault, remove those three lines locally (never commit) or populate `.env` another way. |

## Environment variables

Source of truth: `packages/api/.env.schema`. Values live in `packages/api/.env`
(git-ignored) and are loaded by `varlock run`. Alchemy binds every entry in a
worker's `env:` block and auto-binds `Config` values read during plan/init. A
variable read only inside a request handler, and never declared, stays invisible —
so keep config reads in init (the current workers do).

| Variable                                                       | Required       | Worker(s)          | If missing                                                                                                                         |
| -------------------------------------------------------------- | -------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                                                  | Yes            | api                | varlock rejects values under 32 chars; without varlock the api worker dies at init (no default). Generate: `openssl rand -hex 32`. |
| `AUTH_BASE_URL`                                                | Prod           | api                | Defaults to `http://localhost:8787`; OAuth redirects and session URLs break.                                                       |
| `TRUSTED_ORIGINS`                                              | Prod           | api                | Defaults to `http://localhost:5173`; browser auth/CORS calls are rejected.                                                         |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                    | No             | api                | Google sign-in cannot complete; other auth methods still work.                                                                     |
| `ADMIN_EMAILS`                                                 | No             | api                | No platform admins in the deployed worker.                                                                                         |
| `CF_SAAS_ZONE_ID`                                              | Custom domains | api, build         | Custom-domain set/verify fails; deploy skips the wildcard DNS record and route.                                                    |
| `CF_API_TOKEN`                                                 | Custom domains | api, build         | Same as above; published-site cache purge is skipped.                                                                              |
| `CF_SAAS_CNAME_TARGET`                                         | No             | api                | Defaults to `customers.site-studio.dev`; customers get the wrong CNAME target.                                                     |
| `WWW_DOMAIN`                                                   | Subdomains     | www, build, deploy | No custom domain on www and no `*.WWW_DOMAIN` route; only `/<siteId>/` URLs work.                                                  |
| `CACHE_MAX_AGE`                                                | No             | www                | www falls back to 3600s (same as the schema default).                                                                              |
| `LEADS_NOTIFY_EMAIL` / `LEADS_FROM_EMAIL`                      | No             | api                | Lead notifications fall back to the no-op notifier.                                                                                |
| `PUBLIC_API_URL`                                               | Prod           | build              | Defaults to `https://api.site-studio.dev`; the published contact form posts to the wrong API.                                      |
| `STRIPE_API_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | No             | api                | Free-only mode: checkout/portal return `503 BillingNotConfigured`, webhook returns 503.                                            |
| `RESEND_API_KEY`                                               | No             | api                | Invites are stored but not emailed; the worker logs "email not configured".                                                        |
| `EMAIL_FROM`                                                   | No             | api                | Defaults to `Site Studio <no-reply@site-studio.dev>`; Resend rejects unverified senders.                                           |
| `WEB_URL`                                                      | Prod           | api                | Defaults to `http://localhost:5173`; invite links point at localhost.                                                              |

Honest degradations (verified in code):

- No Stripe keys → checkout and portal return `503 BillingNotConfigured`; Free plans still work.
- No `RESEND_API_KEY` → invites persist, mail is skipped; a configured send failure returns `502 EmailError` after the row is persisted.
- `CF_SAAS_*` unset → `/domain` set/verify fails and `alchemy.run.ts` does not create the wildcard CNAME or route.
- `AUTH_SECRET` missing → the api worker refuses to start; a value under 32 chars also fails varlock validation.

## First deploy

```sh
bun install

# Create packages/api/.env from .env.schema, then validate (may prompt for 1Password):
cd packages/api && bunx varlock load && cd ../..

bun run build:template
bun run --filter @site-studio/api deploy
```

- `deploy` = `varlock run -- bun alchemy deploy` (`packages/api/package.json`).
  There is no `alchemy run` command. `alchemy plan` previews; `alchemy destroy` tears down.
- **Migrations are automatic.** `Database` declares `migrationsDir: "./migrations"`;
  alchemy applies pending `NNNN_*.sql` files during each deploy and records them in
  the wrangler-compatible `d1_migrations` table. No separate `wrangler d1 migrations apply`.

```sh
# Confirm migrations after the first deploy (db id is printed in the deploy output):
bunx wrangler d1 list
bunx wrangler d1 execute <database> --remote --command "SELECT name FROM d1_migrations ORDER BY id"
```

## Live verification checklist

| Check              | Pass condition                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish a site     | Site detail moves `buildStatus: idle → building → built` (queue retries failed builds 3×).                                                    |
| Reserved subdomain | `https://<subdomain>.<WWW_DOMAIN>/` serves the published site.                                                                                |
| Path URL           | `https://<WWW_DOMAIN>/<siteId>/` serves the same site.                                                                                        |
| Custom domain      | Set a domain with ≥3 labels (apex is unsupported), add the returned CNAME, verify → `customDomain` set and the host serves the site over TLS. |
| Stripe checkout    | Test card completes checkout; webhook flips the account to `pro`.                                                                             |
| Cancellation       | Portal cancel; webhook returns the account to `free` while its existing site stays editable and publishable.                                  |
| Invite email       | Invite arrives from `EMAIL_FROM`; invitee signs in and membership activates.                                                                  |
| 402s               | A Free account is blocked on a second site, a Pro template switch, and enabling analytics.                                                    |
| 429s               | Auth spam (>30/min/IP), publish spam (>20 mutations/min/account), and lead spam (>5/min/IP) return 429.                                       |

## Rollback & data

- **Workers are versioned.** Use the Cloudflare dashboard (Worker → Deployments/Versions)
  or `bunx wrangler rollback [<version-id>] --name <worker>`, which redeploys that
  version across routes and domains. (`wrangler versions rollback` is not a command.)
- **D1 migrations are forward-only.** There are no down migrations, and alchemy skips
  files already recorded in `d1_migrations`, so redeploying an older commit will _not_
  undo a schema change.
- **Recovery:** Cloudflare D1 Time Travel is always on and restores in place to any
  minute in the last 30 days (Workers Paid) or 7 days (Free):
  `bunx wrangler d1 time-travel restore <database> --timestamp=<unix>`, then redeploy
  the matching older commit. The restore is destructive; record the current bookmark first.

## Flagged as not verifiable from this repo

- The 1Password item IDs/contents behind `.env.schema`'s bulk-load decorators.
- Live Cloudflare plan entitlements, custom-hostname quota, and zone/DNS state.
- Stripe and Resend dashboard configuration and domain-verification status.
