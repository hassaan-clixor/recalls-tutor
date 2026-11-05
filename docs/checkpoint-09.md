# Checkpoint 09 — public website redesign

2 November 2026, Asia/Karachi. Pages: home, exam family, exam, sitting, pricing, FAQ, about, contact, terms, privacy and refund policy, plus the shared header and footer.

## Direction

- **Dealt:** "The page is the object" (seed 750268726), with the brand's colours and Georgia headings kept (`--keep palette,type`). No slots were redrawn.
- **Idea:** the candidates' recall chat and the single-best-answer question sheet become the page's objects.
  - The home page opens on a stack of tabbed file folders; the tabs link to the page's sections.
  - The open front folder holds the **live thing**: a real five-option question the visitor can answer. It then reveals the answer, why each other option is wrong, and the key notes, exactly as practice does.
  - Each further section is another piece of the same stationery: recall slips standing in front of an engraving; the steps from recall to revision as a draggable row; a scalloped menu sheet ("What a plan includes"); prices set like a menu; tabbed FAQ index cards; a tilted reply card; and the footer as the back of the card, with a stamp.
- **Inner pages** reuse the system. Each page's heading sits on a paper sheet with a folder tab on the forest ground, and sections sit on tonal bands. Exam and sitting pages also carry the sample question.
- **Signature motion:** the exam index. Pointing at an exam brings up its card in one frame and dims the others. There are also staggered section entrances, folders sliding in on load, a slow drift on the engraving, and press and hover feedback on every control. All of it respects reduced motion, and content is never hidden without the script.

## What changed for visitors

- **The first screen says what this is.** Before: "Build knowledge. Find your focus." After: "Recalls Tutor", with "Practise the questions candidates remembered from recent MRCOG and AMC sittings, each one rebuilt, answered and checked by a doctor".
- **Text:** body text went from 12px grey to 17px in full ink. Small labels, numbering, hairline rules, italic accent words and shadows were removed.
- **Pictures:** the home page went from 0 pictures to 3 public-domain artworks, 3 generated exam cards and 9 real interface fragments.
- **Phone layouts:** a sticky buy or trial button, scrollable slips, the folder stack sized for a thumb, and the footer stamp clear of the text.
- **Share images:** they now match the site (a paper card on forest, in sentence case).

## Inspector results (taste-skill), on the live demo server

| Page | Before | After |
| --- | --- | --- |
| Home | 9 FAIL, 7 WARN | 0 FAIL, 6 WARN |
| Exam (`/mrcog/part-1-recalls`) | not measured | 0 FAIL |
| Pricing, FAQ, family (`/mrcog`) | not measured | 0 FAIL |
| Terms (and the other policy pages) | not measured | 1 FAIL (few pictures): deliberate, see below |

The source lint is clean. All 15 automated tests pass (including a new check on the policy-page text renderer), as do the type check and the production build.

**Remaining warnings, defended:**
- **Paper colour:** the brand's own colour, kept.
- **No video:** the open video sources were unreachable, and no honest clip of this subject was found.
- **The "How it works" row scrolls sideways:** it is a deliberate carousel with arrows and a progress bar.
- **Several text start lines:** they come from the twelve-column grid.
- **"Mixed font" headline:** the wordmark's bold and light weights; it is the logo.
- **Repeated boxes:** the four "why recalls" points.

**Legal pages** carry two pictures (the engraving as the ground and the lithograph as a stamp) instead of four. Legal text should not be decorated to meet a picture quota.

**My critique, last round:** the first screen is clear and specific. The weakest part is still the empty demo data: exam pages say "Pricing hasn't been announced" and "Sittings to be confirmed" until real content exists. That is honest but quiet. A formal scored critique was not done.

## Fixed along the way

- **Policy pages:** headings followed by bullets were rendered as one giant heading. Fixed, with a test.
- **Motion:** entrance animations could have left a page's sections hidden after an in-app navigation; they now re-run on every route change.
- **Layout:** a loading screen previously wrapped every public page. It now covers only the signed-in areas, which also keeps real 404 and redirect codes.

## Pictures (all public domain, CC0, Art Institute of Chicago; credited in the footer)

- *The Anatomical Lesson of Professor Pauw*, Jacques de Gheyn II, 1615 — https://www.artic.edu/artworks/51094 (home "where it starts" backdrop, plate bands, policy pages)
- *A Medical Student Starting Out* (plate 12), Charles Émile Jacque, 1843 — https://www.artic.edu/artworks/51127 (footer stamp, FAQ hero, side plates)
- *A Sheet of Anatomical Studies*, Peter Paul Rubens, 1600/10 — https://www.artic.edu/artworks/235541 (pricing plate, side plates)

They show the world of medical learning; none is presented as Recalls Tutor's own product or team. No stock photographs were used.

## Sample content to confirm before launch

- **The sample question** (postpartum haemorrhage, first-line uterotonic: oxytocin), its explanation, distractor reasons and key notes, plus its "Seen in two sittings / High-yield" chips. It was written for the website and is not taken from the paid bank, so **a named reviewer must confirm it**.
- **The six recall slips and the chat bubbles in "How it works":** illustrative and anonymised, modelled on the demo chat. Also the sample figures inside the interface fragments (confidence 91, a 2:41 timer, 3 in the mistakes deck, the sitting list).
- **Policy pages** remain drafts awaiting legal review.
