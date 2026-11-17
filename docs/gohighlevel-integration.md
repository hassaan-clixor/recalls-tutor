# GoHighLevel integration (official PRD section 13)

Status on 17 November 2026: **outbound sync is built and tested with a simulated GoHighLevel client. It has never run against a real GoHighLevel account, so it is not "connected".** Inbound access (GHL granting plans) reuses the existing partner API and has gaps listed below.

## What is built (outbound, PRD 13.1, 13.2, 13.4, 13.5)

- **Connections** (Studio → Integrations, Super Admin only): one or more GHL sub-accounts (location ID plus a Private Integration token), each for one exam or all exams. Tokens are encrypted at rest (AES-256-GCM, key `GHL_ENCRYPTION_KEY`, falling back to `BETTER_AUTH_SECRET`), never shown again, and never logged. A daily health check and a "Test connection" button record the last success or error.
- **Events** (each can be switched on or off per connection): account created, trial started, trial ending (24 hours), trial expired, checkout started but not paid (after 1 hour), purchase, renewal due (7 days), payment failed, cancelled, renewed, inactive for 7 days, Pass Predictor band changed, exam result passed or resit.
- **What is sent per event:** contact upsert by email, tags (editable patterns such as `rt-paid-{exam}-{months}m`), mapped custom fields, and optionally an opportunity moved to a mapped pipeline stage. Custom fields available: exam, exam part, exam diet, exam date, plan name, plan months, renewal date, auto-renew, trial status, questions answered, latest mock score, predictor band, partner name, country and marketing consent. Only fields you map to a GHL custom field ID are sent.
- **Never sent:** question content, answers, notes, passwords, payment details. Marketing consent is sent as a field, and a contact without consent also gets the tag `rt-no-marketing-consent`; GHL workflows must respect it.
- **Reliability:** events are derived from committed data and de-duplicated by key, so repeated scans never send an event twice. Delivery is asynchronous with backoff (1, 5, 15, 60, 180 minutes, 12 and 24 hours). A GHL outage never touches signup, checkout or practice. A rejected token fails the event immediately and shows the reason in the sync log, with a Retry button. A new signup, trial or Stripe event triggers a sync straight away; the cron route `/api/cron/ghl` (every 10 minutes) catches everything else.
- **Backfill:** one click queues every existing active student for a newly connected location. Only activity after a connection is created is sent otherwise.

## Tested

`tests/ghl.test.ts` (simulated client): encrypted token storage, Super Admin only, idempotent events, tags and field mapping, opportunity to the "won" stage on purchase, outage then replay with nothing lost, rejected-token failure and manual retry, event toggles, backfill, exam-scoped connections, deleted accounts skipped, and the HTTP adapter (fixed host, headers, 429/5xx retry, 401/403/422 permanent, no token in error text).

## Not built or not verified

- **Not verified against real GHL:** request and response shapes follow GHL API v2 documentation (`/contacts/upsert`, `/opportunities/upsert`, `/locations/{id}`). Custom field value naming, scope names, tag-merge behaviour on upsert, and rate limits must be confirmed with a test sub-account. Upsert adds tags; old tags (for example `rt-trial-active` after a purchase) are not removed, so workflows should key off current custom fields as well.
- **Marketing consent default:** `student_profiles.marketing_emails` defaults to true. The PRD requires consent captured at signup; counsel should confirm whether an opt-out default is acceptable before marketing automation is switched on.
- **Lead magnet event (`rt-lead-*`):** no lead-capture form exists yet.
- **Inbound (PRD 13.3):** a GHL "Custom Webhook" can already call the partner API (`POST /v1/enrollments`, `GET`/`PATCH`/`DELETE /v1/enrollments/{id}`) with an API key from a dedicated internal organisation and an `Idempotency-Key` header. Missing: a start-trial call, and an endpoint that returns a personalised coupon checkout link (the coupon code exists in `lib/services/coupons.ts`). Set up the internal organisation in Studio → Partners.
- **Partner-owned GHL connections** (PRD 13.1 phase 2) are not built.
- **60-second signup target:** signup, trial and Stripe events trigger a sync immediately after the response; unverified end to end until tested against a real sub-account.

## Needed from the company

1. A GHL test sub-account (location ID) and a Private Integration token with contacts and opportunities access, entered in Studio → Integrations (never in chat or the repository).
2. The custom field IDs to map, pipeline and stage IDs for the purchase event, and the tag names the sales team wants.
3. Confirmation of the marketing-consent rule and wording (counsel).
4. Which events to enable at launch and which exams feed which sub-account.

## Verification checklist (do before calling it connected)

1. Add the test connection and press Test connection: expect "Connected".
2. Sign up a new test student: contact appears within 60 seconds with `rt-signup`, the exam tag and mapped fields.
3. Start a trial; complete a Stripe test-mode checkout: tags update and the opportunity moves to the mapped stage.
4. Revoke the token, trigger an event: it fails with a clear reason, signup still works; restore the token, press Retry.
5. Run Backfill on the test location and spot-check contacts.
