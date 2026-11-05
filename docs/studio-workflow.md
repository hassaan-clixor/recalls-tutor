# Internal Recall Studio — manual editorial workflow

Implemented 1 November 2026. Open `/studio` after signing in with an authorised staff account. Student accounts cannot read the question queue or source evidence. Super Admin accounts must enable two-factor authentication first.

## What works in this milestone

1. A content manager or Super Admin selects an exam and pastes recall text with a source label. The original evidence is stored privately and a blank draft is created. Retrying the same intake request does not create another question.
2. A reviewer edits the stem, five SBA options, correct answer, explanation and references. Partial drafts can be saved. Each save creates an immutable version and returns the question to draft status.
3. A complete draft can be submitted for review. The reviewer confirms the answer, explanation and references before approving. Changes can be requested with a note.
4. A content manager or Super Admin publishes the approved version. Reviewers cannot publish. A published question becomes eligible for student delivery, but the practice engine is not yet implemented. Public catalogue pages expose only its count, never its text or source.
5. A manager can retire the question. Published and retired versions are read-only in this milestone.

Version checks reject stale edits and review actions. Every write records an audit event in the same transaction. The queue shows the latest 100 intake records. Source text is displayed as plain text; it is never interpreted as instructions or sent to an AI service.

## Current limits

This is the manual content workflow, not the completed AI Studio. File uploads/OCR, AI refinement, automated PII removal, semantic deduplication, taxonomy and sitting tagging, paper building, rich text, historical-version content viewer and student practice are still pending. The editor supports five-option SBA only. Remove personal identifiers before pasting. References are checked by the human reviewer; the application does not yet verify their accuracy.

## First administrator

Create an account and verify its email first. Development verification messages are saved to ignored `.local/mail`; there is no public mailbox endpoint. Stop the local preview before running the one-time operator command `pnpm exec tsx scripts/bootstrap-admin.ts <verified-email>`. Restart the preview, sign in, and enable two-factor authentication under Account security. This command refuses to create another initial administrator once one exists. Production email delivery and hosted database configuration remain required before launch.

## QA isolation

`RECALLS_LOCAL_DB` selects an alternative embedded database only when DATABASE_URL is absent in development. Browser QA uses `.local/studio-qa` with synthetic nonclinical content. It does not use the normal `.local/database` catalogue. Production still requires DATABASE_URL.
