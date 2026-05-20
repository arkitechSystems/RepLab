# REPLAB — Privacy Questionnaire Answers (App Store + Play Store)

Refreshed **2026-05-19** for submission day. Paste-ready answers below; TODOs at the end.

Tracking declaration: REPLAB does **NOT** use any data for tracking
across apps or websites owned by other companies. All "tracking"
columns in the tables below are therefore **No**. No third-party
advertising SDKs are present.

Data categories collected: Contact Info (name, email, phone), Health
& Fitness (workout data, body metrics), Photos (profile picture
upload only), User Content (session notes, feedback), Identifiers
(user_id, device push token), Usage Data (PostHog product analytics),
Diagnostics (Sentry error reports), Financial Info (subscription
metadata only — card data never touches our servers; iOS Free build
exposes no purchase path per Apple 3.1.1).

---

## App Store Connect — Privacy Nutrition Label

| Apple category | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Contact Info (name, email, phone) | Yes | Yes | No | App Functionality (auth + Resend transactional email) |
| Health & Fitness (workouts, sets/reps, weights, body metrics) | Yes | Yes | No | App Functionality, Product Personalization (workout tracking) |
| Financial Info (subscription metadata only) | Yes | Yes | No | App Functionality (Stripe — web/Android only; iOS Free build exposes no purchase path) |
| Location | Yes | Yes | No | App Functionality (zip code at signup; IP-derived city/state via ip-api.com) |
| Sensitive Info | No | — | — | — |
| Contacts (trainer-client relationships only — no address book) | Yes | Yes | No | App Functionality (program sharing) |
| User Content (session notes, feedback, feed reactions) | Yes | Yes | No | App Functionality |
| Browsing History | No | — | — | — |
| Search History | No | — | — | — |
| Identifiers (user_id, username, device push token) | Yes | Yes | No | App Functionality |
| Purchases (subscription metadata) | Yes | Yes | No | App Functionality |
| Usage Data | Yes | Yes | No | App Functionality, Analytics (PostHog events + session replay) |
| Diagnostics | Yes | No | No | App Functionality (Sentry frontend `@sentry/react` + backend `@sentry/node`; `sendDefaultPii: false`; no IPs, cookies, or request bodies sent) |
| Photos (profile picture upload only — no photo library scanning) | Yes | Yes | No | App Functionality |
| Other Data (UTM params, referral source, timezone, signup device, gender) | Yes | Yes | No | App Functionality |

---

## Google Play — Data Safety form

| Play category | Collected? | Encrypted in transit? | Encrypted at rest? | User can delete? |
|---|---|---|---|---|
| Personal Info (name, email, phone, user ID, zip) | Yes | Yes (TLS) | Yes (PostgreSQL on Render) | Yes (`DELETE /auth/delete-account`) |
| Financial Info (subscription metadata only — no card data) | Yes | Yes (TLS) | Yes | Yes (cascade) |
| Health and Fitness (workouts, reps, weights, body metrics) | Yes | Yes (TLS) | Yes | Yes (cascade) |
| Messages | No | — | — | — |
| Photos and Videos | No | — | — | — |
| Audio Files | No | — | — | — |
| Files and Docs | No | — | — | — |
| Calendar (schedule_days table) | Yes | Yes (TLS) | Yes | Yes (cascade) |
| Contacts (trainer-client links only — no address book) | Yes | Yes (TLS) | Yes | Yes (cascade) |
| App Activity (page_visits, feed reactions, login history) | Yes | Yes (TLS) | Yes | Yes (cascade) |
| Web Browsing | No | — | — | — |
| App Info & Performance (Sentry frontend + backend; PostHog session replay) | Yes | Yes (TLS) | Yes (at Sentry / PostHog US Cloud) | Sentry: anonymous (no user link). PostHog replay: linked to user_id (deletes when user is deleted from PostHog). |
| Device or Other IDs (push tokens; UA-derived device class) | Yes | Yes (TLS) | Yes | Yes (cascade) |

---

## Third-party data flows (declare in privacy policy)

All vendors below process user data **only for app functionality** and
not for third-party advertising or cross-app tracking. No third-party
ad SDK is present in the app.

| Vendor | Status | Apple privacy category | Retention | What's sent | Linked to user ID? |
|---|---|---|---|---|---|
| **PostHog** | Active (`VITE_POSTHOG_KEY`; US Cloud, `https://us.i.posthog.com`) | Usage Data, Diagnostics | PostHog default (30 days for session replay, configurable; events retained per PostHog plan settings) | (a) Auto-pageviews + custom events: `login_completed`, `signup_completed`, `program_created`, `workout_session_started`, `workout_session_completed`. `identify(userId, {email, username})`. `person_profiles: 'identified_only'`. Opt-out in dev. (b) **Session replay** (enabled by default during PostHog onboarding; confirmed in prod via `us.i.posthog.com/s/`): records clicks, scrolls, mouse moves, form interactions, and DOM state changes. Default masking covers password fields only — emails, names, and other free-text fields rendered in the UI ARE captured. | Yes (replays linked to `user_id` via `identify`) |
| **Sentry** | Active on both frontend and backend (`@sentry/react` v10.47.0; `@sentry/node` v10.47.0) | Diagnostics | Sentry org retention (default 90 days for errors on paid plans) | Uncaught errors + 10% performance traces. `sendDefaultPii: false` on both clients — IP addresses, cookies, and request bodies are NOT sent. Events include URL, HTTP method, browser, OS, and runtime version. Source maps uploaded via `@sentry/vite-plugin`. Org `arkitech-systems-llc`; projects `replab-frontend` and `node`. Common non-actionable errors filtered. | No (no `setUser` call; events anonymous) |
| **Stripe** | Active on web + Android. **Hidden on iOS** per Apple 3.1.1 — no purchase path is exposed on the iOS Free build. | Financial Info, Purchases | Stripe customer record retained for chargeback / refund window per Stripe terms | Customer email + user_id as metadata; subscription events. Card data never touches our servers. | Yes (Stripe customer ID ↔ user ID) |
| **Resend** | Active | Contact Info | Resend default retention for transactional sends | Recipient email + transactional content (welcome, password reset). | Yes |
| **Firebase Cloud Messaging** | Active on Android. **Pending on iOS** — Capacitor + `@capacitor-firebase/messaging` are wired; `GoogleService-Info.plist` must be present in the iOS Xcode project for FCM token exchange to succeed. The app silently skips push registration if the plist is missing. | Identifiers | Push token retained until user deletes account or revokes notification permission | Device push token + notification payload (workout reminders, PR celebrations, weekly summary). | Yes |
| **Anthropic Claude API** | Active for the **AI Workout Generator** (Pro-tier feature). **Not reachable from the iOS Free build** — Pro is hidden on iOS per Apple 3.1.1. | User Content, Usage Data | Anthropic's zero-data-retention API tier where applicable; otherwise Anthropic's standard terms | User-submitted workout/training prompts (e.g. goals, equipment, experience level). | Indirect (we store token counts + cost per `user_id` server-side; Anthropic itself sees only the prompt, no `user_id`) |
| **ip-api.com** | Active (best-effort, non-blocking) | Location (coarse) | ip-api does not retain per their public docs | IP address only → returns city/state. | No (IP only; no `user_id` sent) |

---

## Account deletion flow (already implemented)

- **In-app path:** Profile tab -> **Delete Account** button (next to Export My Data, below Sign Out). User confirms by re-entering their password AND typing `DELETE` into the confirmation field. Satisfies Apple Guideline 5.1.1(v).
- Endpoint: `DELETE /auth/delete-account` — password-verified
- Cascades through 19+ tables: programs, templates, sessions, session_entries, personal_bests, schedule_days, user_metrics, ai_usage, feedback, subscriptions, device_tokens, feed_reactions, trainer_clients, trainer_applications, challenge_entries, shared_programs, page_visits, user_login_history, password_reset_log, trainer_sessions
- Custom exercises kept but `created_by` set to NULL (attribution removed)
- Hard delete, immediate, no retention period
- Data portability: `GET /auth/export-data` returns full JSON dump

---

## Client-side storage

`localStorage` (NOT httpOnly — JS readable):
- `replab_token` (JWT access)
- `replab_refresh_token` (JWT refresh)
- `replab_user` (id, email, phone, names, username, role, plan, trialEnd, photoUrl)
- `wf-bible-verses` (UI preference)

Tokens are signed; rotation on refresh; `tokenVersion` invalidates on password change.

---

## TODOs / gaps to resolve before submission

1. ~~**Sentry DSN unset in prod**~~ — RESOLVED 2026-05-01. `VITE_SENTRY_DSN` and `SENTRY_DSN` are set on Render; both `@sentry/react` and `@sentry/node` are live in production with `sendDefaultPii: false`. Source maps upload via `@sentry/vite-plugin`.
1a. ~~**PostHog session replay disclosure**~~ — RESOLVED 2026-05-20. Decision: keep replay enabled in production. Already declared in the Apple privacy nutrition table above as `Usage Data` (App Functionality, Analytics — PostHog events + session replay) and `App Info & Performance` (linked to user_id, deletes via cascade when user is deleted from PostHog). Also covered in `client/src/pages/Privacy.jsx` under analytics disclosures. Recommend tightening masking before scale (`session_recording: { maskAllInputs: true, maskTextSelector: '[data-sensitive]' }`) but not required for v1 submission.
2. **Verify PostgreSQL encryption-at-rest on your Render plan** — confirm in Render docs/billing; affects the "encrypted at rest = Yes" claims above.
3. **iOS push notifications** — Capacitor + `@capacitor-firebase/messaging` are wired in `client/src/utils/push.js`; the iOS build swaps the raw APNs token for an FCM token before registering it with our server. The remaining step is on the Mac side: `GoogleService-Info.plist` must be added to the iOS Xcode project before the build is uploaded. Without it, push registration silently no-ops rather than storing a dead APNs token.
4. **Data retention schedule** — currently nothing auto-purges (login history, password_reset_log, page_visits grow forever). Recommend: 90-day cap on `user_login_history` and `password_reset_log`. Not a blocker but worth flagging in policy.
5. **COPPA** — code has no under-13 gating. If you're not targeting under-13, add a "13+" line to Terms; if you are, add COPPA-compliant flow.
6. **Trainer session timeout** — `trainer_sessions` table has no visible timeout. Audit before launch.
7. **Admin export** — `/admin` route can export all users to Excel. Make sure admin auth is strong; consider IP allowlist.
8. **PostHog & Sentry account provisioning** — accounts must exist and be configured before launch (env vars need real DSN/keys).
9. **Cascade-delete smoke test** — run a real delete in staging and confirm zero rows left across all 22 tables.

---

## What to paste where

- **App Store Connect → App Information → App Privacy:** use the table in section 1.
- **Play Console → App content → Data safety:** use the table in section 2.
- **Privacy Policy** (`/privacy` page): all sections above plus the third-party vendor list.
- **Terms** (`/terms`): standard SaaS + medical-advice disclaimer.
- **Support** (`/support`): contact email + links to privacy/terms.
