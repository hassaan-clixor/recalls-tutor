# Recalls Tutor design system

One visual identity for the public website and the student app, in a product-led SaaS style (the AMBOSS pattern, chosen from a review of Pastest, BMJ OnExamination, Quesmed, AMBOSS and UWorld). Deep teal fields frame the message, and the product itself, the real practice screen, is the main picture. It is built to read quickly on a phone. Content Studio is out of scope and keeps its own earlier look.

## Where it lives

| Surface | Stylesheet | Root class |
|---|---|---|
| Public website (home, exam, sitting, family, plans, FAQ, policies, 404) | `app/site.css` | `main.hb` |
| Sign-in, sign-up, recovery, account security | `app/auth.css` | `.auth-page` |
| Student app (practice, session, results, history, plans, checkout) | `app/practice/practice.css` | `.app.student-shell` |
| Content Studio | `app/studio/shell.css` + `app/studio/studio.css` | `.app.studio-shell` |

The student app and Studio stylesheets are scoped to their root class, so neither leaks into the other after client-side navigation.

## Tokens

- **Neutrals (slate):** background `#f8fafc`, raised background `#f1f5f9`, surface `#fff`, heading ink `#0f172a`, body text `#1e293b`, muted text `#475569`, hairline `#e2e8f0`, strong hairline `#cbd5e1`.
- **Deep teal fields:** `#0b2f35` to `#0f3f46`, used for the home hero, the source band, the closing band and every inner-page header. Text on these is white, with muted lines in `#a7c7c9`.
- **Primary (on light):** teal `#0f766e` (hover `#115e59`), soft tint `#f0fdfa`, tint line `#99f6e4`.
- **Action on dark:** mint `#5eead4` with deep-teal text; the second button is a white outline.
- **Gradient:** `linear-gradient(135deg,#0f766e,#0e7490)`. It appears only on primary buttons on light backgrounds, never on text, cards or icons.
- **Marker hues:** blue `#3b82f6`, teal `#14b8a6`, sky `#0ea5e9`, amber `#f59e0b`, violet `#8b5cf6`. They identify an exam or topic and only colour a dot or a progress bar.
- **Status:** correct `#15803d` on `#f0fdf4`; wrong `#b91c1c` on `#fef2f2`; high-yield `#92400e` on `#fffbeb`.
- **Radius:** 24px for large cards, 16px for cards, 10–12px for controls, pill for chips.
- **Elevation:** a 1px inset hairline ring plus a soft slate shadow. No glass except the sticky website header and the phone bars.

## Type

- Poppins (500/600/700) for headings, Open Sans for everything read. Both are self-hosted through `next/font`.
- Scale: 12 / 14 / 16 / 20 / 24 / 32. Page titles run from 32 to 56 with `clamp()`.
- Body text is at least 16px. Muted text is used only for secondary lines.

## Layout

- 8pt spacing grid; content width `min(1240px, 100% − 2×gutter)`; gutter `clamp(16px, 4vw, 64px)`.
- Home, in order: a dark centred hero (headline, one action, exam chips), then the product shot (an app window holding the live sample question, with two small floating cards) overlapping into the page. Then three alternating feature rows, each pairing copy with a piece of the real app on a soft teal stage. Then the exam cards, the dark source band, plans as a split, the FAQ as a split, and a dark closing band.
- Inner pages: a dark teal header (breadcrumbs, title, actions, and a white at-a-glance card where there are figures), then titled splits, with the title on the left (sticky on desktop) and the content on the right. Below 1100px they stack.
- Student app: a white sidebar on desktop; on phones, a top bar with a menu and a four-item bottom tab bar.

## Components (by class)

- **Buttons:** `.hb-btn.primary` (teal gradient), `.hb-btn.mint` and `.hb-btn.ghost` (on dark), `.hb-btn.plain` (white with a ring), `.hb-link` (blue text). The app uses `.practice-button` and `.practice-ghost`.
- **Chips:** `.ticket` and `.ticket.hy`; `.exam-chips` (dot plus name); `.topic-chips` (name plus count).
- **Lists and cards:** `.link-rows` (navigable rows with an arrow), `.trust-grid` (2×2 facts), `.figures` in `.glance` (key numbers).
- **Plans:** `.plan-menu` (`li.best` gets the primary ring) and `.plan-pending` when no prices exist. Without real prices, no plan is marked "Best value".
- **Product shot:** `ProductShot`, `FeedbackFragment`, `ExamFragment` and `ProgressFragment` in `components/site/product.tsx`. Example figures are labelled.
- **Questions:** `.q-card` wraps `SampleQuestionBody`, which the product shot shares. Options use `.opt`, `.right` and `.wrong`.
- **FAQ:** `details` inside `.faq`, with a rotating plus icon.
- **Phone purchase bar:** `.sticky-buy` shows on phones only, and only when there is a trial or a price to act on.

## Rules

- Never invent prices, pass marks, exam timings, testimonials, counts or pass claims. Example figures carry a label saying they are illustrative.
- Describe recalls exactly as they work: students share questions in groups and communities after their exams, and the team collects, compiles and reviews them. They are not official questions and do not come from exam halls or exam bodies.
- No eyebrow labels, gradient text, decorative glass, coloured side stripes, emoji, or icons in tinted squares.
- Touch targets are at least 44px. Focus is shown with a visible 3px primary outline. Reduced motion turns off transitions and the panel animation.

## Not covered

- Content Studio stays on its earlier look by decision.
- The sample question on the website still needs a reviewer's confirmation.
- Policy pages are drafts awaiting legal review.
