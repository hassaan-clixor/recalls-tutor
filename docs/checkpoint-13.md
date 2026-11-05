# Checkpoint 13 — Sessions and results page

3 November 2026, Asia/Karachi. This closes the first "not done" item from checkpoint 12.

## What a student gets

A new page at `/practice/history`. "Sessions and results" in the sidebar now opens it; it used to jump to the recent list on the home page. The home page's "Recent sessions" panel also links to it ("All sessions").

- **Title line:** the exam, how many sessions, how many questions answered, and the percentage correct across finished sessions.
- **Filters:** All, Revision, Timed exams and In progress, each with its count. A student with sessions in more than one exam also gets an exam row ("All exams" plus each exam). Sessions in an exam whose access has ended stay visible.
- **One sheet holds the whole record,** newest first and ruled by month. Each row shows:
  - when the session started;
  - its name and mode. The name is the paper's title, or High-yield sprint, Latest-diet pack, Mistakes deck, New questions, Revision, Timed exam, or Mini mock for a trial;
  - answered of total;
  - time on the clock;
  - the result: the score in serif and, for a timed exam with a pass mark, "At or above pass mark" or "Below N%". An unfinished session shows "Continue" ("Return to paper" for a running exam) instead of a score.
- A finished row opens its results report, and an unfinished one opens the session.
- **Pages:** 25 sessions per page, with "Newer sessions" and "Older sessions".
- **On phones** the Answered and Time columns fold into the row's detail line.
- **Empty state:** "No sessions yet." with what to do first. A filter with no matches offers "Show all sessions".

## How it is scored

`listAttemptHistory` in `lib/services/practice.ts` scores each session the same way its results report does:
- withdrawn (retired) questions never count;
- in Revision Mode only answered questions count;
- in Exam Mode unanswered questions count as wrong.

A timed paper whose deadline has passed counts as finished even if it was never submitted. The query reads only the signed-in student's own sessions. New assertions in `tests/practice.test.ts` check the counts, the scores, the pass flag and the mode filter against the results report, and check that another student sees none of these sessions.

## Checks

- **Code:**
  - type check passed;
  - 15 of 15 tests passed, including the new history assertions inside the practice test;
  - production build succeeded (`/practice/history` is a dynamic route).
- **taste-skill inspector:** 0 FAIL on the filled page, the In progress filter and the empty state, at 1440, 768 and 390px. The two warnings kept are the brand's cream ground and the empty canvas below a short list.
- **Lint:** 0 FAIL.
- `tsconfig.json` and `next-env.d.ts` were restored after the QA server ran.
