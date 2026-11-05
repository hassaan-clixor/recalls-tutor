# Checkpoint 15 — Admin screens

4 November 2026, Asia/Karachi. GoHighLevel was dropped from scope at the user's direction (see decisions.md), and the admin screens took its place in the build order.

## Overview (ADM-1), `/studio/overview`

The first item in the Studio sidebar. Every staff role can open it.

- **Needs attention:** questions waiting for review, approved but unpublished questions, student reports, failed AI jobs. A Super Admin also sees scraping alerts and billing issues. Each line links to the screen that resolves it.
- **Students:** accounts, verified accounts, new accounts in 7 and 30 days, students active in the last 7 days, and a 14-day chart of new accounts.
- **Access:** paying students, free trials running, complimentary access, renewals due in 14 days, and past-due subscriptions.
- **Money (Super Admin only):**
  - monthly recurring income from plans that will renew;
  - the value of new plans in the last 30 days;
  - refunds in the last 30 days.

  These come from plan prices; Stripe has the collected totals.
- **Content:** published, waiting for review, approved but not published, AI jobs running.

## Students (ADM-3), `/studio/students`

Super Admin only, with two-step sign-in, the same rule as Billing.

- **Search** by name, email or the 8-character watermark ID. **Filters:** All, Paying, Trial, Complimentary, No access, Suspended. 50 per page.
- **A student's record:**
  - country and exam date;
  - questions opened in the last 24 hours;
  - open reports and alerts;
  - progress by exam and the last 10 sessions;
  - payments (plan, price, status, period end, auto-renew);
  - every access period and any trials.
- **Give or extend access:** complimentary days for an exam, with a required reason. Extra days start after the student's current access ends, so they are never lost.
- **Revoke:** complimentary grants only, with a reason. Paid plans are changed in Billing, so Stripe stays in step.
- **Send password reset:** the student gets the normal reset email. Staff never see or set a password.
- **Suspend or reinstate:** uses the existing content-protection rules (signed out everywhere, reason required).

## Team and audit log (ADM-4), `/studio/team`

Super Admin only.

- **Team:**
  - every staff account with its role and last action;
  - a warning for any Super Admin without two-step sign-in;
  - a role menu per person.

  You cannot change your own role. A role change signs the person out, so the new permissions apply from their next sign-in.
- **Add a team member:** enter the email of an existing, verified account and choose a role.
- **Audit log:**
  - the latest 100 entries, newest first, with an "Older entries" link;
  - filters for Questions, Papers, Access, Accounts, Billing and Reports;
  - each entry shows when, who and what, with a short summary, and opens to the full before and after.

Every action on these screens writes an audit entry.

## Checks

- Type check passed. 17 of 17 tests passed, including the new `tests/admin.test.ts`, which covers:
  - permissions for each role, and money hidden from non-Super Admins;
  - the overview counts;
  - search and filters;
  - an extension that starts after a paid period;
  - revoking complimentary access only;
  - reset auditing;
  - the role-change guards and ending sessions on a role change;
  - audit log order and filters.
- Production build succeeded.
- Browser check on the QA server as a Super Admin:
  - the student account was correctly refused on the Overview;
  - the Overview;
  - the student list and a student record;
  - granting, then revoking, complimentary access;
  - the team table and audit log;
  - no sideways scrolling at 375px.
- **Fixed during the check:**
  - the student record's two columns were too narrow; it is now one column below 1500px;
  - the team role menus were cut off; the table is now full width;
  - long emails made the student list scroll sideways;
  - empty days in the signup chart looked like solid blocks.
- **QA login:** a Super Admin with two-step sign-in was added to the local `studio-qa` database only. Its login is in `.local/studio-qa-superadmin.json`.
- `tsconfig.json` and `next-env.d.ts` were restored after the QA server ran.

## Not done

- **Revenue:** the app holds plan prices, not collected payments. Collected revenue and payouts stay in the Stripe dashboard.
- **Team invitations:** there is no email invitation. A new team member creates an account first, then a Super Admin assigns the role.
