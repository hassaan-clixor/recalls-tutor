# Checkpoint 03 — student practice engine

1 November 2026, Asia/Karachi. Phase One target: 8 November 2026.

## Delivered

- Migration 004: practice attempts and items. Each item pins the published question version delivered, so later edits never change what a student answered.
- Practice service: access derived only from entitlements (subscription, partner or complimentary; trials rejected until the trial service exists), idempotent session start, one question body per request, server-side scoring, Revision and Exam Mode, flags, confidence tags, mistakes deck, results and withdrawal of retired questions.
- Exam Mode: time limit taken from exam configuration (never hard-coded), authoritative server deadline with a 2-second grace, automatic submission at expiry, answers changeable until submission, feedback hidden until then.
- Student screens at `/practice`, `/practice/[attemptId]` and `/practice/[attemptId]/results`: navigator, countdown timer, strike-through options, keyboard shortcuts, answer distribution, explanation and references after answering, watermark with the student's email and ID, selection disabled and print hidden.
- Super Admin complimentary-access form in the Studio (MFA required, audited, not a payment). The dashboard now links to practice.
- Auth hardening: the CSRF origin check is now explicitly on in every environment. Better Auth previously disabled it whenever `NODE_ENV=test`.
- Docs: `practice.md`, decisions entry and README status.

## Verification

- 7 of 7 automated tests pass on Node 24.22.1 (`tsx --test`) and on Bun 1.4.3. The new practice test covers the entitlement gate (including trial rejection and Super Admin-only grants), that no draft is delivered, no feedback before answering, cross-account denial, locked revision answers, the distribution, revision scoring, mistakes-deck entry and exit after two correct answers, Exam Mode configuration, hidden feedback, changeable answers, the server deadline, pass mark, and exclusion of withdrawn questions.
- TypeScript check passed. Production build passed with all practice routes.
- Browser QA against the isolated `.local/studio-qa` database with synthetic, non-clinical questions on a local preview (port 3001): sign-in, practice start, Revision feedback, timed Exam auto-save, flagging, submission and results, and the 360px layout (no horizontal scroll). QA found and fixed unlabelled option radios, a results separator, the pass-mark wording and the mobile navigator position.

## Not verified or not done

- Update: the port-3000 dev server was stopped with the user's approval, and `.local/database` is migrated through 004 (3 exams, 0 questions). The dev server has not been restarted.
- No exam has Exam Mode timing or a pass mark configured. The real values must come from the content team.
- `PROT-2` rate limits and scraping alerts, trials, tagging-based filters, "Seen in" chips, topic breakdown, bookmarks, notes, error reports, papers and the paper library, dashboard progress and the exam switcher are not implemented. See `practice.md`.
- Screen-reader and cross-browser checks were not performed beyond the accessibility tree.
- In the hidden browser pane, React's streaming swap left the loading shell in the DOM alongside the content. This is believed to be an artefact of the hidden pane (no animation frames) and has not been reproduced in a visible browser.

## Next

AI refinement in the Studio (needs an AI provider decision and an API key), then taxonomy and sitting tags, which enable practice filters and "Seen in" chips, then trials, Stripe and GHL.
