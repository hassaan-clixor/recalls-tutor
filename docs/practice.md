# Student practice — Revision and Exam Mode

Implemented 1 November 2026. Open `/practice` from the dashboard with a verified account that has access to an exam.

## Getting access for testing

There is no checkout or trial yet. A Super Admin (with two-factor enabled) opens `/studio`, expands **Grant practice access**, and enters a verified account's email, the exam and a number of days. This creates a complimentary entitlement and an audit record. It is internal access, not a payment.

## What works

- **Start a session:** choose exam, mode, question source (all published, not yet answered, or mistakes deck) and count (1–100). Questions are drawn at random from published questions only.
- **Revision Mode:** answer, optionally tag confidence (sure / unsure / guess), then see the correct answer, explanation, references and how other students answered. Answers lock once checked.
- **Exam Mode:** timed at the real exam pace, with a navigator, flags and answers you can change until you submit. Feedback is hidden until submission. When time runs out the session submits automatically, and the server rejects late answers.
- **Results:** score, pass/fail against the pass mark when one is configured, time per question, and a review list that links back to each question with feedback.
- **Mistakes deck:** every wrong answer joins it and leaves after two correct answers.
- **Question tools:** strike-through options; keyboard shortcuts (A–E or 1–5 choose, N next, P previous, F flag); a faint watermark with the student's email and account ID; text selection disabled; practice pages hidden from print.

## Configuring Exam Mode

Exam Mode stays unavailable until a content manager enters the real paper size and duration in **Studio → Exam catalogue**. The pass mark is optional. Nothing is assumed.

## Added 2 November

- **Filters and shortcuts:** filters by topic, sitting, difficulty, high-yield and latest sitting, plus High-yield sprint and Latest-diet pack shortcuts.
- **Feedback and results:** "Seen in" chips with High-yield and New-this-sitting badges, key notes, and a topic breakdown in results.
- **Paper library:** grouped by sitting. Papers are sat in Exam Mode with their own time limit.
- **Free trial:** turned on per exam by a Super Admin. Questions come from sittings marked "in trial pool", with a server-side question cap and one mini mock. See checkpoint-05.md.

## Not yet implemented

Bookmarks, personal notes, error reports, the reference/lab-values drawer, image zoom, swipe gestures, dashboard progress and countdown, exam switcher, pause, per-user rate limits and scraping alerts (`PROT-2`), and PWA install.
