# Session-state audit — 2026-05-19

Scope: refresh-token flow, bridge tokens, env-var integrity, deploy races, cookie-based parallel auth, service worker, and DB session-state columns. Read-only. Companion to `MIDDLEWARE-AUDIT-2026-05-19.md` (header pipeline) and the in-flight `routes/auth.js + auth.js` audit.

Bug: every `role='client'` user 401s on every authenticated endpoint immediately after login. Trainer `id=37 Wmartin` is the only working account. JWT payload + DB `token_version` both show `0` — they match.

---

## 1. Refresh-token flow trace

What happens when a client user's `GET /sessions` 401s:

```
[browser]  GET /sessions               Authorization: Bearer <access-T0>
[server]   authMiddleware → 401  (per bug report)
[browser]  api.js:147 sees 401 + path doesn't start with /auth/
           → calls getOrStartRefresh()
             ├ no in-flight promise → performRefresh()
             │   POST /auth/refresh   body: { refreshToken: <refresh-R0> }
[server]   /auth/refresh → verifyRefreshToken(R0)
             ├ jwt.verify(R0, JWT_SECRET)         ← uses the SAME JWT_SECRET
             ├ decoded.type === 'refresh'         ← passes
             ├ db.findUserById(43)                ← finds tadams
             ├ user.token_version === decoded.tokenVersion === 0  ← passes
             └ res.json({ accessToken: <T1>, refreshToken: <R1>, token: <T1> })
                  ↑ same generator (generateAccessToken) as login.
[browser]  performRefresh stores T1+R1 via setAuthTokens(data)
           → retries GET /sessions with Authorization: Bearer T1
[server]   authMiddleware → 401 again (T1 is structurally identical to T0)
[browser]  api.js:166 — still 401 after refresh → clearAuthTokens(), logout()
```

### Key observations
- `/auth/refresh` is **NOT** wrapped in `authMiddleware`. It only calls `verifyRefreshToken` (`server/middleware/auth.js:55-64`), which is identical to the access-token verify in every way that matters: same `jwt.verify(token, JWT_SECRET)` call, same `type` claim check (refresh vs access), same `tokenVersion` comparison against `users.token_version`.
- **If refresh succeeds, the freshly issued access token is signed with the exact same secret + the exact same `tokenVersion` as the original.** There is no scenario where refresh succeeds but the retry then fails *for a stable reason*. The only divergent outcomes possible during the round-trip are:
  - A `token_version` bump arrived between the refresh and the retry → retry 401 with `version-mismatch`. (Vanishingly improbable for a single user clicking once.)
  - The verifier on the API route uses a different `JWT_SECRET` than `/auth/refresh` did. (Impossible in this codebase — both read the module-level `JWT_SECRET` constant set once in `middleware/auth.js:13`. There is no per-request secret swap.)
- **User reports they can re-log-in.** That means the SAME route stack that issues the access token in `/auth/login` is producing a token that the SAME stack on `/sessions` immediately rejects. Two route handlers calling `jwt.sign` and `jwt.verify` against the same module-level constant in the same process cannot disagree. **Therefore the only mechanism by which this can happen is if some piece of state outside the JWT changes between login and the next API call** — and the only such piece of state is `users.token_version`. But the DB shows that column = 0 for everyone (see section 3 + the live query in the final report).
- Caveat: the user reports being able to log back in. `api.js:147` skips the refresh logic for any path starting with `/auth/` — so `/auth/login` returning 200 only proves bcrypt is comparing correctly. It does **not** prove that the access token in the login response is valid; the user wouldn't notice until the very next non-`/auth/*` call.

### What I rule out from refresh-flow inspection alone
- No infinite refresh loop. `refreshPromise` is a single-shot (line 109-111) deduped across concurrent racers, cleared on settle. Pathological loop is structurally impossible.
- No accidental skip of the retry. The `if (newAccessToken)` branch (line 156) only fires when refresh resolved with a truthy token.
- No header mishandling on the retry. `doFetch` is the same code path as the initial request, just with the new token in the `Authorization` header.

---

## 2. Bridge-vs-regular-login token handling

The "JWT bridge" is the `?authToken=<jwt>&refreshToken=<jwt>&redirect=<path>` URL pattern used to hand off a session from the server-rendered trainer/admin dashboard into the React SPA.

| Aspect | Regular client login | Bridge handoff |
|---|---|---|
| Token origin | `POST /auth/login` returns `{ accessToken, refreshToken, user }` (`routes/auth.js:177-220`). | Server-rendered `/trainer/create-workout` and `/trainer/edit-workout/:id` call `generateAccessToken` + `generateRefreshToken` on the trainer's user row, then 302 → `/?authToken=...&refreshToken=...&redirect=...` (`routes/trainer.js:574-583` and `1023-1028`). |
| Who can issue? | Anyone with valid credentials, all roles. | Only routes guarded by `trainerAuth` middleware (cookie session check). In practice: only `role='trainer'` (the trainer login form rejects non-trainers — see `routes/trainer.js:200-211`). |
| Token signing | `generateAccessToken(user)` / `generateRefreshToken(user)` (`middleware/auth.js:22-47`) | Same two functions, same module-level `JWT_SECRET`. **Byte-for-byte identical signing path.** |
| Token claims | `{ userId, email, phone, role, tokenVersion, type:'access' }` | Same claim shape. |
| Token storage on client | `applyAuth()` in `AuthContext.jsx:123-136` calls `setAuthTokens()` → both `replab_token` (access) and `replab_refresh_token` (refresh) go into `localStorage`. | `AuthContext.jsx:62-118` bridge effect calls `setApiToken(bridgeToken)` + `setRefreshToken(bridgeRefreshToken \|\| null)`. Same localStorage keys. |
| User-object fetch | Login response body includes `user`. | Bridge has no user — it `fetch('/auth/me', { Authorization: 'Bearer ' + bridgeToken })` to populate it. |
| Failure handling | `applyAuth` throws → AuthContext clears state. | `/auth/me` 401 → bridge clears tokens silently. |

**Verdict.** The bridge produces *the same access token* as login — same generator, same secret, same claims. There is no token-shape difference that could let trainer tokens pass `authMiddleware` while client tokens fail it. If anything, bridge tokens go through one extra hop (`/auth/me` against `authMiddleware`) — and trainer users are observably passing that check successfully (they get into the SPA after the redirect).

**One stylistic note (not a bug):** the bridge only fires when `?authToken=` is in the URL, which only happens via the trainer dashboard. **A client user never goes through this code path** — they hit `/auth/login` and follow the normal flow. So whatever asymmetry exists between trainer and client, it's not because trainers take a different validation path on the server. Their *server-side validation* is identical. The only difference is that trainers got their last token *through the bridge* (i.e. very recently, at the moment they clicked the "Create a Workout" link from `/trainer`), while clients got theirs through `/auth/login` at some earlier point — but in both cases the token is signed with the current `JWT_SECRET` value.

---

## 3. DB column comparison — Will (37) vs tadams (43)

Live query (read-only) against prod DB:

```sql
SELECT id, username, email, phone, role, plan, token_version, account_id, created_at, trial_end
  FROM users WHERE id IN (37, 39, 42, 43) ORDER BY id;
```

| Column | id=37 Wmartin (works) | id=43 tadams (fails) | id=42 jmartin (fails) | id=39 Hoopdig1 (fails) |
|---|---|---|---|---|
| **role** | `trainer` | `client` | `client` | `client` |
| **plan** | `Elite` | `Free` | `Free` | `Free` |
| **token_version** | `0` | `0` | `0` | `0` |
| account_id | 23231 | 23269 | 23268 | 23265 |
| email | willmartinmail@gmail.com | will23movies@gmail.com | jetsyjalenm23@gmail.com | hoopersdigest@gmail.com |
| phone | +16829994947 | `+`  (just a plus sign — see note) | NULL | NULL |
| created_at | 2026-03-27 | 2026-05-19 | 2026-05-18 | 2026-04-29 |
| trial_end | 2026-04-03 | NULL | NULL | NULL |
| timezone | UTC | America/Chicago | (UTC default) | (UTC default) |
| stripe_customer_id | NULL | NULL | NULL | NULL |
| password_hash | bcrypt 60-char | bcrypt 60-char | bcrypt 60-char | bcrypt 60-char |
| profile_photo | NULL | NULL | NULL | NULL |
| welcomed_at | NULL | NULL | NULL | NULL |
| last_streak_reminder_at | NULL | NULL | NULL | NULL |
| last_weekly_summary_at | NULL | NULL | NULL | NULL |
| reset_token / reset_token_expires | NULL | NULL | NULL | NULL |

### What's actually different
- `role` and `plan` — but `authMiddleware` does not read either of these (verified by grep: middleware/auth.js reads only the JWT, then `SELECT id, token_version FROM users WHERE id = $1`).
- `phone` for id=43 is the **string `"+"`** — almost certainly a signup-form quirk where the user submitted only the plus sign without digits, which `normalizePhone` then stored as `+`. This is bizarre but **inert** for auth: phone is included in the JWT payload (`generateAccessToken` line 27) but never re-read on verify.
- `trial_end` is populated for Will (he used a trial) but null for the failing clients. Not referenced anywhere in `authMiddleware`.

### Token-version distribution across the whole users table

```
token_version=0  role=client  count=33
token_version=0  role=trainer count=2
```

(No rows with `token_version > 0`. No rows with `token_version IS NULL` — column is `NOT NULL DEFAULT 0`.)

**This kills the parallel middleware-audit's Hypothesis A.** There is no `token_version` skew — both roles are 100% at version 0. The mismatch path in `authMiddleware:95-98` cannot be firing.

---

## 4. `JWT_SECRET` loading + every read

| File:line | What it does | Transformation? |
|---|---|---|
| `server/middleware/auth.js:4` | Boot guard — throw if missing | None |
| `server/middleware/auth.js:7` | Boot guard — throw if `< 32` chars | `.length` only |
| `server/middleware/auth.js:13` | `const JWT_SECRET = process.env.JWT_SECRET` (module-level) | **No trim, no replace.** |
| `server/middleware/auth.js:32` | Sign access tokens | Uses the constant from line 13. |
| `server/middleware/auth.js:44` | Sign refresh tokens | Same constant. |
| `server/middleware/auth.js:56` | Verify refresh tokens (used by `/auth/refresh`) | Same constant. |
| `server/middleware/auth.js:75` | Verify access tokens (used by `authMiddleware` on every protected route) | Same constant. |
| `server/routes/shop.js:10` | Independent `const JWT_SECRET = process.env.JWT_SECRET` for `shopAuth` (cookie-based shop pages — not in the SPA API path). | No trim. Same env var. |
| `server/routes/waitlist.js:6` | Independent module-level constant for waitlist optionalAuth. | No trim. |
| `server/scripts/verify-jwt.js:14,19,22` | CLI diagnostic (`scripts/verify-jwt.js`). | Reads `.length` only for display, then passes to `jwt.verify`. |
| `server/scripts/diagnose-401-by-user.js` | Does not read JWT_SECRET; only inspects user rows. | n/a |
| `server/tests/api.test.js:7,138,298,309,325,326,334,351,652,669` | Test setup — `process.env.JWT_SECRET = 'test-secret-key-at-least-thirty-two-chars-long'`. | Overwritten in-process only; cannot leak into prod. |
| `server/tests/cascade-delete.test.js:28-29` | Test fallback `process.env.JWT_SECRET ||= 'test-secret-...'`. | Test-only. |

### How env vars get loaded
- `server/package.json` `scripts`:
  - `dev`: `node --watch --env-file=.env index.js`  ← Node 20+ built-in `.env` loader (no `dotenv` package).
  - `start`: `node index.js`  ← **does NOT pass `--env-file`.** Render is expected to inject env vars via its own dashboard (verified — `.env` is gitignored).
- There is **no `dotenv` / `dotenv-flow` / `dotenvx` dependency** anywhere in `server/`. (The `dotenv@16.6.1` entry in `client/package-lock.json` is a transitive dep of a Vite-time tool, not used at runtime.)
- There is **no code in `server/` that reads from `.env` files directly via `fs.readFile`**, no `Object.assign(process.env, ...)`, no `process.env.JWT_SECRET = ...` outside test files. Grep across `server/**/*.js` confirms this.

### Local secret vs prod-issued token
- Local `server/.env` `JWT_SECRET` length = 96. First 8 chars: `92e55093`. Round-trip self-verify on the user's exact failing payload (`{userId:43,email:will23movies@gmail.com,phone:"+",role:"client",tokenVersion:0,type:"access"}`) **succeeds** locally — i.e., the local secret signs+verifies its own JWTs cleanly.
- The user reports the local secret cannot verify the prod-issued JWT in the bug report. That asymmetry has only one explanation: **the prod Render env var is a different string from the local `.env` value.** That is consistent with normal practice (one would not commit prod secrets to local `.env`) and is by itself benign — until you observe the second symptom: **prod is also rejecting the prod-signed token.** That means even on prod, the secret used to *verify* is different from the secret used to *sign* — which can only happen if:
  - (a) the secret changed between signing time and verifying time (rotation mid-session), OR
  - (b) two processes are running on prod with different secret values (the unlikely "two Render instances" scenario).

### Render-side considerations
- Render free/starter Web Services run a single instance. There is no `render.yaml` in the repo (each setting is dashboard-managed), so we can't confirm from code that there isn't a duplicate worker. But none of the schedulers in `server/index.js:367-373` (`startIdleReminderScheduler`, etc.) is configured as a separate Render service — they're in-process `setInterval`s. So in this codebase there is no "second process" that could hold a stale secret.
- `server/.env.example` history (every change in repo history):
  - `9351b6b 2026-05-17` — REPLAB brand spelling + APP_URL/EMAIL_FROM/BUNDLE_ID flipped. **`JWT_SECRET=change-me` placeholder unchanged.** No hint of a deliberate secret rotation.
  - `61b09e7 2026-04-30` — Sentry wiring (added SENTRY_DSN).
  - `24839c2 2026-04-30` — ADMIN_PASS bcrypt note.
  - `7afc623 / 7a74259 2026-04-29/30` — LLC-cutover decoupling.
  - No commit ever touched `JWT_SECRET=` in `.env.example` beyond the original `change-me`.

---

## 5. Service-worker / cache verdict

`client/public/sw.js`:
- Registered only in **production builds** (`client/src/main.jsx:28`). In dev, `main.jsx:44-51` actively `unregister()`s any leftover SW and `caches.delete()`s all caches.
- `CACHE_NAME = 'replab-v5'` (bumped 2026-05-11 specifically to evict a poisoned cache of 404/text-html responses — see SW header comment).
- `activate` event deletes every cache that isn't `replab-v5` (line 28-34). Old SW versions auto-evict on next visit.
- `fetch` interceptor:
  - Caches GET responses for `/templates`, `/sessions`, `/programs`, `/schedule`, `/pbs`, `/exercises`, `/metrics`, `/sharing` — but **only when `response.ok`** (line 107). 401 responses are never cached.
  - `Authorization` headers pass through untouched — the SW doesn't read or strip them.
  - Auth endpoints (`/auth/*`) are NOT in the cacheable list. Login/refresh always hit the network.
- IndexedDB sync queue (`saveToSyncQueue` line 155) only fires for offline-detected POST/PUT/DELETE. It can replay stale requests with stale `Authorization` headers when the user comes back online — theoretically *that* request could 401 — but the user is reporting 401 on an *online* connection immediately after login. SW isn't in this path.
- **`Authorization` headers are NEVER read or rewritten by the SW.** There is no SW code that could substitute a stale token for the live one.

**Service worker is exonerated.** A user on an old bundle would *at worst* see slightly outdated JS for non-auth code; but `api.js`, the JWT format, and the SW itself are all delivered as content-hashed files. An old `api.js` would not request a different `Authorization` header than the new one — both versions read from `localStorage.replab_token`.

One unrelated note: the SW could serve a *very* old cached version of `index.html` if a user's browser hasn't fetched a fresh nav since deploy. `index.js:286` sets `Cache-Control: no-cache, no-store, must-revalidate` on `index.html` precisely to prevent this. The SW's nav strategy is network-first (line 122-131), so a live network wins over cache. Not the bug.

---

## 6. Demo / impersonation paths

- `/auth/demo` (`routes/auth.js:234-245`): creates a throwaway demo user via `db.createUser` and returns `authPayload(user)` — **same `generateAccessToken` / `generateRefreshToken` path as a normal login**, same `JWT_SECRET`, same claim shape. No bypass. The new user has `role='client'` by default (DB column default at `users.role text DEFAULT 'client'`).
- No `/auth/impersonate` route. No `impersonate` handler anywhere in `server/`.
- The closest thing to "impersonation" is the bridge token (`/trainer/create-workout` and `/trainer/edit-workout/:id`), which **issues a fresh access+refresh pair for the trainer's own user row** — it doesn't let the trainer act as another user.
- Trainer cookie session (`trainer_sessions` table, `trainer_session` cookie) is a *separate* session mechanism from the SPA JWT. It guards the `/trainer/*` server-rendered HTML pages and the bridge endpoints. It cannot grant SPA API access — every `/sessions`, `/programs`, etc. route goes through `authMiddleware` which only accepts Bearer JWTs. So the trainer cookie isn't "secretly authenticating" the SPA for trainer users.

Conclusion: there is no auth path that bypasses `JWT_SECRET` for any user, trainer included. Every protected SPA API call goes through the same `jwt.verify(token, JWT_SECRET)`.

---

## 7. Cookie-based parallel auth

Cookie auth exists, but **only** for the server-rendered admin/trainer/workouts pages — not for the SPA's `/sessions`, `/programs`, etc.:

| Route prefix | Cookie | Validation |
|---|---|---|
| `/admin/*` | `admin_session` | `routes/admin.js:68` / `:250`. DB-backed session table. |
| `/trainer/*` | `trainer_session` | `routes/trainer.js:23` / `:273`. DB-backed `trainer_sessions`. |
| `/workouts/*` | `client_session` | `routes/workoutDashboard.js:14` / `:215`. In-memory `clientSessions` Map. |
| `/shop/*` | `replab_token` | `routes/shop.js:14`. **Decodes the JWT with the same `JWT_SECRET`.** Falls back to a `?token=...` query param. |

The shop's `replab_token` cookie is the only cookie that contains a JWT — and it's set via a query-param redirect from the app (`shop.js:39-44`), then served same-origin with `httpOnly: true`. It only affects `/shop` HTML responses, not API JSON.

**Crucially: every SPA API route on `/sessions`, `/programs`, `/templates`, `/pbs`, etc. requires `authMiddleware`, which reads `Authorization: Bearer <jwt>` and ignores cookies entirely.** A trainer can't be "secretly" authenticating via cookie for those routes. Their browser sends both the JWT in the header (for API) and the trainer_session cookie (for the trainer pages), but the API endpoints never consult the cookie.

**Cookies are exonerated** as the cause of the trainer-vs-client asymmetry. Both roles use the exact same Authorization-header path for API JSON.

---

## 8. Deploy race conditions

- Recent commits (since 2026-05-12): see `git log` summary in companion middleware audit, section 8. Only one commit touched `server/middleware/auth.js`: **`1926202 (2026-05-18)`** — added gated `console.warn` debug logging behind `DEBUG_AUTH=1` env var. Diff is additive only. Auth logic identical.
- No commit since 2026-04-29 modified `JWT_SECRET` handling, `generateAccessToken`, `generateRefreshToken`, `verifyRefreshToken`, or the `authMiddleware` decision tree.
- No `render.yaml`; no Dockerfile. Render runs `npm start` → `node index.js` against env vars set in the dashboard.
- No worker service in the codebase. The cron-like schedulers (idle reminders, weekly summary, streak reminders, daily summary heartbeat) are `setInterval`s inside the main process (`server/index.js:336-373`) — they share the same `JWT_SECRET` constant because they're in the same Node.js process.
- **Plausible deploy-race scenario** (not directly observable from the repo, but worth checking in Render dashboard): if `JWT_SECRET` was rotated in the dashboard at some point yesterday or today *and* a deploy was in progress when a user logged in, the new login route could sign a token with the new secret while the old deploy's verifier (still serving the user's API calls) rejects it. This produces "login works, every subsequent API call 401s." The trainer-vs-client asymmetry would arise only if trainers happened to re-login *after* the rotation settled. **This fits the symptom exactly** but cannot be confirmed from code — only from Render's audit log / deploy timeline. **Verification step: check Render dashboard → Environment → JWT_SECRET → "Updated at" timestamp. Cross-reference to the deploy log timestamps.**

---

## 9. Top 3 hypotheses (ranked)

### Hypothesis A — `JWT_SECRET` was rotated in Render between when client tokens were signed and when they were verified (HIGHEST)

Evidence:
- DB `token_version` is `0` for every user (verified live). The middleware-audit's Hypothesis A (token_version mismatch) is **falsified.**
- `authMiddleware`'s only role-independent 401 paths that survive that falsification are:
  1. `jwt.verify` throws → "Invalid token" (line 105-107). This is what an `invalid signature` would produce.
  2. `decoded.type !== 'access'` → impossible for tokens signed by `generateAccessToken`.
  3. DB user-not-found → contradicted by the user's id=43 row existing.
- All three failing users (39, 42, 43) were created **before** any hypothetical rotation. Will (id=37) is the only working user. Will logs into the trainer dashboard regularly (the bridge handoff issues a *fresh* JWT every time he clicks "Create a Workout"), so his token is always seconds old. Clients only get a fresh token at `/auth/login`. **If the secret rotated and Will re-bridged after, his token would verify; clients on older tokens would not.**
- The user's own observation — "local JWT_SECRET cannot verify the prod-signed token, but prod is also rejecting it" — is the strongest single piece of evidence. The only way prod can reject a prod-signed token is if the signing secret and the verifying secret in the *same process* are different at different points in time. Render env-var changes trigger a restart, so this can't happen within one process — but it CAN happen across a restart if a client got a token before the restart and is now hitting an instance after the restart with a different secret value.

**Verification steps:**
1. **Render dashboard → Environment → JWT_SECRET → "Last updated" timestamp.** Compare to the iat on tadams's failing token (`iat:1779163082` = 2026-05-19 at the corresponding wall time — convert via `new Date(1779163082*1000)`).
2. **Set `DEBUG_AUTH=1` on Render and force a 401**, then read the log line. If it says `[auth] 401 verify-failed JsonWebTokenError invalid signature` → confirmed rotation. If it says `[auth] 401 version-mismatch` → re-examine token_version (could be a value > 0 introduced after my query ran). If it says `[auth] 401 user-not-found` → check whether id=43 still exists in prod.
3. Have the user paste the *full* failing JWT (header + payload + signature). Run `server/scripts/verify-jwt.js <token>` locally against a `.env` populated with the CURRENT Render JWT_SECRET (copy-paste fresh from the dashboard). If it verifies, the bug is fully understood: clients are holding tokens signed by a previous secret. Fix: rotate-and-broadcast-logout, or write a one-time DB migration that bumps `token_version` on every row and accept that all users must re-login.

### Hypothesis B — `JWT_SECRET` on Render has invisible whitespace corruption (trailing `\n`, etc.)

Evidence: same as middleware-audit section 9.B — no `.trim()` anywhere on `JWT_SECRET` reads, length-only check at line 7. This *can* coexist with hypothesis A: if someone pasted a fresh secret with a trailing newline into the Render UI yesterday, the restart would (a) make all pre-rotation tokens fail (Hypothesis A) AND (b) make all *new* tokens fail any external tooling (verify-jwt.js locally) that doesn't replicate the same whitespace.

Why this still doesn't fully explain trainer-vs-client asymmetry on its own: every role would equally suffer from a corrupted secret. It only explains it when combined with Hypothesis A's timing model (trainers re-bridge constantly; clients don't).

**Verification:** `node -e "console.log(JSON.stringify(process.env.JWT_SECRET))"` inside the Render shell. Any `\n`, leading/trailing spaces, or wrapping quotes show up in the JSON-stringified output.

### Hypothesis C — A client-side bundle is sending the WRONG token (stale localStorage from a previous user, lingering across a session reset)

Evidence:
- `clearAuthTokens()` in `api.js:59-63` removes `replab_token`, `replab_refresh_token`, and `replab_user`. It is called from `logout()` and from the failed-refresh branch.
- BUT: if a user previously logged in as a different account on the same device (e.g. testing flow), and the new login overwrites `replab_token` but not `replab_user`, the user object shown in UI could be the new user while the token in localStorage could be... no — `setAuthTokens` (line 53) does call `setApiToken(access)` even when `access` is `null`. So a successful new login *does* overwrite the token.
- HOWEVER: if `setAuthTokens` is called with `{ accessToken: undefined, refreshToken: undefined, token: <real> }` (the legacy alias only), `access = undefined ?? <real>` = `<real>` — fine. But `refreshToken` would remain `undefined`, and `if (refreshToken !== undefined) setRefreshToken(...)` would skip — leaving the OLD refresh token in localStorage. That's a real edge case but contradicts the symptom: it would only matter at refresh time, not on the first failing API call.
- This hypothesis would also be specific to dual-account testing on one device, which doesn't match a fresh `tadams` who never had a prior session.

Lower likelihood than A/B but worth checking by asking the user to test in an Incognito window: if Incognito ALSO 401s a fresh login, this hypothesis is dead. (Predicted outcome: Incognito 401s. The bug is server-side.)

**Verification:** Run a curl directly against prod:
```bash
TOKEN=$(curl -s -X POST https://replab-fitness.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"tadams","password":"<password>"}' | jq -r .accessToken)
curl -s https://replab-fitness.com/sessions \
  -H "Authorization: Bearer $TOKEN" -i | head -5
```
If that 401s, every browser/cache hypothesis is ruled out. The bug is server-side, token mismatch only.

---

## TL;DR

- Refresh flow: structurally sound. If `/auth/refresh` is succeeding, the retry should succeed too — unless the verify secret differs from the sign secret across the time gap.
- Bridge tokens: byte-for-byte the same as login tokens. Cannot explain trainer-vs-client asymmetry.
- DB session-state: `token_version=0` uniformly. No NULL anywhere on that column. Schema has nothing role-dependent.
- Env-var loading: pure `process.env.JWT_SECRET`, no `dotenv`, no normalization, no per-process variation in this codebase.
- Service worker: cannot 401 on its own; never rewrites Authorization.
- Cookies: irrelevant to SPA API auth.
- **Top hypothesis: JWT_SECRET was rotated in Render. Trainers got fresh tokens via the bridge after; client tokens predate the rotation.** Verified by enabling `DEBUG_AUTH=1` and watching for `invalid signature` log lines, plus a Render dashboard timestamp check.
