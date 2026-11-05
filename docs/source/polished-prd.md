# Recalls Tutor — Product Requirements Document (Complete App)

Version 1.0 · 30 Oct 2026 · Owner: Hassaan (AI Automation) · Sponsor: CEO, Med Exam Expert · Companion: *Recalls Tutor — Implementation Plan*

## 0. How to use this document

This is the single source of truth for *what* we build. The Implementation Plan says *how*. It is written to be loaded into an AI coding agent as context, so it follows these rules:

- Every requirement has an ID (e.g. `STU-12`) and a priority: **P0** = needed to take money and serve students; **P1** = needed for the full product; **P2** = scale and polish.
- Where the CEO's original PRD was ambiguous or contradictory, this document makes a decision and marks it **\[DECISION\]**. Anything still needing a human answer is in section 14 with a recommended default.
- The agent must not invent features. If a requirement is missing, ask; do not guess.
- Hard rule for the whole product: **AI only creates drafts. A human with the right role publishes.**

## 1. Strategy summary

**What it is.** A responsive web platform that sells exam-recall question banks (QBanks) by subscription. Raw, messy recalls from past candidates become clean, tagged, exam-style questions through an AI pipeline with human approval.

**Why it wins.** Competitors sell static banks written by authors. Recalls Tutor sells what actually came up, refreshed after every exam diet, at a fraction of the production cost because AI does 90% of the drafting work. The moat is three things together: (1) a proprietary, growing recall corpus, (2) the AI Studio that makes freshness cheap, and (3) SEO pages for every exam and sitting that capture high-intent searches such as “MRCOG Part 1 recalls September 2026”.

**Where it makes money.** Direct subscriptions (3/6/12 months per exam, USD), then partner seat sales (course providers and academies), then renewals from students who fail and resit.

**What can kill it.** (1) Legal exposure from exam-body confidentiality rules, (2) wrong answers in published questions destroying trust, (3) content scraped and resold, (4) AI cost or quality drift. The product design below is built around those four.

## 2. Users and jobs-to-be-done

| User | Job to be done | What success looks like |
| --- | --- | --- |
| Exam candidate (student) | “Show me what is likely to come up and let me practise it like the real exam.” | Passes. Renews or resits with us. |
| Content reviewer (doctor/expert) | “Let me verify a question quickly and trust the evidence.” | Under 5 minutes per question. |
| Content manager (MEE content lead) | “Keep the bank fresh and accurate after each diet.” | New diet live within days of the exam. |
| Super admin (ops) | “Run billing, users and reports without a developer.” | No code changes for new exams, plans or pages. |
| Partner (course provider) | “Give my students access automatically when they buy my course.” | Access in under 60 seconds, no manual work. |
| Sales/marketing (MEE team) | “Follow up trials, abandoned checkouts and renewals in GHL.” | Every lifecycle event arrives in GHL as a tag and field update. |

## 3. Positioning and business model

- **Positioning:** “The recall QBank for postgraduate medical licensing exams, updated after every sitting.”
- **Launch exams:** MRCOG Part 1, MRCOG Part 2, AMC Part 1. The platform must support any exam family (PLAB, MRCP, FCPS, USMLE) with **no code changes**.
- **Pricing model:** per-exam subscriptions of 3, 6 and 12 months, auto-renewing, USD. The 6-month plan is the highlighted best-value plan. Bundles and partner seats are added later.
- **\[DECISION\] Auto-renew:** all plans auto-renew by default and the student can switch it off at any time. The 12-month plan renews too, with a mandatory reminder email 7 days before. This is simpler than a special case and consistent with the original PRD’s “renews until cancelled”.
- **\[DECISION\] Plan scope:** a plan is per exam (not per sitting) and includes every published sitting of that exam, including new ones added during the plan.
- **Free trial:** no card, per exam, as the main conversion lever.

## 4. Goals and success metrics

| Goal | Metric | Target (first 6 months) |
| --- | --- | --- |
| Content efficiency | Human review minutes per published question | < 5 |
| Content quality | Reported-error rate on published questions | < 1.5% of questions per month |
| Revenue | Trial-to-paid conversion | Baseline in month 1, then +20% |
| Revenue | Pricing page to paid checkout conversion | Baseline in month 1 |
| Retention | Renewal rate among students who failed and resit | Track from first resit cycle |
| Growth | Organic share of new signups | Majority by month 6 |
| Reliability | Uptime and p95 page/question load | 99.9% and under 1 second |
| Cost | AI cost per published question | Set after pilot; alert on > 2× baseline |

## 5. Scope

**In scope:** SEO website; student portal; admin portal; Recall AI Studio; subscription plans and Stripe billing; free trial; Pass Predictor; partner portal and API; GoHighLevel integration; content protection; analytics and reports.

**Out of scope:** native iOS/Android apps (a PWA covers installability), offline mode, live tutoring, multi-currency pricing.

**Release tiers** (details in section 11): **R1 Sell** (content engine + paid access), **R2 Automate** (growth features, Pass Predictor, partner API), **R3 Scale** (more exams, percentiles, referrals).

## 6. Roles and permissions

Role-based access control (RBAC) on every endpoint. Every admin action is written to an immutable audit log.

| Role | Can | Cannot |
| --- | --- | --- |
| Visitor | Browse public pages, try free samples, view pricing | Access paid content |
| Student | Buy and renew, practise, sit mocks, view own analytics, report errors | See unpublished content or other users’ data |
| Content Reviewer | Review, edit, approve or reject AI drafts, add notes | Pricing, users, billing |
| Content Manager | Reviewer rights plus run AI jobs, build papers, publish, manage taxonomy | Billing, refunds, role changes |
| Super Admin | Everything: plans, prices, users, refunds, roles, integrations, agent settings, reports | — |
| Partner Admin | Manage own organisation’s seats and students | Anything outside own organisation |
| Recall AI Agent (system) | Ingest, extract, refine, dedupe, tag, propose papers | Publish; change billing or users |

- `RBAC-1` (P0): Roles are assigned by Super Admin only. Two-factor authentication is mandatory for Super Admin and available to all staff.
- `RBAC-2` (P0): A student can never read a question whose status is not Published, even by guessing an ID.

## 7. Domain model and business rules

**Hierarchy:** Exam Family → Exam (part) → Sitting → Paper → Question. Topics are an independent taxonomy. A question is stored **once** and linked to every sitting it appeared in via an Attempt Tag.

| Entity | Key fields |
| --- | --- |
| Exam Family | name, slug, governing body, country, logo |
| Exam | family, name, format, question types, total questions, duration, pass mark (if published), papers per sitting, style profile |
| Sitting | exam, date(s), year, diet, label, status (upcoming/live/past), source of date |
| Paper | exam, type (recall paper / mock / topic set), linked sittings, number, ordered questions, time limit, locked flag |
| Question | stem, type (SBA, EMQ, MCQ, T/F), options, correct answer(s), explanation, key notes, references, images, difficulty, topic, subtopic, status, version |
| Attempt Tag | question, sitting, recall confidence, independent source count |
| Topic | parent, name, slug, exam mapping |
| Source Upload | file, uploader, type, sitting hint, processing status, linked questions (private evidence) |
| Plan | exam or bundle, duration, USD price, status, Stripe IDs |
| Subscription | student, plan, start, renewal date, status, auto-renew flag |
| Organisation | partner, seats, packs, API keys |

**Status lifecycle:** Raw → AI Refined → In Review → Approved → Published → Retired. Students only ever see Published.

**Versioning:** every edit creates a new version. Attempt history stores the version answered, so analytics stay correct after edits.

**Badges derived from data:** “Seen in” chips (all sittings, newest first); **High-yield** when seen in 2 or more sittings (threshold configurable); **New this sitting** for first recall in the latest sitting.

**Business rule `BR-1`:** year and diet tags are never typed by hand; they come from the sittings a question is linked to.

**Business rule `BR-2`:** nothing about exams, tags, plans, sittings, style profiles or SEO pages is hard-coded; all are created in admin.

## 8. Functional requirements

### 8.1 Accounts and authentication (AUTH)

- `AUTH-1` (P0): Sign up with email + password and Google. Apple sign-in (P1). Email verification is required before purchase.
- `AUTH-2` (P0): Profile: name, country, exams of interest, optional exam date, timezone.
- `AUTH-3` (P0): Forgot/reset password, change email, delete account with data export on request (GDPR and Australian Privacy Act).
- `AUTH-4` (P1): One active session per account; device limit of 2.

### 8.2 Recall AI Studio (AIS)

Turns raw recalls into publish-ready questions. Every output is a draft.

- `AIS-1` (P0): Bulk drag-and-drop upload (up to 500 MB per batch). Inputs: PDF (text and scanned), DOCX, XLSX/CSV, TXT, WhatsApp/Telegram exports (.txt/.zip), images (JPG/PNG/HEIC), pasted text. P0 covers text-based inputs; OCR for scans and screenshots is P1.
- `AIS-2` (P0): Optional hints on upload (exam, sitting, source name); the agent infers missing values and flags low confidence.
- `AIS-3` (P0): Each upload is a Job with live status: Queued → Extracting → Refining → Deduping → Ready for review. Failed jobs show a reason and can be retried.
- `AIS-4` (P0): Extraction splits raw text into recall fragments, separates stems, partial options, student guesses and chat noise, and attaches images to fragments. Student-claimed answers are stored as evidence, not truth.
- `AIS-5` (P0): Refinement produces a full exam-style question: reconstructed stem, completed options with plausible distractors, correct answer with a 0–100 confidence score, explanation (why right and why each distractor is wrong), 3–5 key learning notes, references, taxonomy tags, difficulty, and image handling.
- `AIS-6` (P0): Each exam has an editable **Exam Style Profile** (prompt template, option count, stem length, guideline sources, tone).
- `AIS-7` (P0): Confidence below a configurable threshold (default 80) flags “needs expert”. Confidence and flags are mandatory on every AI output.
- `AIS-8` (P0): References must be real. The agent cites only sources from an approved source list per exam; any reference not matching the list is flagged for the reviewer to verify.
- `AIS-9` (P0): PII (names, phone numbers, emails) is stripped from uploads on ingestion. Raw sources and chat identities are never shown publicly.
- `AIS-10` (P0): Auto-tagging from a controlled list per exam (family, part, year, diet, topic, subtopic, type, difficulty, frequency, has-image, guideline source). The agent can propose a new tag; it goes live only after admin approval.
- `AIS-11` (P0): De-duplication using embeddings against the full bank and the current batch. Above the high threshold → merge automatically (add Attempt Tag + attach evidence). In the middle band → reviewer chooses Merge, Keep both or Replace. Both thresholds configurable per exam.
- `AIS-12` (P1): When new evidence improves a question (e.g. a missing option), the agent proposes an edit rather than overwriting.
- `AIS-13` (P1): Usage and AI cost tracked per job and per question in admin, with alerts.
- `AIS-14` (P1): Agent proposes new Sittings when uploads mention an unseen diet; an admin confirms.

### 8.3 Review workflow (REV)

- `REV-1` (P0): Review queue sorted by confidence (lowest first), filterable by exam, sitting, topic, reviewer, status.
- `REV-2` (P0): Side-by-side view: raw evidence on the left, refined question on the right, inline editing, all tags editable in one click.
- `REV-3` (P0): Actions: Approve, Edit and approve, Send back to AI with instructions, Reject, Merge. Publishing is a separate Content Manager action.
- `REV-4` (P1): Optional two-step approval per exam (Reviewer → Content Manager).
- `REV-5` (P1): Bulk approve for high-confidence items after a skim.
- `REV-6` (P0): Every change is logged with who, when, what.

### 8.4 QBank, papers and manual content (QB)

- `QB-1` (P0): QBank search and filter by exam, topic, sitting, status, confidence, error rate; edit; retire; view version history and Attempt Tags.
- `QB-2` (P0): Manual question entry with a rich-text editor (LaTeX, images), options builder, explanation, notes, references, tags, with an “Improve with AI” button. Same review flow.
- `QB-3` (P0): CSV/XLSX bulk import with a validation report.
- `QB-4` (P1): Bulk retag (e.g. rename a subtopic across 200 questions).
- `QB-5` (P0): Papers: build, reorder, lock, publish, unpublish. A “Complete Paper” matches the exam blueprint (count, type mix, topic weighting).
- `QB-6` (P1): Agent proposes complete papers per sitting; Content Manager adjusts and locks.

### 8.5 Student practice (STU)

- `STU-1` (P0): **Revision Mode:** combinable filters (year, diet, topic, subtopic, type, difficulty, high-yield, has image, unanswered, incorrect, bookmarked, flagged), chosen question count, optional timer, instant feedback with correct answer, explanation, notes, “Seen in” chips and % of students choosing each option.
- `STU-2` (P0): **Exam Mode:** a complete paper or timed blueprint-matched set; mandatory timer equal to the real exam; navigator; flag for review; change answers until submit; auto-submit at time end; no feedback until submission; configurable pause.
- `STU-3` (P0): Results: score, pass/fail vs pass mark (if known), time per question, topic breakdown, full review.
- `STU-4` (P0): Paper library grouped by year and diet, attempt history, retake any time.
- `STU-5` (P0): Question tools: bookmark, flag, personal note, report an error, strike-through options, image zoom, reference/lab-values drawer, keyboard shortcuts (desktop), swipe (mobile).
- `STU-6` (P0): Dashboard: countdown (if exam date set), daily target, progress overall and by topic, weakest 3 topics, continue where you left off, what is new.
- `STU-7` (P0): **Mistakes deck:** every wrong answer joins an auto-deck; re-practise until correct twice.
- `STU-8` (P0): **High-yield sprint** and **Latest-diet pack** shortcuts.
- `STU-9` (P0): **Confidence tagging** (sure/unsure/guess) per answer.
- `STU-10` (P0): **Exam switcher** for students with several exams.
- `STU-11` (P1): Analytics: score trend, topic heatmap, high-yield vs other accuracy, time per question vs exam pace, readiness indicator.
- `STU-12` (P1): Percentile vs peers on the same paper once 30+ attempts exist.
- `STU-13` (P2): Spaced repetition (1, 3, 7, 14 days), study planner, flashcards from key notes, streaks and goals, notes export.
- `STU-14` (P2): AI tutor on a question (“explain more simply”), grounded only in the approved explanation, rate-limited.
- `STU-15` (P2): Moderated per-question discussion; student recall submissions earning credit.
- `STU-16` (P0): All screens fully usable from a 360 px phone browser; installable as a PWA; dark mode (P1).

### 8.6 Pass Predictor (PP)

Unlocks after one complete Exam Mode paper and at least 300 answered questions.

- `PP-1` (P1): Shows a likelihood band (Low / Borderline / Likely / Very likely), predicted score range vs pass mark (where published), 4-week trend, the top 3 topics by gain per study hour, and the daily target needed to reach “Likely”.
- `PP-2` (P1): v1 is a transparent rule-based score using: recent complete-paper scores (recent weighted higher), high-yield accuracy, blueprint coverage, accuracy on latest sitting, time per question vs pace, confidence ratings, and first-attempt accuracy only.
- `PP-3` (P1): Post-exam “Did you pass?” prompt with a small reward. Once about 200 outcomes exist per exam, calibrate against real results and show accuracy in admin.
- `PP-4` (P0): Every prediction carries the disclaimer: an estimate from practice performance, not a guarantee. **\[DECISION\]** The wording and band labels avoid any claim of a pass guarantee, for legal and trust reasons.

### 8.7 Plans, trial and billing (BILL)

- `BILL-1` (P0): Super Admin sets 3, 6 and 12-month USD prices per exam in admin; each exam has one Stripe Product with three recurring Prices. Price changes create a new Price; existing subscribers keep their old one unless migrated.
- `BILL-2` (P0): Purchase flow: choose exam → plan → Stripe Checkout (hosted: cards, Apple Pay, Google Pay, Link, 3-D Secure) → instant access and branded welcome email.
- `BILL-3` (P0): Access rules: starts on payment; auto-renew on by default and toggleable in My Plans; cancel keeps access to period end; failed renewal gives a 7-day grace period with retries and emails, then access pauses until paid; upgrade is immediate with proration; downgrade applies at next renewal; lapsed students who resubscribe get all progress restored.
- `BILL-4` (P0): Webhooks are the source of truth for access: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`, `charge.refunded`, `charge.dispute.created`. Signature-verified, idempotent, retried, with a nightly reconciliation job.
- `BILL-5` (P0): Refunds are issued by Super Admin in admin; access updates through the webhook. Refund policy is shown at checkout.
- `BILL-6` (P1): Coupons and promo codes managed in admin and synced to Stripe; revenue reports (by exam, sitting, day/month, new vs renewal, coupons, refunds, disputes) with CSV export.
- `BILL-7` (P1): Renewal comms: reminder 7 days before, receipts, payment-failed emails, 20% win-back 14 days after lapse.
- `BILL-8` (P2): Bundles, subscription pause, one-time passes, optional monthly plan, Stripe Tax where required.
- `TRIAL-1` (P0): Per exam, no card: 3 days or 50 questions (whichever first), fixed pool from older sittings, Revision Mode plus one 25-question mini mock, Pass Predictor teaser only. One trial per exam per account with email verification. Limits are admin-editable.
- `TRIAL-2` (P1): Device fingerprinting against repeat trials; trial-ending emails on day 2 and 3; trial-only coupon within 48 hours of expiry; progress carries over on purchase.

### 8.8 SEO marketing website (SEO)

Every exam and sitting gets its own indexable page, generated from the database. New sittings create new pages automatically.

- `SEO-1` (P0): Pages: Home, Exam family hub (`/mrcog`), Exam page (`/mrcog/part-1-recalls`), Sitting page (`/mrcog/part-1-recalls/september-2026`), Pricing, About, Contact, FAQ, Terms, Privacy, Refund policy.
- `SEO-2` (P1): Topic pages with 3–5 free sample questions; free sample question pages (indexable); blog and guides in a CMS; “What came up in {exam} {sitting}” posts.
- `SEO-3` (P0): Server-rendered or statically generated; Core Web Vitals on mobile: LCP < 2.5 s, INP < 200 ms, CLS < 0.1; Lighthouse mobile ≥ 90 for performance and SEO on exam and sitting pages.
- `SEO-4` (P0): Editable title, meta description and H1 per page with database-driven defaults; canonical tags; auto-generated XML sitemap; robots.txt; 301 redirect manager.
- `SEO-5` (P0): Structured data: Organization, Product + Offer (USD), FAQPage, BreadcrumbList; Article (blog); Quiz (sample pages, P1). Open Graph and Twitter cards with generated share images.
- `SEO-6` (P0): Paid question content is never present in public HTML. Past-sitting pages stay live permanently so earned rankings are never lost.
- `SEO-7` (P0): Conversion elements: plan selector on every exam page with 6 months highlighted, price per month and savings shown, sticky mobile buy button, free sample test without card (20 questions), trust blocks, lead-magnet email capture (P1).
- `SEO-8` (P0): Search Console, GA4 and ads conversion tracking for purchases, with a cookie consent banner.

### 8.9 GoHighLevel integration (GHL)

Stripe remains the payment source of truth. GHL is for marketing and sales follow-up.

- `GHL-1` (P0): Connect a GHL sub-account from Admin → Integrations (API v2, OAuth or private integration token). Tokens encrypted; connection health and last sync visible.
- `GHL-2` (P0): Outbound: on signup, trial start/end/expiry, abandoned checkout, purchase, renewal due, payment failed, cancellation and renewal, upsert the contact (match by email, then phone), set custom fields, add tags (`rt-signup`, `rt-trial-active`, `rt-paid-mrcog-p1-6m`, etc.), and optionally move an opportunity stage.
- `GHL-3` (P0): Synced custom fields: exam, part, plan and duration, renewal date, auto-renew flag, trial status, questions answered, latest mock score, predictor band, country, marketing consent.
- `GHL-4` (P0): Contacts without marketing consent receive transactional messages only. Question content is never sent to GHL.
- `GHL-5` (P0): A GHL outage never blocks signup, purchase or practice; events queue and replay with backoff; a sync log per contact with retry.
- `GHL-6` (P1): Inbound: GHL workflow webhook can grant, extend or revoke a plan or start a trial, with idempotency keys. Optional coupon-based personalised checkout links.
- `GHL-7` (P1): Field/tag mapping, pipeline mapping, event toggles per connection, one-click backfill, multiple sub-accounts per exam.

### 8.10 Partner program and API (PART)

- `PART-1` (P0 data model, P1 features): An Organisation owns seats from day one so no later migration is needed.
- `PART-2` (P1): Models: prepaid seat packs with volume tiers, postpaid monthly invoicing with credit limit, optional white-label. A seat is one student’s access to one exam for 3, 6 or 12 months; unused seats roll over until pack expiry.
- `PART-3` (P1): Partner Portal: seat balance, purchase history, invoices; assign seats by email, CSV or capped invite link; revoke unactivated seats; cohort reports only for students who consented; low-balance alerts.
- `PART-4` (P1): REST API `/v1`, API-key auth (rotatable, optional IP allow-list), sandbox, idempotency keys, rate limits, request log. Endpoints: `GET /products`, `GET /seats`, `POST /enrollments`, `GET|PATCH|DELETE /enrollments/{id}`, `GET /enrollments/{id}/progress`. Signed outbound webhooks: `enrollment.activated|expiring|expired`, `seats.low_balance`.
- `PART-5` (P2): Zapier/Make apps, recipes for common course platforms, SSO (OIDC/SAML).
- `PART-6` (P1): Admin approves partners, sets tiers and credit limits, and can suspend an API key instantly. Partner revenue is reported separately.

### 8.11 Admin portal (ADM)

- `ADM-1` (P0): Dashboard: revenue, active students, signups, review-queue size, running AI jobs, subscriptions and MRR, renewals due, open error reports.
- `ADM-2` (P0): Catalogue: families, exams (blueprint, duration, types, pass mark), topics, style profiles, sittings, plans and prices, trial settings.
- `ADM-3` (P0): Students: search, profile, plans, progress, payments; extend or grant complimentary access; reset password; suspend.
- `ADM-4` (P0): Team and roles with audit log. `ADM-5` (P1): content analytics (most-missed questions, high report rates, coverage vs blueprint). `ADM-6` (P1): email template editor, site content editor, error-report queue with AI-drafted fixes.

### 8.12 Content protection (PROT)

Content is the asset, so protection is a requirement, not a nice-to-have. Be honest that no browser measure fully stops a determined copier; the goal is to raise cost and detect abuse.

- `PROT-1` (P0): Questions load one at a time through authenticated APIs; never the whole bank in one response.
- `PROT-2` (P0): Per-user rate limits with scraping alerts; one question view budget per hour that is configurable.
- `PROT-3` (P0): Dynamic watermark (student email + ID) faintly overlaid on questions and images.
- `PROT-4` (P1): Disable text selection and right-click in practice views; signed expiring image URLs; no PDF export of paid questions; session and device limits.
- `PROT-5` (P1): Leak tracing: because watermarks identify the account, suspected leaks can be traced and the account suspended.

## 9. Non-functional requirements

- **Performance:** p95 page and question load < 1 s on 4G; designed for 10× exam-week traffic.
- **Reliability:** 99.9% uptime; error tracking and uptime monitoring; daily encrypted backups with 30-day retention and a tested restore.
- **Security:** HTTPS/HSTS, OWASP Top 10 mitigations, secure password hashing, secrets never in code, role checks on every endpoint, audit log, dependency scanning.
- **Accessibility and devices:** WCAG 2.1 AA; 360 px phones to large desktops; iOS Safari, Android Chrome, desktop Chrome, Edge, Safari, Firefox.
- **Observability:** structured logs, per-job AI cost, billing and webhook dashboards, alerts on failed jobs and webhooks.

## 10. Legal, privacy and compliance

- **Highest-risk item:** recall content may breach exam bodies’ candidate confidentiality agreements. **\[DECISION\]** A legal review of how recalls are sourced, rewritten and marketed is a launch gate. The AI pipeline already reconstructs questions rather than copying them verbatim; legal should confirm whether that is sufficient.
- Do not use exam-body names or logos as if endorsed; use descriptive references only.
- Compliance: Australian Privacy Act, GDPR (UK/EU), cookie consent, data export and deletion on request, PII stripped from sources.
- Terms must forbid sharing accounts and redistributing content; refund policy shown at checkout.
- Student identities in chat exports are never exposed.

## 11. Release plan

| Release | Contents | Exit condition |
| --- | --- | --- |
| **R1 — Sell** | Data model, auth, admin catalogue, QBank, manual entry, CSV import, AI Studio (text-based inputs, refine, dedupe, review), publish, student practice (Revision + Exam, papers, filters, mistakes deck, confidence tags), trial, Stripe subscriptions and webhooks, core SEO pages, GHL outbound, content protection basics, Organisation data model | First launch exam live with paying students |
| **R2 — Automate** | OCR, analytics, Pass Predictor, error-report loop, paper-builder proposals, topic/sample/blog SEO, win-back and renewal emails, coupons, GHL inbound, Partner Portal and API, spaced repetition and planner | All three launch exams running without manual plan admin |
| **R3 — Scale** | More exam families, bundles, monthly option, percentiles, web push, referrals, discussion, AI tutor, white-label, SSO | Set from R2 data |

## 12. Acceptance criteria (release gates)

- [ ] A 50-message WhatsApp recall export yields refined drafts with options, answer, explanation, notes, references, topic and confidence, with no manual typing.
- [ ] A repeat recall adds a “Seen in” tag and creates no duplicate.
- [ ] Nothing reaches students without human approval.
- [ ] A student signs up, pays in USD and starts practising on a phone in under 3 minutes.
- [ ] Plans renew automatically; auto-renew can be turned off; failed payments get a 7-day grace period then pause access.
- [ ] Exam Mode timer, navigator, flagging and auto-submit behave like the real CBT exam.
- [ ] Each sitting has an indexable page with Product/Offer schema and appears in the sitemap automatically.
- [ ] Paid questions are absent from public page source and from any bulk API response.
- [ ] A new signup appears in GHL with correct tags and fields within 60 seconds; a GHL outage loses no events.
- [ ] A partner purchase through the API grants access within 60 seconds and a retried request never uses a second seat (R2).
- [ ] Lighthouse mobile ≥ 90 for performance and SEO on exam and sitting pages.

## 13. Product risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Legal challenge from an exam body | Takedown, reputational loss | Legal review as launch gate; reconstruct and rewrite questions; no verbatim exam text; no endorsement claims; fast takedown process |
| Wrong answers published | Loss of trust, refunds | Mandatory human approval, confidence flags, student error reporting, auto-flag high-error questions, reviewer sign-off per exam |
| Hallucinated references | Credibility damage | Approved source list, reviewer verification, flag unverifiable citations |
| Content scraped or shared | Revenue loss | Section 8.12, watermarking, rate limits, account tracing, terms of service |
| Reviewer bottleneck | Slow publishing | Confidence-sorted queue, bulk actions, two-tier approval, named reviewers per exam |
| AI cost drift | Margin erosion | Per-job cost tracking, alerts, model routing, caching |
| Low trial conversion | Weak revenue | Quality trial pool, email sequences, GHL follow-up, test price points |
| Stripe or webhook errors grant wrong access | Revenue leakage or angry customers | Idempotent webhooks, nightly reconciliation, admin override with audit log |

## 14. Open decisions and recommended defaults

| Question | Recommended default |
| --- | --- |
| Which legal entity and Stripe account? | Use the existing MEE Stripe if the entity matches; otherwise create a new account before week 2 |
| Launch prices for 3/6/12 months | Set 6-month as anchor; 3-month ≈ 60% of the 6-month price per month premium; 12-month the cheapest per month. Test with the CEO |
| Refund policy | Full refund within 48 hours if fewer than 50 questions attempted |
| Auto-renew on all plans? | Yes (see section 3) |
| Target published questions per exam before launch | Enough for at least 3 complete papers per launch exam; CEO to confirm |
| Stripe Tax at launch? | Decide with an accountant; turn on if selling to UK/EU/AU consumers |
| Existing designs (17 student, 10 admin screens) as the build basis? | Yes, if the CEO confirms; otherwise use a component library |
| Named reviewers per exam | Required before R1 content seeding |

## 15. Glossary

**Recall:** a candidate’s memory of an exam question. **Sitting/diet:** one real exam occasion (e.g. September 2026). **SBA/EMQ/MCQ:** single best answer / extended matching / multiple choice. **QBank:** question bank. **MEE:** Med Exam Expert. **GHL:** GoHighLevel. **Attempt Tag:** link between a question and a sitting it appeared in.
