# Functionality improvement plan

Follow-on to the TanStack Query migration (`docs/tanstack-query-migration.md`). Goal: make the
backend and app logic (saving, syncing, background jobs, database changes) solid by replacing
hand-built code with well-tested, widely used open-source libraries. Visual/UI redesign comes
after this plan is done.

**Read this first if you're picking the work up in a new session.** Agreed with Will 2026-10-11.
Add new questions and answers to the decision log.

## Rules for every step

- One step at a time, each on its own branch off `main`, pushed to GitHub as it goes.
- Automated tests for what changed; run the full client + server suites before asking to merge.
- Merge to `main` (= website deploy) only with Will's approval. Leave a few quiet days between
  merges so a problem can be traced to one change.
- Production database reads/writes need Will's OK.
- Simple separate git commands; no Co-Authored-By trailer; never commit
  `client/src/pages/LandingPageTest.jsx` (Will's own uncommitted edits).

## Order

### 1. Dependency audit fix + Dependabot (quick win, ~1 hour)
- `npm audit` (2026-10-11, server, production deps) shows high-severity issues in indirect
  packages: `@fastify/busboy` (multipart parser), `@grpc/grpc-js` (via `firebase-admin`),
  `@opentelemetry/core`; moderate in `@anthropic-ai/sdk`. Run `npm audit fix` (not `--force`) in
  `server/` and `client/`, re-run tests, review anything left that needs a breaking upgrade.
- Replace `xlsx` 0.18.5 (abandoned on npm, known security issues) in the two admin exports
  (`server/routes/admin.js`, exercise-library export and one other) with `exceljs` (already a dev
  dependency → move to dependencies). Migration scripts can keep `xlsx` (local, one-off).
- Add `.github/dependabot.yml` (weekly npm updates for `client/` and `server/`, grouped minor/patch).

### 2. Playwright end-to-end tests
- Real-browser tests of the flows that matter most: sign in, log sets, offline → log → reload →
  online → all saved once; Mark Complete offline; calendar edits offline; account switch.
- Runs against a local server + a separate test database (never production). Decide the test
  database setup with Will (local Postgres vs a free Render/Neon test DB).
- Also lets the 2 skipped server tests (need a real database) run.
- Optional later: run in GitHub Actions on every push.

### 3. pg-boss — background jobs
- Replace the five hand-built `setInterval` timers with pg-boss jobs stored in the existing Postgres:
  `pushScheduler.js`, `streakReminderScheduler.js`, `weeklySummaryScheduler.js`, the daily summary
  heartbeat in `index.js`, `communityLikeNotifier.js`.
- Gains: cron schedules, retries on failure, exactly-once sends across Render restarts/deploys.
- Move one job at a time; compare sends against the old timer before deleting it.

### 4. node-pg-migrate — tracked database changes
- Today `initDb.js` re-runs ~100 CREATE/ALTER statements on every server start; data fixes are
  loose scripts in `server/migrations/` with no record of what ran.
- Baseline migration = current production schema (no-op on production, verified by diff),
  then every future change is a numbered, recorded, reversible migration.
- `initDb.js` seed/data parts reviewed separately; keep the old file until the baseline is proven.

### 5. Finish Zod on every server route
- Prerequisite: `zod-validation` merged to `main` (on or after 2026-10-14 — see the TanStack
  plan's To-do).
- Extend `server/validation.js` + `validateBody` to auth, metrics, programs, sharing, community,
  trainer, admin, cardio, challenges, feedback routes. Same lenient approach: reject only what the
  database would refuse or misstore; keep existing error messages.
- Steps 3–5 can overlap with this one route group at a time.

### Later / smaller (after the above)
- **Helmet** — standard security headers (the server sets a few by hand in `index.js`).
- **pino + pino-http** — structured logs with a request ID per request.
- **Express 5** — async route errors handled automatically.

### Not planned (decided 2026-10-11)
- Replacing login/account code (Firebase + hand-built refresh tokens): works, tested, risky to rewrite.
- Rewriting `server/db.js` (~2,900 lines of parameterized SQL) onto Kysely/Drizzle: big rewrite,
  modest gain.

## Status

| Step | Status |
|---|---|
| 1. Audit fix + Dependabot | Not started |
| 2. Playwright | Not started |
| 3. pg-boss | Not started |
| 4. node-pg-migrate | Not started |
| 5. Finish Zod | Waiting on `zod-validation` merge (on/after 2026-10-14) |

## Decision log

| # | Date | Question | Decision |
|---|---|---|---|
| 1 | 2026-10-11 | Order of work | Audit fix → Playwright → pg-boss → node-pg-migrate → finish Zod; then Helmet/pino/Express 5 |
| 2 | 2026-10-11 | Rewrite auth or db.js? | No (see "Not planned") |
