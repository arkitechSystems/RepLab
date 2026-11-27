# End-to-end tests (Playwright)

A real Chrome, a real server and a real Postgres database, all on this computer.
Production is never touched: `start-server.mjs` refuses any database that isn't
local, wipes the test database at the start of every run, and leaves out the
email, payment, AI and push keys.

## One-time setup

1. Open Docker Desktop.
2. Create the test database container:
   `docker run -d --name replab-e2e-db -e POSTGRES_USER=replab -e POSTGRES_PASSWORD=replab -e POSTGRES_DB=replab_e2e -p 5433:5432 postgres:16-alpine`
3. Install Playwright: `cd e2e`, then `npm install`, then `npx playwright install chromium`.

## Running

1. Open Docker Desktop. If the container is stopped, run `docker start replab-e2e-db`.
2. Build the website: `cd client`, then `npx vite build`.
3. Run the tests: `cd e2e`, then `npx playwright test`.
4. To see a failure step by step: `npx playwright show-report`.

Use `npx playwright test --headed` to watch the browser.

The server tests that need a real database (`server/tests/cascade-delete.test.js`)
run against the same container:
`DATABASE_URL=postgres://replab:replab@localhost:5433/replab_e2e npx vitest run` in `server/`.

## What's covered

- `auth.spec.js` — sign in, wrong password, switching accounts never shows the
  previous user's data.
- `session.spec.js` — checking/unchecking a set saves at once, a logged set is
  there after a reload, Mark Complete.
- `create-workout.spec.js` — Create a Workout on the session screen: the entered weight and reps
  are saved as the workout's goals in My Workouts, a scheduled start shows them as Goal Wt /
  Goal Reps, and an exercise added mid-session stays out of the saved workout.
- `help-chat.spec.js` — the offline Help chat: open it from the Workouts "?", get an answer,
  no-match shows Contact support; it also opens signed out from the Support page.
- `my-workouts.spec.js` — My Workouts page: month headers, Move into a program lands after the
  program's last workout (Week/Day in the toast, checked on the server), Edit → Save returns to My Workouts.
- `offline.spec.js` — sets logged offline survive a reload and save once on
  reconnect, several offline changes go out in order, Mark Complete offline.

## Writing tests

- Set things up through the API (`createUser`, `createWorkout` in
  `tests/helpers.js`); test the thing itself through the screens.
- Each test signs up its own user, so tests never depend on each other.
- Check the result on the server (`serverSession`), not only on screen.
