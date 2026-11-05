# Checkpoint 08 — Stripe billing

2 November 2026, Asia/Karachi.

## Delivered (PRD 8.7, implementation plan section 8)

- **BILL-1, plans and prices** (Studio → Billing, Super Admin only):
  - Set 3, 6 and 12-month USD prices per exam. Each exam gets one Stripe Product and each price a recurring Stripe Price.
  - Changing a price creates a new Price and archives the old one, and **existing subscribers keep their original price**.
  - Prices can be set before Stripe is connected and pushed with "Sync prices to Stripe".
- **BILL-2, purchase flow:**
  - On the exam page's plan selector (6 months highlighted), the student chooses a plan and goes to **Stripe Checkout** (hosted: cards, Apple Pay, Google Pay, Link, 3-D Secure).
  - Signed-out visitors are sent to sign-in and brought back to the same plans. A verified email is required (AUTH-1).
  - One Stripe customer per account, and no second plan for an exam the student already has.
  - The checkout page shows the auto-renew terms and links the refund policy (BILL-5).
  - The return page **never grants access**: it waits for the webhook, then says "You're in".
- **BILL-3, access rules:**
  - Access starts on payment and runs to the period end, plus a 24-hour buffer so renewals never cause a gap.
  - **Auto-renew is on by default and can be turned off in My plans**; access then ends exactly at the period end.
  - A failed renewal gives **7 days' grace** while Stripe retries, then access pauses until paid. Paying later resumes access.
  - Cancelled or ended plans lose access. Resubscribing restores everything, because progress is never deleted.
  - Upgrades, downgrades, card changes and invoices go through **Stripe's billing portal** ("Manage billing" in My plans). Proration and downgrade-at-renewal are set in Stripe's portal settings.
- **BILL-4, webhooks** (`/api/webhooks/stripe`):
  - The signature is verified (HMAC with a 5-minute window), and each event id is processed only once.
  - **Order-independent:** only the ids are taken from the event, and current state is always read back from Stripe.
  - Handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded` and `charge.dispute.created`.
  - A failure returns an error so Stripe retries. After three failed attempts an alert is raised, and a Super Admin can retry manually.
  - **Nightly reconciliation:** run `tsx scripts/reconcile-billing.ts` from the host's scheduler, or press "Reconcile with Stripe now". It repairs drift and flags subscriptions Stripe no longer has.
- **BILL-5, refunds and disputes:**
  - A Super Admin issues a full refund of the latest payment, with a reason. Access ends when Stripe confirms the refund, and the plan is cancelled so the student isn't charged again.
  - Partial refunds don't change access.
  - A **dispute suspends access** and raises an alert. A Super Admin resolves it and can restore access if the dispute is won.
  - Refunded or disputed plans cannot be re-activated by later Stripe events.
- **Audit:** every price change, sync, refund, hold and decision is in the audit log.

## Design notes

- No Stripe SDK. A small REST adapter (`lib/integrations/stripe.ts`) is pinned to API version `2024-06-20`, and its error messages never echo request details. A stand-in gateway in the tests exercises the full lifecycle.
- Events are processed when they arrive, and a failure returns 500, so Stripe's own retry with backoff provides the queue. This avoids running a job runner. Each event needs only a few Stripe reads.
- Production refuses a test key unless `STRIPE_ALLOW_TEST_MODE=true` (for staging).

## Verification

- 15 of 15 automated tests pass. The new billing tests cover:
  - form encoding, and signature acceptance and rejection (tampered body, wrong secret, expired timestamp, missing header);
  - generic error messages, the pinned version header and idempotency keys;
  - Super Admin-only pricing, one product per exam, a new Price on a change, the old Price archived, and old subscribers kept on their price;
  - checkout blocked for unverified accounts, no access before the webhook, and refund policy in the checkout text;
  - out-of-order and duplicate events;
  - the renewal buffer, auto-renew off, renewal, failed payment with 7-day grace, unpaid with no access, and paying later resuming access;
  - refund flow including blocking re-activation, partial refunds, disputes (alert, then restored when won);
  - failing events (three attempts, alert, manual retry) and reconciliation (drift repaired, missing subscription flagged);
  - audit entries.
- Type check and production build pass.
- Browser, QA database with synthetic prices and a deliberately invalid Stripe key:
  - the plan selector shows prices, per-month figures, 25% and 40% savings, and best value, plus Product and Offer structured data;
  - choosing a plan while signed out goes to sign-in and comes back to the plans;
  - choosing it signed in reached Stripe, which rejected the placeholder key, and the student landed on My plans with "Stripe rejected the API key." instead of an error page;
  - the confirmation page handles an unknown session;
  - the webhook endpoint refuses requests while not configured.
- **Not verified:** a real Stripe test-mode payment, because no Stripe keys are available yet.

## To switch on (Stripe test mode first)

1. In Stripe (test mode), copy the secret key and set `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint `https://<site>/api/webhooks/stripe` with the 8 events above, and set `STRIPE_WEBHOOK_SECRET`. Locally, use `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
3. In Stripe → Settings → Billing:
   - turn on the customer portal (plan switching between an exam's three prices, cancellation at period end);
   - set retries to cover the 7-day grace period;
   - set what happens after the final retry (mark unpaid or cancel).
4. Set prices in Studio → Billing, then buy with Stripe's test card `4242 4242 4242 4242` to check the whole path.
5. Schedule `scripts/reconcile-billing.ts` nightly.

## Not built (P1 and later)

- Coupons and promo codes, revenue reports and CSV export (BILL-6).
- Renewal reminder, receipt and win-back emails (BILL-7). These need an email provider; the PRD's mandatory 7-day reminder before 12-month renewals depends on it.
- Bundles, pause, one-time passes and Stripe Tax (BILL-8).
- Purchase conversion tracking in GA4.
