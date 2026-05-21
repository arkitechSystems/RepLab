# REPLAB Pre-Launch Checklist

Living list of things that must be done before App Store / Play Store submission. Updated **2026-05-17** after the Resend domain verification + REPLAB email-copy sweep.

## Done since the last revision (2026-04-30)

- [x] **Exercise library cleanup (Path A)** — 479 → 313 master exercises, 0 orphan PRs, 0 customs leaked into library programs. PR data consolidated across former duplicate names.
- [x] **Path B Phase 1** — added `exercise_id` FK columns + dual-write to template_exercises, session_entries, personal_bests.
- [x] **Path B Phase 2** — server reads switched from `LOWER(name)` joins to id-keyed joins (pbs.js, admin.js, check-exercise-coverage.js).
- [x] **Admin tooling for ongoing maintenance** — uniqueness guard, health page (`/admin/exercise-health`), filter toggle (master/custom/both), promote-custom-to-master button, merge-duplicates UI.
- [x] **Featured Workouts gated** as "Coming Soon" — route gate + non-clickable card. Unlock via `?ff=featured` or localStorage.
- [x] **Challenges section gated** as "Coming Soon" — non-clickable card + `selectedGroup === 'challenges'` view guard.
- [x] **Bundle asset purge** — `Gym cinematic promotion video.mp4` + the entire `client/public/Workouts/` folder moved to the `replab-videos.onrender.com` CDN; ~40 MB removed from the iOS app bundle.
- [x] **Sentry live** — `@sentry/react` + `@sentry/node` configured on Render with `sendDefaultPii: false`. Org `arkitech-systems-llc`, projects `replab-frontend` + `node`.
- [x] **Master library name uniqueness index** prevents future duplicate masters at the DB level.
- [x] **Plate calculator in-session** — long-press a weight input OR tap the ⚖ icon → in-session plate calc modal matching the Utilities page layout. Defaults to bar-only state when set is empty.
- [x] **Brand artwork** — RL logo wired as iOS/Android app icon, PWA icons, Add-to-Home-Screen apple-touch-icon, in-app header, landing nav. Brand spelling normalized to REPLAB everywhere user-facing.
- [ ] **Public web account-deletion flow (Google Play 2024 policy)** — new `/delete-account` page on the public web that accepts an email, emails a single-use confirmation link, and on click performs the same cascade as the in-app delete. New routes `POST /auth/request-deletion` + `GET /auth/confirm-deletion`, table `account_deletion_tokens`, REPLAB-branded `sendDeletionConfirmationEmail`, plus SPA `/account-deleted` and `/account-deletion-failed` landing pages. Migration script: `server/scripts/migrations/2026-05-20-account-deletion-tokens.js`. Privacy policy section 5 updated to point at the new URL. Mark done after smoke-testing email delivery in staging.

## Blocking — Must do before submission

### Apple Developer Program (status: Individual enrollment)
- [x] LLC formation (ArkiTech Systems LLC) + DUNS in hand
- [ ] ~~Apple Developer Program (Organization)~~ — **REJECTED** for trademark conflict ("ArkiTech" flagged as similar to "ARKit"). User enrolled as **Individual** with personal Apple ID. Update copyright to "© 2026 Will Martin" in app-store-metadata.md.
- [ ] Confirm Apple Developer membership purchase verification email received
- [ ] Generate Apple Distribution certificate + provisioning profile (via Xcode auto-signing on first archive)
- [ ] App Transfer plan: post-launch, once LLC name is renamed or new entity formed, use Apple's App Transfer process to move the app from Individual → LLC. Apple ID stays personal; app moves to new account.

### Email (Resend) — ✅ welcome path live
- [x] **Resend domain verification** — `email.replab-fitness.com` verified 2026-05-17. DKIM + SPF (MX + TXT) green in the Resend dashboard. Inbound MX intentionally not started (we don't need to receive at the subdomain).
- [x] **Welcome email end-to-end test** — delivered to `willmartinmail@gmail.com` from `noreply@email.replab-fitness.com`, REPLAB-branded copy.
- [x] **DB welcome template updated** — `email_templates` row swapped from the WillFit-era copy to REPLAB via `server/scripts/update-welcome-email-template.sql`.
- [x] **REPLAB brand sweep across email.js** — welcome / password reset / signup notification / daily summary all use REPLAB (not RepLab).
- [ ] Send test from password reset, signup notification, daily summary paths — confirm deliverability of the remaining transactional flows
- [ ] Push reminder email path (if there is one) — confirm

### iOS push notifications (Xcode work, after Mac access)
- [ ] Open `client/ios/App/App.xcworkspace` in Xcode (on rented Mac or owned Mac)
- [ ] Signing & Capabilities → "+ Capability" → add **Push Notifications** (creates `App.entitlements` with `aps-environment`)
- [ ] Add **Background Modes** capability → check "Remote notifications"
- [ ] Create APNs Auth Key (.p8) in Apple Developer Portal
- [ ] Upload .p8 to Firebase Console → Cloud Messaging → APNs Authentication Key
- [ ] (Code change) Wire `@capacitor-firebase/messaging` (or equivalent) so iOS uses FCM transport
- [ ] Or accept push-notifications-Android-only for v1; document in privacy policy

### Mac access for building .ipa
- [ ] Rent MacinCloud / MacStadium OR get access to a physical Mac with Xcode 15+
- [ ] Install Xcode (~10-15 GB)
- [ ] Clone repo on the Mac, run `cd client && npm install && npm run build && npx cap sync ios && open ios/App/App.xcworkspace`
- [ ] Archive → Upload → TestFlight smoke test before submitting

### App Store Connect / Play Console assets
- [ ] Create App Store Connect listing — bundle ID `com.replab.fitness`
- [ ] Create Play Console listing — package name `com.replab.fitness`
- [ ] App Store Connect: privacy/marketing/support URLs → `https://replab-fitness.com/privacy`, `/`, `/support`
- [ ] App Store screenshots (6.9" iPhone 1320×2868 required, 6.5" or 6.7" also recommended) — 3-10 images
- [ ] Play Store screenshots (phone, optionally tablet)
- [ ] Feature graphic (Play only) — 1024×500
- [ ] App Review Notes — paste from `_marketing/app-review-notes.md`
- [ ] Privacy nutrition label / Data Safety form — paste from `_marketing/privacy-nutrition-answers.md`
- [ ] App description / subtitle / keywords — paste from `_marketing/app-store-metadata.md` (refresh first; see notes there for Featured-gated copy)
- [ ] Demo reviewer account — run `node --env-file=server/.env server/scripts/seed-apple-reviewer.js` against production DB once ready; verify creds work in App Review Notes
- [ ] Verify account-deletion path is reachable from Profile (Apple required since 2022)

### Domain + universal links
- [ ] Set `APPLE_TEAM_ID` env var on Render backend (replaces `TEAMID` placeholder in AASA) — after Apple Dev membership active
- [ ] Generate Android upload keystore (or enable Play App Signing)
- [ ] Get Android SHA-256 release fingerprint from Play Console → set `ANDROID_SIGNING_SHA256` env var on Render
- [ ] Verify `https://replab-fitness.com/.well-known/apple-app-site-association` returns valid JSON over HTTPS
- [ ] Verify `https://replab-fitness.com/.well-known/assetlinks.json` returns valid JSON over HTTPS
- [ ] Xcode → Signing & Capabilities → Associated Domains → add `applinks:replab-fitness.com`

### Payments
- [ ] iOS Pro tier: hidden entirely (Apple 3.1.1 — Stripe path off on iOS); confirm by smoke test on TestFlight
- [ ] Stripe webhook URL → flip to `https://replab-fitness.com/billing/webhook` on Stripe dashboard
- [ ] Verify Stripe live mode keys in Render env vars (not test keys)

### Legal
- [ ] Replace LLC state placeholder `[STATE TBD]` in `client/src/pages/Terms.jsx` (governing law)
- [ ] If Individual enrollment: ensure Privacy + Terms still reference ArkiTech Systems LLC as the legal entity (the app is owned by the LLC, just published under personal Apple ID for now); confirm with counsel
- [ ] Lawyer review of `Privacy.jsx` and `Terms.jsx` — esp. auto-renewal disclosure (CA, NY have specific rules)

## Should do — Polish before submission

- [ ] PostHog → Authorized URLs → add `replab-fitness.com`
- [ ] Sentry → Allowed Domains → add `replab-fitness.com`
- [ ] PostHog session replay masking — confirm `maskAllInputs: true` (or equivalent) so emails/names aren't captured in replays
- [ ] Confirm Splash image asset is in Xcode project (LaunchScreen.storyboard references "Splash" — if missing, app crashes on launch)
- [ ] Manual test: Profile → Delete Account on iOS Simulator — confirm cascade works end-to-end
- [ ] Run `server/tests/cascade-delete.test.js` against staging DB to validate orphan-free deletion
- [ ] Decide: keep `RepLab` as iOS home-screen `CFBundleDisplayName` or flip to all-caps `REPLAB` (currently strings.xml says `RepLab` for Android too)
- [ ] **Trainers demo content** — `client/src/data/trainers.js` ships a mock Zumba Jason trainer with fake stats. Either gate the trainers feature like Featured/Challenges, or replace with real trainer data, or stub the list to empty for v1. See `_marketing/DEMO-CONTENT-AUDIT.md`.
- [ ] Decide whether to use the App Store Notes-to-Reviewer to explain the Featured/Challenges "Coming Soon" gating, OR keep the gated state silent (current plan is silent — the COMING SOON label is sufficient)

## Nice to have — Post-launch OK

- [ ] App icon: design a simplified glyph for 20×20 / notification sizes (current RL wordmark may go illegible at that resolution)
- [ ] Optional: 301 redirect `will-fit.shop` → `replab-fitness.com` for old email links (keep alive 6+ months)
- [ ] Localized App Store keywords for non-English markets
- [ ] Wire StoreKit IAP for iOS Pro tier (currently iOS is free-tier-only per 3.1.1)
- [ ] App Transfer to LLC once new entity / renamed LLC has a clean Apple Dev account
- [ ] Plate calculator + Plate Calculator Modal — fully deduplicated via `client/src/utils/plateMath.js`; visual components still per-file. Could extract further if drift becomes a problem.

---

**See also:**
- `_marketing/app-store-metadata.md` — paste-ready Apple + Play store copy
- `_marketing/app-review-notes.md` — paste-ready Apple Review Notes
- `_marketing/privacy-nutrition-answers.md` — paste-ready privacy questionnaires
- `MIGRATION.md` — exact file:line values to flip at LLC cutover
- `/admin/url-conversion` — interactive URC checklist with persisted state
