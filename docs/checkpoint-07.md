# Checkpoint 07 — SEO website pages

2 November 2026, Asia/Karachi.

## Delivered (PRD 8.8)

- **SEO-1, pages from the database:**
  - Exam family hubs (`/mrcog`, `/amc`).
  - Exam pages (`/mrcog/part-1-recalls`).
  - A page for every sitting marked "On website" in the catalogue (`/mrcog/part-1-recalls/september-2026`). New sittings get pages automatically, and past sittings stay live.
  - Pricing, FAQ, About, Contact, Terms, Privacy and Refund policy.
  - Old `/exams/...` addresses redirect permanently to the new ones.
- **Exam page:**
  - Breadcrumbs, the heading and description, and counts of reviewed questions, sittings and high-yield questions.
  - Trust blocks.
  - **Plan selector** (SEO-7): 6 months highlighted as best value, price per month and savings. It shows "Pricing hasn't been announced" until real plans exist; no prices are invented.
  - Sittings list, topic coverage, exam format (only once your team enters it), and exam FAQs.
  - Free-trial button when a trial is on, a **sticky buy button on phones**, and the independence disclaimer.
- **Sitting page:** how many reviewed questions came from that sitting and how many repeat in other sittings, topics in that sitting, and links to other sittings. Counts only; no question text.
- **SEO-4:**
  - Studio → **Website** lets content managers set the search title, meta description and H1 for any public page, with a live search-result preview. Blank fields fall back to automatic defaults.
  - Canonical link on every public page.
  - Automatic `sitemap.xml` and `robots.txt`, with private areas excluded.
  - **301 redirect manager.** Next.js answers with 308, the modern permanent redirect.
- **SEO-5:**
  - Structured data: Organization site-wide, BreadcrumbList on hub, exam and sitting pages, FAQPage, and Product with Offers in USD (only once real plans exist).
  - Generated share images for every exam and sitting page, plus Open Graph and Twitter cards.
- **SEO-6:** paid question content never appears in public HTML. An automated test and a live crawl of every public page both confirm it.
- **SEO-8:**
  - The cookie banner and Google Analytics 4 turn on once `NEXT_PUBLIC_GA_ID` is set. Analytics load only after a visitor clicks Accept, and "Cookie settings" in the footer reopens the choice.
  - Search Console verification is set with `NEXT_PUBLIC_GSC_VERIFICATION`.
- **Company and policy pages:** editable in Studio → Website, using plain text with headings and bullets and no HTML. They are seeded with drafts built from PRD decisions (no account sharing, watermark tracing, auto-renew, plan covers all sittings, GDPR and Australian Privacy Act rights, cookies). The proposed refund rule is "48 hours and fewer than 50 questions". Every policy page says it is **a draft awaiting legal review**. Re-seeding never overwrites edits.
- **FAQs:** seven general FAQs from PRD facts; staff can add exam-specific ones.
- **Footer:** policy links, cookie settings, and "not affiliated with or endorsed by any exam body" (PRD section 10).

## Fixed along the way

The site-wide loading screen made every page return status 200, so missing pages were not real 404s and redirects were not real redirects, which is bad for search. Loading screens now cover only the signed-in areas (Studio and Practice).

## Verification

- 13 of 13 automated tests pass. The new SEO tests cover:
  - plan maths and the 6-month highlight;
  - that structured data cannot be broken out of with a `</script>`, and that page text cannot inject HTML;
  - the canonical URL scheme, and that unpublished sittings and draft questions are hidden;
  - topic counts and high-yield and repeat counts;
  - that sitemap contents follow publication;
  - **that a published question's text, options, explanation and source appear in no public payload**;
  - that plans show only real prices, and exam format only once configured;
  - policy drafts, page edits surviving re-seeding, meta length limits, defaults restored when cleared, FAQ scope, redirect validation (no external targets, no loops or chains), and manager-only editing.
- Type check and production build pass.
- Live check on the QA database:
  - fetched the raw HTML of 15 public pages, the sitemap and robots: no synthetic question text anywhere;
  - every page has its own title and canonical link;
  - `/exams/mrcog-part-1` returns 308 to `/mrcog/part-1-recalls`, and unknown pages return 404;
  - the share image renders (PNG);
  - the exam and sitting pages fit at 360px with the sticky button.
- **Not measured:** Lighthouse and Core Web Vitals (SEO-3 asks for 90+ on mobile), because Lighthouse is not available in this environment. Run it once the site is hosted.

## Needed from your team

- **Legal review:** of Terms, Privacy and Refund policy (Studio → Website).
- **Contact details:** for the Contact page.
- **Site settings:** the real site address (`NEXT_PUBLIC_SITE_URL`), and optionally the GA4 and Search Console codes.
- **Content:** prices for the plan selector (the billing slice), and which sittings to show on the website (Studio → Exam catalogue).
