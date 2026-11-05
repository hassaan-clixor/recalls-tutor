# Deployment runbook

Recalls Tutor deploys to **Vercel Pro** with a **hosted Postgres** (Neon or Supabase) in the same region. All code, migrations, scheduled jobs and checks are ready. What is left is accounts and keys from the business.

## 1. What we need from the CEO

| Item | Why | Where it goes |
|---|---|---|
| Vercel team on the **Pro** plan (invite the developer) | Hobby is for non-commercial use, and the site takes payments. Cron jobs run every 10 minutes and AI jobs need up to 300 seconds. | Vercel |
| Hosted Postgres: Neon or Supabase, London region, **pooled** connection string | The database | `DATABASE_URL` |
| Domain and DNS access (for example recallstutor.com) | The site address, email sending and Stripe | Vercel domain, `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL` |
| Resend account with the domain verified, and a sender address | Sign-in, receipts, reminders and partner emails | `RESEND_API_KEY`, `AUTH_EMAIL_FROM` |
| Stripe account, activated, with **live** keys | Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Anthropic API key, with billing set up | AI drafting, scanned files, proposed fixes, the tutor | `ANTHROPIC_API_KEY` |
| Prices for each exam and duration | We never invent prices | Studio → Billing, after deploy |
| Optional: Google OAuth client, GA4 ID, Search Console code | Google sign-in and analytics | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GSC_VERIFICATION` |

## 2. Environment variables (Vercel → Settings → Environment Variables, Production)

Every variable is listed with a comment in `.env.example`.

- **Required:**
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` (the same https address)
  - `BETTER_AUTH_SECRET` (32 or more random characters)
  - `RESEND_API_KEY` and `AUTH_EMAIL_FROM`
  - `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
  - `ANTHROPIC_API_KEY`
  - `CRON_SECRET` (24 or more random characters)
- **Do not set in production:** `AUTH_MAIL_MODE`, `RECALLS_LOCAL_DB`, `RECALLS_LOCAL_PRODUCTION_CHECK`, or `STRIPE_ALLOW_TEST_MODE`. Set `STRIPE_ALLOW_TEST_MODE` only on a staging project.

## 3. First deploy

1. Import the repository into Vercel. The framework is Next.js; the build command comes from `package.json` (`vercel-build`).
2. Production builds apply database migrations first (`scripts/vercel-build.mjs`). Preview builds never touch the production database.
3. Seed the catalogue and draft site pages once, from a machine with the production `DATABASE_URL`:

   ```bash
   pnpm db:seed
   ```

4. Sign up on the live site with the administrator's email and verify it. Then:

   ```bash
   pnpm db:bootstrap-admin admin@example.com
   ```

5. Sign in as the administrator and turn on two-step sign-in under Account security.
6. In Stripe, add the webhook endpoint `https://<domain>/api/webhooks/stripe` for these events:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`
   - `invoice.paid` and `invoice.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created` and `charge.dispute.closed`

   Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
7. In Stripe → Settings → Billing → Customer portal, turn on cancellation, payment-method updates and invoice history.
8. Studio → Billing:
   - enter prices (3, 6 and 12 months, and 1 month if the business wants a monthly plan);
   - press **Sync prices to Stripe**;
   - set exam timings and pass marks in Studio → Exam catalogue when the content team confirms them.
9. Check readiness. With the production environment loaded:

   ```bash
   pnpm readiness
   ```

   Or online:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/health
   ```

   Every required line must be OK.

## 4. Scheduled jobs (`vercel.json`)

| Route | Schedule | Does |
|---|---|---|
| `/api/cron/partners` | every 10 minutes | Partner expiry events, pack alerts, seat-email and webhook retries |
| `/api/cron/billing` | hourly | Receipts, renewal reminders, failed-payment notices, trial emails, win-back, trial and referral offers; removes tutor text after 30 days |
| `/api/cron/reconcile` | nightly 02:30 UTC | Compares every Stripe subscription with our records and repairs drift |

Vercel sends `Authorization: Bearer $CRON_SECRET`; requests without it get 401.

## 5. Smoke test after deploy (about 15 minutes)

1. Open the home, exam, sitting, topic, pricing and blog pages. Check that `sitemap.xml` and `robots.txt` load.
2. Sign up a test student. Check the verification email arrives, then start a trial and answer a question.
3. Buy a plan with a real card, then refund it in Studio → Billing. The webhook should grant access, then remove it.
4. Studio: upload a short text recall and check that a draft appears (this tests the Claude API).
5. `curl` the health route with the cron secret: `status` should be `ready`.

## 6. Before public launch (business decisions, not code)

- Legal review of recall sourcing, terms, privacy and the refund policy (the policy pages are drafts).
- A reviewer must confirm the website's sample question and any question marked as a free sample.
- Prices, exam timings and pass marks from the content team.
- Offer settings in Studio → Billing → Coupons. The win-back is 20% (from the PRD). The trial-offer and referral rewards stay off until set.
