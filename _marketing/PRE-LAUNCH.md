# REPLAB Pre-Launch Checklist

Living list of things that must be done before App Store / Play Store submission. Updated 2026-04-30.

## Blocking — Must do before submission

### Email (Resend)
- [ ] **Resolve open Resend email issue** ← Will flagged 2026-04-30. Fix before launch.
- [ ] Add `replab-fitness.com` (or `email.replab-fitness.com` subdomain) to Resend dashboard
- [ ] Add SPF, DKIM (×3), DMARC DNS records at registrar
- [ ] Click Verify in Resend; wait for green checks
- [ ] Send test from each transactional path: welcome, password reset, signup notification, daily summary, push reminder — confirm deliverability

### Sentry (10 min of dashboard work)
- [ ] Create sentry.io account + organization
- [ ] Create two projects: `replab-frontend` (React) and `replab-backend` (Node.js) — copy each DSN
- [ ] Set `VITE_SENTRY_DSN` on Render frontend service env vars
- [ ] Set `SENTRY_DSN` on Render backend service env vars
- [ ] Trigger a test error in production; confirm it lands in Sentry dashboard

### iOS push notifications (Xcode work)
- [ ] Open `client/ios/App/App.xcworkspace` in Xcode
- [ ] Signing & Capabilities → "+ Capability" → add **Push Notifications** (creates `App.entitlements` with `aps-environment`)
- [ ] Add **Background Modes** capability → check "Remote notifications"
- [ ] (After Apple Dev account) Create APNs Auth Key (.p8) in Apple Developer Portal
- [ ] (After Apple Dev account) Upload .p8 to Firebase Console → Cloud Messaging → APNs Authentication Key
- [ ] (Code change) Wire `@capacitor-firebase/messaging` (or equivalent) so iOS uses FCM transport

### App Store Connect / Play Console assets
- [ ] App Store Connect: privacy policy URL, marketing URL, support URL → set to `https://replab-fitness.com/privacy`, `/`, `/support`
- [ ] App Store screenshots (6.7" iPhone required, 1290×2796) — 3-10 images
- [ ] Play Store screenshots
- [ ] App Review Notes — paste from `_marketing/app-review-notes.md`
- [ ] Privacy nutrition label / Data Safety form — paste from `_marketing/privacy-nutrition-answers.md`
- [ ] App description / subtitle / keywords — paste from `_marketing/app-store-metadata.md`
- [ ] Demo reviewer account — run `node --env-file=server/.env server/scripts/seed-apple-reviewer.js` against production DB once ready

### LLC / DUNS chain (everything below this is gated)
- [ ] LLC formation finalized
- [ ] Apply for DUNS number
- [ ] Apple Developer Program (Organization) enrollment with DUNS
- [ ] Generate Apple Distribution certificate + provisioning profile
- [ ] Set `APPLE_TEAM_ID` env var on Render backend (replaces `TEAMID` placeholder in AASA)
- [ ] Generate Android upload keystore (or enable Play App Signing)
- [ ] Get Android SHA-256 release fingerprint from Play Console → set `ANDROID_SIGNING_SHA256` env var on Render
- [ ] Verify `https://replab-fitness.com/.well-known/apple-app-site-association` returns valid JSON over HTTPS
- [ ] Verify `https://replab-fitness.com/.well-known/assetlinks.json` returns valid JSON over HTTPS
- [ ] Xcode → Signing & Capabilities → Associated Domains → add `applinks:replab-fitness.com`
- [ ] Stripe webhook URL → flip to `https://replab-fitness.com/billing/webhook`
- [ ] Replace LLC state placeholder `[STATE TBD]` in `client/src/pages/Terms.jsx` (governing law)

## Should do — Polish before submission

- [ ] PostHog → Authorized URLs → add `replab-fitness.com`
- [ ] Sentry → Allowed Domains → add `replab-fitness.com`
- [ ] Confirm Splash image asset is in Xcode project (LaunchScreen.storyboard references "Splash" — if missing, app crashes on launch)
- [ ] Manual test: Profile → Delete Account on iOS Simulator — confirm cascade works end-to-end
- [ ] Run `server/tests/cascade-delete.test.js` against staging DB (set `DATABASE_URL`) to validate orphan-free deletion
- [ ] Decide: keep `RepLab` as iOS home-screen `CFBundleDisplayName` or flip to all-caps `REPLAB`
- [ ] Lawyer review of `Privacy.jsx` and `Terms.jsx` — esp. auto-renewal disclosure (CA, NY have specific rules)

## Nice to have — Post-launch OK

- [ ] App icon: design a simplified glyph for 20×20 / notification sizes (current REPLAB wordmark goes illegible at that resolution)
- [ ] Optional: 301 redirect `will-fit.shop` → `replab-fitness.com` for old email links (keep alive 6+ months)
- [ ] Localized App Store keywords for non-English markets
- [ ] Wire StoreKit IAP for iOS Pro tier (currently iOS is free-tier-only per 3.1.1)

---

**See also:**
- `_marketing/app-store-metadata.md` — paste-ready Apple + Play store copy
- `_marketing/app-review-notes.md` — paste-ready Apple Review Notes
- `_marketing/privacy-nutrition-answers.md` — paste-ready privacy questionnaires
- `MIGRATION.md` — exact file:line values to flip at LLC cutover
- `/admin/url-conversion` — interactive URC checklist with persisted state
