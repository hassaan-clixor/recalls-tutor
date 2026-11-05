# Checkpoint 16 — Lighthouse, share images and student analytics

4 November 2026, Asia/Karachi.

## Lighthouse (PRD release gate: mobile ≥ 90 for performance and SEO on exam and sitting pages)

**Method.** Lighthouse 12.6.0 ran against a production build (`next start`) with QA data, in mobile mode. Each figure is the median of 3 runs. The pages measured were MRCOG Part 1, AMC Part 1, and the September 2026 and March 2025 sittings.

| Run | Performance | SEO | Accessibility | Best practices |
|---|---|---|---|---|
| Default 4× CPU slowdown | 79–81 | 100 | 100 | 100 |
| CPU-calibrated 2× slowdown | **92 on all four** | **100** | — | — |

- **Why two runs.** Lighthouse flagged this PC as slower than its baseline: benchmark index 734, about half the speed Lighthouse expects. Its default 4× slowdown therefore over-penalises the machine. The 2× run corrects for that.
- **The page is light.** It has 203 elements and weighs 247 KB in total. The remaining cost is the framework's own JavaScript start-up, plus Windows font matching in headless Chrome. Blocking web fonts made the first layout slower, so that cost comes from the host, not the page.
- **Tried and reverted.** Next's `inlineCss` roughly doubled total blocking time, because the CSS is also repeated in the page data. Removing `text-wrap`, the blur effects and the shadows made no measurable difference.
- **Final confirmation still needed.** The gate should be confirmed with PageSpeed Insights on the hosted staging site, since that runs on Google's reference hardware.
- **New flag `RECALLS_LOCAL_PRODUCTION_CHECK=1`.** It lets a local production build read the embedded database for measurement. It is never set on a deployed server, where `DATABASE_URL` stays required. The measurement server ran with:
  - `RECALLS_LOCAL_PRODUCTION_CHECK=1 RECALLS_LOCAL_DB=.local/studio-qa BETTER_AUTH_URL=https://127.0.0.1:3002 RESEND_API_KEY=local-measurement-only AUTH_EMAIL_FROM=local@example.test NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3002`
  - `next start --port 3002`

## Share images (SEO-5)

- **New design.** `components/seo/share-image.tsx` replaces the old green paper card. It uses:
  - the deep teal field of the page headers;
  - the mark and the "Recalls Tutor" name;
  - the exam family in mint;
  - the page title in white;
  - a footnote with the real counts;
  - a fragment of the practice screen.

  The fragment shows no question text or figures, so a shared link never shows paid content.
- **New default image.** `app/opengraph-image.tsx` covers the home page and every page without its own image.
- **Checked:** all three images (home, exam and sitting) render at 1200×630, and exam pages point their `og:image` tag at them.

## Student analytics (STU-11), `/practice/progress`

The page is reached from the "Progress" tab on Sessions and results and from the sidebar. On phones the Results tab stays highlighted. Every figure counts only answers whose feedback the student has seen; Exam Mode answers count after submission.

- **Readiness:**
  - accuracy over the last 100 answers, against the pass mark (shown only when one is configured);
  - the share of the bank tried;
  - a plain verdict: above, close to or below the pass mark;
  - "Answer N more questions" until 20 answers exist;
  - a one-tap practice set for the weakest topic.

  It is labelled as "a guide from your own answers, not a prediction of your exam result".
- **Score trend:**
  - correct answers per week for 12 weeks, as bars on a single teal hue;
  - empty weeks keep their place on the axis;
  - a dashed pass-mark line when the pass mark is set;
  - a hover label on each week and a table view.
- **Topics heatmap:** accuracy all time and in the last 30 days, on a single sequential teal ramp, with the number answered in each cell and a colour key.
- **High-yield questions against the rest:** two bars and one line of advice.
- **Time per question:** Revision and timed-exam averages against the real exam pace, when the exam timing is configured.

## Checks

- Type check passed.
- 18 of 18 tests passed. The new `tests/analytics.test.ts` covers:
  - the weekly buckets;
  - topic and high-yield splits;
  - that unsubmitted Exam Mode answers are excluded until submission;
  - pace against the configured exam pace;
  - readiness;
  - that another student's answers never appear.
- Production build succeeded.
- Browser check on the QA server at 1280px and 375px. Fixed during the check:
  - the bars were too wide;
  - the pass-mark label sat under the latest bar;
  - the chart labels were about 5 px on phones;
  - the y-axis labels were clipped;
  - the lightest heatmap swatch was invisible on white.
- `tsconfig.json` and `next-env.d.ts` were restored after the QA server ran.
