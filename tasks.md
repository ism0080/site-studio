# Stripe production setup

The API runs in Free-only mode while Stripe is unconfigured: Free plans and
billing status work, but checkout/portal return `503 BillingNotConfigured` and
the webhook endpoint rejects.

1. Create a Stripe account (or use an existing one) and finish account activation.
2. Create the **Pro monthly** recurring price. Copy its `price_...` id. The product,
   amount, and currency live in Stripe; the app only receives `STRIPE_PRICE_ID`.
3. Set the API secrets/env:
   - `STRIPE_API_KEY` — secret key (`sk_live_...` in production).
   - `STRIPE_PRICE_ID` — the Pro monthly `price_...`.
   - `STRIPE_WEBHOOK_SECRET` — signing secret (`whsec_...`) from step 4.
4. Add a webhook endpoint pointing at `https://<api-host>/api/billing/webhook` and
   subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Deploy the API with the three values set, then verify end-to-end:
   - Sign in as a new account and confirm it starts on the Free plan.
   - Complete one checkout and confirm the account flips to Pro (webhook received).
   - Open the customer portal, cancel the subscription, and confirm the account
     returns to Free after the webhook lands, keeping its existing site.
   - As a Free account, confirm creating a second site, switching to a Pro
     template, and enabling analytics are blocked with the upgrade message while
     the existing site still edits and publishes.

# Email (Resend) production setup

Invites are always stored as pending rows. When Resend is unconfigured the API
skips sending (and logs it), so dev keeps today's behavior; a configured send
failure returns `502 EmailError` after the invite row is persisted, so the
inviter can retry safely.

1. Create a Resend account, add the sending domain, and publish its DNS records
   (DKIM and SPF) in Cloudflare. Wait for Resend to mark the domain verified.
2. Set the API secrets/env:
   - `RESEND_API_KEY` — API key (`re_...`) with send permission.
   - `EMAIL_FROM` — a verified sender, e.g.
     `Site Studio <no-reply@site-studio.dev>`.
   - `WEB_URL` — the web app origin used in invite links, e.g.
     `https://app.site-studio.dev`.
3. Deploy the API.
4. Verify end-to-end:
   - Invite a client from a site's members screen and invite an agency partner
     from the admin screen; confirm each appears as pending and the email
     arrives.
   - Sign in with the invited email and confirm membership/agency access
     activates automatically.
   - Unset `RESEND_API_KEY`, repeat an invite, and confirm it is still stored
     while the API logs that email is not configured.
