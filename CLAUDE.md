# RepLab

Monorepo: `client/` (React 18 + Vite + Tailwind, Capacitor iOS/Android) and `server/` (Express + PostgreSQL on Render). `npm run dev` at the root runs both.

Local development uses the Docker database `replab-dev-db` (port 5435), not production — see
`docs/local-dev-database.md`. Production's URL is in `server/.env.production-db`; never point
`server/.env` back at production, and production database reads/writes need Will's OK.

## Branch rule

Commit and push everything to `main` (which deploys the live site) unless Will says to use
another branch. Don't commit to `tanstack-query` or other feature branches on your own.

## Active project: TanStack Query migration

The migration was done on the `tanstack-query` branch (now merged; new work goes on `main`). The save point before it is tag `pre-tanstack-query` (commit `0e5bb7f`).
Read `docs/tanstack-query-migration.md` before touching data loading, saving or offline code — it holds the
decisions already made with Will, the phase plan, and the behavior that must keep working. Record new
questions and answers in its decision log.

Its **To-do** section lists what's left after the 2026-10-11 website release (all improvement-plan
branches merged by 2026-11-20; still open: manual and device checks). Remind Will of open items there.

## iOS releases

To build and upload the iOS app from the cloud Mac using only Terminal, follow `docs/ios-release.md`.
Version and build numbers are kept in the repo's `project.pbxproj`.

## Keep in sync: trainer workout template

The trainer spreadsheet template (Excel/Google Sheets), the app's workout fields (workout session,
Create/Edit Workout), the Trainer Central upload importer, and the future Trainer Central
"Create a Workout / Program" web page must always match, so a filled-out sheet uploads straight into
the app. When you change workout/exercise/program fields or options in any of them, update all of
them — see `docs/trainer-workout-template.md`.

## Keep in sync: help FAQ

The in-app Help chat (`client/src/components/HelpChat.jsx`, opened from the "?" header icons,
Profile > Help & FAQ and the Support page) answers from `client/src/data/helpFaq.js` — offline, no AI.
When a user-facing flow, button label or route changes, update the matching FAQ answers (and any
"Show me" route) in that file too, then run `npm test` in `client/` (every question must still find itself).
Don't mention owner-only features (Featured, Challenges, Trainer Central) there.

## Next project: functionality improvement plan

`docs/functionality-improvement-plan.md` — replace hand-built backend code with tested libraries,
in order: audit fix + Dependabot → Playwright → pg-boss → node-pg-migrate → finish Zod. Read it
before starting any of those steps and keep its Status table current.
