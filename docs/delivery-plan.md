# Phase One — 14-day delivery plan

Start: 31 October 2026. Revised target: 8 November 2026, interpreting the user's 1 November request for completion next week as seven days. Official scope: content engine + MVP sales; first exam live with paid students. MRCOG Part 1 is the working launch assumption. All three exams must use the same configurable model.

The original day-by-day sequence below records the earlier 14-day estimate, not a feasible promise for the revised deadline. Current execution order: finish authentication verification; build and demonstrate the internal recall-to-reviewed-question workflow; implement practice; integrate Stripe/GHL; complete release checks. Do not declare Phase One complete while any required workflow remains missing. The new target has substantial schedule risk given current implementation status.

## Updated implementation priority — user direction

Build authentication, the internal AI Studio and student practice first. Stripe and GHL setup move to the late stage. The immediate internal acceptance flow is staff login → add/upload recalls → AI draft → human review/publish → authorised practice. Use explicitly granted internal/complimentary entitlements for testing; do not pretend payment has occurred or open paid content to every registered account. This changes implementation order, not the original paid-launch exit condition. The user selected Better Auth, and implementation has begun. The reported Supabase incident belonged to a different project and is not a Recalls Tutor constraint. Clerk is no longer the selected implementation.

## Day 1–2: foundation and access

Repository, catalogue, relational constraints, content lifecycle, deployment configuration. Then authentication, verified email, human roles, staff MFA, audited admin catalogue and question editor. Establish managed database and private storage. Collect prices, approved content, reviewers, Stripe and GHL access.

## Day 3–4: content engine

Private uploads and pasted recalls, extraction/sanitisation, durable job stages, structured AI drafts, confidence and reference checks, embeddings and dedupe proposals. Keep the worker unable to publish. Establish a reviewer-approved evaluation set. Track unresolved OCR and format scope explicitly.

## Day 5–6: review and papers

Side-by-side evidence review, edit/version, approve, reject, merge and separate publish. QBank filters, manual CSV/XLSX import and complete paper validation against configured blueprints. Test preservation of old attempt versions.

## Day 7–8: practice and trial

One-question delivery, revision feedback, timed exam mode with server deadline, navigator/flags/autosubmit, results, trial pool/time/question cap, bookmarks, notes, confidence, mistakes deck and high-yield/latest-diet shortcuts. Test mobile flows and unpaid/draft access denial.

## Day 9–10: billing and lifecycle

Stripe test-mode subscriptions, verified/idempotent/out-of-order webhooks, entitlements, cancellation, upgrade/downgrade, refunds/disputes, grace period and renewal messages. GHL transactional outbox, consent-aware mapping, retries and sync logs. No access granted by checkout return alone.

## Day 11–12: public launch experience

Canonical exam family/exam/sitting pages, pricing and trial entry, metadata/schema/sitemap, policy pages and consent-aware tracking. Dashboard and My Plans. Verify accessibility, content protection, session controls, private images and mobile signup-to-practice path.

## Day 13–14: acceptance and launch

Run official acceptance scenarios, Stripe failure/retry clocks, AI sample review, no paid-content leakage, rate limits, backup restore, error monitoring, performance and browser checks. Named reviewer approves content. Deploy to staging then production only when release gates pass. Record remaining failures rather than relabelling them complete.

## Current checkpoint

Done and tested: foundation/catalogue, Better Auth with staff MFA, the manual Recall Studio, and student practice (Revision and Exam Mode). Not complete: AI refinement, taxonomy and papers, trials, billing, GHL, full SEO and production deployment. See checkpoint-03.md. See ERD-report.md for assumptions and implementation boundaries.

## Release gates

- A 50-message recall export becomes reviewed drafts with verifiable references; duplicates gain sitting links.
- No AI publication or student access to drafts, answers before allowed feedback, or another student's records.
- Signup → verified purchase → practice works on mobile in under three minutes.
- All subscription durations, cancellation, renewal failure and seven-day grace verified in test mode.
- Exam timer, navigator, flagging and auto-submit; Revision Mode instant feedback.
- Published sitting pages enter sitemap with valid offers; paid stems absent from public HTML.
- ~~Outbound GHL catches up after an outage without delaying signup/payment/practice.~~ Dropped on 4 November 2026: the team will not use GHL (see decisions.md).
- Approved question inventory, prices, policy, service ownership and reviewers recorded.
