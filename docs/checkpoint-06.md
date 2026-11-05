# Checkpoint 06 — content protection

2 November 2026, Asia/Karachi.

## Delivered (PRD 8.12)

- **PROT-1 (already in place, rechecked):** questions are delivered one at a time through authenticated pages, only for published questions in the student's own session. There is no bulk endpoint.
- **PROT-2, hourly question budget:**
  - Every question shown to a student is logged. Each account may open a configurable number of **new** questions per rolling hour; re-opening one already seen is free.
  - Over the limit, the student sees a calm "short break" page with the wait time. Their session and answers are kept, and the question text is never sent.
- **PROT-2, scraping alerts:**
  - An alert is raised when an account hits the hourly limit, or when it opens questions far faster than anyone can read (a configurable count within a few minutes).
  - At most one alert of each kind per account per hour, so a scraper cannot flood the queue.
- **PROT-3 (already in place):** a watermark with the student's email and account ID on every question.
- **PROT-4 deterrents:** text selection, copying, cutting, right-click and dragging are blocked on the question, and practice pages print blank. Session and device limits (AUTH-4, P1) and signed image links (no images yet) are not built.
- **PROT-5 leak tracing and suspension:**
  - A Super Admin enters the email or the 8-character ID from a watermark and sees the account and its recent activity: views in 24 hours and 7 days, sessions, open alerts and last view.
  - **Suspend** requires a reason. It signs the account out everywhere at once, blocks sign-in with a clear message, and blocks practice and the Studio. **Reinstate** restores access. Super Admins cannot suspend themselves or another Super Admin.
  - Every action is in the audit log.
- **Protection screen** (Studio → Protection, Super Admin only): limit settings, open alerts with Resolve and Suspend, and the leak tracer.

Default limits are technical safety values, not business rules: **240 new questions per hour** (one every 15 seconds), and an alert above **60 new questions in 5 minutes** (one every 5 seconds). A Super Admin can change both.

## Verification

- 11 of 11 automated tests pass on Node 24.22.1. The new protection test covers:
  - defaults, Super Admin-only settings and validation;
  - the budget with free re-opens and a friendly wait time, that refused deliveries are not logged, the hour rolling over, and that other students are unaffected;
  - one alert of each kind, and resolving with a recorded decision;
  - tracing by watermark text, ID and email;
  - suspension rules, sign-out everywhere, sign-in blocked through real Better Auth sign-in, practice and Studio blocked, and reinstatement restoring sign-in;
  - audit entries.
- Type check and production build pass.
- Browser (QA database, synthetic content):
  - right-click, copy and text selection are blocked on the question;
  - with a temporary limit of 1, the second question showed the "short break" page and its text was not in the page. The QA limit was then reset.
- **Not clicked through in the browser:** the Protection screen itself, because it needs a Super Admin signed in with two-factor. It is covered by the automated test and compiles in the production build.

## Notes

Alerts appear in the Protection screen and the server log. Email or Slack notification needs an email provider, which is not set up yet. Question-view logs grow over time; a retention clean-up (for example, 90 days) should be scheduled before launch.
