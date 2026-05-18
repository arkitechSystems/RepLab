# REPLAB — iOS Submission Playbook

Step-by-step walkthrough for taking REPLAB from "Windows dev machine, no Xcode" to "approved in the App Store." Drafted 2026-05-17.

This is the **execution** doc. For the inventory of what's done vs. blocking, see [`PRE-LAUNCH.md`](./PRE-LAUNCH.md). For paste-ready store copy, see [`app-store-metadata.md`](./app-store-metadata.md). For the demo-account / review-notes payload, see [`app-review-notes.md`](./app-review-notes.md). For the privacy questionnaire answers, see [`privacy-nutrition-answers.md`](./privacy-nutrition-answers.md).

## Confirmed project facts (from the repo, as of 2026-05-17)

- Bundle ID: `com.replab.fitness` (`client/ios/App/App.xcodeproj/project.pbxproj`, both Debug and Release; also `client/capacitor.config.json`)
- Marketing version: `1.3.03` — bump to `1.0.0` for App Store v1 (see step 5.1)
- Current project (build) version: `2`
- App display name on the home screen (`CFBundleDisplayName` in `Info.plist`): `RepLab` (mixed case, intentional — App Store listing name stays `REPLAB`)
- iOS deployment target: `15.0`
- Code-sign style: `Automatic` (good — Xcode will fetch the certificate + profile for you on first archive)
- AppDelegate is the Capacitor stock template; **no Firebase init code is wired** (`client/ios/App/App/App/AppDelegate.swift`)
- `@capacitor/push-notifications` is in `client/package.json`; `@capacitor-firebase/messaging` is **NOT** installed
- `client/src/utils/push.js` registers raw APNs tokens to the backend on iOS — works as-is for an APNs-direct path, but the backend's existing FCM transport will not deliver to iOS until either (a) `@capacitor-firebase/messaging` is added so iOS hands FCM tokens to the server, or (b) the backend grows an APNs sender alongside FCM
- No `App.entitlements` file exists yet (will be created by Xcode the moment you add the first capability)
- No `GoogleService-Info.plist` in the iOS project

---

## Section 1 — Pre-flight (do on Windows, before getting Mac access)

All of these can be done from a browser. No Xcode needed. Knock them out so the first hour on the Mac is just `npm install` and Xcode setup.

### 1.1 Confirm Apple Developer Program enrollment is active
- **Owner:** Apple-side / Will
- **Time:** 5 min (just verifying)
- **Steps:**
  1. Sign in at https://developer.apple.com/account
  2. Confirm membership status is "Active" and the team name is your personal name (Individual enrollment, per the trademark-rejected LLC path documented in `PRE-LAUNCH.md`)
  3. Note your **Team ID** (top-right of the membership page) — needed for the AASA file's `APPLE_TEAM_ID` env var on Render (`PRE-LAUNCH.md` → "Domain + universal links" section)
- **Docs:** https://developer.apple.com/help/account/manage-your-team/locate-your-team-id/

### 1.2 Register the App ID in the Developer Portal
- **Owner:** Apple-side
- **Time:** 10 min
- **Steps:**
  1. https://developer.apple.com/account → Certificates, IDs & Profiles → Identifiers → "+"
  2. Select **App IDs** → Continue → **App** → Continue
  3. Description: `REPLAB`
  4. Bundle ID: **Explicit** → `com.replab.fitness`
  5. Capabilities — enable these checkboxes now so the matching provisioning profile auto-includes them:
     - **Push Notifications**
     - **Associated Domains**
  6. Continue → Register
- **Note:** Xcode auto-signing will also create/refresh this App ID if you skip this step, but doing it manually surfaces any name conflict before you're sitting on an $80/day Mac rental.

### 1.3 Create the App Store Connect listing
- **Owner:** Apple-side
- **Time:** 30 min (longer if you're pasting all metadata)
- **Steps:**
  1. https://appstoreconnect.apple.com → My Apps → "+" → New App
  2. Platforms: iOS
  3. Name: `REPLAB` (from `app-store-metadata.md`)
  4. Primary language: English (U.S.)
  5. Bundle ID: select `com.replab.fitness` from the dropdown (must show up here after step 1.2)
  6. SKU: `replab-ios-v1` (internal-only, any string)
  7. User Access: Full Access
  8. Create
  9. In the new app's left nav, walk these sections and paste from the linked source-of-truth files:
     - **App Information** → name, subtitle, category — from `app-store-metadata.md`
     - **Pricing and Availability** → Free, all territories (or your launch-region subset)
     - **App Privacy** → privacy nutrition labels — from `privacy-nutrition-answers.md` section 1
     - **Prepare for Submission** (first version row):
       - Promotional text, Description, Keywords, Support URL, Marketing URL — from `app-store-metadata.md`
       - Screenshots: see step 1.4
       - App Review Information → Notes — from `app-review-notes.md` (full body)
       - App Review Information → Sign-In Information → check "Sign-in required" → paste demo account from `app-review-notes.md` (`apple-reviewer@replab-fitness.com` / `Reviewer2026!`)
       - Contact Information → your email + phone (App Review may call)
       - Version 1.0.0
       - Copyright: `© 2026 Will Martin` (Individual enrollment — `app-store-metadata.md` "Copyright / Seller" section)
       - Routing App Coverage File: leave blank
       - Age Rating: walk the questionnaire using the answers in `app-store-metadata.md` § "Age rating questionnaire answers (target: 4+)"
- **Docs:** https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app

### 1.4 Generate screenshots
- **Owner:** Will
- **Time:** 1-2 hours (depends on how polished you want them)
- **Required spec** (App Store Connect minimums for 2026):
  - **6.9" iPhone (iPhone 16 Pro Max class):** 1320 × 2868 px — **required**
  - **6.5"/6.7" iPhone (older Pro Max class):** 1242 × 2688 px or 1284 × 2778 px — recommended fallback for older devices
  - **iPad Pro 12.9" (6th gen):** 2048 × 2732 px — required IF you keep iPad in your supported device family (`TARGETED_DEVICE_FAMILY = "1,2"` in `project.pbxproj` says you do — either generate iPad screenshots or change the target to iPhone-only)
- **Count:** 3-10 per device class
- **How:** Either (a) take them on a real iPhone running the dev build via TestFlight after section 5, then come back and upload — preferred so they're real; or (b) use the iOS Simulator on the Mac (Device → Screenshot, ⌘S) once you're on the Mac in section 2
- **Decision point:** if you don't want to generate iPad screenshots, edit `TARGETED_DEVICE_FAMILY` in `project.pbxproj` from `"1,2"` to `"1"` before archiving. This is a code change so do it on the Mac in section 3, not now.

### 1.5 Generate the APNs Auth Key (.p8)
- **Owner:** Apple-side
- **Time:** 5 min
- **Steps:**
  1. https://developer.apple.com/account → Certificates, IDs & Profiles → **Keys** → "+"
  2. Key Name: `REPLAB APNs Auth Key`
  3. Check **Apple Push Notifications service (APNs)**
  4. Continue → Register
  5. **Download the .p8 file immediately.** Apple lets you download it exactly once. Store it in a password manager or a secure encrypted drive. **If you lose it, you have to revoke and regenerate.**
  6. Note these three values — you'll paste them into Firebase Console in step 1.6:
     - **Key ID** (10 chars, shown on the key detail page)
     - **Team ID** (from step 1.1)
     - The `.p8` file itself
- **Skip this step IF** you decide to ship iOS push v1 as Android-only push — see section 4 branch B.
- **Docs:** https://developer.apple.com/help/account/manage-keys/create-a-new-key

### 1.6 Upload the .p8 to Firebase Console
- **Owner:** Firebase-side
- **Time:** 5 min
- **Skip IF** going Android-only push for v1.
- **Steps:**
  1. https://console.firebase.google.com → select the project you use for the Android FCM build (the one whose service account is in the Render `FCM_SERVICE_ACCOUNT_JSON` env var)
  2. Project Settings (gear icon) → Cloud Messaging tab
  3. Apple app configuration → "Upload" under APNs Authentication Key
  4. Upload `.p8`, paste Key ID, paste Team ID
  5. Save
- **Why:** This lets Firebase route FCM-targeted pushes to APNs for the iOS bundle. Required if iOS push tokens are going to be FCM tokens served through the existing backend FCM transport.
- **Docs:** https://firebase.google.com/docs/cloud-messaging/ios/certs

### 1.7 Run the Apple-reviewer seed script against production
- **Owner:** Will (Windows)
- **Time:** 5 min
- **Steps:**
  1. Make sure the credentials in `app-review-notes.md` (`apple-reviewer@replab-fitness.com` / `Reviewer2026!`) match what the seed script creates. Read the script header at `server/scripts/seed-apple-reviewer.js` to confirm.
  2. From the repo root: `node --env-file=server/.env server/scripts/seed-apple-reviewer.js`
  3. Verify by logging into https://replab-fitness.com with the demo credentials and confirming the seeded data renders (populated calendar, history, metrics)
- **Why:** Apple Review will use this account. If the login fails or the screen is empty, you'll get a Metadata Rejected within 24 hours and lose 2-3 days of review time.

### 1.8 Set the `APPLE_TEAM_ID` env var on Render
- **Owner:** Will (Windows)
- **Time:** 2 min
- **Steps:**
  1. https://dashboard.render.com → REPLAB web service → Environment
  2. Add `APPLE_TEAM_ID` = (the 10-char team ID from step 1.1)
  3. Redeploy or wait for next deploy
  4. Verify: `curl https://replab-fitness.com/.well-known/apple-app-site-association` should return JSON with your team ID substituted into `appID`, not the literal string `TEAMID`
- **Why:** Universal links break silently if the AASA file ships the placeholder team ID. Verifies before review touches it.

---

## Section 2 — Mac setup (first hour on the Mac)

You're now on macOS. Goal: get to `npx cap open ios` with no errors.

### 2.1 Install Xcode
- **Owner:** Mac
- **Time:** 30-60 min (10-15 GB download)
- **Steps:**
  1. App Store → search "Xcode" → Get → wait
  2. Once installed, launch it once. It will prompt to "Install additional required components" — accept.
  3. Xcode → Settings (⌘,) → Accounts → "+" → Apple ID → sign in with the personal Apple ID enrolled in the Developer Program
  4. Once your Apple ID appears in the list, select it → "Manage Certificates…" — just leave the sheet open and close. (This pre-warms Xcode's certificate cache so the first archive doesn't stall.)
- **Note:** Xcode 15+ is the floor for App Store submission in 2026; latest stable is fine.

### 2.2 Install Node and Git on the Mac
- **Owner:** Mac
- **Time:** 5 min
- **Steps:**
  1. Open Terminal
  2. Install Homebrew if not present: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
  3. `brew install node@24 git`
  4. `node -v` → should print `v24.x`
  5. `git -v` → should print 2.x or higher
- **Note:** macOS may already have Git via Xcode Command Line Tools — `git -v` is harmless to run first.

### 2.3 Clone the repo and install dependencies
- **Owner:** Mac
- **Time:** 10 min
- **Steps:**
  1. `mkdir ~/code && cd ~/code`
  2. `git clone https://github.com/<your-org>/<repo>.git replab && cd replab` (adjust to your remote)
  3. Pull any required `.env` files from your password manager. Server `.env` is not in repo; you'll need `DATABASE_URL`, `JWT_SECRET`, etc. — but **for the iOS build you only need `client/.env` and `client/.env.production`** (the bundle is built from those; the server runs on Render).
  4. `cd client && npm install`
  5. (Optional, recommended) `npm install` at the repo root too if you want to run server smoke tests locally

### 2.4 Build the web client
- **Owner:** Mac
- **Time:** 2-5 min
- **Steps:**
  1. `cd client`
  2. `npm run build`
  3. Confirm `client/dist/` is populated with a fresh `index.html`, `assets/` folder, and the icon set
- **Why:** Capacitor reads from `webDir = "dist"` (`capacitor.config.json`); if you skip this, the .ipa ships a stale or missing web bundle.

### 2.5 Capacitor sync
- **Owner:** Mac
- **Time:** 1-2 min
- **Steps:**
  1. From `client/`: `npx cap sync ios`
  2. Expect output like "✔ Updating iOS plugins" and a list of installed plugins (push-notifications, app, device, haptics, preferences, splash-screen, status-bar)
  3. If you see "could not find ios" — make sure you're in the `client/` directory, not the repo root
- **Why:** This copies `dist/` into the iOS project's `public/` folder and refreshes the plugin Pods.

### 2.6 Open the iOS workspace in Xcode
- **Owner:** Mac
- **Time:** 1 min
- **Steps:**
  1. From `client/`: `npx cap open ios`
  2. Xcode opens `client/ios/App/App.xcworkspace` — this is the workspace (with Pods), **not** the bare `.xcodeproj`. Always open the workspace.
  3. Wait for Xcode to finish indexing (progress bar in the toolbar) before doing anything in section 3.

---

## Section 3 — Xcode signing + capabilities (one-time per project)

You're in Xcode with the REPLAB workspace open. Goal: project compiles, signs cleanly, and has every capability the app needs.

### 3.1 Select the App target
- **Owner:** Mac
- **Time:** 1 min
- **Steps:**
  1. Project Navigator (left sidebar) → click the blue **App** project icon at the top
  2. In the editor area, select the **App** target (under TARGETS, not PROJECT)
  3. Click the **Signing & Capabilities** tab

### 3.2 Wire your Team and confirm Bundle Identifier
- **Owner:** Mac
- **Time:** 2 min
- **Steps:**
  1. Check the **Automatically manage signing** box
  2. **Team** dropdown → select your personal team (the Individual enrollment from `PRE-LAUNCH.md`)
  3. Confirm **Bundle Identifier** reads `com.replab.fitness`
  4. Xcode will spin briefly and fetch / create a "iOS Team Provisioning Profile: com.replab.fitness." If you see a red error saying "Failed to register bundle identifier" or "Communication with Apple failed," it usually means the App ID in step 1.2 isn't visible to this Apple ID, or your enrollment isn't fully active. Wait 15 minutes and retry; if still failing, check https://developer.apple.com/account/resources/identifiers/list
- **Decision point:** if you want to flip iPad off (skip iPad screenshots), do it now: still in the target editor, **General** tab → Deployment Info → uncheck "iPad" under Supported Destinations. This rewrites `TARGETED_DEVICE_FAMILY` for you.

### 3.3 Add the Push Notifications capability
- **Owner:** Mac
- **Time:** 1 min
- **Skip IF** going Android-only push for v1 (see section 4 branch B).
- **Steps:**
  1. Still in Signing & Capabilities → click **+ Capability** (top-left of the tab)
  2. Search "Push" → double-click **Push Notifications**
  3. Xcode creates `client/ios/App/App/App.entitlements` with `aps-environment` set (development for debug builds, automatically promoted to production for release builds)

### 3.4 Add Background Modes → Remote notifications
- **Owner:** Mac
- **Time:** 1 min
- **Skip IF** going Android-only push for v1.
- **Steps:**
  1. **+ Capability** → search "Background Modes" → double-click
  2. In the Background Modes block that appears, check **Remote notifications**
- **Why:** Without this, iOS silently drops content-available payloads that arrive while the app is backgrounded.

### 3.5 Add Associated Domains for Universal Links
- **Owner:** Mac
- **Time:** 1 min
- **Steps:**
  1. **+ Capability** → search "Associated Domains" → double-click
  2. In the Associated Domains block, click **+** under the Domains list
  3. Enter: `applinks:replab-fitness.com`
  4. Press Tab to commit
- **Why:** This pairs with the AASA file at `https://replab-fitness.com/.well-known/apple-app-site-association`. The `APPLE_TEAM_ID` env var (step 1.8) needs to be set on Render first; if it's still `TEAMID` in the served JSON, universal links won't activate even with this capability on.
- **Docs:** https://developer.apple.com/documentation/xcode/supporting-associated-domains

### 3.6 Verify there's no App Sandbox or other unnecessary capability
- **Owner:** Mac
- **Time:** 30 sec
- **Steps:**
  1. App Sandbox is a **macOS** capability — do NOT add it. iOS apps don't need it; adding it can cause submission errors.
  2. Confirm the capability list shows only: Push Notifications, Background Modes, Associated Domains. That's the full set v1 needs.

### 3.7 Test-compile
- **Owner:** Mac
- **Time:** 2-5 min
- **Steps:**
  1. Top toolbar → select destination "Any iOS Device (arm64)" (don't pick a simulator yet — we want a real-archive-compatible build)
  2. Product → Build (⌘B)
  3. Expect "Build Succeeded." If you see signing errors, fix the team selection in 3.2. If you see Swift errors, something's off with the Cap sync — go back to 2.5.

---

## Section 4 — iOS push wiring (decision branch)

You have two branches here. Pick one and document it in the App Review Notes if it changes the user-facing behavior.

### Branch A — Ship iOS push in v1 via Firebase Messaging

**Recommended IF** you want Android and iOS push to share the existing backend FCM transport. Adds ~30 min of work and one Swift bridge.

#### A.1 Install the Firebase Capacitor plugin
- **Owner:** Mac
- **Time:** 3 min
- **Steps:**
  1. `cd client`
  2. `npm install @capacitor-firebase/messaging`
  3. `npx cap sync ios`
- **Note:** As of this playbook, `@capacitor-firebase/messaging` is NOT in `client/package.json`. Verify before assuming the plugin is wired.

#### A.2 Download GoogleService-Info.plist from Firebase
- **Owner:** Firebase + Mac
- **Time:** 5 min
- **Steps:**
  1. https://console.firebase.google.com → your project → Project Settings → General tab
  2. Under "Your apps," click **Add app** → iOS icon
  3. iOS bundle ID: `com.replab.fitness`
  4. App nickname: `REPLAB iOS`
  5. Register app
  6. Download `GoogleService-Info.plist` and save it to your Mac
- **Skip step 6** if you already created the iOS Firebase app earlier — just hit the gear icon next to the existing app and re-download.

#### A.3 Add GoogleService-Info.plist to the Xcode project
- **Owner:** Mac
- **Time:** 2 min
- **Steps:**
  1. In Finder, locate the downloaded `GoogleService-Info.plist`
  2. In Xcode, Project Navigator → drag the file into the **App** folder (the one that contains `AppDelegate.swift`, `Info.plist`, `Assets.xcassets`)
  3. In the sheet that appears: check **Copy items if needed**, **Create groups**, and **Add to targets: App**
  4. Confirm the file shows up at `client/ios/App/App/App/GoogleService-Info.plist` after the drag (Finder)

#### A.4 Initialize Firebase in AppDelegate
- **Owner:** Mac
- **Time:** 5 min
- **Steps:**
  1. Open `client/ios/App/App/App/AppDelegate.swift` in Xcode
  2. Add `import FirebaseCore` near the top (after `import Capacitor`)
  3. Inside `application(_:didFinishLaunchingWithOptions:)`, before `return true`, add:
     ```swift
     FirebaseApp.configure()
     ```
  4. Save (⌘S) — Xcode should auto-link FirebaseCore via the Pods the Capacitor plugin pulled in. If you see "No such module 'FirebaseCore'," run `npx cap sync ios` again from terminal, then close+reopen the workspace.
- **Why:** The Capacitor plugin needs Firebase initialized before it can call `getToken()`.

#### A.5 Update the bootstrap to prefer FCM tokens on iOS
- **Owner:** Will (code change, plan only — do this BEFORE the next Mac session)
- **Time:** 30 min
- **Steps:** This is a separate code change to `client/src/utils/push.js` and is **out of scope for this playbook**. Plan the work on Windows before getting on the Mac:
  - Branch the existing APNs registration in `push.js` so iOS calls `@capacitor-firebase/messaging` for an FCM token instead of `@capacitor/push-notifications` for an APNs token
  - Server's `/push/register` endpoint should already accept either; verify in `server/routes/push.js` and `server/pushScheduler.js`
- **Don't ship Branch A without doing this.** Otherwise iOS will register raw APNs tokens that the backend's FCM transport can't deliver to.

### Branch B — Ship v1 as Android-only push

**Recommended IF** you want to move fast and don't need launch-day iOS push.

#### B.1 Confirm push capability is OFF in Xcode
- **Owner:** Mac
- **Time:** 30 sec
- **Steps:**
  1. Signing & Capabilities → if Push Notifications was already added, click the trash icon to remove it
  2. Same for Background Modes if no other module needs it
- **Why:** Submitting with the Push Notifications entitlement enabled but no working push logic gets you Guideline 4.5.4 questions from Apple Review.

#### B.2 Document in App Review Notes
- **Owner:** Will
- **Time:** 5 min
- **Steps:**
  1. In `_marketing/app-review-notes.md`, add a short paragraph under "About the app":
     > Push notifications are Android-only in v1. iOS push (workout reminders, weekly summaries) ships in a follow-up release.
  2. Paste the updated notes into App Store Connect (step 1.3 → App Review Information → Notes)

---

## Section 5 — Archive and upload to TestFlight

Goal: a build sitting in App Store Connect with a green "Ready to Submit" status.

### 5.1 Bump the version
- **Owner:** Mac
- **Time:** 1 min
- **Steps:**
  1. Project Navigator → App target → **General** tab
  2. **Version** (CFBundleShortVersionString — currently `1.3.03`): change to `1.0.0` for the first App Store submission. (The 1.3.x history is internal; App Store wants a 1.0.0 first build.)
  3. **Build** (CFBundleVersion — currently `2`): change to `1`
- **Rule:** Build number must be unique per upload. If you upload, get rejected, and reupload, bump Build to `2`. Version stays the same until you fix something user-facing.

### 5.2 Pick the archive destination
- **Owner:** Mac
- **Time:** 30 sec
- **Steps:**
  1. Top toolbar device dropdown → **Any iOS Device (arm64)**
  2. Do NOT pick a simulator — archive is disabled for simulators.

### 5.3 Archive
- **Owner:** Mac
- **Time:** 5-15 min (first archive is slowest)
- **Steps:**
  1. Menu bar → **Product** → **Archive**
  2. Wait. Xcode compiles in Release config, signs with the Apple Distribution cert (Xcode creates this on first archive if missing), and packages.
  3. When done, the **Organizer** window opens automatically with your new archive at the top of the list.
- **If Archive is greyed out:** you're on a simulator destination. Go back to 5.2.
- **If signing errors:** "no provisioning profile for distribution" — Xcode's auto-signing usually heals itself by clicking "Try Again" in the error sheet. If it doesn't, go to https://developer.apple.com/account/resources/profiles and confirm there's no expired Distribution profile blocking it.

### 5.4 Distribute to App Store Connect
- **Owner:** Mac
- **Time:** 10-30 min (server-side processing dominates)
- **Steps:**
  1. In Organizer, select the new archive → click **Distribute App**
  2. Method: **App Store Connect** → Next
  3. Destination: **Upload** → Next
  4. Distribution options: leave defaults (Strip Swift symbols: yes; Upload your app's symbols: yes — required for Sentry source maps to symbolicate native crashes; Manage Version and Build Number: yes) → Next
  5. Signing: **Automatically manage signing** → Next
  6. Xcode shows the IPA contents — click **Upload**
  7. After ~2 min you'll see "Upload Successful" — close the sheet
  8. Go to https://appstoreconnect.apple.com → My Apps → REPLAB → **TestFlight** tab. The build will show as "Processing" for 10-30 min. Once it transitions to "Ready to Submit," it's available for internal testing.
- **If you see "Missing Compliance" yellow warning:** that's the export-compliance question — click the build, answer the encryption questions (the answer is "No, your app doesn't use any non-exempt encryption" if you're only using HTTPS, which REPLAB is).

---

## Section 6 — TestFlight smoke test checklist

Install the TestFlight build on a real iPhone and run this list before hitting Submit. Each item is a "would Apple Review trip on this" check, not an exhaustive QA pass — `LAUNCH-SMOKE-TEST.md` is the broader pass.

### 6.1 Install via TestFlight
- **Owner:** Will (iPhone)
- **Time:** 5 min
- **Steps:**
  1. App Store Connect → REPLAB → TestFlight → Internal Testing → add yourself (your Apple ID email) as an internal tester
  2. Accept the invite email on your iPhone → install TestFlight app from App Store → install REPLAB inside TestFlight
  3. Launch REPLAB

### 6.2 Reviewer-facing flows
- [ ] **Sign-up flow** — create a new account on the device (NOT the demo account). Welcome email lands within 60s.
- [ ] **Log in** — log out, log back in with the demo `apple-reviewer@replab-fitness.com` / `Reviewer2026!` credentials. Confirm the seeded calendar, history, metrics, and assigned program all render.
- [ ] **Start a workout session** — tap into a scheduled session from the calendar. Loads without crashing.
- [ ] **Log a set** — enter weight + reps, hit save, confirm the value persists when you back out and reopen.
- [ ] **Complete a workout** — finish a session, confirm the summary screen renders + history reflects it.
- [ ] **PR detection** — log a heavier set than the previous best; confirm the PR badge fires.
- [ ] **Plate calculator** — long-press a weight input; confirm the in-session plate calc modal opens.
- [ ] **Universal link** — from another app (e.g., Mail or Safari), open `https://replab-fitness.com/login`. The REPLAB app should foreground directly to the login screen, NOT bounce through Safari. If it bounces, the AASA file or Associated Domains is misconfigured — see step 1.8 + step 3.5.
- [ ] **Push notification test (Branch A only)** — accept the permission prompt; from the backend or a test script, send a notification; confirm it arrives both in foreground (no system banner; logged in the app) and background (system banner).
- [ ] **Account deletion** — Profile → Settings → Delete Account → confirm with password. Verify the account is fully gone (try to log back in — should fail). This is a hard Apple requirement under Guideline 5.1.1(v) since 2022.
- [ ] **Logout** — Profile → Logout → confirms returns to login screen.

### 6.3 "Coming Soon" gating must be visibly soft
- [ ] **Featured Workouts** — card is visible but shows "Coming Soon" state, NOT clickable
- [ ] **Challenges** — same: visible, "Coming Soon," NOT clickable
- [ ] **Trainers** — if Zumba Jason is still showing (per `DEMO-CONTENT-AUDIT.md` open item), decide before submission: gate the tab, replace with real data, or stub to empty. **Apple Review will tap into him and find fake stats.**
- [ ] **Upgrade / Pricing page on iOS** — Pro/Elite tier cards visible, but NO purchase CTA renders on iOS (`Capacitor.getPlatform() === 'ios'` guard, per `app-review-notes.md`). Hit `/upgrade` and confirm no "Subscribe" or "Upgrade" button shows.

### 6.4 Permission prompts
- [ ] **Photos** — open photo picker (Profile → change photo); the `NSPhotoLibraryUsageDescription` from `Info.plist` should appear in the system prompt
- [ ] **Camera** — try "take new photo"; the `NSCameraUsageDescription` should appear
- [ ] **Push** — on first auth, the push permission prompt appears (Branch A only)
- [ ] Strings: confirm each prompt actually says what's in `Info.plist`, not a stale message

### 6.5 Crash and console hygiene
- [ ] Force-kill the app, relaunch — should resume without a crash banner
- [ ] In Xcode → Window → Devices and Simulators → select your iPhone → View Device Logs — look for any REPLAB process crash entries since install. Investigate before submit.
- [ ] Sentry dashboard (`replab-frontend` project) should show zero new error events from your TestFlight session for happy-path flows.

---

## Section 7 — Submit for review

Goal: the "Submitted to App Review" status in App Store Connect.

### 7.1 Final pre-submit checks
- **Owner:** Will (browser)
- **Time:** 15 min
- **Steps:**
  1. App Store Connect → REPLAB → App Store tab → 1.0.0 version row
  2. Walk every section in the left nav and confirm there's no yellow "Missing" warning:
     - App Information
     - Pricing and Availability
     - App Privacy
     - Prepare for Submission: Screenshots present, Promotional Text, Description, Keywords, Support URL, Marketing URL, Build attached (1.0.0 build 1 from TestFlight), App Review Information, Sign-In Information toggled on, Version Release set (Manually release, or Automatic — recommend Manual for v1 so you control the launch hour)
  3. Confirm the build attached is the one you smoke-tested in section 6 (build number matches)

### 7.2 Add for Review
- **Owner:** Will (browser)
- **Time:** 1 min
- **Steps:**
  1. Top-right → **Add for Review** → confirm → **Submit to App Review**
  2. Status flips to "Waiting for Review" within 5 min

### 7.3 Wait
- **Owner:** Apple Review
- **Time:** 24-72 hours for first review; sometimes faster
- **What happens:**
  - "Waiting for Review" → "In Review" → either "Pending Developer Release" (you set Manual release) or "Ready for Sale" (Automatic release)
- **If rejected:**
  1. The Resolution Center message will cite a specific guideline (e.g., 3.1.1 for IAP, 5.1.1(v) for account deletion, 4.5.4 for push, 2.1 for general bugs)
  2. Reply in the Resolution Center with what you fixed, or push a new build + re-submit
  3. Most-likely rejection reasons for REPLAB v1, in order:
     - **3.1.1** — if any in-app purchase CTA leaks through on iOS (mitigated by the `Capacitor.getPlatform() === 'ios'` guard; verify in 6.3)
     - **5.1.1(v)** — if account deletion is hidden or broken (mitigated by smoke test in 6.2)
     - **4.5.4** — push enabled in entitlements but no working push code (mitigated by branch B → remove the capability, or branch A → wire FCM)
     - **2.3.3** — if screenshots show features not in the build (don't include Featured Workouts shots since it's gated)
     - **2.1** — generic "the app crashed" — minimize via 6.2 + 6.5

### 7.4 Phased release decision
- **Owner:** Will
- **Time:** 1 min (decision)
- **Steps:**
  1. If Manual release was selected: once "Pending Developer Release," go to the version row and click **Release This Version** when ready
  2. If Automatic: app goes live in all selected territories within a few hours of approval
- **Tip:** Apple offers "Phased release for automatic updates" (7-day percentage rollout) — turn this ON for v1 to limit blast radius if there's a launch-day bug

---

## Section 8 — Post-launch tasks

These don't block submission but should be queued as soon as v1 is live.

### 8.1 App Transfer to the renamed LLC entity
- **Owner:** Apple-side / Will
- **Time:** 1-2 hours, then 24-72h Apple processing
- **When:** After the LLC entity rename is finalized (or a new clean entity is registered in Apple Developer Program as an Organization)
- **Steps (high-level):**
  1. New entity must have an active Apple Developer Program (Organization) account in good standing
  2. Source account (Will's Individual): App Store Connect → My Apps → REPLAB → App Information → Additional Information → **Transfer App**
  3. Enter the destination team's App Store Connect email + Team ID
  4. Destination team accepts within 60 days
  5. App keeps its bundle ID, reviews, ratings, IAP, TestFlight builds — only the seller identity changes
- **Constraints:** can't transfer if any beta app review is in progress; can't transfer if the app uses iCloud or Game Center (REPLAB doesn't); can't transfer within the first version's review cycle (post-launch only)
- **Docs:** https://developer.apple.com/help/app-store-connect/transfer-an-app/transfer-an-app-overview

### 8.2 Wire StoreKit IAP for the iOS Pro tier
- **Owner:** Will
- **Time:** 1-2 weeks of dev work
- **Why:** Apple Guideline 3.1.1 requires IAP for digital subscriptions on iOS. Currently iOS hides Pro entirely (`Capacitor.getPlatform() === 'ios'` guard in `Upgrade.jsx`) — that's the launch-safe path but blocks revenue from iOS users.
- **High-level steps:**
  1. Configure subscription products in App Store Connect → Monetization → Subscriptions (group + individual SKUs)
  2. Add `@revenuecat/purchases-capacitor` (recommended) or `@capacitor-community/in-app-purchases-2` to the client
  3. Backend: server-side receipt validation against Apple's verification endpoint, sync entitlement to existing `subscriptions` table
  4. Flip the iOS guard in `Upgrade.jsx` to render Apple-IAP-driven CTAs on iOS
  5. Submit the new build for review; first IAP submission gets extra scrutiny — be ready to demo
- **Note:** Renewal subscriptions need Apple-specific disclosures in the purchase flow + a "Manage Subscriptions" deep link to iOS Settings. RevenueCat handles most of this; rolling your own is more work.

### 8.3 Generate the simplified-glyph app icon variant
- **Owner:** Will
- **Time:** 1 hour design work
- **Why:** `PRE-LAUNCH.md` notes the current RL wordmark may not render cleanly at 20×20 (notification, Spotlight). Design a single-glyph variant for those sizes.

### 8.4 Localize for non-English stores
- **Owner:** Will (or contracted translator)
- **Time:** varies
- **Why:** Keywords + Description in App Store Connect are per-locale. Spanish, German, French are the typical first three for fitness apps.

---

## Cross-references

- [PRE-LAUNCH.md](./PRE-LAUNCH.md) — inventory of done vs. blocking
- [app-store-metadata.md](./app-store-metadata.md) — paste-ready name, subtitle, description, keywords
- [app-review-notes.md](./app-review-notes.md) — paste-ready App Review Notes + demo creds
- [privacy-nutrition-answers.md](./privacy-nutrition-answers.md) — paste-ready privacy questionnaire answers
- [LAUNCH-SMOKE-TEST.md](./LAUNCH-SMOKE-TEST.md) — broader release-day QA pass
- [DEMO-CONTENT-AUDIT.md](./DEMO-CONTENT-AUDIT.md) — Zumba Jason / trainer mock-data decision
- Apple Developer docs landing: https://developer.apple.com/documentation/xcode
- App Store Connect Help: https://developer.apple.com/help/app-store-connect/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
