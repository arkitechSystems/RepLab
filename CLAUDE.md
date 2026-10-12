# RepLab

Monorepo: `client/` (React 18 + Vite + Tailwind, Capacitor iOS/Android) and `server/` (Express + PostgreSQL on Render). `npm run dev` at the root runs both.

## Active project: TanStack Query migration

Work happens on the `tanstack-query` branch. The save point before it is tag `pre-tanstack-query` (commit `0e5bb7f`).
Read `docs/tanstack-query-migration.md` before touching data loading, saving or offline code — it holds the
decisions already made with Will, the phase plan, and the behavior that must keep working. Record new
questions and answers in its decision log.

Its **To-do** section lists what's left after the 2026-10-11 website release (merge `zod-validation`
on or after 2026-10-14, manual and device checks). Remind Will of open items there.

## Keep in sync: trainer workout template

The trainer spreadsheet template (Excel/Google Sheets), the app's workout fields (workout session,
Create/Edit Workout), the Trainer Central upload importer, and the future Trainer Central
"Create a Workout / Program" web page must always match, so a filled-out sheet uploads straight into
the app. When you change workout/exercise/program fields or options in any of them, update all of
them — see `docs/trainer-workout-template.md`.

## Next project: functionality improvement plan

`docs/functionality-improvement-plan.md` — replace hand-built backend code with tested libraries,
in order: audit fix + Dependabot → Playwright → pg-boss → node-pg-migrate → finish Zod. Read it
before starting any of those steps and keep its Status table current.
