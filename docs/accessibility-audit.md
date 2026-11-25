# Accessibility check, 25 Nov 2026 (automated, partial)

Scripted check of the live demo's public pages (/, /pricing, /sign-in, /sign-up, /mrcog, /blog): every page has `lang="en"`, one `h1`, a main landmark, a title and a viewport tag; no image lacks `alt`; every link and button has an accessible name; every form field has a label.

Not done, and needed before a WCAG 2.1 AA claim: a Lighthouse run (the Google PageSpeed API refused keyless requests, so run `npx lighthouse <url>` locally or add an API key), a keyboard-only pass through sign-up, practice and checkout, a screen-reader pass (NVDA or VoiceOver) of the question screen, contrast checks of the new dark theme on practice and Studio pages, and checking the lab-values panel and flashcards with a screen reader.
