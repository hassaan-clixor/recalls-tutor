# Checkpoint 11 — Content Studio redesign

2 November 2026, Asia/Karachi. Screens:
- Questions (the queue and the question editor);
- Papers;
- Exam catalogue;
- Website;
- Billing;
- Content protection.

## What changed

- **Shared shell.** The Studio now uses the same app shell as the student practice screens (`StudioShell` in `components/studio/nav.tsx`), replacing the old "← Dashboard" link, the 64px header and the tab bar.
  - **Sidebar groups:**
    - Content Studio: Questions, Papers, Exam catalogue, Website;
    - Administration (Super Admin only): Billing, Content protection;
    - Student view: Practice, Account security.
  - The user and their role sit at the foot of the sidebar, with Sign out.
  - On phones the sidebar folds into the same 48px bar and Menu sheet.
  - The public header and footer are hidden on `/studio`.
- **Each screen has an app-sized title with one line under it.** The Questions page states what is waiting: "Nothing waiting for review · 3 published. Claude drafts; nothing reaches students until a person approves and publishes it."
- **List and editor layout:**
  - the queue or paper list sits in a tinted side panel, with each item as a rounded card and the open item outlined;
  - the editor sits on a white panel;
  - catalogue, website, billing and protection sections are rounded white panels in two columns.
- **Controls** match practice: 8px fields and buttons in the forest accent, grey secondary buttons, pill status tags and option letters in small tiles. AI job states show as coloured dots, replacing the ✓ and ! characters.
- **Headings:**
  - the small uppercase labels are gone, including the numbered "01 / Source evidence", "02 / Editorial draft" and "03 / Human review";
  - each section now has a plain heading: Source evidence, Editorial draft, Human review, Ask Claude for a better draft, Topic and sittings;
  - the exam and question type move to a line under the heading.
- **Small fixes:**
  - "optional" hints sit on the same line as their label, so inputs in a row line up;
  - queue cards read "Published · v2" and "3 questions · 3 min", where every word used to be capitalised;
  - the leak-trace field's hint no longer uses a sample address.

## Inspector results (taste-skill `--app`)

0 FAIL on every Studio screen measured:
- Questions (empty, and with a question open);
- Papers (empty, and with a paper open);
- Exam catalogue;
- Website.

Billing and Content protection were measured only as the "Super Admin access required" screen. No Super Admin login is stored locally, and those pages use the same panels as the catalogue.

The linter went from 1 FAIL to 0 FAIL.

**Warnings kept:**
- **Cream ground:** it is the brand colour.
- **Panels of uneven height:** the editor is long, and the list beside it is not.
- **"unlock":** it is the papers' real lock and unlock action.

## Checks

- Type check passed.
- 15 of 15 tests passed.
- The production build succeeded.
- `tsconfig.json` and `next-env.d.ts` were restored after the QA server.
