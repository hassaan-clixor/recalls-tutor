# Checkpoint 17 — OCR for scanned uploads (Phase 2, first item)

5 November 2026, Asia/Karachi.

## What staff can upload now

Content Studio → Upload recalls takes up to 10 files at once, 4 MB in total:
- **Text, read directly as before:** chat exports (.txt), PDFs with text, Word (.docx), CSV and Markdown.
- **New, read by OCR:** scanned PDFs (any PDF without selectable text), photos and screenshots (PNG, JPG, WebP, GIF).
- **HEIC (iPhone photos):** refused, with advice to share the photo as JPG.
- **Renamed files:** caught by their file signature before anything is sent.

## How a scan becomes draft questions

1. The upload creates the job and returns at once. The job shows "Extracting" while Claude reads each scan.
2. Each transcript is labelled with its file name and added to any text uploaded alongside it. It then passes through the same PII removal as text uploads: names, phone numbers, emails, mentions and links.
3. The job goes back to the queue and Claude drafts questions exactly as for text. A job waiting for OCR can never be drafted early.
4. **The files themselves are never stored.** Only the cleaned transcript is kept. If reading fails, the job shows the reason, and Retry asks for the files to be uploaded again.
5. The job's cost now includes the reading cost.

## Which Claude reads the files

| Where | How |
|---|---|
| Production (`ANTHROPIC_API_KEY` set) | Official Anthropic SDK (`@anthropic-ai/sdk` 1.4.0), Claude Opus 5.5 at low effort, streaming, with server-side refusal fallback |
| This PC (no key) | The Claude app's bundled CLI on your own login, with no tools, settings or saved sessions |

The CLI on this PC reported **"Not logged in"** on 5 November, so OCR has not run live yet. It will work once the CLI is signed in, or once an API key is set.

## Checks

- Type check passed.
- **19 of 19 tests passed.** The new `tests/ocr.test.ts` covers:
  - detection, renamed files and HEIC;
  - no drafting before OCR;
  - the transcript combined with typed text;
  - PII removed from the transcript;
  - cost added to the job;
  - no file bytes stored in the database;
  - unreadable scans and reader errors;
  - Retry after a failed read;
  - mismatched files.
- Production build succeeded. The QA and demo databases were migrated (`011_ocr.sql`).
