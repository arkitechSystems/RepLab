# LLC Cutover Migration Checklist

When the LLC clears and we get DUNS → Apple Developer org enrollment, several
identity-coupled values change. The server code reads everything cutover-
sensitive from environment variables (see `server/config.js` and
`server/.env.example`). The native build files below cannot be env-driven at
build time and must be edited by hand. Do all of them in a single commit.

## 1. Server (env vars only — no code change)

Set these in the Render dashboard. Defaults in `server/config.js` keep the
pre-cutover values working until you do.

| Env var | Pre-cutover | Post-cutover |
| --- | --- | --- |
| `APP_URL` | `https://will-fit.shop` | `https://replab-fitness.com` |
| `APP_HOST` | (auto) `will-fit.shop` | (auto) `replab-fitness.com` |
| `APPLE_TEAM_ID` | `TEAMID` (placeholder) | real 10-char Team ID from App Store Connect |
| `APP_BUNDLE_ID` | `com.willfit.app` | `com.replab.fitness` |
| `ANDROID_SIGNING_SHA256` | placeholder zeros | SHA-256 of the Play Console upload key |
| `EMAIL_FROM_TRANSACTIONAL` | `RepLab <noreply@email.will-fit.shop>` | `RepLab <noreply@email.replab-fitness.com>` (or chosen subdomain) |
| `EMAIL_FROM_ADMIN` | `RepLab <noreply@will-fit.shop>` | `RepLab <noreply@replab-fitness.com>` |

After redeploy, verify:

- [ ] `https://<new-domain>/.well-known/apple-app-site-association` returns the new `appID`
- [ ] `https://<new-domain>/.well-known/assetlinks.json` returns the new `package_name` + fingerprint
- [ ] Stripe Checkout success/cancel URLs land on the new domain
- [ ] Resend sender domain is verified (DKIM/SPF/DMARC) at the new domain

## 2. Native build files (manual edits)

### Bundle ID — change `com.willfit.app` → `com.replab.fitness`

- [ ] `client/capacitor.config.json:2` — `"appId": "com.willfit.app"`
- [ ] `client/ios/App/App.xcodeproj/project.pbxproj:308` — `PRODUCT_BUNDLE_IDENTIFIER = com.willfit.app;` (Debug)
- [ ] `client/ios/App/App.xcodeproj/project.pbxproj:329` — `PRODUCT_BUNDLE_IDENTIFIER = com.willfit.app;` (Release)
- [ ] `client/android/app/build.gradle:4` — `namespace = "com.willfit.app"`
- [ ] `client/android/app/build.gradle:7` — `applicationId "com.willfit.app"`
- [ ] `client/android/app/src/main/res/values/strings.xml:5` — `<string name="package_name">com.willfit.app</string>`
- [ ] `client/android/app/src/main/res/values/strings.xml:6` — `<string name="custom_url_scheme">com.willfit.app</string>`
- [ ] `client/android/app/src/main/java/com/willfit/app/MainActivity.java:1` — `package com.willfit.app;` (and rename the directory `com/willfit/app/` → `com/replab/fitness/`)
- [ ] `mobile/app.json:18` — `"bundleIdentifier": "com.willfit.app"`
- [ ] `mobile/app.json:24` — `"package": "com.willfit.app"`

After: `cd client && npx cap sync` to propagate to the native projects.

### Android App Link hosts (AndroidManifest)

- [ ] `client/android/app/src/main/AndroidManifest.xml:38` — `<data android:host="example.com" />`
- [ ] `client/android/app/src/main/AndroidManifest.xml:39` — `<data android:host="www.example.com" />`

Replace both with the real production hosts (`replab-fitness.com` and `www.replab-fitness.com`).

### iOS Associated Domains

- [ ] Xcode → App target → Signing & Capabilities → Associated Domains → add `applinks:replab-fitness.com` (and remove any `applinks:will-fit.shop` if previously added).

### Client deep-link host allow-list

- [ ] `client/src/utils/deepLink.js:17` — `APP_HOSTS` array — add the production hosts (`replab-fitness.com`, `www.replab-fitness.com`).

### Client share strings (cosmetic — visible in social-share text)

- [ ] `client/src/pages/Workouts.jsx:1314` — share text URL `https://will-fit.shop`
- [ ] `client/src/pages/Workouts.jsx:1341` — Messenger share link

## 3. External dashboards (no code change)

- [ ] Render → Web Service → Custom Domains → add new domain, set `APP_URL` env, optionally redirect old → new
- [ ] Resend → verify new sender domain (DNS records: SPF, DKIM, DMARC, MX)
- [ ] Stripe → Webhooks → update endpoint URL to new domain
- [ ] App Store Connect → Privacy / Marketing / Support URLs
- [ ] Play Console → Store Listing → Website / Privacy URL
- [ ] PostHog / Sentry → Authorized Domains

## 4. After cutover

- [ ] Trigger a new release build of the native apps with the new bundle ID and signing key (TestFlight + Play internal track)
- [ ] Verify Universal Links / App Links open the app from a fresh install (autoVerify works only when assetlinks.json fingerprint matches the installed APK signing cert)
- [ ] Send a test transactional email and confirm the `from:` matches `EMAIL_FROM_TRANSACTIONAL`
