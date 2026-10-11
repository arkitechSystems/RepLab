# RepLab

Monorepo: `client/` (React 18 + Vite + Tailwind, Capacitor iOS/Android) and `server/` (Express + PostgreSQL on Render). `npm run dev` at the root runs both.

## Active project: TanStack Query migration

Work happens on the `tanstack-query` branch. The save point before it is tag `pre-tanstack-query` (commit `0e5bb7f`).
Read `docs/tanstack-query-migration.md` before touching data loading, saving or offline code — it holds the
decisions already made with Will, the phase plan, and the behavior that must keep working. Record new
questions and answers in its decision log.
