# Build Verification

_Run date: 2026-05-17_
_Repo state: `main` @ a472ccb (plus in-progress parallel agent work on trainers gating, pre-submission audit, account-deletion tests; nothing observed mid-edit caused a syntax error during this run)._

## Summary

**Status: GREEN, with one yellow note.** Client production build succeeds in ~12s. Server entry parses cleanly. All 39 runnable server tests pass (vitest, mocked DB + Express via supertest). The two `cascade-delete.test.js` cases self-skip because no local PostgreSQL DATABASE_URL is configured and the only one in `server/.env` points to prod — these are documented under Skipped below. The one yellow flag is bundle size: the main client chunk is **967.74 kB raw / 269.89 kB gzip**, over Vite's 500 kB warning threshold (a `BUNDLE-SPLIT-PLAN.md` already exists in `_marketing/`).

## Client build

- **Command:** `npm --prefix client run build` (`vite build`, Vite 5.4.21)
- **Result:** built in 12.21s, 742 modules transformed, no errors
- **Output:** `client/dist/` — `index.html` (2.82 kB), CSS bundle 90.45 kB / gzip 16.27 kB, plus ~50 JS chunks
- **Main bundle:** `assets/index-Dp7zzGoz.js` — **967.74 kB raw / 269.89 kB gzip** (over 500 kB warning)
- **Warnings:**
  - Vite CJS Node API deprecation notice (informational, not actionable from this build)
  - "Some chunks are larger than 500 kB after minification" — applies only to the main `index-*.js` chunk; suggests dynamic `import()` / `manualChunks`. Tracked in `_marketing/BUNDLE-SPLIT-PLAN.md`.
- **No** missing-dep, missing-module, or build-time errors.

## Server checks

- **`node --check server/index.js`** — parses cleanly, exit 0
- **No separate server build step** (server `package.json` has only `dev`, `start`, `test`; no `build`, no `lint`)
- **No lint script** in root, client, or server `package.json`

## Tests

`server/package.json` test runner: **vitest 4.1.4**. Two test files in `server/tests/`:

| File | Pass | Fail | Notes |
|---|---|---|---|
| `server/tests/api.test.js` | 39 | 0 | Fully mocked (dbPool, db, email, Sentry, Stripe, initDb). Covers auth signup/login/refresh/delete-account, programs CRUD, templates, sessions, health check, and security regressions (reset-token hashing, JWT tokenVersion invalidation, sharing invite ownership, admin CSRF). |
| `server/tests/cascade-delete.test.js` | 0 | 0 | **Skipped** (2 cases) — see Skipped section. |

Aggregate: **39 passed, 0 failed, 2 skipped (41 total).** Vitest duration ~3.4s on full suite.

## Failures detail

None.

## Skipped

- **`server/tests/cascade-delete.test.js` (2 tests):**
  - `db.deleteUser cascade (integration) > removes all rows tied to the user across every dependent table`
  - `db.deleteUser cascade (integration) > DEPENDENT_TABLES list is exhaustive vs the live schema`

  **Reason:** The file uses `describe.skip` when `process.env.DATABASE_URL` is unset. The server's `test` npm script (`vitest run`) intentionally does NOT load `server/.env` (only the `dev` script uses `--env-file=.env`), so DATABASE_URL is unset under `npm test` and the suite correctly self-skips. The only DATABASE_URL on disk in `server/.env` points to the prod Render PostgreSQL instance — running this test against prod would CREATE a real user, populate ~20 dependent tables, then DELETE the cascade. Even though the test is designed to be self-cleaning (unique suffixes, `afterAll` defensive sweep), this verification run does NOT execute it against prod. To exercise it, point DATABASE_URL at a local/staging Postgres and rerun.

## Inventory reference

- Root `package.json` scripts: `install:all`, `build` (= install:all + vite build), `start`, `dev:client`, `dev:server`, `dev`. No `test`, no `lint`.
- `client/package.json` scripts: `dev`, `build` (`vite build`), `preview`. No `test`, no `lint`.
- `server/package.json` scripts: `dev` (`node --watch --env-file=.env index.js`), `start` (`node index.js`), `test` (`vitest run`). No `lint`, no `build`.
- `server/tests/`: `api.test.js`, `cascade-delete.test.js` (only).
