# Checkpoint 04 — Recall AI Studio with Claude

1 November 2026, Asia/Karachi.

## Delivered

- Migration 005: `studio_jobs` (cleaned source, status, error, draft count, model, cost); recall sources linked to jobs; `key_notes` and `ai_meta` on question versions; a new `rejected` status.
- Claude adapter (`lib/integrations/llm/claude-cli.ts`): the local Claude Code CLI in headless mode on the user's Claude login. There is no API key, and the CLI runs without tools, MCP, settings or saved sessions. Output must match a JSON schema.
- Pipeline (`lib/services/ai-studio.ts`): PII removal, idempotent jobs, background run through each status, structured drafts, validation, server-derived "needs expert" and reference flags, word-overlap duplicate flags, failure reasons and retry, and "Refine with Claude" with reviewer instructions. The pipeline can only create `ai_refined` drafts.
- Studio UI: upload panel (file or paste), live job list, an AI details panel on each draft (confidence, flags, issues, model), a key-notes field, Refine with Claude, Reject, and the review queue sorted by lowest confidence first.
- Demo kit: `scripts/demo-setup.ts` (separate `.local/demo` database with content manager, reviewer and student accounts), the `demo` preview config, `docs/demo/sample-whatsapp-recalls.txt`, and `docs/ai-studio.md`.

## Verification

- 8 of 8 automated tests pass on Node 24.22.1. The new AI Studio test uses a stand-in model, so it never calls Claude. It covers:
  - redaction of names, phones, emails, mentions, links and media lines, while clinical values (Hb 98 g/L, BP 140/90) stay;
  - staff-only, idempotent jobs, with only cleaned text sent and the evidence wrapped as untrusted input;
  - validation discarding a bad draft, and confidence, candidate-claim and reference flags;
  - the queue order, the explanation including distractor reasons, and that AI drafts cannot be published directly;
  - failure reasons and manager-only retry, duplicate flags, "no recalls found", and reject with a reason;
  - refine with instructions creating a new version, stale-version protection, AI history kept after human edits, and the full publish path.
- Type check passes. The production build passes with no warnings, after fixing two whole-project tracing warnings.
- In the browser (QA database, synthetic text), the upload panel, background job and live job list work. Without a Claude login, the job failed with the exact reason and a Retry button.
- The adapter was run against the real bundled CLI (2.1.309). It found the binary and correctly reported "not signed in".

## Not verified

- **No real Claude drafting has run yet**, because the CLI on this computer is not signed in. Run `claude auth login` once (see `ai-studio.md`), then retry the job or upload again. Draft quality, timing and the structured-output format from the real CLI are still unconfirmed.
- Medical accuracy of AI drafts: they must go through named reviewers before anything is published to real students.

## Next

Sign the CLI in and run the demo end to end. Then: approved source lists and style profiles per exam, sitting and topic tagging, PDF and Word upload, and a server-side model connection for hosting.
