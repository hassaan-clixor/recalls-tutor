# Decision log

## 2026-11-05 — Phase 2 completion, Phase 3 and deployment readiness

- **Coupons:** each coupon is one Stripe coupon with one promotion code, saved here first, so codes can be prepared before Stripe is connected. A code typed on our site is checked here, then by Stripe. Revenue comes from a ledger of paid invoices (amount, discount, coupon, the sitting page the purchase started from), plus refunds (total per charge) and disputes (won disputes excluded), all in UTC.
- **Lifecycle emails:** each email is queued once (kind + ref) and written from current data when sent, so an email that no longer applies is skipped. Offer emails (win-back, trial, referral) respect an opt-out on the profile and a signed link in each email; service emails always send.
  - The PRD sets the 20% win-back and the 7-day reminder.
  - The win-back code lasts 14 days; this is editable.
  - The trial-offer and referral discounts are off until a Super Admin sets them.
  - **Legal review is needed:** whether this opt-out approach is enough for UK and EU marketing rules.
- **Trial devices:** one trial per exam per device, from a random first-party cookie stored only as a hash. The network address is hashed and only recorded, never used to block, because hospitals and universities share networks. No browser fingerprinting.
- **Pass Predictor v1:** the weights are papers 50% (most recent counts most), first-attempt accuracy 20%, high-yield 15% and latest sitting 15%. Being slower than exam pace costs up to 5 points. The range widens with low coverage, few papers and confident wrong answers. Bands exist only against a published pass mark. These are a first version, to be checked against PP-3 outcomes.
- **Spaced repetition:** worked out from the answers themselves (no stored schedule), so it cannot drift. Wrong, or right-but-unsure, joins the deck; 1, 3, 7 and 14 days come from the PRD. The 20-a-day planner target is a starting suggestion when the student has not set one.
- **Proposed edits:** AI never changes a published question. A content manager accepts (optionally edited), which creates a new version; sessions already started keep their version. A stale proposal cannot be accepted. Paper proposals use only a sitting's own questions, and never invent a time limit.
- **Free samples:** staff mark each public sample, at most 5 per topic. Sample addresses never change. "What came up" drafts contain figures only, never question text.
- **AI on the server:** the official Anthropic SDK with structured outputs whenever `ANTHROPIC_API_KEY` is set; otherwise the local Claude app CLI. Bounds that structured outputs do not accept are moved into descriptions and still validated in code.
- **Tutor and discussion:** the tutor sees only the approved question, answer, explanation and notes, and treats the student's text as data. It is limited to 10 an hour and 40 a day (technical values), and student text is removed after 30 days. Comments are anonymous and need approval; contact details are refused.
- **Deployment:** production builds run migrations before building; previews never migrate. Pooled Postgres connections turn prepared statements off. `/api/health` with the cron secret reports readiness without secrets.
- **Not built in Phase 3:** bundles, subscription pause, Stripe Tax, web push and SSO. Each needs a business decision, partner details or a new dependency.

## 2026-11-05 — Partner Portal and API (PART-2/3/4/6)

Partners are `organisations`. A seat writes an ordinary `partner` entitlement, so practice needed no change. Each enrolment row is one seat. It points at the prepaid pack it came from, and the balance is computed from those rows rather than kept as a counter, so it cannot drift. A seat goes back to the balance only when it is revoked before activation. Extensions use one more seat each and are recorded separately.

- **Postpaid partners** have no packs. A monthly seat limit stands in for the PRD's "credit limit". Statements count seats activated each month at the seat price the Super Admin agreed. Creating Stripe invoices for them is not built yet.
- **Activation:** a seat activates at once for an existing verified account with that email. Otherwise the student is emailed and the seat activates at their first verified sign-in (checked when the session is read). "Creates the account" in the PRD is met by an emailed sign-up link; we do not create passwordless accounts on the partner's behalf.
- **Stacking:** a partner seat's months are added after any access the student already has for that exam.
- **Locking:** every write locks the organisation row, which serialises seat use per partner. Assigning the same email to the same exam twice is refused.
- **API keys:** 32 random bytes, stored only as a SHA-256 hash and shown once. A rotated key works for 24 more hours. Keys can have an optional IP allow-list (exact addresses and IPv4 ranges).
- **Rate limit:** 120 requests a minute per key, counted from the request log. No Redis is needed, which suits Vercel.
- **Idempotency:** every write needs an `Idempotency-Key`. The key is claimed before the work runs. A retry replays the stored answer for 24 hours, the same key with a different body gets 422, and a claim left by a crashed request is taken over after a minute.
- **Sandbox:** test keys, with 25 test seats per product. Sandbox requests work while a partner is waiting for approval, and never create accounts, entitlements or emails.
- **Webhooks:** stored per endpoint and signed `t=…,v1=HMAC-SHA256(secret, "t.body")`. Retries back off over about two days (8 tries). Private and loopback URLs are refused.
- **Scheduled jobs:** expiry events, expiring-pack alerts, email retries, webhook retries and log pruning run from `/api/cron/partners`, protected by `CRON_SECRET`, for a Vercel Cron schedule at deployment.
- **Admin access:** partner admins are ordinary accounts linked to an organisation. Managing keys and webhooks needs two-step sign-in. Progress is visible only to partners the student agreed to share it with on their profile, and sharing is off by default.
- **Not built (PRD later items):** white-label, SSO, Zapier/Make, GHL connections for partners, and Pass Predictor bands in cohort reports (the predictor is not built yet).

## 2026-11-05 — OCR for scanned uploads

Scanned PDFs, photos and screenshots are read by Claude before drafting. Production uses the official Anthropic SDK (`@anthropic-ai/sdk` 1.4.0, exact pin) with Claude Opus 5.5 at low effort, streaming and server-side refusal fallback. Without `ANTHROPIC_API_KEY` the local Claude Code CLI is used. File bytes are never stored: only the PII-cleaned transcript is kept, so a failed read needs the files uploaded again. HEIC is refused with advice to share as JPG. Files are capped at 10 per upload and 4 MB in total, to fit a serverless request body.

## 2026-11-02 — Stripe billing

The Stripe SDK was not added. A small REST adapter pinned to API version 2024-06-20 covers the dozen calls needed, and keeps one interface that tests replace with an in-memory Stripe. Webhooks process each event when it arrives and return 500 on failure, so Stripe's retries with backoff act as the queue; an event-id table makes repeats no-ops. Handlers use only object ids from the payload and read current state from Stripe, which makes them order-independent and independent of the endpoint's API version. Access is written only to `entitlements` (source `subscription`): period end plus a 24-hour renewal buffer (a technical value), 7 days' grace when past due (PRD), none otherwise. Refunds and disputes set an access hold that later events cannot clear; only a Super Admin resolving a won dispute lifts it. Plan switching and card management use Stripe's hosted billing portal rather than custom upgrade and downgrade screens.

## 2026-11-02 — SEO website

Public URLs follow PRD SEO-1: `/{family}/{exam seo_slug}/{sitting slug}`, where `seo_slug` is derived from the exam slug (`mrcog-part-1` becomes `part-1-recalls`). Public pages are rendered on the server for each request from the database (SEO-3 allows server rendering), so publishing a sitting updates its page and the sitting map at once. Redirects are applied by the public dynamic routes when a page is not found, not in Proxy, because the embedded development database allows only one owner. A redirect can therefore only replace an address that no longer exists, up to three levels deep. The root loading boundary was removed, because streaming before a page resolves forces status 200 and turns 404s and 301s into soft responses; loading states now cover only the Studio and Practice. Policy pages are staff-editable plain text, seeded with PRD-derived drafts marked for legal review. Analytics are off unless `NEXT_PUBLIC_GA_ID` is set and the visitor opts in.

## 2026-11-02 — content protection

The question budget counts distinct new questions per rolling hour per account, logged in `question_views` when a body is delivered. Re-opening a question is free, so students moving back and forth in Exam Mode are never penalised. Defaults (240 per hour; alert above 60 in 5 minutes) are technical safety values stored in `app_settings` and editable by a Super Admin. They are not PRD business rules. Suspension is an account status checked by every service permission query and by a Better Auth `session.create.before` hook, and suspending deletes all sessions. Browser measures (no selection, copy, right-click, drag or print) are deterrents only, as the PRD says; the real controls are the budget, alerts, watermark tracing and suspension.

## 2026-11-02 — uploads, taxonomy, papers and trials

`unpdf` 1.8.1 (exact pin, released August 2026) was added for PDF text extraction. It wraps Mozilla PDF.js for server use, needs no native build and has no runtime dependencies. Word `.docx` is read with a small built-in zip reader, so no library is needed. Scanned PDFs and images still need OCR (R2).

Topic, difficulty and sitting links are question metadata, not versioned content, so retagging never unpublishes. Exam timings, pass marks and thresholds stay blank until staff enter them in the catalogue. The only defaults are PRD values: trial 3 days, 50 questions, 25-question mini mock; high-yield at 2 sittings; needs-expert below 80. Trials are a separate access path with their own pool (sittings marked as trial pool) and a server-side cap. Paid access keeps using non-trial entitlements, and every answer rechecks access. A "complete paper" currently means it matches the configured question count; type mix and topic weights are not yet configured.

## 2026-11-01 — AI drafting through the local Claude Code CLI

The user chose Claude for AI refinement with no API key for the MVP and meeting demo. The app therefore runs the Claude Code CLI bundled with the Claude desktop app, in headless mode on the user's own Claude login. It runs with no tools, MCP servers, settings or saved sessions, and with any `ANTHROPIC_*` variables removed. Uploaded text is untrusted data and cannot trigger actions. This only works on a computer where the CLI is signed in, so a hosted deployment needs a server-side model connection later. The adapter interface (`RecallModel`) keeps that swap contained.

Jobs run with Next.js `after()` in the web process, not a durable queue. That is acceptable for a single-operator MVP: interrupted jobs show as stalled and can be retried. Duplicate detection uses word overlap and only flags, never merges, because embeddings need a separate provider. Flags are derived on the server so they don't depend on the model's self-assessment. A `rejected` status was added so reviewers can discard drafts without retiring published content.

## 2026-11-01 — practice engine slice

Practice was built before AI refinement at the user's direction. It works on questions the manual Studio publishes. Access comes only from `entitlements` with source subscription, partner or complimentary. Trial entitlements are deliberately rejected until the trial service enforces its pool, time and question caps (`TRIAL-1`). Complimentary access is granted only by an MFA-enabled Super Admin, is audited, and is not a payment.

Each attempt fixes its questions and pins the published version at start (`practice_items.version_id`), so later edits never change what was answered. The page renders exactly one question body per request. The navigator carries position, answered and flagged state only. A question retired after the attempt started is shown as withdrawn and excluded from scoring.

Exam Mode timing is never hard-coded. It requires `exams.blueprint.count` and `exams.settings.durationMinutes`; the time limit is the real exam pace multiplied by the number of questions chosen. `settings.passMarkPercent` is optional. The server deadline is authoritative, with a 2-second network grace; an expired attempt is submitted at its deadline when next read. No exam has timing configured yet, because those values must come from the content team.

Better Auth disables its origin (CSRF) check whenever `NODE_ENV=test`. `advanced.disableOriginCheck:false` is now set explicitly so the protection, and the test that proves it, do not depend on the runner.

Node is not on PATH in this environment. A Node 24.22.1 binary exists under another tool's runtime cache, and Bun 1.4.3 is installed. Both ran the suite with identical results. The documented `pnpm` commands still need Node and pnpm on PATH.

## 2026-11-01 — corrected project context and authentication choice

The user clarified that the Supabase project interruption belonged to a different project. It is not a known Recalls Tutor infrastructure issue and must not influence this project's requirements or risk reporting. Better Auth remains selected because the user explicitly approved it. Its official documentation MCP was registered and its frontend/backend integration is in progress. This does not select a production database host or prove auth readiness.

## 2026-11-01 — reporting correction

The current public preview is a foundation preview, not a completed Phase One MVP or functioning Recall AI Studio. The Studio route is a protected placeholder. Report auth as partially implemented until lifecycle tests and browser verification pass. The earlier foundation build/test results apply to that checkpoint, not automatically to the subsequent authentication changes. See EOD-2026-10-31.md.

## 2026-10-31 — source precedence

The original pasted PRD is authoritative at the user's direction. Its polished derivatives are references. The user's two-week target supersedes their older delivery estimates. Full assumptions are in ERD-report.md.

## 2026-10-31 — initial technical foundation

Next.js App Router and TypeScript provide one server-rendered application. PostgreSQL holds catalogue and content relationships. PGlite is a local development/test engine, not production hosting. postgres is the production driver. SQL migrations are explicit and transactional; no ORM is needed for the first slice. React/React DOM power the UI; TypeScript/tsx provide type checking and tests. Avoid installing speculative integration libraries before their slices.

Next.js current App Router installation requirements were checked against https://nextjs.org/learn/react-foundations/installation and the official package registry. Dependencies are locked in pnpm-lock.yaml. Node v24.22.1 is available locally. Production provider pricing/quotas are not verified or chosen yet.

## 2026-10-31 — no public mutations before authentication

Catalogue and health are read-only endpoints. Content transitions exist as internal tested services. Do not accept actor IDs or roles from browser requests when wiring admin actions. Production requires verified session guards and database-role separation before exposing writes.

## 2026-10-31 — launch honesty

Seed only planned exams. Do not invent prices, endorsements, question totals or medical questions. No checkout/signup CTA claims to work before those services are connected. The initial website is a local foundation preview; it is not a paid launch.
