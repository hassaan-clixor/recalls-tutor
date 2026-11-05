# Checkpoint 18: Partner Portal and API (Phase 2, second item)

5 November 2026, Asia/Karachi.

Partners are course providers, academies and hospitals. They buy seats and give them to their own students, either by hand in the Partner Portal or automatically when their checkout calls the API. A seat is one student's access to one exam for 3, 6 or 12 months.

## Super Admin: Studio → Partners

- **Create a partner.** It starts as "waiting for approval".
- **Products and seat prices:** which exams and durations the partner may assign, and the agreed price per seat. Prices are left empty until they are agreed; none were invented.
- **Billing model:**
  - prepaid seat packs, recorded with seats, amount paid, expiry date and an invoice reference; or
  - postpaid, billed monthly for the seats activated, with an optional monthly seat limit.
- **Partner admins:** add existing accounts by email.
- **Approve** the partner. Suspending it stops its live API keys at once, makes the portal read-only, and leaves students the access they already have.
- **Suspend one API key** instantly.
- **Partner revenue** is shown separately from direct sales: packs by month bought, and postpaid seats by month activated.

## Partner admin: `/partner`

- **Overview:**
  - seats available per product, with pack expiry dates;
  - low-balance and expiring-pack alerts, also emailed to the partner;
  - activation rate;
  - cohort progress (questions answered, accuracy, mock scores) for students who agreed to share it.
- **Students and seats:**
  - assign seats by email (one per line) or by CSV (up to 500 at a time, in one step);
  - each student's status: invited, active, expired or revoked;
  - search by email or the partner's own reference;
  - extend access;
  - revoke a seat. It goes back to the balance if the student never activated it.
- **Invite links:** a shareable link with a seat cap and an expiry date. Students sign in, claim a seat, and have access at once.
- **Purchases and invoices:** seat-pack history and monthly statements.
- **API and webhooks:**
  - keys are shown once, can be rotated (the old key keeps working for 24 hours) and can have an IP allow-list;
  - sandbox keys come with 25 test seats per product;
  - webhook endpoints show their delivery history and a "Send again" button;
  - the request log is kept for 90 days;
  - a quick reference.
- **Two-step sign-in** is required to create keys and webhooks.

## Students

- **New email:** they get a "you have a seat" email, and the seat activates the first time they sign in with that address.
- **Existing account:** access starts immediately.
- **Stacking:** a partner seat is added after any plan the student already has for that exam, so the two never overlap.
- **Progress sharing:** Profile → Course providers lets each student choose whether a partner sees their progress. It is off by default.

## API: `/v1`

| Endpoint | Purpose |
|---|---|
| `GET /v1/products` | Exams and durations the partner may assign |
| `GET /v1/seats` | Seat balance per product |
| `POST /v1/enrollments` | Give a student a seat by email |
| `GET /v1/enrollments` | List enrolments, filtered by email or status |
| `GET /v1/enrollments/{id}` | Status, access dates and activation |
| `PATCH /v1/enrollments/{id}` | Change the duration of an invited seat (`months`), or extend an active one (`extend_months`) |
| `DELETE /v1/enrollments/{id}` | Revoke; the seat comes back if it was never activated |
| `GET /v1/enrollments/{id}/progress` | Progress, only if the student agreed to share it |

- **Authentication:** a Bearer API key.
- **Idempotency:** every write needs an `Idempotency-Key`. A retried course purchase gets the first answer back and never uses a second seat.
- **Rate limit:** 120 requests a minute per key.
- **Signed webhooks:** `enrollment.activated`, `enrollment.expiring` (7 days before), `enrollment.expired` and `seats.low_balance`. Failed deliveries are retried for about two days.

## PRD acceptance criteria

| Criterion | Status |
|---|---|
| A partner checkout calls `POST /v1/enrollments` and the student gets access within 60 seconds | Immediate for an existing account; at first sign-in for a new one |
| Retrying with the same idempotency key does not use a second seat | Yes |
| 100 seats assigned by CSV in one step, with activation status per student | Yes |
| Partners see progress only for students who consented | Yes |

## Checks

- Type check passed, and 20 of 20 test files passed. The new `tests/partners.test.ts` covers:
  - approval, sandbox and live keys;
  - idempotent retries, duplicate and invalid emails, and running out of seats;
  - seats returned on revoke, and extensions;
  - activation at sign-up, and consent;
  - IP allow-list, rate limit, key suspension and rotation;
  - signed webhooks and retries;
  - 100-row CSV assignment, low-balance alerts, invite-link caps;
  - seat emails, expiry events, partner suspension and revenue.
- Production build succeeded.
- Checked in the browser on the QA preview:
  - the Studio partner list and detail;
  - adding a partner admin;
  - the portal overview;
  - assigning seats, with skipped rows explained, and revoking;
  - creating a sandbox key and calling the real `/v1` routes: 201, then a replay on retry, one test seat used, and 401 without a key;
  - the request log, an invite link and its claim page;
  - phone width, with no sideways page scroll.
- **Fixed during the check:**
  - the public site header showing on portal pages;
  - unreadable text on Studio buttons that are links;
  - seat-price boxes too narrow to type in.
- The QA database now has a test partner, "QA Test Academy", clearly labelled as not real. QA and demo databases are migrated (`012_partners.sql`).

## Still to do

- **Deployment:**
  - add a Vercel Cron schedule for `/api/cron/partners`;
  - set `CRON_SECRET`.
- **Postpaid invoicing:** creating the monthly Stripe invoices for postpaid partners. The statements are ready, but the Stripe invoice step needs the partner's Stripe customer.
- **Later PRD items:** white-label, SSO, Zapier/Make, partner GHL connections, and Pass Predictor bands in cohort reports, which depend on the Pass Predictor.
