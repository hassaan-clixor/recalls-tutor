# Recalls Tutor

Phase One build for the official PRD. Implemented so far: exam catalogue and public pages, Better Auth authentication with staff MFA, the Recall AI Studio (upload → Claude drafts → human review → publish) student practice (Revision, Exam Mode, filters and complete papers), the exam catalogue, the free trial, content protection (rate limits, scraping alerts, leak tracing and suspension), and the SEO website (exam, sitting and policy pages, sitemap, structured data, redirects and consent-based analytics). Stripe billing is implemented and needs Stripe keys to go live. GoHighLevel was dropped from scope on 4 November 2026. This is not the completed sales platform.

## Run locally

Use Node 24 and pnpm. Install dependencies with `pnpm install --frozen-lockfile`, then:

```sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. Without DATABASE_URL, development uses `.local/database` (PGlite). Stop the server before running database scripts: the embedded database must have only one owning process. No prices or questions are seeded. For a managed PostgreSQL connection, export DATABASE_URL before running scripts and the app. Next.js reads .env.local, but standalone database scripts use exported environment variables.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm build
```

Tests create an isolated in-memory database. Production runtime requires DATABASE_URL and migrated schema; there is no local database fallback. Build does not require production credentials because database pages render at request time. Writes go through authenticated server actions that load the actor's role from the database.

## Project records

- docs/source/official-prd.txt: original authoritative source.
- docs/source/polished-prd.md and implementation-plan.md: supplied references.
- docs/ERD-report.md: implemented/planned schema, assumptions and open inputs.
- docs/delivery-plan.md: two-week sequence and launch gates.
- docs/decisions.md: technical decisions and limitations.
- docs/checkpoint-01.md to checkpoint-08.md: completed work, verification and outstanding features.
- docs/studio-workflow.md, docs/ai-studio.md and docs/practice.md: how to use the Studio, Claude drafting and practice, including the meeting demo.

Next work: enter real exam values, run the live Claude demo, then the admin screens and production deployment. See the delivery plan for the full scope.
