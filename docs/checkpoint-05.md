# Checkpoint 05 — uploads, tags, papers and free trial

2 November 2026, Asia/Karachi (overnight work while the team was offline).

## Delivered

- **PDF and Word uploads.** The Studio upload now accepts `.pdf` (with selectable text) and `.docx`, alongside `.txt`, `.csv`, `.tsv` and `.md`, up to 2 MB.
  - Scanned PDFs, images, password-protected PDFs, old `.doc` files and broken files are refused with a clear message saying what to do.
  - Word files are read directly; PDFs use `unpdf` 1.8.1 (see decisions).
- **Exam catalogue screen (`/studio/catalogue`):**
  - **Exam Mode settings:** questions in the real paper, duration and pass mark.
  - **Content rules:** high-yield threshold, needs-expert threshold, approved reference sources and house style notes for Claude.
  - **Free-trial settings**, which only a Super Admin can change.
  - **Sittings:** month and year, with "on website" and "in trial pool" switches.
  - **Topics:** two levels. Every change is audited.
  - All fields start blank; **nothing is assumed**. Exam Mode stays off until your team enters real values.
- **Topic and sitting tags:**
  - Each question has a topic, a difficulty and the sittings it was seen in. Changing tags never creates a new version or unpublishes a question.
  - Claude must choose topics from the exam's list. Anything else is recorded as a proposal for a content manager.
  - Uploads can name a sitting, so the drafts are tagged with it.
- **Practice:**
  - Filters by topic (including subtopics), sitting, difficulty, high-yield and latest sitting.
  - One-tap High-yield sprint and Latest-diet pack.
  - "Seen in" chips with High-yield and New-this-sitting badges, plus key notes after answering.
  - A topic breakdown in results, weakest first.
  - Access is rechecked on every answer, so an expired plan or trial cannot keep answering.
- **Complete papers (`/studio/papers`):**
  - Content managers create a paper (exam, optional sitting, time limit), add published questions, reorder, lock, publish and unpublish.
  - A completeness check compares the paper with the configured real paper size.
  - Students get a paper library grouped by sitting and sit papers in Exam Mode, in fixed order, with the paper's time limit. Retakes are unlimited.
- **Free trial:**
  - Off until a Super Admin turns it on per exam. Defaults are the PRD's: 3 days or 50 questions, plus one 25-question mini mock.
  - One trial per account per exam, verified email, no card.
  - Questions come only from sittings marked "in trial pool"; the question cap is counted on the server; papers need full access.
  - Shown on the practice page and the public exam page.

## Verification

- 10 of 10 automated tests pass on Node 24.22.1. Two are new.
  - **Uploads test:** builds a real Word file and a real PDF in memory, and checks the refusal for scanned, fake, broken, `.doc` and image files.
  - **Catalogue, tags, filters, papers and trial test** covers:
    - permissions, validation and that blank settings stay blank;
    - sittings and topics, including duplicates and depth;
    - that tagging never versions or unpublishes;
    - AI topic mapping, new-topic proposals and sitting tags from uploads;
    - every practice filter, the badges and the topic breakdown;
    - paper rules (published questions only, order, lock before publish, unpublish before unlock, full access only);
    - trial rules (off by default, needs a pool, one per account, pool-only questions, the cap, a single capped mini mock, no papers) and access expiry.
- Type check and production build pass with no warnings.
- Browser QA on the isolated QA database (synthetic, non-clinical content):
  - added sittings and a topic in the catalogue;
  - tagged a published question (still published at v2 after reload);
  - created, filled, reordered, locked and published a paper;
  - as a student, ran the High-yield sprint (badges and "Seen in" chips shown), sat the paper and checked the results;
  - checked the 360px layout.
- The browser "loading screen stays" issue noted in checkpoint 03 was confirmed to be the hidden test pane not drawing frames. Content hydrates as soon as the pane draws. It is not an app bug.

## Not verified or not done

- **Real exam values:** no question counts, durations or pass marks have been entered for any real exam. Your team enters them in the exam catalogue.
- The free trial was not tried in the browser, because it needs a Super Admin with two-factor. It is covered by the automated tests.
- File upload through the browser was not clicked through, because the test browser cannot attach files. Extraction is covered by tests with real Word and PDF files.
- Still pending: the live Claude run (needs `claude auth login`), OCR for scans and images, XLSX, blueprint topic and type mix, trial emails and device fingerprinting, Stripe, GHL and hosting.
