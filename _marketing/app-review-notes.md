# App Review Information — REPLAB

Paste the body below into App Store Connect:
App Information -> App Review Information -> Notes (max 4000 chars).

Last refreshed: 2026-05-19 (submission day).

---

## Demo reviewer account

- Email: `apple-reviewer@replab-fitness.com`
- Password: `Reviewer2026!`

The account is pre-seeded by `server/scripts/seed-apple-reviewer.js` and
is idempotent — running it again before submission refreshes the
password, profile, schedule, and historical sessions in a single
transaction.

What the reviewer will see immediately after signing in:

- Free tier (`role=user`, `plan=Free`). This mirrors a real new iOS user.
- The library program **Jeff Nippard's Push Pull Legs** assigned to
  their schedule for the next 7 days (today plus six). The seed script
  intentionally avoids `is_featured = TRUE` programs because Will's
  Hypertrophy is gated behind a feature flag and not reachable from the
  reviewer's keychain.
- 3–4 already-logged sessions on dates in the past week so the
  Progress / History views are non-empty on first load.
- Body metrics + lift maxes pre-filled
  (70in / 175lb / 15% BF / bench 225 / squat 315 / deadlift 405).

## Step-by-step test flow for the reviewer (under 90 seconds)

1. Open the app — the system push-notification permission prompt may
   appear on first launch (see "Push notifications" below). Allow or
   deny; the rest of the app works either way.
2. Sign in with the credentials above.
3. The Home / Today view shows the workout assigned for today from
   **Jeff Nippard's Push Pull Legs**. Tap into it.
4. Tap any exercise card — set rows are tappable to mark them complete.
   Long-press a weight value (or tap the **PC** button in-session) to
   open the in-app **Plate Calculator**.
5. Tap the viewfinder icon on any exercise card to enter **Full-Screen
   Workout Mode** (one exercise at a time, swipe between exercises).
6. Mark a few sets complete, then tap **Finish Workout**. The session
   posts and any new personal best is auto-detected.
7. Open **Progress** (bottom nav) to see the new session in the history
   list and the PR appear in the recent-PRs list.
8. Open **Profile** (bottom nav) to verify account-management options
   (Export My Data, Delete Account, sign out, legal links).

## Coming Soon sections (gated for v1)

Three sections render as **non-interactive "Coming Soon"** placeholders
in the v1 build:

- **Featured Workouts** (including Will's Hypertrophy)
- **Challenges**
- **Trainers**

These are gated client-side via three localStorage flags
(`rl_ff_featured`, `rl_ff_challenges`, `rl_ff_trainers`) defined in
`client/src/utils/featureFlags.js`. The reviewer's device has a fresh
keychain/localStorage and no way to set the flags, so the sections are
locked from their perspective. They are real features in the codebase
but are not part of the v1 user-facing surface; they will be enabled in
a subsequent release.

## Account deletion (Guideline 5.1.1(v))

In-app account deletion is fully supported:

- **Path:** Profile tab -> **Delete Account** button (below Sign Out,
  next to Export My Data).
- **Confirmation:** the user must re-enter their account password AND
  type the literal word `DELETE` into the confirmation field.
- **Effect:** immediate hard delete with CASCADE across 19+ dependent
  tables (programs, templates, sessions, session_entries,
  personal_bests, schedule_days, user_metrics, ai_usage, feedback,
  subscriptions, device_tokens, feed_reactions, trainer_clients,
  trainer_applications, challenge_entries, shared_programs,
  page_visits, user_login_history, password_reset_log,
  trainer_sessions). Custom exercises authored by the user are kept
  but anonymized (`created_by` set to NULL).
- **Endpoint:** `DELETE /auth/delete-account` (password-verified).

A full JSON data export is also available from the same screen
(**Export My Data**) via `GET /auth/export-data`.

No data is retained after deletion beyond legally required transaction
records — and free-tier accounts have none.

## iOS-specific notes (Guideline 3.1.1)

REPLAB v1 ships **free-tier-only on iOS**.

- All Stripe-checkout paths are hidden when
  `Capacitor.getPlatform() === 'ios'` (see `client/src/pages/Upgrade.jsx`,
  `IS_IOS_NATIVE` guard).
- The tier-comparison view at `/upgrade` renders informationally so
  iOS users can see what the Pro and Elite tiers contain, but no
  purchase or "subscribe" button is exposed inside the iOS app.
- The **AI Workout Generator** is a Pro-tier feature; it is therefore
  not reachable from the iOS Free build via any in-app navigation.
- In-app purchase via StoreKit is planned for a subsequent release.
  Until that ships, the iOS build offers no paid tier.
- Web (desktop browser) and Android keep the full Stripe-based
  subscription flow, which is outside Apple's IAP guidelines and is
  intentionally kept off the iOS surface.

## Push notifications

On first launch the app calls
`PushNotifications.requestPermissions()` (Capacitor) which triggers
the standard iOS system prompt. If the reviewer **denies** the
prompt, every other feature continues to work — push is strictly
opt-in and is only used for:

- Personalized workout reminders at the user's habitual workout time
- Personal-best celebration pushes
- A weekly summary

Server-side delivery is via Firebase Cloud Messaging (`firebase-admin`).
The iOS build uses `@capacitor-firebase/messaging` to swap the raw
APNs token for an FCM token before registering it with our server.
(Note for our own records: GoogleService-Info.plist must be present
in the iOS project for FCM exchange to succeed; without it the app
silently skips push registration rather than storing a dead APNs
token.)

## Things that may confuse a reviewer (proactive list)

- The **Upgrade** screen at `/upgrade` is reachable but shows no
  purchase button on iOS. This is intentional per Guideline 3.1.1, not
  a broken screen.
- The **Featured Workouts**, **Challenges**, and **Trainers** sections
  show "Coming Soon" placeholders. This is intentional for v1 — the
  features are gated, not unfinished.
- The app uses a mixed-case **RepLab** wordmark on the iOS home-screen
  label (`CFBundleDisplayName`) and all-caps **REPLAB** in the App
  Store listing. Both are intentional brand decisions.
- The Home page shows a **plate calculator** and **1RM estimator** in
  the Utilities section. These are general-purpose lifting tools, not
  medical devices, and are explicitly disclaimed in the app
  description.

## Privacy policy, terms, and support

- Privacy policy: https://replab-fitness.com/privacy
- Terms of service: https://replab-fitness.com/terms
- Support: https://replab-fitness.com/support

## Third-party services in use

- Anthropic Claude API — AI Workout Generator (Pro-only; not reachable
  on the iOS Free build)
- Resend — transactional email (welcome, password reset)
- Firebase Cloud Messaging — push notifications (iOS + Android)
- Sentry — error monitoring (no PII; `sendDefaultPii: false`)
- PostHog — product analytics (identified-users only)
- Stripe — billing (web + Android only; hidden on iOS)
- Render — application hosting and PostgreSQL database

## Contact

- Developer email: wmartin@phgworks.com
- Support email: support@replab-fitness.com
- Phone: [REPLACE_WITH_PHONE_OR_REMOVE_LINE]

---

## TODO for the developer before submitting

- [ ] Replace `[REPLACE_WITH_PHONE_OR_REMOVE_LINE]` above (or remove the
      line) — App Review may call if they have questions during review.
- [ ] Re-run the seed script against the production database with the
      exact reviewer password committed above:
      `REVIEWER_PASSWORD='Reviewer2026!' node --env-file=server/.env server/scripts/seed-apple-reviewer.js`
- [ ] Verify login at https://replab-fitness.com (web) with the
      credentials above to confirm the seeded schedule and history are
      visible.
- [ ] Confirm the Delete Account flow works end-to-end against
      production (try with a throwaway user, not the reviewer
      account).
- [ ] Confirm `GoogleService-Info.plist` is in the iOS Xcode project
      before the build is uploaded — otherwise push registration
      silently no-ops on iOS.
- [ ] Confirm the iOS bundle hides the `/upgrade` purchase CTAs in the
      final TestFlight build (smoke test on a real device, not the
      simulator).
