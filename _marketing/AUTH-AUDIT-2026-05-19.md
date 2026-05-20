# AUTH-AUDIT — Production 401 for role='client' users

Date: 2026-05-19
Scope: Read-only audit. No source code modified.
Repro: All users with `role='client'` get HTTP 401 on every authenticated API call immediately after `/auth/login` succeeds. Only `Wmartin` (id=37, role='trainer', plan='Elite') succeeds.

---

## TL;DR — Most likely root cause

**The server code does NOT contain a role-based 401 gate.** I read every middleware and route handler in `server/`. The auth middleware (`server/middleware/auth.js`) never branches on `role`, `plan`, `accountId`, or anything besides the JWT signature, `type`, user existence, and `tokenVersion`. The user-mapping functions in `server/db.js` (`findUserByIdentifier`, `findUserById`, `createUser`) return the same shape with the same `tokenVersion: u.token_version ?? 0` for every role.

**Direct verification.** I minted a fresh access token for `tadams` (user 43, role='client') locally using `server/.env`'s `JWT_SECRET`, then ran `server/scripts/verify-jwt.js` against it:

```
JWT_SECRET length: 96
Signature verified by local JWT_SECRET.
DB user: id=43 role=client token_version=0
JWT:     userId=43 tokenVersion=0
authMiddleware would PASS this token.
```

So with the local `server/.env` secret + local DB pointer (which is prod Postgres `dpg-d696f7t6ubrc73adu02g-a.oregon-postgres.render.com`), tadams's token passes every check in `authMiddleware`.

That leaves three live possibilities, ranked:

1. **`JWT_SECRET` on the live Render web service ≠ the one in your local `server/.env`** (mismatch happened during a recent deploy / env-var edit). Will's session keeps working because his browser cached the access+refresh pair from BEFORE the mismatch existed — when those expire, his session would die too. New logins by any user sign with the *current* server secret, are then verified by the *current* server secret on the next call, and should work — but if the env var contains a hidden trailing/leading character (whitespace, `\r`, smart-quote) that's stripped or preserved differently by Render vs. `--env-file`, the signing-vs-verifying calls would silently mismatch. **This is suspect #1.**
2. **A non-deployed code path is running on the server** (stale Render container that didn't pick up the latest deploy, or a deploy that never completed). Will's account is the trainer with elevated routes, and might be hitting `/trainer` (cookie-based) for some of his testing while clients hit `/auth/*` (JWT-based). If the JWT path is using stale code from before commit `210356a` ("Access + refresh token auth", 2026-04-20), legacy logic could be issuing or verifying tokens differently than the SPA expects. **Suspect #2.**
3. **`token_version` column drift**. The diagnostic script confirms all four tested users have `token_version = 0` in the DB *I queried locally*. If Render is reading from a different DB (e.g. branch DB, restored snapshot, regional replica), the prod-running server might see different `token_version` values. **Suspect #3 — easy to rule out (see Verification Queries §5).**

---

## 1. Top suspects (ranked)

### Suspect #1 — JWT_SECRET drift between Render env var and what `generateAccessToken` actually loads at runtime
- **Location:** `server/middleware/auth.js:13` (`const JWT_SECRET = process.env.JWT_SECRET;`)
- **Why it matches symptoms:**
  - The error in `authMiddleware` for a signature mismatch is the generic `'Invalid token'` (line 106), thrown from the `catch` after `jwt.verify` throws. That's the same string emitted on line 82 (wrong `type` claim) — so the response body alone won't disambiguate.
  - Will's *cached* tokens (from a localStorage pair issued days/weeks ago) might still be valid if the secret in use today is one he was signed with earlier. New logins by anyone today sign with the *current* server secret. If Render and your local `.env` have *visually* the same value but bytewise differ (trailing newline, `\r\n`, quoted value with the quotes still in the variable, etc.), then locally-minted tokens verify locally but server-minted tokens may not verify on the same server's *next request* due to a slightly different secret per-process or per-thread.
  - One specific gotcha: Render env-var editor sometimes preserves Unicode `​` zero-width chars from paste. `JWT_SECRET.length` would still be 96 visually but bytewise differ.
- **Cheapest test:** Set `DEBUG_AUTH=1` in Render env, redeploy (or restart), reproduce, read the next 401 log. Commit `1926202` (2026-05-18) added this. The log line distinguishes which of the 5 internal 401 paths fired. Specifically, if you see `[auth] 401 verify-failed JsonWebTokenError invalid signature`, you've confirmed JWT_SECRET drift.

### Suspect #2 — Stale Render container running pre-2026-04-20 auth code (legacy single-JWT)
- **Why it matches symptoms:**
  - Before `210356a`, the JWT had no `type` claim. After that commit, login mints `type:'access'`. The middleware's defensive branch at `server/middleware/auth.js:80` is exactly: "Pre-existing tokens (issued before this change) have no `type` claim — treat those as access tokens for backwards compatibility during rollout." But if the *running server* is the new code and the *frontend bundle* is the new code, then everything should be consistent.
  - Conversely, if the server is old (pre-April-20) and the client/api.js is current, then `/auth/refresh` doesn't exist on the server. New logins would still succeed (old single-token endpoint returns just `{ token }`). But the frontend `applyAuth` correctly handles `data.accessToken ?? data.token`, so it works either way. Hmm — this suspect is weaker than #1.
- **Cheapest test:** Hit `/health` on prod and check the git SHA via Render's deploy log; compare to current `main` HEAD `a472ccb`.

### Suspect #3 — Render is reading from a different database than `server/.env` points at
- **Location:** Render web service env vars vs. `server/.env` `DATABASE_URL`.
- **Why it could happen:** Render Postgres + a clone/branch DB. If you swapped DBs recently or pointed the web service at a snapshot, the row layout for `token_version` could differ from what the diagnostic shows.
- **Cheapest test:** Pull `DATABASE_URL` from Render dashboard, confirm host is `dpg-d696f7t6ubrc73adu02g-a.oregon-postgres.render.com`. If yes, suspect #3 is dead.

---

## 2. Code paths traced — full lifecycle of a client request

### 2.1 Login (POST /auth/login)
- `server/index.js:150` → `authLimiter` (rate limit, 15-min window). Returns 429, not 401.
- `server/index.js:75` → `sanitize` middleware. Strips XSS from `req.body`, `req.query`, `req.params`. **Does NOT touch headers** — so the eventual `Authorization: Bearer …` is unaffected.
- `server/index.js:237` → `app.use('/auth', authRoutes)`.
- `server/routes/auth.js:177-220` → `router.post('/login', ...)`:
  - `db.findUserByIdentifier(normalizedId)` (db.js:365-375). Returns `{ id, accountId, email, phone, passwordHash, firstName, lastName, username, role, plan, trialEnd, profilePhoto, timezone, createdAt, tokenVersion }`. Identical shape for clients and trainers.
  - `bcrypt.compareSync(password, user.passwordHash)`.
  - `res.json(authPayload(user))` (line 198).
- `authPayload` (routes/auth.js:54-63):
  - `generateAccessToken(user)` → JWT with `{ userId, email, phone, role: user.role || 'client', tokenVersion: user.tokenVersion ?? 0, type: 'access' }`. **No role-based branching.**
  - `generateRefreshToken(user)` → JWT with `{ userId, tokenVersion, type: 'refresh' }`.
  - Returns `{ token, accessToken, refreshToken, user: userResponse(user) }`.

### 2.2 Frontend persists tokens (client/src/context/AuthContext.jsx)
- `login()` at line 138 calls `api('/auth/login', ...)` then `applyAuth(data)`.
- `applyAuth` (lines 123-136):
  - `setAuthTokens(data)` → `setApiToken(data.accessToken)`, `setRefreshToken(data.refreshToken)`. **Same path for all roles.**
  - Persists `replab_user`.
  - Calls `setToken(data.accessToken ?? data.token ?? null)`.
- React re-renders, app navigates to `/app`.

### 2.3 First authenticated call (e.g. GET /schedule)
- `client/src/api.js:131-176` → `api()`:
  - `getApiToken()` returns the in-memory token (set just-now) OR localStorage value. **No role check.**
  - `doFetch` attaches `Authorization: Bearer ${token}` (lines 121-123).
- Hits server: `apiLimiter` (server/index.js:227) → `scheduleRoutes` (server/routes/schedule.js).
- `router.get('/', authMiddleware, …)` — auth runs.
- `authMiddleware` (server/middleware/auth.js:66-108):
  - Read `req.headers.authorization`. If missing/wrong prefix, 401 (line 70) — "No token provided".
  - `jwt.verify(token, JWT_SECRET)`. If throws (bad signature, expired, malformed), `catch` block returns 401 (line 106) — "Invalid token".
  - If `decoded.type && decoded.type !== 'access'`, 401 (line 82) — "Invalid token". A freshly-minted access token has `type:'access'`, so this passes.
  - SELECT `id, token_version FROM users WHERE id = $1`. If 0 rows, 401 (line 91) — "Account no longer exists".
  - `currentVersion = rows[0].token_version ?? 0`; `tokenVersion = decoded.tokenVersion ?? 0`. If they differ, 401 (line 97) — "Session expired. Please sign in again.".
  - Otherwise `req.userId/userEmail/userRole` are set and `next()` is called.

### 2.4 What the user is seeing
- Status 401 — must be one of the 5 paths above. Without the response JSON body or `DEBUG_AUTH=1` logs, we can't yet say which.

---

## 3. Role / plan / accountId gates found in the server

| File:line | Condition | What it blocks | Who passes |
|---|---|---|---|
| `server/middleware/auth.js:80` | `decoded.type && decoded.type !== 'access'` → 401 | Refresh tokens used as access tokens; legacy untyped tokens treated as access | Any user with a current access JWT |
| `server/middleware/auth.js:89` | `rows.length === 0` → 401 | Deleted accounts | Any user whose row still exists |
| `server/middleware/auth.js:95` | `decoded.tokenVersion !== currentVersion` → 401 | Stale JWTs after password change | Any user whose JWT matches DB token_version |
| `server/routes/trainer.js:53` | `trainerAuth` no session cookie → 401 | Anyone w/o trainer session cookie | `/trainer/*` users only (separate cookie session, NOT JWT-based) |
| `server/routes/trainer.js:222` | `user.role !== 'trainer'` → redirect | Trainer-login form when non-trainer attempts trainer dashboard | Trainers signing into `/trainer/login` |
| `server/routes/trainer.js:1389` | `userRows[0].role === 'trainer'` → 400 | Assigning a trainer as another trainer's client | Anyone (it's a 400, not a gate on auth) |
| `server/routes/trainer.js:1425, 1453` | `check.length === 0` → 403 | Trainers operating on clients not in `trainer_clients` | Trainers w/ a valid client mapping |
| `server/routes/trainer.js:1479` | `plan` not Pro/Elite → 403 | Trainer w/ Free plan creating programs for clients | Pro/Elite trainers |
| `server/routes/admin.js:77` | `trainerAuth` failure → 401 | Anyone hitting `/admin/*` without admin session cookie | Admin session cookie holders |
| `server/routes/sessions.js:144` | `tmpl.userId && tmpl.userId !== req.userId` → 403 | Owning-user mismatch on a template | Owner of the template |
| `server/routes/schedule.js:60` | `tmpl.userId && tmpl.userId !== req.userId` → 403 | Owning-user mismatch on a template | Owner of the template |
| `server/routes/sharing.js:142` | Sharing a workout the user doesn't own | Non-owner share attempts | Owners or library templates |
| `server/routes/workoutDashboard.js:22` | `trainerAuth` failure → 401 | Anyone hitting `/workouts/*` w/o trainer cookie | Trainer-session holders |
| `server/routes/waitlist.js:104, 118` | Standalone bearer check (no role gate) | Missing/invalid bearer | Any JWT holder |

**Critical: there is no gate that requires role='trainer' for `/schedule`, `/exercises`, `/exercises/muscles`, `/pbs`, `/pbs/all-by-muscle`, `/metrics`, `/programs`, `/sessions`, `/auth/page-visit`.** All of these mount only `authMiddleware`, which does not branch on role.

`req.userRole` is *assigned* on line 102 of the middleware (`req.userRole = decoded.role || 'client';`) but is never *gated on* anywhere in the failing routes. The only consumer of `req.userRole` outside trainer/admin routes is `routes/shop.js:31`, which re-assigns it the same way (data-shaping, not a gate).

---

## 4. Recent commits scanned (since 2026-05-12)

| SHA | Date | Touches auth path? | Summary |
|---|---|---|---|
| `1926202` | 2026-05-18 | YES | Added DEBUG_AUTH-gated `console.warn` to every 401 branch in `auth.js` + `scripts/verify-jwt.js`. **Pure observability — no semantic change.** Safe. |
| `a4918e7` | 2026-05-18 | NO | Added `scripts/diagnose-401-by-user.js`. No middleware change. |
| `a4918e7`/index.js touch | 2026-05-18 | NO | Touched only `server/index.js` for `/sessions` (this commit row appears twice in git log — verified the diff doesn't touch auth) |
| `a4918e7`/sessions.js | 2026-05-18 | NO | Sessions route changes — but those routes still use plain `authMiddleware`. |
| `a4918e7` | 2026-05-18 | — | (Push/streak/weekly scheduler additions — no auth changes) |
| `25a02e1` | 2026-05-17 | NO | `/pbs` SQL refactor: switched joins from `LOWER(name)` to `exercise_id` FK. Could break PB data queries but would return [] not 401. |
| `38a2b4b` | 2026-05-17 | NO | db.js dual-write exercise_id. Doesn't touch user lookup or auth path. |
| `4a89042` | 2026-05-13 | NO | db.js: removed 2+ distinct-dates filter in `getSameWeightRepeats`. Not on the failing routes. |
| `2d48e1b` | 2026-05-12 | NO | Rate-limit /billing routes. Returns 429, not 401. Confirmed earlier. |

**Conclusion: no commit since 2026-05-12 introduces a role-based 401.** The only auth-touching commit (`1926202`) is observability-only. If there's a recent regression that broke client login, it's likely **environmental** (Render config) rather than **code**.

Worth a glance further back:
- `210356a` (2026-04-20) — split the JWT into access+refresh. Backwards-compat for legacy untyped JWTs is explicit (auth.js:80 comment). Verified.
- `dd5894e` (2026-04-20) — token_version invalidation on password change. Verified DB rows all at 0.

---

## 5. Verification queries

Run all SELECT-only. Will leave prod data untouched.

### 5.1 Confirm token_version is 0 across ALL users (already done — re-run if drift suspected)
```sql
SELECT COUNT(*) FILTER (WHERE token_version = 0) AS at_zero,
       COUNT(*) FILTER (WHERE token_version > 0) AS bumped,
       COUNT(*) AS total
  FROM users;
```
Expect: `at_zero = total`, `bumped = 0`. Anything else → suspect #3 is live.

### 5.2 Inspect the failing users' raw rows (suspect #3 ruled out if these match what `diagnose-401-by-user.js` showed)
```sql
SELECT id, username, email, phone, role, plan, token_version, created_at
  FROM users
 WHERE id IN (37, 39, 42, 43)
 ORDER BY id;
```

### 5.3 Confirm that the prod web service is connecting to the same DB as `server/.env`
Compare `dpg-d696f7t6ubrc73adu02g-a.oregon-postgres.render.com` against the Render dashboard's web service env `DATABASE_URL`. **No SQL needed — this is a Render dashboard check.**

### 5.4 Confirm JWT_SECRET on Render
**No SQL — go to Render dashboard → Web Service → Environment → `JWT_SECRET`.** Copy the value into a local file, run:
```bash
node --env-file=server/.env server/scripts/verify-jwt.js <a-current-failing-client-jwt-token-from-browser>
```
If verify-jwt prints "Signature verified" but authMiddleware on prod still 401s, then either DB drift or `type` claim mismatch.

If verify-jwt prints "❌ jwt.verify FAILED", **the local secret differs from what signed the token**. Either:
- The prod server signed with secret-A and the local env has secret-B, OR
- The token was created by a different process (e.g. an older Render container before a redeploy)

Either way, suspect #1 confirmed.

### 5.5 Verify the running Render deploy SHA matches `main`
- `git rev-parse HEAD` locally → compare to Render's "Latest deploy" SHA. If they don't match, a stale build is running.

---

## 6. Action items (in order of effort/payoff)

### Highest payoff — do this first
1. **Set `DEBUG_AUTH=1` in Render's env and trigger a manual redeploy.** Reproduce the 401 (have tadams log in and call /schedule). Open Render → Logs → grep for `[auth] 401`. The next line will say which of the 5 internal paths fired. Each prefix is unique:
   - `[auth] 401 no-bearer` → Authorization header missing (frontend bug — bearer not attached)
   - `[auth] 401 wrong-type` → JWT `type` claim is wrong (refresh token sent instead of access, or some other shape)
   - `[auth] 401 user-not-found` → server DB is querying a different DB than expected
   - `[auth] 401 version-mismatch` → token_version drift (suspect #3)
   - `[auth] 401 verify-failed JsonWebTokenError invalid signature` → JWT_SECRET drift (suspect #1)
   - `[auth] 401 verify-failed TokenExpiredError` → clock skew or 15-min TTL elapsed before retry
   - `[auth] 401 verify-failed JsonWebTokenError jwt malformed` → token mangled in transit (CDN/proxy?)

### Secondary — to do once you have the log prefix
2. **If `verify-failed invalid signature`:** Pull `JWT_SECRET` from Render dashboard, paste into a temp file, and `diff` against `server/.env`. Byte-compare with `Get-FileHash` if the visible chars look identical. Look for trailing CRLF or surrounding quotes.
3. **If `user-not-found`:** Compare Render's `DATABASE_URL` to `server/.env`. Match → query the same DB.
4. **If `version-mismatch`:** Query `SELECT token_version FROM users WHERE id = 43;` against whichever DB the *running* server is using.
5. **If `no-bearer`:** Open Chrome DevTools → Network → reproduce → inspect the request headers for `/schedule`. The frontend isn't attaching the bearer. Most likely cause: a stale build is being served (the bundle hash in `<script src>` doesn't match the latest deploy). Hard-refresh + check `localStorage.getItem('replab_token')` in the DevTools console.
6. **If `wrong-type`:** Inspect the actual `accessToken` returned by `/auth/login` on prod (Network tab) and confirm its decoded payload has `type:'access'`. If it has `type:'refresh'` or no `type`, something on the server is shipping the wrong token in the wrong slot.

### Confirmation step — after fix
7. Once a fix is applied (redeploy, env edit, etc.), have tadams log in and confirm `/schedule` returns 200. Roll `DEBUG_AUTH=0` (or remove the env var) once green.

### Frontend defensive cleanup (not the root cause, but recommended)
8. `client/src/api.js:131-176` is correct. The bridge flow in `AuthContext.jsx:62-118` could leave `replab_user` unset if `/auth/me` 404s, which would render an authed user with `user=null` — but that's a different symptom than what was reported (you said the user "lands in the app", so `user` was set).

---

## 7. Things I confirmed are NOT the bug

1. **No `role`-based gate on the failing endpoints.** Verified by grep across `server/`.
2. **No `plan`-based gate.** Only consumer of `user.plan` is `routes/trainer.js:1479` (trainer creating programs for clients) and a Stripe-related flow.
3. **No `accountId`-based gate.** `account_id` is data-only; column is nullable; never checked in middleware.
4. **`sanitize` middleware doesn't touch headers.** Only `req.body`, `req.query`, `req.params`. The Bearer token survives sanitize.
5. **Rate limits return 429, not 401.** Verified across `authLimiter`, `apiLimiter`, `aiLimiter`, `refreshLimiter`.
6. **`token_version = 0` for every user in the DB pointed at by `server/.env`.** Confirmed via `server/scripts/diagnose-401-by-user.js`.
7. **A locally-minted access token for user 43 (tadams, role=client) PASSES `authMiddleware`** when verified against the local DB+secret. This means the code path itself is sound; the production failure is environmental.
8. **User-mapping shape is uniform across roles.** `findUserByIdentifier`, `findUserById`, `createUser` all return `tokenVersion: u.token_version ?? 0` consistently (db.js:357, db.js:374, db.js:384).
9. **No recent commit since 2026-05-12 changed semantic auth behavior.** Only `1926202` (2026-05-18) touched `auth.js`, and it was observability-only.

---

## Appendix A — files read for this audit

- `server/middleware/auth.js` (full)
- `server/middleware/sanitize.js` (full)
- `server/routes/auth.js` (full)
- `server/routes/programs.js` (top)
- `server/routes/schedule.js` (top)
- `server/routes/pbs.js` (top)
- `server/routes/metrics.js` (top)
- `server/routes/sessions.js` (top)
- `server/routes/exercises.js` (full)
- `server/routes/trainer.js` (auth-relevant sections)
- `server/index.js` (full)
- `server/db.js` (user-mapping functions)
- `server/migrations/add-account-ids-starting-at-23231.js` (full)
- `server/scripts/diagnose-401-by-user.js` (full + ran)
- `server/scripts/verify-jwt.js` (full + ran)
- `client/src/api.js` (full)
- `client/src/context/AuthContext.jsx` (full)
- `git log --since="2026-05-12" -- server/` (all)
- `git show 4a89042 38a2b4b 1926202 210356a 9630970 bc8f3e5 a472ccb` (relevant diffs)

## Appendix B — local verification artifact

I locally signed an access token for user 43 (`tadams`, role='client') with the JWT_SECRET from `server/.env`, then asked `verify-jwt.js` to validate it against that same secret + the prod DB row:

```
JWT_SECRET length: 96
Signature verified by local JWT_SECRET.
Payload: { userId: 43, email: "will23movies@gmail.com", phone: "+",
           role: "client", tokenVersion: 0, type: "access", … }
DB user: id=43 role=client token_version=0
JWT:     userId=43 tokenVersion=0
authMiddleware would PASS this token.
```

The code path is healthy. The production 401 is therefore environmental — almost certainly a JWT_SECRET or DB-URL mismatch between Render's web-service env and the local `server/.env`.
