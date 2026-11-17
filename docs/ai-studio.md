# Recall AI Studio — Claude drafting (MVP)

Implemented 1 November 2026. Claude drafts questions; people review, approve and publish them. Nothing the AI produces reaches students without that human path.

## How Claude is connected

The app runs the **Claude Code CLI** on this computer in headless mode, using your Claude account login. No API key is used or stored, and any `ANTHROPIC_*` variables are removed before the CLI starts. The CLI runs with **no tools, no MCP servers, no settings and no saved session**, so uploaded text cannot make it take any action. It can only return a JSON draft.

- The binary is found automatically from the Claude desktop app install. Override it with `CLAUDE_CLI_PATH`.
- The model defaults to `sonnet`. Override it with `RECALLS_CLAUDE_MODEL` (for example `opus`).
- **One-time setup:** sign the CLI in. Run this once in a terminal, then sign in with your Claude account in the browser:

```bash
"C:\Users\A.H\AppData\Roaming\Claude\claude-code\2.1.309\9078b9c1d466\claude.exe" auth login
```

This suits a demo or a single-operator MVP on this machine. A hosted deployment needs a server-side model connection, which is a later decision.

## The pipeline

1. **Upload:** a content manager chooses the exam and uploads a `.txt` chat export, a PDF with selectable text, a Word `.docx`, or a `.csv`, `.tsv` or `.md` file (up to 2 MB), or pastes text. An optional source label and sitting can be added; the drafts are tagged with that sitting. Claude chooses each draft's topic from the exam's topic list, and any new topic it suggests is recorded as a proposal.
2. **Clean (AIS-9):** before anything is stored or sent to Claude, sender names become "Participant N". Names mentioned in messages, phone numbers, emails, @mentions and links are removed, along with "media omitted" and "message deleted" lines. Only the cleaned text is kept.
3. **Job (AIS-3):** the job runs in the background, moving from Queued through Extracting, Refining and Deduping to Ready, and the Studio updates live. A failed job shows the reason and a Retry button. A job stuck for 10 minutes can also be retried.
4. **Draft (AIS-4, AIS-5):** Claude splits the source into distinct recalls (up to 12 per job) and writes one five-option SBA per recall. Each draft has:
   - the answer and an explanation, including why each distractor is wrong;
   - 3–5 key notes, references, topic and difficulty;
   - a 0–100 confidence score, a list of issues, and the excerpt of evidence it used.

   Output that fails the schema or the validation checks is discarded and noted on the draft.
5. **Flags (AIS-7, AIS-8):** the server, not the model, marks a draft "needs expert" when:
   - confidence is below the exam's threshold (default 80);
   - the answer rests only on candidates' claims;
   - the model asked for it.

   Every reference not on the exam's approved source list (`exams.settings.approvedSources`) is flagged for verification. No exam has a list configured yet, so every reference is flagged.
6. **Duplicates (AIS-11, simplified):** each draft is compared by word overlap with the exam's bank and the rest of the batch. A likely duplicate is flagged with a link to the existing question. Nothing is merged automatically.
7. **Review (REV-1, REV-3):** drafts arrive as "ai refined", with lowest confidence first in the queue. A reviewer can edit (each edit creates a new version, with the AI history kept), ask Claude to refine with instructions, reject with a reason, or submit for review. Approval and publication are unchanged: approve needs the verification checkbox, and only a content manager can publish.

Every AI action is in the audit log (`ai_job.created`, `ai.draft_created`, `ai.refined`), along with each job's cost as reported by the CLI.

## Running the meeting demo

1. Sign the CLI in (above).
2. Start the **demo** preview, or run `next dev` on port 3000 with `RECALLS_LOCAL_DB=.local/demo`. It uses a separate demo database, so your normal one is untouched.
3. Sign in as the demo content manager. Credentials are in `.local/demo-credentials.json`, which git ignores.
4. Studio → **Upload recalls** → upload `docs/demo/sample-whatsapp-recalls.txt`. This synthetic chat contains fake names and numbers (to show redaction), chat noise, a duplicate recall, and a planted "ignore all previous instructions" message (to show it is ignored).
5. Watch the job progress (usually 30–90 seconds), then open the drafts. Show the confidence, flags and issues, edit one, use **Refine with Claude**, reject the duplicate, then approve and publish one.
6. Sign in as the demo student and practise the published question at `/practice` (the student already has 30-day complimentary access to MRCOG Part 1).

To reset the demo, stop the server, delete `.local/demo` and `.local/demo-credentials.json`, then run `RECALLS_LOCAL_DB=.local/demo tsx scripts/demo-setup.ts`.

## Not in this MVP

Excel, images and OCR for scanned PDFs; zip exports; batches over 2 MB; embedding-based dedupe with automatic merging and Attempt Tags; a durable job queue (a job interrupted by a server restart shows as stalled and must be retried); an editor for the exam style profile; cost alerts; and a gold-set evaluation. Name removal only catches names that appear as chat senders or @mentions.

## Large uploads (up to 500 MB per batch) — added 17 November 2026

Studio → "Upload a large batch" sends files **straight from the browser to private object storage** with short-lived signed URLs, so no web function has to hold a large request body (the older 4 MB form stays for quick uploads and pasted text). The panel only appears when the `STORAGE_*` variables are set in production; locally it uses `.local/uploads` through a signed development route.

- **Limits:** 500 MB and 200 files per batch; documents (PDF, DOCX, XLSX, ZIP, text) up to 100 MB each, images up to 25 MB each. Each file is processed on its own, so memory use depends on the largest single file. Extraction has its own limits (ZIP/DOCX/XLSX contents 20 MB after decompression; a scanned PDF is capped at 20 pages); a file that exceeds them fails with a clear message and the rest of the batch continues.
- **Flow:** begin batch (server checks types, sizes, permission; idempotent by request id) → browser uploads three files at a time with three tries each → server confirms the stored size → batch is queued → the studio cron route (`/api/cron/studio`) extracts one file at a time (OCR for scans, text splitting for long text) and creates sanitised AI jobs; the first file starts immediately after the upload.
- **Nothing is silently dropped:** long text is split into jobs with every part kept; a file that cannot be read is listed as failed with its reason and a Retry button; an AI job that hit the 12-draft cap, or had drafts fail validation, shows a warning telling the reviewer to re-upload the source in smaller parts.
- **Retention:** the raw file stays in private storage only until it has been processed, then it is deleted. Failed files are kept for retry for up to 7 days, and abandoned partial uploads expire after 24 hours. Raw files may contain personal identifiers until deleted; text is cleaned before it is stored in a job or sent to a model. The storage bucket must be private, with CORS allowing `PUT` from the site origin. Deletion and retention need approval by the company's privacy counsel.
- **Not verified:** a real S3-compatible bucket (signing is tested against the AWS published example), browser uploads of 100 MB files on slow connections (single `PUT` per file, no resume within a file), the 300-second Vercel limit on very large batches (the cron processes files for about 150 seconds per run, so a 500 MB batch can take several runs), and load testing.
