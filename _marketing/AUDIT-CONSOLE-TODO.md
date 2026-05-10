# Console & TODO Audit — RepLab

**Generated:** 2026-05-01
**Scope:** `client/src/**`, `server/**`, `scripts/**`
**Excluded:** `node_modules`, `dist`, `build`, `.git`, `client/dist`, `client/android`, `client/ios`, `mobile/`, `package-lock.json`, `*.min.js`

## Headline counts

**console.\***
- `console.log`: 145
- `console.error`: 240
- `console.warn`: 16
- `console.debug` / `console.info` / `console.trace`: 0
- **Total: 401 calls**

Three additional grep hits were excluded because the literal text `console.log(...)` lives inside a string/comment, not in a real call:
`server/.env.example:66`, `server/middleware/auth.js:10`, `server/routes/admin.js:25` (all bcrypt/JWT-secret help text).

By area:
- `client/src`: 0 log + 30 error + 12 warn = **42**
- `server/`: 142 log + 210 error + 4 warn = **356** (heavy share is one-shot CLI: `migrations/`, `scripts/`, `seed*.js`, `syncExercises.js`, `check-exercise-coverage.js` — these never run in the live request path)
- `scripts/`: 3 log + 0 error + 0 warn = **3** (icon generator, also one-shot CLI)

**TODO / FIXME / XXX / HACK / BUG: / KLUDGE comments**
- `TODO`: **0**
- `FIXME`: **0**
- `XXX`: **0**
- `HACK`: **0**
- `BUG:`: **0**
- `KLUDGE`: **0**
- **Total: 0 task-marker comments in scope.**

The case-insensitive scan turned up only false positives — "Hack Squat" exercise names, the `'todo'` value in the audit-tracker status enum (`server/routes/admin.js`), and `XXX` substrings inside SHA integrity hashes in `server/package-lock.json` (which is excluded anyway). No true `// TODO`/`// FIXME` comments exist.

---

## Part A — `console.*` inventory

### A1 — Debug noise to strip before launch

The client codebase deliberately gates almost every console call behind `if (import.meta.env.DEV)`, so production bundles already drop the bodies. There is, however, a small cluster of **unguarded** `console.error` calls in `client/src/pages/Workouts.jsx` that will print in production. These are the only client-side strip candidates.

| file:line | call | note |
|---|---|---|
| `client/src/pages/Workouts.jsx:1888` | `console.error(err)` | catch in `templates/reorder` PUT — silently swallow or wrap with DEV gate |
| `client/src/pages/Workouts.jsx:1898` | `console.error(err)` | catch in `handleDeleteTemplate` |
| `client/src/pages/Workouts.jsx:1912` | `console.error(err)` | catch in `handleDeleteProgram` |
| `client/src/pages/Workouts.jsx:1954` | `console.error(err)` | catch in `handleDeleteWeek` (loop of deletes) |

These four are the only client `console.*` calls that aren't already DEV-gated or part of `ErrorBoundary`/`sentry.js`. Recommend: wrap with `if (import.meta.env.DEV)` to match the convention used everywhere else in `Workouts.jsx`, *or* dual-write to Sentry once that's wired (see A3).

There is no debug-noise category for the server: server-side `console.log` calls are all in CLI/migration/seed scripts (run manually, not on the request path) or are intentional startup/scheduler banners (see A2).

### A2 — Intentional production logging (leave as-is)

Server startup banners, scheduler heartbeat, fire-and-forget catches in long-running daemons, and CLI scripts. Representative entries — full list is large (~350) but uniform in shape:

| file:line | call | note |
|---|---|---|
| `server/index.js:300` | `console.log('RepLab server running on http://localhost:${PORT}')` | startup banner |
| `server/index.js:324` | `console.log('Daily summary sent for ${todayUTC}')` | daily cron tick success |
| `server/index.js:326` | `console.error('Daily summary tick failed (will retry):', err.message)` | cron retry trace |
| `server/index.js:340` | `console.error('Failed to initialize database:', err)` | fatal init failure |
| `server/dbPool.js:16` | `console.error('Unexpected pool error:', err.message)` | pg pool error event |
| `server/initDb.js` (×19) | `console.log('Seeded …')` / `console.error('… failed:', err.message)` | run-once seed/init traces |
| `server/email.js` (×7) | `console.log('RESEND_API_KEY not set, skipping …')` / `console.error('Failed to send …', err.message)` | email send/skip traces |
| `server/pushProvider.js` (×3) | Firebase init/send error logging | ops-relevant |
| `server/pushScheduler.js` (×5) | `[push-scheduler] …` heartbeat + per-send results | scheduler trace |
| `server/streakReminderScheduler.js` (×5) | `[streak-reminder] …` heartbeat + per-user results | scheduler trace |
| `server/migrations/*.js` (~110 calls across 23 files) | `console.log('Created program "X"')`, `console.error('Migration failed:', err)` | one-shot migrations, run manually |
| `server/scripts/*.js` (~30 calls across 7 files) | apple-reviewer seeder, send-test-email, dump-welcome-template, mark-url-conversion-done, etc. | manual CLI tools |
| `server/seedSummerShred.js` (×2) | seed log + error | one-shot CLI |
| `server/syncExercises.js` (×5) | wger sync progress | one-shot CLI |
| `server/check-exercise-coverage.js` (×6) | coverage report output | one-shot CLI |
| `server/exerciseCardBuilder.js:351,378` | catch logs in admin card builder | low-traffic admin tool |
| `server/migrations/_utils.js:137,185` | `console.warn` for migration safety guards | ops-relevant |
| `server/routes/admin.js:22` | `console.error('[admin] WARNING: ADMIN_PASS/ADMIN_KEY is set but is not a bcrypt hash …')` | startup misconfig guard |
| `server/routes/admin.js` (×56 more) | `console.error(err)` in catch blocks for admin endpoints | ops-relevant; admin traffic only |
| `server/routes/auth.js` (×19) | `console.error(err)` in catch blocks for signup/login/refresh/etc. | ops-relevant; see A3 below for upgrade candidates |
| `server/routes/sessions.js` (×11) | `console.error(err)` in catch blocks | request-path errors |
| `server/routes/trainer.js` (×20), `workoutDashboard.js` (×8), `sharing.js` (×7), `billing.js` (×5), `templates.js` (×5), `programs.js` (×4), `pbs.js` (×4), `ai.js` (×4), `schedule.js` (×3), `challenges.js` (×3), `exercises.js` (×3), `feedReactions.js` (×2), `feedback.js` (×2), `metrics.js` (×2), `push.js` (×2), `shop.js` (×1) | `console.error(err)` in catch blocks | request-path errors |
| `client/src/components/ErrorBoundary.jsx:21` | `console.error('App crash caught by ErrorBoundary:', error, info?.componentStack)` | top-level React crash trace; pairs with Sentry once wired |
| `client/src/sentry.js:29` | `console.warn('[sentry] VITE_SENTRY_DSN is not set …')` | bootstrap notice |
| `scripts/generate-icons.mjs` (×3) | per-icon write log + done banner | one-shot CLI |

Net: ~395 of the 401 console calls fall into A2 — leave as-is. Server has no `winston`/`pino` wired and the platform is Render's stdout aggregator, so plain `console.error` in catch blocks is the de-facto production logging strategy. Migrations and scripts deserve all the chatter they have.

### A3 — Dual-write candidates for Sentry (once `VITE_SENTRY_DSN` / server DSN are set)

`PRE-LAUNCH.md` flags Sentry env vars as still pending. Once wired, these `console.error`/`console.warn` sites are the highest-value places to also call `Sentry.captureException(err)` so they show up in the Sentry dashboard alongside stdout. They are still also valid as console logs — keep both.

| file:line | call | note |
|---|---|---|
| `client/src/components/ErrorBoundary.jsx:21` | `console.error('App crash caught by ErrorBoundary:', error, info?.componentStack)` | already the canonical Sentry hook; dual-write here is the highest-priority client integration |
| `client/src/pages/WorkoutSession.jsx:1742` | `console.warn('Post-save PB refresh failed (session was saved):', postSaveErr)` | session saved but PB refresh broke — silent data drift, worth alerting |
| `client/src/pages/WorkoutSession.jsx:3094` | `console.error('Failed to save template:', err)` | user-visible feature broken |
| `client/src/pages/Workouts.jsx:1888,1898,1912,1954` | unguarded `console.error(err)` in CRUD catches | already in A1 — strip *or* dual-write |
| `server/index.js:340` | `console.error('Failed to initialize database:', err)` | fatal startup; pages-on-call event |
| `server/index.js:326` | `console.error('Daily summary tick failed (will retry):', err.message)` | recurring cron — alert if rate spikes |
| `server/dbPool.js:16` | `console.error('Unexpected pool error:', err.message)` | pg pool event; symptomatic of DB outage |
| `server/email.js:98,136,183,291` | `console.error('Failed to send … email:', err.message)` | Resend failures (welcome/reset/signup-notify/daily-summary) — already a Will-flagged blocker |
| `server/pushProvider.js:32,75` | Firebase init / FCM send errors | once push is live, surface to Sentry |
| `server/pushScheduler.js:30,76`, `server/streakReminderScheduler.js:69,178` | scheduler tick / per-user send failures | recurring background — Sentry rollup is more useful than tail-the-log |
| `server/routes/billing.js:62,75,150,177,195` | Stripe checkout / webhook / portal / subscription errors | money-path — definitely Sentry |
| `server/routes/ai.js:139,150,237,315` | AI parse / generation / edit / swap errors | OpenAI failure modes worth tracking |
| `server/routes/auth.js:165,217,229,242,287,337,365,405,438,461,486,497,510,538,552,636,656` | `console.error(err)` in signup, login, refresh, password-reset, change-password, delete-account, etc. | auth path — every catch is Sentry-worthy |
| `server/routes/admin.js:184` | `console.error('Failed to send admin reset email:', err.message)` | admin path |
| `server/routes/admin.js:6205,6321,6611` | `console.error('Backup failed', 'Excel export failed', 'Restore failed')` | admin ops events worth dashboard visibility |
| `server/routes/sessions.js:32,42,104,120,132,142,157,167,187,200,215` | `console.error(err)` for session CRUD + activity feed | core write path |
| `server/routes/sharing.js:25,65,76,104,118,178,189` | share / invite / accept / decline errors | social feature path |
| `server/routes/trainer.js:233,410,421,488,559,896,977,996,1156,1213,1288,1312,1334,1348,1376,1407,1475` (×17) | trainer login / bridge / CRUD / delete errors | trainer-app path |
| `server/routes/workoutDashboard.js:182,572,678,696,1000,1049,1128,1139` | client login / create / delete / edit / history / exercises errors | trainer client web app |

Roughly 80–90 sites total. None of them are "wrong" today — Sentry is purely additive.

### A4 — PII / token leaks

**None found.** Spot-checked auth.js login/signup/refresh, billing webhooks, sharing, trainer login. No call passes a password, hashed password, JWT, refresh token, request body, or raw user email into a log — the convention is `console.error(err)` with the bare error object, or `console.error('label:', err.message)`. The login-history block at `server/routes/auth.js:209,215` logs only the geo-fetch error and the insert error, not the credentials.

The only spots where an email-like value reaches a log are intentional and limited to admin/ops contexts:
- `server/scripts/seed-apple-reviewer.js:237` prints `${REVIEWER_EMAIL} / ${REVIEWER_PASSWORD}` to stdout — but this is a *manually invoked seed script* whose entire job is to print test credentials for the App Review reviewer. Not a runtime log; not a leak.
- `server/migrations/move-wills-programs-to-wmartin23.js:39` prints `email=${userRows[0].email}` — manual one-shot migration trace.

Both are acceptable for their context. **No A4 entries to fix.**

---

## Part B — TODO / FIXME / XXX / HACK / BUG: / KLUDGE

**Zero matches in scope.**

A case-insensitive sweep across `client/src`, `server/`, and `scripts/` produced no `// TODO`, `// FIXME`, `// XXX`, `// HACK`, `// BUG:`, or `// KLUDGE` comments. Every grep "hit" was a false positive:

- "Hack Squat" exercise name (×6 across `seedExercises.js`, `client/src/utils/exerciseLibrary.js`, `client/src/pages/FeaturedWorkoutSession.jsx`, `client/src/pages/Utilities.jsx`, `server/migrations/add-hypertrophy-programs.js`)
- "Hacker Card" UI demo label in `client/src/pages/CardsTest.jsx:358`
- The string value `'todo'` in the admin audit-tracker status enum (`server/routes/admin.js` ×~15) — used as a workflow state, not a code marker
- `XXX` inside SHA integrity hashes in `server/package-lock.json` (excluded by scope)
- "Shackled Complex" exercise name (false hit on "HACKLED")

**No table to render. Category counts:** bug 0 / feature 0 / cleanup 0 / docs 0 / performance 0 / unknown 0.

If the team uses an external tracker for follow-ups (Linear, GitHub issues, the in-repo audit tracker UI), that's the source of truth — the codebase itself is clean of inline task markers.

---

## Recommendations

1. **Pre-launch (small):** wrap or remove the 4 unguarded `console.error(err)` calls in `client/src/pages/Workouts.jsx` (lines 1888, 1898, 1912, 1954) so the client is fully silent in production. ~5 minute fix.
2. **Sentry wire-up (when DSN env vars land):** the A3 list is the prioritized dual-write target set. Start with `client/src/components/ErrorBoundary.jsx:21`, `server/routes/billing.js` (×5), `server/routes/auth.js` (×17), and `server/routes/ai.js` (×4) — those are highest signal.
3. **No TODO/FIXME debt to track** in source. The audit tracker UI in `server/routes/admin.js` (the `'todo' | 'inprogress' | 'done' | 'na'` workflow) is the de-facto follow-up store — keep using that.
