# Checkpoint 01 — application foundation

31 October 2026. Phase One remains in progress. Target date is 13 November 2026.

## Delivered

- Next.js application with server-rendered home, exam detail and pricing pages; responsive prelaunch interface.
- PostgreSQL schema and repeatable migration/seed scripts; three planned exam records, no invented pricing or clinical content.
- Public catalogue API returning metadata and published question counts only.
- Internal content lifecycle service with database-loaded roles, approval-before-publication and transactional audit logging.
- Constraints preventing cross-exam sitting links and cross-question version ownership; append-only audit trigger.
- ERD report with assumptions, implemented relationships and pending model work; 14-day delivery plan; original source files preserved.

## Verification

- Three automated tests passed, including database integration assertions for migration/seed repeatability, approval/publish permissions, illegal transitions, audit records, version ownership, cross-exam links and catalogue content isolation.
- TypeScript check passed.
- Production build passed; database-backed pages render dynamically without credentials at build time.
- Frozen dependency install passed; esbuild install script explicitly allowed.
- Live catalogue endpoint returned HTTP 200 with three planned exams and only summary fields.
- Browser screenshots captured at desktop 1440px, tablet 768px, mobile 375px and 360px; mobile detail and pricing screenshots also saved under screenshots/.
- Root visually inspected the 360px home layout. Independent evaluator did not finish its final verdict because its agent hit a usage limit. Cross-provider evaluation was unavailable. Screenshots alone do not establish full accessibility or cross-browser compliance.

## Limits and next work

No authenticated student/admin flows, checkout, AI processing, practice engine, trial enforcement, GHL sync or production hosting are implemented. The internal access helper covers interval/revocation only and must not be used as a complete trial guard. Production database roles and hosted PostgreSQL verification remain pending. Public copy is provisional and canonical SEO routes are pending.

Next vertical slice: verified authentication and audited admin catalogue/manual question editing, then upload → AI draft → review → publish. Billing and auth changes require focused integration tests before launch.

Read ERD-report.md for all assumptions, especially MRCOG Part 1 first, no supplied designs, per-exam subscriptions and the distinction between official PRD requirements and polished priority changes.
