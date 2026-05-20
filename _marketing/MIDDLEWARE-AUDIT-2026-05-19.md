# Middleware audit — 2026-05-19

Scope: Everything in the request pipeline **other than** `server/middleware/auth.js`. Read-only — no code modified.

Bug context: clients (`role='client'`) get 401 on every authenticated endpoint after login; trainers (`role='trainer'`) work fine. Hypothesis being tested by this audit: something in the pipeline before `authMiddleware` either strips/mutates the `Authorization` header, or rejects requests differently per role.

---

## 1. Header pipeline trace

Tracing the exact path that `Authorization: Bearer <jwt>` follows for a typical client API call (e.g. `GET /sessions`), in the order middlewares fire in `server/index.js`:

| # | Middleware | File / lines | Touches `req.headers.authorization`? |
|---|---|---|---|
| 1 | `cors(corsOptions)` | `index.js:63-66` | No. In production `corsOptions = {}` — default `cors` allows any origin, mirrors `Access-Control-Request-Headers` on preflight, never reads or rewrites incoming `Authorization`. |
| 2 | Body parser switch (`express.raw` for `/billing/webhook`, else `express.json`) | `index.js:67-73` | No. Parses request body only; does not touch headers. |
| 3 | `cookieParser()` | `index.js:74` | No. Reads `Cookie`, populates `req.cookies`. |
| 4 | `sanitize` | `index.js:75` → `server/middleware/sanitize.js` | **NO** — see section 2 below. Sanitizes `req.body`, `req.query`, `req.params` only. `req.headers` is never touched. |
| 5 | Security-headers middleware | `index.js:78-119` | No. Only `res.setHeader(...)` for response. |
| 6 | Per-route rate limiters (`apiLimiter`, etc.) | `index.js:225-234`, `258`, `260`, `262` | No. `express-rate-limit` reads `req.ip` to key its counters. It writes `RateLimit-*` headers on responses. It never reads or writes `req.headers.authorization`. |
| 7 | Router-level CSRF checks (admin/trainer/workouts) | `routes/admin.js:52`, `routes/trainer.js:82`, `routes/workoutDashboard.js:45` | No — and these don't apply to the SPA's `/sessions`, `/programs`, etc. They only mount under `/admin`, `/trainer`, `/workouts`. |
| 8 | `authMiddleware` per route (`routes/sessions.js:9`, etc.) | `server/middleware/auth.js:66-108` | Reads `req.headers.authorization` (line 67). |

**Conclusion:** Nothing in the pre-auth pipeline mutates the `Authorization` header. The header that arrives at the express server is the same byte-for-byte string that `authMiddleware` reads on line 67.

`req.originalUrl` and `req.method` are also unchanged, so the per-route `apiLimiter` keyed on `req.ip` cannot be sending a request to a different path before auth sees it.

---

## 2. Sanitize middleware deep dive

`server/middleware/sanitize.js` — full read:

```js
import xss from 'xss';

function sanitizeValue(val) {
  if (typeof val === 'string') {
    return xss(val, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style'],
    });
  }
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val && typeof val === 'object') {
    const cleaned = {};
    for (const key of Object.keys(val)) {
      cleaned[key] = sanitizeValue(val[key]);
    }
    return cleaned;
  }
  return val;
}

export default function sanitize(req, res, next) {
  if (req.body)   req.body   = sanitizeValue(req.body);
  if (req.query)  req.query  = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
}
```

Annotation:
- Only `req.body`, `req.query`, `req.params` are walked.
- `req.headers` is **never** referenced.
- No lowercasing, trimming, or replacement on header values.
- Pure clone — doesn't mutate references shared with anything else.

This middleware is exonerated. It cannot be the cause of differential 401s between client and trainer roles, because (a) it doesn't touch the auth header and (b) it doesn't read `req.userRole` (which doesn't exist yet at this point in the pipeline anyway).

Git history: only commit touching this file is `c52a2a9 Add input sanitization to prevent XSS attacks` — original commit, not recently modified.

---

## 3. CORS verdict

`server/index.js:63-66`:

```js
const corsOptions = process.env.NODE_ENV === 'production'
  ? {}
  : { origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] };
app.use(cors(corsOptions));
```

In production, `corsOptions` is the empty object. Effect of `cors({})`:
- `Access-Control-Allow-Origin` is mirrored from `Origin` (`*` when none).
- `Access-Control-Allow-Headers` on preflight mirrors `Access-Control-Request-Headers` — so `Authorization` is implicitly allowed when the browser asks for it.
- `credentials` is NOT set — but this is fine because the client uses Bearer auth in a header, not cookies. `fetch` does not need `credentials: 'include'` for an `Authorization` header.
- Methods: defaults to `GET,HEAD,PUT,PATCH,POST,DELETE` — covers everything in use.
- No per-route CORS overrides anywhere in the codebase.

**CORS is not the culprit.** The production build is same-origin anyway (`API_BASE = ''` in `client/src/api.js:1`), so CORS preflights wouldn't even fire for SPA → API calls. They only matter for the Capacitor iOS/Android shells (which use the production origin via deep link / capacitor server config) and for local dev.

Caveat for the parallel mobile-shell investigation: if the Capacitor iOS/Android app makes cross-origin requests with a non-`replab-fitness.com` origin (e.g. `capacitor://localhost` or `https://localhost`), production CORS still permits it because `corsOptions = {}` mirrors any origin. So this is permissive enough to not break clients accidentally.

---

## 4. JWT_SECRET usage map

Every read of `process.env.JWT_SECRET` across the entire repo:

| File:line | Use | Transformation |
|---|---|---|
| `server/middleware/auth.js:4` | Guard: throw if missing | None — direct read |
| `server/middleware/auth.js:7` | Guard: throw if `< 32` chars | `.length` only |
| `server/middleware/auth.js:9` | Error message | `.length` only |
| `server/middleware/auth.js:13` | `const JWT_SECRET = process.env.JWT_SECRET` (module-level, used for sign + verify) | **No `.trim()`, no normalization.** |
| `server/routes/shop.js:10` | Independent module-level copy, used by `shopAuth` | No trim |
| `server/routes/waitlist.js:6` | Independent module-level copy, used by `optionalAuth` and `GET /waitlist/me` | No trim |
| `server/scripts/verify-jwt.js:14,19,22` | CLI diagnostic | No trim |
| `server/tests/api.test.js:7,138,…` | Test setup (always overwritten to the test value) | No trim |
| `server/tests/cascade-delete.test.js:28-29` | Test setup | No trim |

Findings:
- Three places sign/verify with `JWT_SECRET`: `middleware/auth.js`, `routes/shop.js`, `routes/waitlist.js`. All read directly from `process.env.JWT_SECRET` with no transformation.
- **Critically: no `.trim()` anywhere.** If Render's env-var UI captured a trailing `\n` or leading space when the secret was pasted, every signed token would still come out fine (the same corrupted secret is used to sign), but if the secret was *changed* on Render — even just to re-paste it cleanly — every JWT in flight would fail verification. This is consistent with "trainer login works (re-signed at login, immediate use) but client tokens from yesterday don't".
- `.env.example:9` is `JWT_SECRET=change-me` — no helpful constraint hint.

Risk surface: if the secret is rotated or accidentally has whitespace, *all* roles would 401 equally — so plain whitespace corruption alone doesn't explain "trainer works, client doesn't". It only explains it under a specific scenario: trainers re-authenticated more recently than clients did, and a rotation happened in between.

---

## 5. Render config findings

- **No `render.yaml` in the repo.** All deploy config lives in the Render dashboard.
- **No `Dockerfile`.** Render auto-detects Node + uses `npm start` (which runs `node index.js` per `server/package.json:8`).
- `app.set('trust proxy', 1)` is set at `index.js:58` — correct for a single Render load balancer hop. `req.ip` and `req.secure` will reflect the real client values from `X-Forwarded-*`.
- Nothing in the codebase branches on `req.secure` or `req.ip` in a way that would 401 a client. Rate limiters use `req.ip` for keying only; they return 429, not 401.
- Single Web Service expected (build = `npm run build`, start = `npm start`). No multi-service configuration in the repo, so there's no risk of one service having a different `JWT_SECRET` than another in this codebase. (But if Render has *both* a Web Service and a duplicate/preview environment, those need to be checked manually in the dashboard.)

Static / SPA fallback (`index.js:283-307`): no behavior depends on auth role. `/assets/*` 404s for missing chunks (correct), everything else returns `index.html`. This cannot produce a 401 — only 200 or 404. The reported 503 on `/session/791/2026-05-18` would not originate from this code (a 503 from Render typically means the upstream node process is down or restarting; not a middleware concern).

---

## 6. Header mutation hunt — other findings

- `res.setHeader` is called only with response headers (CSP, Cache-Control, file-download Content-Disposition, etc.). None touch a *request* header.
- `req.headers.authorization` appears in exactly three runtime files: `middleware/auth.js:67`, `routes/waitlist.js:18`, `routes/waitlist.js:102`. None of these *write* to it — they only `.startsWith('Bearer ')` and `.split(' ')[1]`.
- `req.get('host')`, `req.get('origin')`, `req.get('referer')` are used by the trainer/admin/workouts CSRF checks (`routes/trainer.js:68-70`, `routes/admin.js`, `routes/workoutDashboard.js:31-33`). None of those touch `Authorization`.

No code path mutates the Authorization header.

---

## 7. Express version + known issues

`server/package.json`:
- `express`: `^4.21.1` — latest stable 4.x line, no known header-handling regressions.
- `express-rate-limit`: `^8.3.1` — v7+ requires `app.set('trust proxy', N)` explicitly to count real IPs (already done at `index.js:58`).
- `cors`: `^2.8.5`
- `cookie-parser`: `^1.4.7`
- `jsonwebtoken`: `^9.0.2`
- `xss`: `^1.0.15`

Nothing on this list has a known bug that would 401 some users and not others. `express-rate-limit` produces 429 (not 401) when triggered.

---

## 8. Recent middleware-touching commits (since 2026-05-12)

```
1926202  Auth: gated debug logging on every 401 path (DEBUG_AUTH=1) + verify-jwt.js
14a8408  Scripts: add diagnose-401-by-user.js (role / plan / token_version inspector)
a4918e7  Push notifications: 4 launch types (no middleware change)
2d48e1b  Server hygiene: escape admin dashboard interpolations, rate-limit /billing routes
5aa5c68  Fix stale-chunk MIME error (static-serve only)
297c1b9  Pre-launch features: cardio, waitlist, FLIP reorder (added /waitlist, /cardio routers in index.js)
```

`1926202` only adds `console.warn` calls behind `DEBUG_AUTH==='1'`. It is the *most recent* touch to `server/middleware/auth.js`. The diff (verified via `git show 1926202`) does not alter any 401 decision logic — just adds gated logging *before* each existing `return res.status(401)`. Behavior with `DEBUG_AUTH` unset is identical to the previous version.

`2d48e1b` introduced the `/billing` rate-limit wrapper at `index.js:252-255`. This is unrelated to authenticated SPA API calls.

`297c1b9` added `/cardio` and `/waitlist` routers. The `/waitlist` router introduces a *second* `JWT_SECRET = process.env.JWT_SECRET` module-level constant and its own `optionalAuth` reading `req.headers.authorization`. Same env var, same read path — no divergence.

No recent commit changes the middleware order, the CORS config, or the sanitize behavior in a way that would 401 client tokens.

---

## 9. Top 3 hypotheses (ranked)

### Hypothesis A — `token_version` was bumped for the client cohort after they were issued tokens (HIGHEST likelihood)

Evidence:
- `authMiddleware` at `server/middleware/auth.js:88-98` rejects with 401 ("Session expired") if `decoded.tokenVersion !== users.token_version` for that user. **This is the only 401 path in `authMiddleware` that depends on the user record, and therefore the only one that could differ between two roles.**
- Trainers and clients sit in the same `users` table. A bulk update that touched `token_version` for `role='client'` rows (or every row but trainers happened to re-log in after) would produce exactly the reported symptom — old JWTs 401 on every API call, new logins succeed and immediately work.
- The very existence of `server/scripts/diagnose-401-by-user.js` (commit `14a8408`) is evidence that the team has already been investigating `token_version` mismatches.
- The client-side refresh loop (`client/src/api.js:147-176`) tries `/auth/refresh` once on 401, then logs out if the retry is still 401. If the refresh token was *also* signed at the old version, refresh succeeds (issuing a new access token with the *same* stale `tokenVersion`), the retry 401s again, and the user is logged out — which matches the "every authenticated endpoint 401s" report.

**Next-step verification:** On Render, set `DEBUG_AUTH=1` for one deploy and watch logs for one failed client request. The log line will be one of:
- `[auth] 401 verify-failed JsonWebTokenError invalid signature` → secret rotation / corruption.
- `[auth] 401 version-mismatch jwtV=0 dbV=1` → token_version bump. Cross-reference the bumped `user_id` against role with `diagnose-401-by-user.js`.
- `[auth] 401 user-not-found` → unrelated.
- `[auth] 401 no-bearer` → client isn't sending the header at all (unlikely given login works).

If it's `version-mismatch`, run `SELECT role, token_version, count(*) FROM users GROUP BY role, token_version` to confirm a role-skewed distribution. Fix is either to roll back the migration that bumped, or to invalidate all sessions for the affected cohort (force re-login).

### Hypothesis B — `JWT_SECRET` on Render has whitespace/newline corruption

Evidence:
- `JWT_SECRET` is read with **zero normalization** anywhere in the repo (`server/middleware/auth.js:13`, `routes/shop.js:10`, `routes/waitlist.js:6`).
- Length check at `auth.js:7` (`< 32`) would pass even with a trailing `\n` (33+ chars).
- Render's env-var UI sometimes preserves trailing whitespace on paste.
- `scripts/verify-jwt.js` explicitly prints the local secret length on line 19, suggesting prior debugging in this direction.

Why this is hypothesis B not A: secret corruption would 401 *all* roles, not just clients. The reported asymmetry only fits if trainers happened to re-log in *after* the corruption was introduced and clients didn't. Possible but requires a specific timeline.

**Next-step verification:**
1. `DEBUG_AUTH=1` on Render. A `JsonWebTokenError: invalid signature` log line confirms this hypothesis (vs. `TokenExpiredError` or `version-mismatch`).
2. SSH (or shell-via-Render) into the running instance, run `node -e "console.log(JSON.stringify(process.env.JWT_SECRET))"` and inspect for `\n`, leading/trailing spaces, or quote chars. The `JSON.stringify` is essential — it makes whitespace visible.
3. Run `node --env-file=server/.env server/scripts/verify-jwt.js <a-failing-client-jwt>` locally with the *exact* Render value pasted into local `.env`. If it says "invalid signature", you've narrowed it to the secret.

### Hypothesis C — No middleware smoking gun; bug is in `auth.js` itself or downstream

Evidence:
- The full pre-auth pipeline trace (section 1) is clean. Header arrives intact at `authMiddleware`.
- The role-dependent symptom can only originate from code that reads `decoded.role` or queries the user row. The only such code in the audit's scope is `routes/waitlist.js`, which (a) doesn't fire for `/sessions`, `/programs`, etc., and (b) silently falls through on auth failure rather than 401-ing.
- That means the asymmetry must be either (i) in `auth.js` itself (out of scope here, but the parallel agent should look at the `decoded.role || 'client'` default at line 102 and at the `token_version` query) or (ii) in the JWT contents (signed with the wrong claims for clients at login time).

**Next-step verification:** Have the parallel auth-code agent check `routes/auth.js` `/login` handler — specifically whether `user.role` and `user.tokenVersion` are read correctly from the DB before being baked into the JWT at `generateAccessToken`. If `tokenVersion` is `undefined` for some users at sign time but the DB later has `0`, the `?? 0` default at `auth.js:29` and `94` makes them match, so that path is safe. But if the *DB column* exists for trainers but is NULL for clients in some rows, behavior diverges.

---

## TL;DR

- The middleware pipeline (CORS → bodyParser → cookieParser → sanitize → security headers → rate limiters) does **not** mutate or strip the `Authorization` header.
- `sanitize.js` only touches body/query/params; it is fully exonerated.
- CORS, trust-proxy, static serving, and Express version all look correct.
- `JWT_SECRET` is read without normalization in 3 runtime files — a Render-side whitespace corruption is plausible but doesn't naturally explain role asymmetry on its own.
- Most likely cause is **`token_version` mismatch for the client cohort** (the only role-dependent 401 path in `authMiddleware`). Enable `DEBUG_AUTH=1` on Render to confirm.
