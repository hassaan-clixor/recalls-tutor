# Launch operations: what to switch on

Features added on 25 Nov 2026 that need a key, a setting or a manual step before they do anything.

## Apple sign-in
Set `APPLE_CLIENT_ID` (the Services ID) and `APPLE_CLIENT_SECRET` (the signed JWT from Apple; it expires after at most six months, so renew it). Optional: `APPLE_APP_BUNDLE_IDENTIFIER`. The button appears on sign-in and sign-up only when both are set. Google works the same way with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Web push reminders
1. Generate keys once: `node -e "const c=require('crypto');const e=c.createECDH('prime256v1');e.generateKeys();console.log('VAPID_PUBLIC_KEY='+e.getPublicKey('base64url'));console.log('VAPID_PRIVATE_KEY='+e.getPrivateKey('base64url'))"`
2. Add both to Vercel, plus optional `VAPID_SUBJECT` (`mailto:` an address you read).
3. Students turn reminders on under Profile. A daily cron (`/api/cron/push`, 16:00 UTC) sends one reminder to students with reviews due.
Pushes carry no text from our side; the service worker (`public/sw.js`) shows a fixed message.

## Error tracking (Sentry)
Set `SENTRY_DSN`. Unhandled server errors are posted to Sentry (error, stack, route and method only; no query strings, cookies or bodies). No SDK is installed. For browser-side errors and source maps, replace this with `@sentry/nextjs` once the team wants it.

## Backups
Supabase is the database. Free projects have no backups; Pro keeps daily backups for 7 days, and point-in-time recovery is an add-on. Before real students sign up: move the project to Pro, turn on daily backups, and do one restore drill into a scratch project. Also take a logical dump before every risky migration: `pg_dump "$DATABASE_URL" --no-owner -Fc -f recalls-$(date +%F).dump`.

## Migrations on Vercel
`MIGRATE_ON_BUILD` is false on the demo, so new migrations (`035_recalls_best`, `036_push`) are applied to Supabase by hand (or set the variable to true for one deploy).

## Checks still to run against the live URL
Lighthouse (performance, accessibility, SEO) and a screen-reader and keyboard pass. Results go in `docs/accessibility-audit.md`.
