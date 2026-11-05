# Checkpoint 10 — student practice redesign

2 November 2026, Asia/Karachi. Screens covered:
- the practice home;
- a live session;
- results;
- My plans;
- Account security;
- checkout confirmation;
- the staff dashboard.

## Direction

- **Dealt:** the app style "editorial greeting" (seed 1057596385), keeping the public site's colours and Georgia headings (`--keep palette,type`). No slots were redrawn.
- **Shell:** every signed-in student screen shares one shell, `components/practice/shell.tsx`.
  - **Sidebar:** the logo, an exam switcher, and Practice, Sessions and results, My plans and Account security. Staff also get Content Studio. The user row with Sign out sits at the foot.
  - **Phones:** a 48px bar with the screen title and a Menu sheet.
  - **Header and footer:** the public ones are hidden on these routes (`components/public/chrome.tsx`).
- **Each screen opens on one finding, in its heading:**
  - **Home:** for example "Practice, 1 question is waiting in your mistakes deck.", with the matching action beside it. In priority order the finding is: a live timed paper, mistakes, trial left, ready, new questions, all answered.
  - **Results:** "33% on your QA recall paper", then the pass mark or the weakest topic, and "Practise your mistakes" when there are any.
- **Home layout:**
  - 4 figures: reviewed questions, answered, accuracy and mistakes deck;
  - the session form beside "Your access";
  - coverage by sitting beside recent sessions;
  - complete papers and free trials.
- **Results layout:** 4 figures, bars by topic beside the "Next" panel, and the full review table.

## Fixed during QA

- **Sign-in forms (security):** all 8 sign-in and account forms now post. Before, a click on a page that had not loaded its scripts fell back to a GET and put the email and password in the address bar.
- **Contrast:** buttons built as links ("Start another session", "See plans") showed dark text on forest green, because a link colour rule outranked the button style.
- **Phone menu:** its items sat 10px from the screen edge. They now sit inside the 16px margin.
- **Strike-out control:** the ✕ character is now a drawn icon. The session's top label moved under the heading, and the "of N" in "Question 1 of N" is now set in the heading's own serif.
- **Results:** "Untagged" is listed after the real topics.

## Inspector results (taste-skill `--app`)

Measured on server-rendered snapshots of the QA account's pages.

| Screen | Before | After |
| --- | --- | --- |
| Practice home | 1 FAIL | 0 FAIL, 2 WARN |
| Results | 2 FAIL | 0 FAIL, 2 WARN |
| My plans | 2 FAIL | 0 FAIL, 2 WARN |
| Account security | 1 FAIL | 0 FAIL, 3 WARN |
| Session | not measured | 0 FAIL, 3 WARN |

The linter (`lint.mjs --app`) went from 1 FAIL to 0 FAIL, 3 WARN.

**Warnings kept on purpose:**
- **Cream ground:** it is the brand colour shared with the public site.
- **Panels of uneven height:** heights follow the student's own data, and the QA account has only 3 questions.
- **Empty space:** My plans and Account security have little content.
- **Zero-padded seconds:** they are in the timers.

## Checks

- Type check passed.
- 15 of 15 tests passed.
- The production build succeeded.
- `tsconfig.json` and `next-env.d.ts` are back to their normal form after the QA server.
