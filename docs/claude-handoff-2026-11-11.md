# Claude handoff — 11 November 2026

The user wants Claude to handle the remaining Recalls Tutor work, including GitHub and GoHighLevel integration. This explicitly supersedes the earlier direction to exclude GoHighLevel. Inspect the official pasted PRD, project instructions, current Git status and `docs/ceo-launch-requests.md` before making changes; preserve existing uncommitted work.

The Vercel production build of commit `e62a7bb` failed because `DATABASE_URL` was not set. Configure an appropriate hosted PostgreSQL database and production environment variables, then verify migrations, deployment and runtime. Do not skip migrations merely to make the build pass. The user's Vercel project and its active configuration have not been verified from this connection. Avoid exposing credentials in chat or committing them.

Confirm with the user what GitHub integration or workflow is required beyond the existing repository, and obtain the GoHighLevel requirements, access, consent and data-handling decisions. Implement and test the agreed integration; do not claim it exists until verified.

The latest local changes include work not necessarily present in the deployed commit. Review the launch checklist for AI fallback, OCR, deduplication, paper blueprints, upload limits, practice formats, Stripe and QA. Report verified results and remaining blockers without claiming launch readiness prematurely.
