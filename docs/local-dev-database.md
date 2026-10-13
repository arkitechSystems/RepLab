# Local dev database

Since 2026-10-13, `npm run dev` uses a Postgres database on this PC instead of
production. The server changes the database structure on start (migrations,
see `server/db-migrations/README.md`), so running a branch locally against
production would change production before that branch ships.

| | |
|---|---|
| Container | `replab-dev-db` (Docker Desktop), Postgres 18 — same version as production |
| URL | `postgres://replab:replab@localhost:5435/replab_dev` (in `server/.env`) |
| Data | Docker volume `replab-dev-data` — survives restarts and reboots |
| Production URL | `server/.env.production-db` (git-ignored) |

Docker Desktop must be running for `npm run dev`. The container restarts on
its own when Docker starts.

The test databases are separate: `replab-e2e-db` (port 5433) is wiped on every
Playwright run.

## First time on a new computer

1. Start Docker Desktop.
2. Create the container:

   ```
   docker run -d --name replab-dev-db --restart unless-stopped -e POSTGRES_USER=replab -e POSTGRES_PASSWORD=replab -e POSTGRES_DB=replab_dev -v replab-dev-data:/var/lib/postgresql -p 5435:5432 postgres:18-alpine
   ```

3. In `server/.env`, set `DATABASE_URL=postgres://replab:replab@localhost:5435/replab_dev`.
4. `npm run dev` — the server builds the tables and seeds the library on first
   start. (Branches older than the `node-pg-migrate` merge can't build an empty
   database; start one with that code first.)
5. Sign up in the local app to get a user. The local database starts with the
   exercise library and library programs only — no real users or workouts.

Emails: if `server/.env` has `RESEND_API_KEY`, signing up locally sends real
emails (welcome + admin notification). Leave it blank to skip them.

## Running a script against production on purpose

```
cd server
node --env-file=.env --env-file=.env.production-db scripts/<script>.js
```

The second file overrides `DATABASE_URL`. `npm run migrate:up` / `migrate:down`
refuse production unless `ALLOW_REMOTE_DB=1` is also set.

## Start over with an empty dev database

```
docker rm -f replab-dev-db
docker volume rm replab-dev-data
```

then step 2 above.
