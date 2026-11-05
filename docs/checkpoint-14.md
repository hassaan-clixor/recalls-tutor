# Checkpoint 14 — P0 student and account features

4 November 2026, Asia/Karachi. This checkpoint closes the P0 (must-have) student and account gaps found when the PRD was checked against the code.

## Student practice

- **Bookmark (STU-5):** a Bookmark button in the question bar, with the B key as a shortcut. A bookmark belongs to the student and the question, so it carries over to every later session.
- **Personal note (STU-5):** shown under the explanation once feedback is visible. Only the student sees it, up to 2,000 characters, and it comes back whenever the question does. The note field is exempt from the question's copy protection.
- **Report an error (STU-5):** the student picks a reason (wrong answer, unclear, spelling, out of date, other) and can add details. The report records the exact version the student saw. Each student and question has at most one open report; reporting again updates it.
- **Filters (STU-1):** the custom session has two new focus options, "Bookmarked by me" and "Flagged for review". A question counts as flagged when it was flagged in the most recent session that included it.
- **Study plan on the practice home (STU-6):** a strip under the next step with three parts:
  - a countdown to the exam date;
  - questions answered today, against the daily target, counted in the student's timezone;
  - the three weakest topics, each with a one-tap 10-question practice set.
- **Option percentages after answering (STU-1)** were already in place and are unchanged.

## Account

- **Profile page (AUTH-2)** at `/account/profile`, added to the sidebar and the phone tab bar (now five tabs). It holds:
  - name and country;
  - exams of interest;
  - exam date;
  - daily target;
  - timezone, defaulting to the browser's own.
- **Change email (AUTH-3):** Better Auth's change-email flow. The new address takes effect only after the student opens the link sent to it.
- **Download your data (AUTH-3):** `/account/export` returns a JSON file with:
  - the account and profile;
  - access, subscriptions and trials;
  - every session and answer;
  - notes, bookmarks and reports.

  Question content is not included.
- **Delete account (AUTH-3):** the student confirms by typing their email.
  - **What is erased:** name, email, profile, notes and bookmarks. The account is anonymised in place, every sign-in method and session is removed, and the account can no longer sign in.
  - **What is kept:** payment and access records, without the person's details, for accounting and refunds.
  - **When it is refused:** while a plan would still renew. The student must turn off auto-renew first, so they are never charged after deletion.
  - **Staff accounts:** cannot delete themselves.
- **Google sign-in (AUTH-1):** a "Continue with Google" button on sign-in and sign-up. It appears only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set (documented in `.env.example`). It is not switched on yet, because it needs a Google OAuth client.

## Content Studio

- A **Student reports** list in the Questions sidebar, newest first, with the report's question listed first when that question is open. Each report shows:
  - the reason and the student's details;
  - the version the student saw and the current version;
  - "Mark fixed" and "Dismiss" buttons, and each outcome is written to the audit log.
- Queue cards show "· N reported", and the page summary counts open reports.

## Install on phones (STU-16)

- `app/manifest.ts`: the app installs from a phone browser and opens on the practice home.
- Generated 192 and 512px icons at `/icons/192` and `/icons/512`, also usable as maskable.
- A teal theme colour.
- A favicon (`app/icon.svg`); the old `/favicon.ico` request returned 404.

## Database

Migration `010_student.sql` adds:
- `question_bookmarks`, `question_notes` and `question_reports`;
- `student_profiles`;
- a `deleted` account status.

A deleted account is blocked at sign-in by the same hook that blocks suspended ones. The demo and QA databases are migrated.

## Checks

- Type check passed.
- 16 of 16 tests passed, including the new `tests/student.test.ts`. It covers:
  - ownership of bookmarks, notes and reports;
  - the two new filters;
  - report de-duplication and staff-only access;
  - profile validation and the study plan;
  - an export that contains no question content;
  - deletion guards and anonymisation.
- Production build succeeded.
- Browser check on the QA server at 1366px and on a phone (375px):
  - practice home with the countdown and daily target;
  - profile save;
  - question screen with Bookmark, the note and the report form;
  - the five-tab phone bar;
  - the manifest, icon and export responses.
- `tsconfig.json` and `next-env.d.ts` were restored after the QA server ran.

## Not done

- Google sign-in needs a Google OAuth client before it can be switched on.
- Email changes and verification links need Resend keys in production. Locally, messages are written to `.local/mail`.
- Error reports from students were not sent in the browser check; the test covers sending and closing them.
