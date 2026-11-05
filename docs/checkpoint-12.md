# Checkpoint 12 — Impeccable critique and refinement of the app screens

3 November 2026, Asia/Karachi. Scope:
- the student screens: practice home, session, results;
- Content Studio: questions, papers, catalogue, website, billing, protection.

The owner's brief: the UI looked "pretty simple" and "AI generated".

## Critique (impeccable `critique`, two independent reviewers)

- **Design review: 24/40 (Acceptable).**
  - **Verdict:** a category-interchangeable SaaS dashboard recoloured green.
  - **Why:** the app had dropped the public site's own vocabulary (ruled sections, square paper, a 3px forest rule, serif figures) for rounded "card soup". The old editorial rules survived only as dead CSS under an override layer.
  - **P1 issues:**
    - card soup with no hierarchy;
    - about 7 competing ways to start on the practice home;
    - the exam timer and actions scrolling away on phones, and no key to check an answer;
    - Studio publishing hidden in a dropdown, with the source evidence scrolling away from the draft.
  - **P2:** native browser `confirm()` at exam start and submit.
- **Detector:**
  - **Student source:** clean.
  - **Studio source:** 4 findings, all dead or overridden CSS rules, plus the deliberate Arial search-result preview.

The archive copy is in `.impeccable/critique/`.

## What changed

**One visual system, rewritten in place.**
- `app/practice/practice.css` and `app/studio/studio.css` are each a single layer now; the stacked override blocks are gone.
- **Sheets:** each screen has one sheet, white paper with the 3px forest rule. It holds what the screen is for:
  - the next step on the home page;
  - the question in a session;
  - the score on the results page;
  - the editor in the Studio.
- **Everything else:**
  - sections are ruled;
  - lists are hairline rows;
  - titles, figures, answer letters and the timer are in Georgia;
  - controls have a 3px radius;
  - the grey secondary buttons now use a palette tint.
- **Browser surfaces are themed:** text selection, caret, scrollbar and checkbox accent colour.
- **Removed:**
  - every inset shadow used as an outline;
  - the queue's side-tab;
  - the four-tile KPI row.

**Practice home: one path.**
- **The title is the exam.** The line under it gives access, progress and accuracy. The chatbot-style "Name, …" greeting is gone.
- **One "Next" sheet** picks the action, in this order:
  1. return to a running timed paper;
  2. continue an unfinished revision session (new);
  3. practise the mistakes deck;
  4. start;
  5. new questions;
  6. go round again.
- **"Other ways to practise"** is one ruled list: High-yield sprint, Latest-diet pack (it now names the sitting), each complete paper, and Custom session. The custom form is folded into that last row.
- **Sitting papers:** "Sit this paper" first shows an inline check ("the timer starts as soon as you begin and keeps running if you leave"). It replaces the browser's confirm box.
- **Sidebar:** the exam switcher only appears for students with more than one exam.

**Session.**
- The question bar (title, timer, Flag and Submit) is pinned, under the phone bar on phones, so the clock never scrolls away.
- **Enter checks the answer** in Revision Mode, and the key hint says so.
- **Submitting an exam** opens an inline check: "Submit with N of T answered? X unanswered count as wrong. Y still flagged." It offers "Keep working" or "Submit exam".
- The verdict ("Correct.") is set large in serif. Sitting badges are paper tags, and High-yield stays lime.

**Results.**
- A scorecard sheet with serif figures replaces the KPI tiles.
- Unanswered and withdrawn rows collapse into one "Not answered" cell instead of four dashes.

**Studio.**
- **Status pipeline:** the question heading shows Draft → In review → Approved → Published, with the current step filled and the version beside it.
- **Visible review steps:** the "Next action" dropdown is now buttons. The forward step is primary, Request changes is secondary, and Reject or Retire sits apart in red. Each opens its own check:
  - the verification checkbox;
  - the reason;
  - for Publish, a preview of the stem and options exactly as students will see them, with the answer marked.
- **Queue:** status filters with counts (All, Drafts, In review, Approved, Published, Closed). Status is shown in words with a colour per state.
- **Source evidence** stays in view beside the draft on wide screens.
- **Page summary:** the line under the title now counts approved-but-unpublished questions, and the repeated warning boilerplate is gone.
- **AI sign-in failure message:** now "Ask your administrator to connect Claude, then press Retry". It used to tell staff to run a terminal command. Jobs that failed before this change keep their stored message.

## Checks after the change

- **taste-skill inspector:** 0 FAIL on home, session, results, the Studio queue, question editor, paper and catalogue.
- **Warnings kept:**
  - the cream ground (brand);
  - "heavy borders" (the forest sheet rule and the section rules, which are the notebook device);
  - uneven column heights (driven by the data);
  - the watermark behind the question (content protection).
- **Lint:** 0 FAIL.
- **impeccable detector:** down from 4 findings to 1, the deliberate Arial search preview.
- **Code:**
  - the type check passed;
  - 15 of 15 tests passed;
  - the production build succeeded;
  - `tsconfig.json` and `next-env.d.ts` were restored.

## Not done (from the critique, lower priority)

- A dedicated session-history page. "Sessions and results" still links to the recent list.
- Stem snippets in the results review table.
- Saving tags with the main draft save. The tags panel still has its own button.
- Billing and Content protection were not checked as a Super Admin, because no Super Admin login is stored locally.
