# Spanish i18n Audit — 2026-05-22

Scope: the working-tree-only i18n landing (no commit yet). Reviewed: `client/src/i18n.js`, `client/src/locales/{en,es}.json`, `client/src/context/AuthContext.jsx`, `client/src/pages/{LandingPageTest,Login,Profile,Workouts}.jsx`, `client/src/components/BottomNav.jsx`, `client/src/main.jsx`, `server/i18n.js`, `server/db.js`, `server/email.js`, `server/routes/auth.js`, `server/{streakReminderScheduler,weeklySummaryScheduler,postSessionPushes,pushScheduler}.js`, `server/schema.sql`, `server/initDb.js`, `server/scripts/migrations/2026-05-22-users-locale.js`.

## Summary
- 22 findings: **0 P0**, **8 P1**, **14 P2**
- Build status: **client `vite build` clean (8.87s), `node --check` clean on every touched server file**
- en/es key parity: **214/214 exact match — no missing keys**
- Top 3 risks:
  1. **Welcome email body is still ~95% hardcoded English.** Hero is localized but the 8 tutorial panels, CTA copy, and footer copy are all EN-only. A user who picks ES on signup gets a Spanish subject and 4-line hero, then 400+ lines of English. Plenty of unused `email.welcome.{closing,signature,signedBy,role}` keys sit in server/i18n.js to remind us the job is half done. (P1)
  2. **Weekly summary push bypasses server/i18n.js entirely.** The scheduler inlines its own ES title ("✨ Tu semana en REPLAB") at `weeklySummaryScheduler.js:139` and never reads from `push.weeklySummary.*` in i18n.js — those keys are dead code with a different copy than what actually ships. (P1)
  3. **`PATCH /auth/me/locale` is unauthenticated against the rate limiter.** The route sits under `/auth/*` which has no global apiLimiter (only specific sub-paths are gated). An authed-but-malicious client can flip locale unlimited times. Cheap query but worth a small per-user cap. (P1)

The translations themselves read like they were written by a native speaker — verb forms, register (consistent `tú`), and gym vocabulary are correct (`serie`, `repeticiones`, `récord`, `sobrecarga progresiva`). The architectural pieces — db column + CHECK + migration, server-authoritative locale, client precedence chain, languageChanged guard — are all wired correctly. Most P2 items are missed surfaces or unused keys.

---

## P0 — Blockers

_None._ Build is clean, key sets match, locale precedence is correct, server-authoritative sync works, DB constraint is in the schema.

---

## P1 — Should fix before launch

### Welcome email is 95% hardcoded English even when `locale='es'`

- **File:** `server/email.js:27-194`
- **Issue:** Only the subject + 3 hero strings flow through `i18n(locale, ...)`. Every tutorial panel (Step One / Library / Custom / Tracking / Featured / Toolkit / Reminders / Desktop / Reference), the "We're always looking to improve" closing block, the "Open REPLAB" CTA label, and the bottom disclaimer ("Thanks for being here. Glad to have you." and "If you didn't create a REPLAB account…") are all string literals in EN. The user that signs up with the EN→ES pill flipped will receive a `Bienvenido a REPLAB` subject, a 4-line Spanish hero, then a wall of English. That's worse than a fully-English email — it telegraphs that we did the work halfway.
  ```js
  // line 41-42: localized
  <p>${i18n(locale, 'email.welcome.heroBody')}</p>
  // line 49: NOT localized
  <p>Step One</p>
  // line 50: NOT localized
  <h3>Take the Tutorial</h3>
  // …40+ lines of similar
  ```
- **Repro:** Sign up with `i18n.language === 'es'`. Open the resulting email.
- **Fix:** Either (a) add panel keys (`email.welcome.step1.eyebrow`, `…step1.title`, `…step1.body`, …) to server/i18n.js and route each `<p>` and `<h3>` through `i18n(locale, …)`, or (b) ship two distinct HTML templates and switch on `locale`. Option (b) is faster and lets the Spanish copy be written for impact rather than fitted to English structure. Either way: also use the existing dead keys (`email.welcome.{closing,signature,signedBy,role}`) — they're sitting in i18n.js unused.

### Weekly summary scheduler bypasses i18n.js — its `push.weeklySummary.*` keys are dead

- **File:** `server/weeklySummaryScheduler.js:118-140`, `server/i18n.js:36-37,67-68`
- **Issue:** i18n.js declares
  ```js
  'push.weeklySummary.title': 'Your week in lifts',
  'push.weeklySummary.body': '{{count}} workouts · {{volume}} lbs moved · {{prs}} new PRs.',
  ```
  but the scheduler never imports them. Instead it inlines a different title and assembles body parts itself:
  ```js
  const title = isEs ? '✨ Tu semana en REPLAB' : '✨ Your week in REPLAB';
  // …parts.push(`${count} workout${count===1?'':'s'}`)…
  const body = parts.join(' · ');
  ```
  Net effect:
    1. Two sources of truth for the same string — i18n.js says "Your week in lifts", users actually receive "✨ Your week in REPLAB". Anyone editing the keys (translator, designer) will not see their changes ship.
    2. Dead keys generate maintenance overhead — the next person to add a push will follow the i18n.js pattern and not know the weekly summary doesn't.
- **Repro:** Tick the scheduler. The title that lands is the inline one, not the i18n.js value.
- **Fix:** Pick one. Either (a) move the inline strings into i18n.js as keys + drive the scheduler through `i18n()`, or (b) delete the dead i18n.js keys and add a `// weekly summary: see weeklySummaryScheduler.js` comment in i18n.js so future devs aren't fooled. Option (a) is more consistent with the other 5 push types in this same file family.

### `PATCH /auth/me/locale` has no per-user rate limit

- **File:** `server/routes/auth.js:243-256`, `server/index.js:150-182` (limiter setup)
- **Issue:** The route is auth-gated and validates the `locale` value, but isn't wrapped in any of the rate limiters defined in index.js. The `apiLimiter` is applied to `/programs`, `/templates`, etc. via `app.use('/x', apiLimiter)`, but `/auth/*` only gets the `authLimiter` on the specific paths `/auth/login`, `/auth/signup`, `/auth/request-reset` (lines 150-152) and `/auth/refresh` + `/auth/export-data` (lines 173, 176). A logged-in attacker — or a buggy client in a loop — can hammer PATCH /auth/me/locale unlimited times. The write itself is cheap, but it's still write contention on the users table and a free amplification surface.
- **Repro:** Auth'd `for (let i=0;i<100000;i++) fetch('/auth/me/locale', {method:'PATCH', …, body:JSON.stringify({locale:'es'})});`. No 429 ever.
- **Fix:** Either (a) apply `apiLimiter` to specific PATCH/POST endpoints on `/auth` (not blanket — `/auth/me` GET is fine unlimited), or (b) drop a cheap per-user cap on `/auth/me/locale`. The Map-based pattern used for `canSendReset` (auth.js:341-351) is the minimal copy-paste — keyed on `req.userId` instead of email.

### Login form's error fallback is hardcoded English; `login.errors.*` keys exist but are unused

- **File:** `client/src/pages/Login.jsx:75`
- **Issue:**
  ```js
  setError(friendlyError(err, "Email or password didn't match. Try again or reset your password."));
  ```
  The English string is the *default* — `friendlyError` only swaps in if the server returns a specific shape. en.json/es.json already have `login.errors.invalidCredentials` ("Correo o contraseña incorrectos") and `login.errors.generic`. A Spanish-locale user who mistypes their password gets the English fallback.
- **Repro:** Switch to ES on landing, navigate to /login, enter wrong password. The red banner shows English.
- **Fix:** `setError(friendlyError(err, t('login.errors.invalidCredentials')))` (or `.generic` if invalidCredentials is too specific for the catch-all). Same shape will surface the i18n key shipped intentionally.

### Stamped signup `locale` is `'en'` if user picks ES *during* the signup form but landing-pill ES was set before mount

- **File:** `client/src/context/AuthContext.jsx:182`
- **Issue:** Subtle but real:
  ```js
  const locale = (i18n.language || 'en').split('-')[0] === 'es' ? 'es' : 'en';
  ```
  This reads `i18n.language` at the moment `signup()` is called. That's fine if the user flipped ES on Landing before tapping "Create an Account". But if they navigated `/signup` from `/login` (Spanish flip on Login page would also work — except Login has no language switcher). The only place to flip ES is the landing pill. If the user came in via the iOS app deep link to `/signup` (no landing visit), `i18n.language` is whatever `navigator.language` says. Mexican Android users with `es-MX` should resolve correctly via `nonExplicitSupportedLngs: true`. Good. But users with `'es-419'` (Latin American Spanish region code) — the browser/i18next normalization treats `'es-419'` as `'es'`, also fine. The actual gap is: **Capacitor mobile users have no UI to pick ES before signup.** Profile dropdown is post-signup. Solution sketch (low-cost): add the EN|ES pill to the Signup page header too, or read `@capacitor/device` and prime localStorage on first boot.
- **Repro:** Fresh install on a Spanish-language iPhone where `navigator.language === 'es-MX'`. Open the app → /login → /signup. The signup payload's `locale: 'es'` lands correctly because `navigator.language` detector kicks in. So the actual signup is OK. *However:* an English-language iPhone (`navigator.language === 'en-US'`) user who wants Spanish has no way to set it before signing up — the welcome email goes EN, the first-workout push goes EN, until they reach Profile and flip it. That's a real defect for ES-preferring users on EN-locale devices.
- **Fix:** Add an EN|ES pill to the Signup page header (~10 lines mirroring LandingPageTest:144-158). Or surface a one-time "Welcome — pick your language" toggle in the first session. Document the gap if you can't address before launch.

### `friendlyError` default messages in Profile + others are not translated (out of scope for this audit but adjacent)

- **File:** `client/src/utils/errors.js` (presumed) + every caller passing an English literal as the fallback
- **Issue:** Same pattern as the Login finding above — `friendlyError(err, "fallback English")` calls dot the codebase. en.json has `errors.network`, `errors.saveFailed`, `errors.loadFailed`, `errors.sessionExpired` ready to use. Most of these will never reach a Spanish-locale user surface, but the ones on translated pages (Profile delete, Profile language save) will.
- **Repro:** Force a network error on the Profile language save → toast shows the EN literal.
- **Fix:** Audit each `friendlyError(...)` call site on translated pages; swap the second arg to `t('errors.xxx')`.

### No e2e test asserts that `/auth/me/locale` rejects bad input

- **File:** missing — should sit alongside `server/tests/api.test.js`
- **Issue:** The CHECK constraint at the DB layer + the `if (locale !== 'en' && locale !== 'es')` gate at the route layer are both defenses. Neither has a test. A future refactor that loosens the route gate (someone adds `'fr'` to a list) without realizing the CHECK rejects it would manifest as 500s under load, not a clean test failure.
- **Repro:** N/A — gap.
- **Fix:** Add 4 quick test cases: PATCH `{locale:'es'}` → 200; PATCH `{locale:'fr'}` → 400; PATCH `{}` → 400; PATCH without Authorization → 401.

### Welcome email's `RESEND_API_KEY not set` log doesn't include locale context

- **File:** `server/email.js:15`
- **Issue:** Minor but the audit caught it: when Resend isn't configured in dev, the log line is `'RESEND_API_KEY not set, skipping welcome email'` with no user/locale. Devs testing the ES flow have no signal that the `locale` parameter actually made it into the function. Trivial to fix.
- **Repro:** Sign up in dev with `locale='es'`, no `RESEND_API_KEY`. Log says nothing about the locale routing.
- **Fix:** `console.log(\`RESEND_API_KEY not set, skipping welcome email to \${email} (locale=\${locale})\`)`. Same on the other 3 send paths.

---

## P2 — Polish

### Dead keys in `server/i18n.js`: `email.welcome.{closing,signature,signedBy,role}`

- **File:** `server/i18n.js:19-22, 50-53`
- **Issue:** Declared in both locales, never referenced from `server/email.js`. They look like they're intended for the welcome-email signature block, but the email's signature block is hardcoded text at lines 186-189.
- **Fix:** Either wire them up (preferable, ties to the P1 above) or delete to remove maintenance lag.

### Dead `signup.*` keys — Signup.jsx never imports `useTranslation`

- **File:** `client/src/pages/Signup.jsx` (no i18n imports), `client/src/locales/en.json:95-137` + `es.json:95-137`
- **Issue:** ~30 keys under `"signup"` exist in both locales — placeholders for first name, gender labels, referral options, terms-agreement text, error strings, the whole form — and Signup.jsx renders everything as raw English strings. This is intentional per the audit-architecture note ("Most of the WorkoutSession.jsx page — only key surfaces…") which doesn't list Signup; but the keys' presence implies wiring. Pick a posture: either land the wiring now or remove the keys.
- **Fix:** Honest options:
  - **Land it.** Signup.jsx is ~440 lines but a high-impact page — non-English speakers shouldn't see "How did you hear about us?" or "By signing up, you agree to our Terms…" in English when they picked Spanish a click earlier. Probably 30 min of `t()` wiring.
  - **Delete the keys.** Saves bundle, removes the trap of "the keys are there so it must work."

### `nav.signup` ("Sign Up") used as the Login page's "Sign up" link instead of `login.signUpLink` ("Sign up")

- **File:** `client/src/pages/Login.jsx:240`, `client/src/locales/en.json:146`
- **Issue:**
  ```jsx
  <Link to="/signup" ...>{t('nav.signup')}</Link>
  ```
  The `nav.signup` key is intended for nav-bar contexts (the landing page top-bar). `login.signUpLink` exists for exactly this spot. They happen to be the same string in EN, but the ES values diverge: `nav.signup` is "Registrarse" (verb form, "to register"), `login.signUpLink` is "Regístrate" (imperative, "register yourself"). The latter is the right register for "Don't have an account? Sign up" — more conversational. The current code ships the verb-form, which reads slightly stiff in ES.
- **Fix:** `{t('login.signUpLink')}`.

### `Profile` page heading `'PROFILE'` is hardcoded uppercase via `.toUpperCase()`

- **File:** `client/src/pages/Profile.jsx:990` (and similar)
  ```jsx
  <h3>{t('profile.workoutHistory').toUpperCase()}</h3>
  ```
- **Issue:** Calling `.toUpperCase()` on translated strings works for Latin scripts (English + Spanish) but breaks for any future locale where the uppercase form changes the letter (German ß, Turkish dotless ı, etc.). And more practically: it forces the translation to be designed in lowercase, even when the source string is naturally Title Case. The Spanish translations in es.json are Title Case ("Historial de entrenamientos") — uppercasing them gives "HISTORIAL DE ENTRENAMIENTOS" which is exactly what's intended visually, fine. But future locales won't be so lucky. Not urgent.
- **Fix:** Use CSS `text-transform: uppercase` (already applied via `letterSpacing: '0.3em'` neighbors in the same file). Drop the `.toUpperCase()` call.

### Spanish translation: `"feed": "Comunidad"` doesn't match `"feed"` semantically

- **File:** `client/src/locales/es.json:37`
- **Issue:** EN says "Feed", ES says "Comunidad" (Community). Reasonable rebranding choice — "Feed" is awkward in Spanish — but flag it because it's semantically distinct. The current EN matches the BottomNav tab in App ("Community" tab on the homepage), so the ES choice is actually *more* accurate to the page's content than the EN key name. Suggest renaming the key to `nav.community` and updating both locales for consistency.
- **Fix:** Optional. Rename `nav.feed` → `nav.community` if shipping more nav-tab work soon.

### `common.tomorrow` = "Mañana" — could be ambiguous with "morning"

- **File:** `client/src/locales/es.json:12`
- **Issue:** "Mañana" in Spanish means *both* "tomorrow" and "morning" depending on context. As a standalone label after a workout name ("Push Day — Mañana"), users will read it as tomorrow (correct). But on a screen where time-of-day context exists nearby, "Mañana" could ambiguously read as "morning". Not a bug per se, just worth knowing. No fix needed unless the card surrounds it with "Día" copy that pushes the wrong reading.

### `workouts.previewNext` Spanish = "Ver el siguiente" — borderline awkward

- **File:** `client/src/locales/es.json:187`
- **Issue:** "Ver el siguiente" literally back-translates to "See the next one". Not wrong but stilted. More natural Spanish: "Ver siguiente" (drop article) or "Próximo entrenamiento". Same finding: `workouts.preview` = "Ver" reads as "to see" rather than "Preview" — natives would say "Vista previa". Style judgment; flagging not enforcing.
- **Fix:** Optional. Reword to "Vista previa" + "Vista del siguiente" if you have a native ES reviewer in the loop.

### `session.setType.straight` Spanish "Directa" is uncommon gym vocab

- **File:** `client/src/locales/es.json:223`
- **Issue:** ES gym lifters typically call this "Serie normal" or just "Normal" — "Directa" is technically correct but not what someone going to a Mexican/Spanish gym would say or hear. Same exact issue: "Drop set" (line 225) is correct as-is (loanword adoption in ES gym culture).
- **Fix:** Optional. Replace with "Normal" or "Serie normal".

### Push body for streak reminder doesn't preserve the streak number's pluralization in ES

- **File:** `server/i18n.js:63`
- **Issue:** `'push.streakReminder.title': '🔥 No rompas tu racha de {{streak}} días'`. Always says "días" (plural). In ES, "1 día" is grammatically required but the scheduler only fires for `streak >= 2` so the 1-day case never hits. So this is *fine in practice* — but if the threshold ever drops to ≥1, it'd read "racha de 1 días" which is wrong. Same EN string has the same shape ("Don't break your 1-day streak") — but EN allows "1-day" with hyphen which sidesteps the issue.
- **Fix:** Defensively, use `{{streak, plural, one {día} other {días}}}` if you swap i18next for the push code — or just gate the message on streak >=2 (it already is) and leave a comment.

### Push title for weekly summary `'✨ Tu semana en REPLAB'` puts emoji *before* article — fine but check rendering on Android

- **File:** `server/weeklySummaryScheduler.js:139`
- **Issue:** Cosmetic — Android system notification on some launchers truncates the leading emoji + first 1-2 chars of the title. iOS handles it fine.
- **Fix:** None unless QA on Android sees truncation.

### Capacitor device-locale not wired into the precedence chain

- **File:** `client/src/i18n.js:45-55` (detection config)
- **Issue:** The architecture doc calls this out explicitly. On native, `navigator.language` reflects browser/webview default, which may not match the user's iOS Settings → Language pick. Capacitor's `@capacitor/device` plugin exposes `Device.getLanguageCode()` which returns the real OS setting. Wiring it in as the first non-querystring detector would close the "ES-preferring user on EN-default Capacitor webview" gap mentioned in P1 above.
- **Fix:** Add a custom i18next detector that calls `Device.getLanguageCode()` when `Capacitor.isNativePlatform()`. Position it between querystring and localStorage.

### `i18n.language === 'fr'` fallback behavior — confirmed correct, document anyway

- **File:** `client/src/i18n.js:64-69`
- **Issue:** Manual trace requested. Suppose `localStorage.replab_locale === 'fr'` (user toggled to a French preview build then downgraded). LanguageDetector returns 'fr'. i18next normalizes 'fr' → 'fr' (no parent match) → falls back to `fallbackLng: 'en'` for resource lookup. `i18n.language` initially holds 'fr' until the `'languageChanged'` handler at line 64-69 fires `changeLanguage(DEFAULT_LOCALE)`, which overwrites the localStorage cache to 'en'. **Net: user sees English copy, localStorage gets fixed up.** Correct behavior.
- **Fix:** None — works. Mention in the launch checklist that the self-healing is intentional.

### `userResponse(user)` re-defaults locale even though `findUserById` already does

- **File:** `server/routes/auth.js:49`, `server/db.js:396, 413`
- **Issue:**
  ```js
  // db.js (already defaults)
  locale: u.locale || 'en'
  // auth.js (defaults again)
  locale: user.locale || 'en'
  ```
  Double-default is harmless but a code smell — if someone "fixes" the db.js default to throw on missing locale (e.g. after Path B refactor of users), the route default will mask the bug.
- **Fix:** Pick one site. Route should pass through `user.locale` verbatim and trust the DB layer to default.

### Server stamps `locale = 'en'` for demo users — fine but undocumented

- **File:** `server/routes/auth.js:258-269`
- **Issue:** Demo user creation calls `db.createUser({ email, phone: null, passwordHash })` without a locale. `createUser` defaults to `'en'` via `(locale === 'es' ? 'es' : 'en')`. Demo users have no email so they never get a welcome email anyway. Fine — but the demo flow should probably honor the client's `i18n.language` so the in-app strings render in ES if the demo-clicker picked ES. Currently the demo path is `AuthContext.demo()` → `applyAuth(data)` → since `data.user.locale === 'en'`, applyAuth will force the app back to EN, undoing the user's pick. Subtle UX regression.
- **Repro:** Flip ES on landing → click whatever surfaces the demo button → app reverts to EN after demo logs in.
- **Fix:** Stamp `locale` into the demo payload too. Same one-liner as signup:
  ```js
  const locale = (i18n.language || 'en').split('-')[0] === 'es' ? 'es' : 'en';
  await api('/auth/demo', { method:'POST', body: JSON.stringify({ locale }) });
  ```
  And accept it in the `/auth/demo` route. (No demo button is currently surfaced to end users per the launch plan, so very low priority — but the gap exists.)

### `pickedLocale` log noise: every PATCH /auth/me/locale logs nothing

- **File:** `server/routes/auth.js:243-256`
- **Issue:** The route is silent on success. If launch debugging needs to confirm that the route fired, there's no log line — only a 200. Logging `console.log('[locale] user', userId, '→', locale)` on success would help diagnose "my Spanish toggle didn't stick" tickets without database access.
- **Fix:** Add a one-line log.

### `friendlyError` import absent from Login but `t('login.errors.*')` is the fix path

- (Sub-finding under the P1 above; not double-counted.)

### `bibleVersesDescription` in ES says "después de cada 5 entrenamientos completados" — drops the ordinal

- **File:** `client/src/locales/es.json:170`
- **Issue:** EN: "Show a verse after every 5th completed workout." ES: "Muestra un versículo después de cada 5 entrenamientos completados." The EN ordinal "5th" implies "every fifth one"; the ES drops the ordinal and reads as "after every set of 5 workouts" — which is the same outcome but the sentence is slightly less crisp. Native phrasing: "Muestra un versículo cada 5 entrenamientos completados." (Drop "después de".)
- **Fix:** Minor wording polish.

---

## Things that look correct

- **Build pipeline.** `vite build` finishes in 8.87s with no i18next-related warnings. All 8 touched server modules `node --check` clean.
- **en/es key parity.** 214 keys in each. Every key in en.json has a corresponding es.json entry (programmatic deep-walk diff returned `[]` for both directions).
- **Locale precedence in `client/src/i18n.js`.** The detector order `['querystring', 'localStorage', 'navigator']` matches the documented chain. `lookupQuerystring: 'lang'` and `lookupLocalStorage: 'replab_locale'` are correct.
- **Server-authoritative on login.** `AuthContext.applyAuth()` at `client/src/context/AuthContext.jsx:147-153` correctly reads `data.user.locale` and overwrites both `localStorage.replab_locale` and `i18n.language` when they differ. This is the intended behavior: a user who flipped ES on Device A, logs in on Device B where EN is set, gets ES because the server is the source of truth. Confirmed.
- **Signup stamps current locale.** `client/src/context/AuthContext.jsx:182` reads `i18n.language` at signup time and gates to `'en'|'es'` before sending. Routes through to `db.createUser` and the user_locale CHECK constraint. End-to-end correct.
- **DB schema.** `users.locale TEXT DEFAULT 'en' CHECK (locale IN ('en','es'))` is in schema.sql. The idempotent ALTER + guarded CHECK in initDb.js (lines 549-556) matches the migration script. Re-running the migration on a partially-applied DB is safe (`IF NOT EXISTS` on column, `NOT EXISTS (SELECT 1 FROM pg_constraint...)` on the check).
- **REPLAB brand uppercasing.** Grepped both `client/src/locales/es.json` and `server/i18n.js` for `replab|RepLab`. Every hit is the all-caps "REPLAB" form. Brand discipline holds in ES.
- **i18next `nonExplicitSupportedLngs: true` + `es-MX` etc.** Confirmed: detector returns `'es-MX'`, i18next normalizes to `'es'`, ES resources load.
- **Unsupported-language fallback.** The `'languageChanged'` handler at `client/src/i18n.js:64-69` defensively re-normalizes and forces `DEFAULT_LOCALE` if the detected base isn't supported. So `localStorage.replab_locale = 'fr'` → app starts in EN, localStorage gets corrected.
- **Push notification locales propagate.** Every scheduler (`streakReminderScheduler`, `postSessionPushes.notifyPRCelebration`, `notifyFirstWorkout`, `pushScheduler` idle reminder, `weeklySummaryScheduler`) joins or selects `u.locale` from the users table before composing the message. Streak/PR/idle correctly route through `i18n(locale, ...)`. Weekly summary inlines its own copy (P1 above) but does read the locale.
- **No regressions in adjacent features.** Spot-checked: the `?summary=1` deeplink CTA (`workouts.workoutCompleted`) routes to `/session/:templateId/:date?summary=1` exactly as the prior Next Workout audit prescribed (Workouts.jsx:5133). PR celebration push window (`postSessionPushes.js:47-48`) still uses `last_activity_at` not `created_at` — fix from the prior session audit preserved. Cascade delete (account_deletion_tokens) is untouched.
- **REPLAB brand-name pun in welcome email.** `'See you in the lab,'` → `'Nos vemos en el laboratorio,'` — preserves the wordplay that REPLAB sounds like "rep lab" (laboratory). Nice touch.
- **Translation register is consistent.** Every ES string uses `tú` (informal "you") — no `usted` slip-ups. Right call for a fitness app targeted at gym-going adults.
- **No accidentally translated REPLAB brand.** No `"replab"` or `"RepLab"` typos in either locale file.
