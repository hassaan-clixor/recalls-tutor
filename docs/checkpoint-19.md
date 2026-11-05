# Checkpoint 19: Phase 2 complete, most of Phase 3, deployment ready

5 November 2026, Asia/Karachi. Goal: ship by 7 November; deployment waits only on the CEO's accounts and keys (see [deployment.md](deployment.md)).

## Phase 2 (R2): done

| PRD | What was built |
|---|---|
| BILL-6 | Coupons in Studio → Billing → Coupons. Each coupon is created in Stripe as a coupon plus a promotion code and can be limited by exam, number of uses, end date, or first purchase only. Links like `?code=SPRING25` apply a code, and students can also type it at Stripe checkout. Revenue report (Billing → Revenue) by day or month, exam, sitting page, new vs renewal and coupon, with refunds and disputes, plus a CSV export (formula-safe, audited). |
| BILL-7 | Receipts, a renewal reminder 7 days before, payment-failed notices, and a 20% win-back code 14 days after a plan ends. |
| TRIAL-2 | Trial emails on day 2 and day 3; a trial-only code in the last 48 hours (off until a Super Admin sets the discount); one trial per exam per device (a hashed first-party cookie); progress carries over. |
| PP-1..4 | Pass Predictor (Practice → Pass Predictor): unlocks after one complete timed paper and 300 answers. Shows the band against the pass mark, the predicted range, a 4-week trend, the top 3 topics by gain per hour, and the daily target to reach "Likely". The working is shown, with the disclaimer. Asks "Did you pass?" after the exam date; accuracy appears in the Studio overview from 200 answers. |
| STU-13 | Spaced repetition at 1, 3, 7 and 14 days (a review deck and review sessions), a weekly study plan, a streak, and a download of the student's own notes. |
| QB-6 | "Propose papers per sitting": one draft paper per published sitting, balanced across topics to the blueprint count. |
| ADM-6 / AIS-12 | Claude drafts a fix for a student's error report, and new evidence for a published question becomes a proposed edit. Staff compare before and after, edit if needed, and accept (a new version) or dismiss. |
| AIS-13 / AIS-14 | AI cost per job, draft and refinement, with a monthly budget alert. Sittings named in uploads are proposed for an admin to confirm. |
| SEO-2 | Topic pages, free sample-question pages with Quiz schema (staff choose up to 5 per topic), and a blog with Article schema, including draft "What came up" reports built from catalogue figures. All are in the sitemap. |

## Phase 3 (R3): built

- **STU-12 percentiles:** on paper results, once 30 or more other students have sat the paper.
- **BILL-8 monthly plan:** an optional 1-month price beside 3, 6 and 12 months.
- **More exam families:** a Super Admin adds families and exams in the catalogue. They start as planned, with nothing for sale.
- **Referrals:** each student gets a link (`/r/{code}`). A friend's first payment can earn the referrer a single-use code; this stays off until a Super Admin sets the reward.
- **STU-14 AI tutor:** after feedback, grounded only in the approved explanation and key notes. Limited to 10 questions an hour and 40 a day; student text is removed after 30 days.
- **STU-15 discussion:** anonymous comments, shown only after staff approve them; contact details and group links are refused.
- **White-label:** partner display name, logo and colour on its invite pages. A colour too light for white text is refused.

## Phase 3: not built

- **Bundles:** they change how one payment maps to access across several exams, and need prices from the business.
- **Subscription pause and Stripe Tax:** both need business and tax decisions.
- **Web push:** needs push keys and an added dependency.
- **SSO (OIDC/SAML):** needs a partner's identity provider to build against.

## Deployment readiness

- **Vercel build:** `vercel-build` runs migrations on production deploys only. `vercel.json` schedules the three cron routes.
- **Database:** pooled Postgres is supported (no prepared statements through a pooler).
- **Claude:** server-side Claude API through the official SDK whenever `ANTHROPIC_API_KEY` is set. AI routes get longer time limits.
- **Readiness checks:** `pnpm readiness`, and `/api/health` with the cron secret. They list every required setting and never print secrets.
- **Runbook:** [deployment.md](deployment.md) lists what is needed from the CEO, the environment variables, the first-deploy steps, the Stripe webhook events and a smoke test.

## Checks

- Type check passes; 31 of 31 test files pass; production build succeeds.
- Migrations 013–019 are applied to the QA and demo databases.
- Checked on the QA preview:
  - Studio overview (AI usage, predictor accuracy), questions (proposed edits, comments to moderate), website (blog), papers, catalogue (add exam), coupons, partner detail (white-label);
  - the student's study plan, Pass Predictor, profile (invite link, offer emails), and a question with the tutor and discussion;
  - the blog, exam page, sitemap and offer opt-out page.
- Fixed during the check:
  - the study plan repeated the same new question every day;
  - the AI cost note claimed a per-draft display that does not exist.
- The QA database has 4 synthetic payments (`in_qa_test_*`) and a coupon `QA-SPRING25`, both labelled as tests.
