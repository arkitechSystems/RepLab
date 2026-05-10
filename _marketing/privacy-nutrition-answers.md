# RepLab — Privacy Questionnaire Answers (App Store + Play Store)

Generated 2026-04-29 by background audit of the codebase. Paste-ready answers below; a few TODOs flagged at the end.

---

## App Store Connect — Privacy Nutrition Label

| Apple category | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Contact Info | Yes | Yes | No | App Functionality (email/phone for auth; Resend for transactional email) |
| Health & Fitness | Yes | Yes | No | App Functionality, Product Personalization (workout tracking) |
| Financial Info | Yes | Yes | No | App Functionality (Stripe subscription metadata; cards never handled by app) |
| Location | Yes | Yes | No | App Functionality (zip code at signup; IP-derived city/state) |
| Sensitive Info | No | — | — | — |
| Contacts | Yes | Yes | No | App Functionality (trainer-client relationships, program sharing) |
| User Content | Yes | Yes | No | App Functionality (session notes, feedback, feed reactions) |
| Browsing History | No | — | — | — |
| Search History | No | — | — | — |
| Identifiers | Yes | Yes | No | App Functionality (device push tokens, user_id, username) |
| Purchases | Yes | Yes | No | App Functionality (subscription metadata) |
| Usage Data | Yes | Yes | No | App Functionality, Analytics (PostHog events + session replay; Sentry performance traces) |
| Diagnostics | Yes | No | No | App Functionality (Sentry errors on frontend `@sentry/react` and backend `@sentry/node`; `sendDefaultPii: false`; no IPs, cookies, or request bodies sent) |
| Other Data | Yes | Yes | No | App Functionality (UTM params, referral source, timezone, signup device, gender) |

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

| Vendor | Status | What's sent | Linked to user ID? |
|---|---|---|---|
| **PostHog** | Active (`VITE_POSTHOG_KEY`; US Cloud, `https://us.i.posthog.com`) | (a) Auto-pageviews + custom events: `login_completed`, `signup_completed`, `program_created`, `workout_session_started`, `workout_session_completed`, `featured_program_viewed`. `identify(userId, {email, username})`. `person_profiles: 'identified_only'`. Opt-out in dev. (b) **Session replay** (enabled by default during PostHog onboarding; confirmed in prod via `us.i.posthog.com/s/` requests): records clicks, scrolls, mouse moves, form interactions, and DOM state changes (effectively a video of the in-app UI). Default masking covers password fields only — emails, names, and other free-text fields rendered in the UI ARE captured. Replays stored in PostHog US Cloud subject to PostHog's retention policy (default 30 days on free/paid tiers unless changed in project settings). | Yes (replays linked to `user_id` via `identify`) |
| **Sentry** | Active on both frontend and backend (`@sentry/react` v10.47.0 with `VITE_SENTRY_DSN`; `@sentry/node` v10.47.0 with `SENTRY_DSN`) | Uncaught errors + 10% performance traces. `sendDefaultPii: false` on both clients — IP addresses, cookies, and request bodies are NOT sent. Events include URL, HTTP method, browser, OS, and runtime version. Source maps uploaded via `@sentry/vite-plugin` so stack traces resolve to original source. Org `arkitech-systems-llc`; projects `replab-frontend` and `node` (backend). Common non-actionable errors filtered (`ResizeObserver loop`, `Network request failed`, `Load failed`, `AbortError`). | No (no `setUser` call; events anonymous) |
| **Stripe** | Active for paid plans | Customer email + user_id as metadata; subscription events. Card data never touches our servers. | Yes (Stripe customer ID ↔ user ID) |
| **Resend** | Active | Recipient email + transactional content (welcome, password reset, admin notifications). | Yes |
| **Firebase Cloud Messaging** | Optional (`FCM_SERVICE_ACCOUNT_JSON`) | Device push tokens + notification payload. | Yes |
| **Anthropic Claude API** | Active (AI trainer feature) | Workout/training queries. Anthropic's own retention terms apply. | Indirect (we store token counts + cost per `user_id`) |
| **ip-api.com** | Active (best-effort, non-blocking) | IP address only → returns city/state. | No (IP only; no user_id sent) |

---

## Account deletion flow (already implemented)

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
1a. **PostHog session replay disclosure** — replay is on by default and captures emails/names rendered in the UI. Either (i) add explicit replay disclosure to the privacy policy and consider an opt-out toggle, or (ii) tighten masking in the PostHog project (set `session_recording: { maskAllInputs: true, maskTextSelector: '...' }`) before launch.
2. **Verify PostgreSQL encryption-at-rest on your Render plan** — confirm in Render docs/billing; affects the "encrypted at rest = Yes" claims above.
3. **iOS push notifications** — Capacitor returns raw APNs tokens; for FCM you need to integrate the Firebase Messaging SDK in the iOS project. If skipping FCM on iOS, document that push is FCM-only on Android in the privacy policy.
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
