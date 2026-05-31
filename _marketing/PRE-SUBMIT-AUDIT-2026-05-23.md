# Pre-Submission Audit — 2026-05-23

## Summary

- **27 findings: 3 P0, 11 P1, 13 P2**
- **Top 3 risks:**
  1. **InstallPrompt renders inside the iOS native app.** The component has no Capacitor guard and detects "iOS" by user agent, so a Capacitor WKWebView triggers the iOS-style "Add to Home Screen" CTA inside the shipping app. A reviewer will see "Install REPLAB / Add to your home screen — Tap the Share icon below" while running the App Store build. Direct Apple 4.0 / 4.3 reviewer red flag.
  2. **Native `confirm()` and `alert()` dialogs on iOS destructive paths.** Three `window.confirm(...)` calls (delete workout / delete program / delete week) and eight `alert(...)` calls remain in Workouts.jsx, plus alerts in Utilities, ExerciseLibrary, FeaturedWorkoutSession, and exportProgramPDF. iOS renders these as the system "Page" alert with the host name visible — reads like a debug build and Apple Review will notice on Workouts → "..." menu.
  3. **Push permission prompt fires immediately on first authenticated render.** `AuthContext.jsx:68` calls `initPushNotifications()` as soon as `user` becomes truthy. On a fresh signup the user hits the iOS permission popup during the Welcome onboarding tour before they've ever scheduled a workout. Apple HIG explicitly discourages permission prompts before the user understands the value, and FCM is dormant in v1 anyway so the prompt grants nothing.

---

## P0 — Must fix before submission

### 1. InstallPrompt visible inside iOS native app
- **File:** `client/src/components/InstallPrompt.jsx:9-20, 96`
- **Category:** App Store / iOS
- **Issue:** `isIOSDevice()` returns `true` for Capacitor's WKWebView (the UA still contains "iPhone"), and `isStandalone()` returns `false` in WKWebView because `window.navigator.standalone` is undefined inside Capacitor (it's a Safari-only flag) and `display-mode: standalone` is not reliably set. The render gate `if (!ios && !deferredPrompt) return null;` therefore short-circuits to "show the iOS install hint" inside the native bundle. Layout.jsx:162 mounts `<InstallPrompt />` on every authed screen.
  ```js
  // InstallPrompt.jsx
  if (!visible || !ready) return null;
  if (!ios && !deferredPrompt) return null;
  // → on iOS Capacitor: visible=true, ready=true, ios=true → renders
  ```
- **Repro:** Sign in on the iOS build, wait 5s. The card "Install REPLAB / Add to your home screen / Tap the Share icon below, then Add to Home Screen" appears above the bottom nav.
- **Fix:** Add `if (Capacitor.isNativePlatform()) return null;` at the top of the `useEffect` and the render guard. Same pattern as `push.js:44`.

### 2. Native confirm()/alert() dialogs reachable from primary destructive flows
- **File:** `client/src/pages/Workouts.jsx:1996, 2006, 2026, 1557, 1575, 1604, 1731, 1762, 1800, 1820, 6443`; also `Utilities.jsx:768`, `ExerciseLibrary.jsx:58`, `FeaturedWorkoutSession.jsx:2119`, `utils/exportProgramPDF.js:462`
- **Category:** App Store / UX
- **Issue:** Inside the otherwise-polished UI, deleting a workout/program/week pops a `window.confirm()`. On iOS these render as the system alert with the bundle's display name above the message — Apple's reviewer will see "RepLab / Delete this workout? This will also remove its history and personal bests." in a native iOS modal. The WorkoutSession deliberately removed these (`WorkoutSession.jsx:147` comment: "Replaces window.alert() — those read like a debug build to App Review.") but Workouts.jsx still has 8 of them on error paths and one share-success path.
  ```js
  // Workouts.jsx:1996
  if (!confirm('Delete this workout? This will also remove its history and personal bests.')) return;
  // Workouts.jsx:1557
  alert(err.message || 'Failed to load schedule. Please try again.');
  ```
- **Repro:** From My Workouts, tap the delete trash icon on any user-created workout → native iOS confirm. Or, with a flaky network, accept a shared program → native iOS alert.
- **Fix:** Replace with the in-app modal pattern already used elsewhere (e.g., `ConfirmOverwriteModal.jsx` and the existing UndoToast for the decline-share flow at Workouts.jsx:1735). For the error-path alerts, surface a toast or inline banner.

### 3. Push permission prompt fires during onboarding
- **File:** `client/src/context/AuthContext.jsx:68-71`, `client/src/utils/push.js:60-63`
- **Category:** App Store / iOS
- **Issue:**
  ```js
  // AuthContext.jsx
  useEffect(() => {
    if (!user) return;
    initPushNotifications().catch(() => {});
  }, [user]);
  ```
  `initPushNotifications` immediately calls `PushNotifications.requestPermissions()` if permission is `'prompt'`. After signup the user is on `/welcome` (the 5-step tour) — the iOS notification permission popup appears on top of the first tour step. Apple HIG and Guideline 4.0 specifically discourage permission prompts before the user has done anything that needs the permission. Also, push is dormant in v1 per project memory — even if granted, no FCM token will register on iOS.
- **Repro:** Fresh signup on iOS. After hitting "Sign Up" the system "Allow notifications" alert appears during the Welcome flow.
- **Fix:** Defer the call. Either (a) tie it to a deliberate "Turn on workout reminders" toggle in Profile, (b) call after the user completes their first session, or (c) at minimum, gate on a localStorage flag set by a deliberate user action like completing the Welcome flow.

---

## P1 — Should fix

### 4. Welcome email references images that don't exist
- **File:** `server/email.js:93, 115`, asset folder `client/public/email-img/`
- **Category:** Bug / Looks Unfinished
- **Issue:** Welcome email body embeds `<img src="${config.APP_URL}/email-img/workout-session.png">` and `/email-img/plate-calc.png`, but `client/public/email-img/` contains only `README.md`. Every new signup receives a welcome email with two broken-image placeholders. (Note: per the user instruction, this is still pending — Will hasn't dropped the screenshots yet. Worth flagging because launch is days away.)
- **Repro:** Sign up with a fresh email, open the welcome email — two missing-image icons render in the body.
- **Fix:** Either add the two PNGs to `client/public/email-img/` per the README spec (600×900 or 2x), or remove the `<img>` blocks from `server/email.js` (the older `update-welcome-email-template-2026-05-20.js` already stripped them in the SQL template; the live `server/email.js` still includes them).

### 5. `setDefaultSchedule` is a no-op — new user lands on app with empty Up Next + empty Calendar
- **File:** `server/db.js:658-660`
- **Category:** First-time UX
- **Issue:**
  ```js
  async setDefaultSchedule(_userId) {
    // New users start with a blank schedule
  },
  ```
  Auth signup calls this, but it does nothing. A fresh user sees "Up Next / Nothing scheduled" on Workouts and "No schedule set up yet" on Calendar. The "Browse" and "Create a Workout" CTAs work, but the empty-state messaging assumes the user already knows what programs are. Combined with the Welcome tour's "Build custom workouts" / "Browse Workout Library" content, the friction is real for someone who just wants to start lifting.
- **Repro:** Fresh signup → skip onboarding → land on /app → see "Nothing scheduled" with no obvious next step besides Browse.
- **Fix:** Either keep the current empty state but make "Browse" the primary CTA when status==='none' (currently it's the secondary slot — primary is "Create a Workout"), or auto-enroll new users into a curated default like "Will's Hypertrophy Week 1" via `setDefaultSchedule`. Probably the simpler fix is swapping the primary/secondary CTAs when no programs exist.

### 6. WorkoutSession `console.error` in production on cardio delete failure
- **File:** `client/src/pages/WorkoutSession.jsx:1377`
- **Category:** Looks Unfinished
- **Issue:** All other catch blocks in this file are wrapped `if (import.meta.env.DEV) console.error(...)`. This one isn't:
  ```js
  } catch (err) {
    console.error('Failed to delete cardio entry', err);
    setCardioEntries(before);
  }
  ```
  Production users open the browser console on web and see "Failed to delete cardio entry" with the raw error — looks like a debug build leak.
- **Repro:** Delete a cardio entry while offline (or hit a 401 between sessions) — console.error fires in prod.
- **Fix:** `if (import.meta.env.DEV) console.error(...)` like every sibling catch in the file.

### 7. `navigator.onLine` triggers persistent "You're offline" banner inside Capacitor
- **File:** `client/src/components/Layout.jsx:22, 44-46, 117-122`
- **Category:** iOS / Bug
- **Issue:** Capacitor's WKWebView is known to return `navigator.onLine === false` intermittently (especially right after app launch) even when the device is online. Layout shows a yellow "You're offline — changes will sync when you reconnect" banner sitting permanently across the top of every screen. The user signs in, sees the banner, never sees it dismiss. Compounds with finding #1 — the app feels half-broken from cold-launch.
- **Repro:** Cold-launch the iOS build → banner often shows for several seconds (or until first network event fires).
- **Fix:** On Capacitor, use `@capacitor/network` plugin's `Network.getStatus()` / `addListener('networkStatusChange')` instead of `window.online/offline` events. Or hide the banner unless a fetch has actually failed.

### 8. Tutorial selectors `[data-tutorial="my-workouts"]` and `[data-tutorial="browse-library"]` collide with multiple elements
- **File:** `client/src/pages/Workouts.jsx:5633, 5670` (`my-workouts` used twice), `Workouts.jsx:5550` (`browse-library`)
- **Category:** Bug
- **Issue:** `data-tutorial="my-workouts"` is set on two different elements (5633 and 5670). `document.querySelector('[data-tutorial="my-workouts"]')` returns whichever comes first in the DOM — if it's the wrong one, the tutorial spotlights an off-screen or invisible target and falls into the "Loading next step..." waiting state.
- **Repro:** Run the 1B tutorial path that walks through My Workouts (if any step targets this selector).
- **Fix:** Make the data attribute unique. The most important rendered instance should keep `my-workouts`; the other should be `my-workouts-empty` or similar.

### 9. Welcome flow forces every new user through a Bible verse on completion
- **File:** `client/src/pages/Welcome.jsx:82-98`, `client/src/pages/BibleVerses.jsx`
- **Category:** App Store / UX
- **Issue:** `exitToApp` defaults `versesEnabled = true` (the wf-bible-verses key is unset for new users) and forces a full-screen Bible verse overlay before the user reaches /app. Per project memory this is intentional (Bible verses fire every 5th workout, was 7th), but the Welcome verse is BEFORE the user has even completed a workout. Combined with the Apple reviewer's demo account (also a fresh keychain), every reviewer sees a Bible verse during onboarding. Religious content is allowed by Apple, but a prominent unavoidable verse may trigger questions during review.
- **Repro:** Sign up → finish Welcome tour → 1RM screen → Save & Continue → Bible verse takeover.
- **Fix:** Either skip the Welcome verse (only fire on completed workouts as the comment says was the intent) or add a small "Skip" affordance in the BibleVerseOverlay close button. Currently the only close path is the X button — discoverable but not obvious during the verse animation.

### 10. SplashScreen footer doesn't respect `safe-area-inset-bottom`
- **File:** `client/src/components/SplashScreen.jsx:179`
- **Category:** iOS
- **Issue:**
  ```jsx
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 22px 28px' }}>
  ```
  Hardcoded 28px bottom padding. On devices with a home indicator (X+), the "NET ● ONLINE / SYNC / WK 21 · D6" mono telemetry row sits behind the indicator bar. Visible on iPhone 14/15/16 Pro on every launch.
- **Repro:** Cold-launch the iOS build on an iPhone with a home indicator — the bottom row is partially obscured.
- **Fix:** `padding: 'calc(env(safe-area-inset-bottom, 0px) + 28px)'`.

### 11. Stale 1RM autofill prompt comes from an unrelated text input event
- **File:** Cross-reference, but worth eyeballing in `WorkoutSession.jsx:760-780` where `last-session` and `programs` are awaited with no error UI.
- **Category:** Bug (low-confidence — verify on device)
- **Issue:** Two `console.warn` catches at lines 770/774 silently swallow failures loading `/sessions/last-entries` and `/programs`. The resulting empty data means the autofill silently doesn't fire — user types weights from scratch when they shouldn't have to. Not a crash, but a silent regression risk.
- **Fix:** Add a one-time toast "Couldn't load your last weights — autofill is off" so the user knows.

### 12. Calendar empty state uses "Tap to assign" but assign opens a giant picker — onboarding for the picker is missing
- **File:** `client/src/pages/Calendar.jsx:946-1001`
- **Category:** First-time UX
- **Issue:** The empty Calendar shows 7 day rows that say "Tap to assign." When the user taps, they get the assignment modal (workout/rest/clear-week). The picker is dense — workout list, rest day, copy-week — with no inline help, no tutorial spotlight, and no "Pick a program first" funnel. New user with no programs/templates sees an empty picker with only "No workouts yet — create one" tag. This is the most likely place a first-time user gets stuck.
- **Repro:** Fresh signup → skip onboarding → go to Calendar → tap a day → see assignment picker with no obvious next step.
- **Fix:** When `templates.length === 0`, the assignment picker should show a CTA "Create your first workout" → /clientworkouts/create instead of the empty list.

### 13. `RestDayCard` import not visible in audit but referenced; verify it ships
- **File:** `client/src/components/RestDayCard.jsx`
- **Category:** Verification
- **Issue:** Listed in components/. Not reviewed in this pass. If imported only in a code path that's gated off, fine; if it renders on rest days in the empty-state flow, give it a smoke test.

### 14. `aria-disabled` on disabled "Create a Workout for Me" button — element is `<button disabled>` already, double-disabled is harmless but the styled `cursor-not-allowed` doesn't apply on touch devices
- **File:** `client/src/pages/Workouts.jsx:2891-2911`
- **Category:** UX / App Store (4.2)
- **Issue:** The "Create a Workout for Me" button in the Create menu is disabled with a "Coming Soon" pill. Visible to all users including iOS. Per the earlier audit, Apple has historically been OK with disabled "Coming Soon" buttons in working apps, but it's worth verifying this is desired for v1 review. Note the styled `cursor-not-allowed` won't show on iOS (no cursor); tap still does nothing but the user can't tell why without reading the small "Coming Soon" pill.
- **Fix:** Optional. If you want zero "Coming Soon" surfaces in the create menu, hide this entry until v1.1 (gate behind `FF_AI`).

---

## P2 — Polish / post-launch

### 15. SplashScreen `navigator.onLine` shows "OFFLINE" inside Capacitor cold-launch
- **File:** `client/src/components/SplashScreen.jsx:43, 192`
- **Category:** iOS / Polish
- **Issue:** Same root cause as #7 — `navigator.onLine` returns false during Capacitor's initial mount. The splash footer briefly shows "NET ● OFFLINE" then never updates because the value is captured at mount, not subscribed to events. Aesthetic only.
- **Fix:** Switch to `@capacitor/network` or just hide the NET cell on native.

### 16. CFBundleDisplayName is "RepLab" (mixed case), brand spelling is "REPLAB"
- **File:** `client/ios/App/App/Info.plist:9-10`
- **Category:** Brand
- **Issue:** App Store listing is "REPLAB" but home-screen icon label is "RepLab". Per `_marketing/app-store-metadata.md` this is acknowledged intentional — Will's preference. Leaving as P2 reference.
- **Fix:** None unless Will changes mind.

### 17. Unreferenced/leaked assets in `client/public/`
- **File:** `client/public/screenshoterror.png`, `Logo6.png`, `ArkiTechLogo7.1.png`, `RepLabLogo2.jpg`, `RepLabLogo3.jpg`, `RepLabLogo4.jpg`, `RepLaplogo3NoBG.jpg`
- **Category:** Bundle size / Polish
- **Issue:** Grep'd these against `client/src` — `screenshoterror`, `Logo6`, `ArkiTechLogo7` have zero references. `RepLabLogo2/3/4` and `RepLaplogo3NoBG` are likely unused too. These ship in the static bundle and bloat downloads.
- **Fix:** Delete or move to `_marketing/`.

### 18. Tutorial waiting state has no timeout — user can hang on "Loading next step..."
- **File:** `client/src/components/Tutorial.jsx:457-471, 41-58`
- **Category:** Bug (low impact)
- **Issue:** `measureTarget` runs once, sets `targetRect=null` if the selector doesn't match. The fallback UI is "Loading next step..." with only a Skip button — no auto-retry, no error after N seconds. If a tutorial step's target selector is stale (e.g. after a class refactor) the user is stranded.
- **Fix:** After a few hundred ms with `targetRect=null`, advance the tutorial automatically or surface a slightly different "We couldn't find this step — keep going?" message.

### 19. `friendlyError` in `utils/errors.js` swallows server "Email or phone already registered" as generic
- **File:** `client/src/utils/errors.js:8`
- **Category:** UX / Bug
- **Issue:** The regex `/email.*taken|already.*exist/` doesn't match the server's actual message "Email or phone already registered" (returned by `auth.js` signup duplicates). Falls through to the catch-all fallback. Cosmetic — signup just shows the generic fallback message.
- **Fix:** Add `/already.*registered/` to the regex.

### 20. `PageTracker` fires `/auth/page-visit` even on routes that don't matter (test pages, modals)
- **File:** `client/src/App.jsx:177-189`
- **Category:** Polish
- **Issue:** Logs every authed path including test routes. Test routes are gated to two test emails, but the calls still hit the server for those users. Minor.
- **Fix:** Ignore paths starting with `/test/`.

### 21. `Capacitor.isNativePlatform()` not memoized in App context
- **File:** `client/src/App.jsx:209, 231, 240`
- **Category:** Performance (negligible)
- **Issue:** Called on every render of App. The function itself is fast but checks `window.Capacitor` each time. Hoist to module scope.
- **Fix:** `const IS_NATIVE = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;`

### 22. UndoToast on share-decline never restores the share UI on error past the toast's lifetime
- **File:** `client/src/pages/Workouts.jsx:1735-1751`
- **Category:** Bug
- **Issue:** If the user declines a share, the UndoToast catches a server error inside `commitFn` and restores the share to `pendingShares` — but if the toast has already auto-dismissed by the time the API call fails, the user sees the share reappear unexplained ~3 seconds later. Confusing.
- **Fix:** Surface an error toast on commit failure.

### 23. `applyAuth` throws "Failed to save login state" but `login`/`signup` don't render that message
- **File:** `client/src/context/AuthContext.jsx:140-153`
- **Category:** UX
- **Issue:** If localStorage is full or unavailable (Safari private), `applyAuth` throws and the caller (`login`/`signup`) will surface "Failed to save login state" via `friendlyError` fallback. Acceptable but generic.
- **Fix:** Treat the storage-write step as best-effort, NOT fatal. The user is authenticated in memory even if localStorage failed; let them use the app for that session.

### 24. Sentry not reporting `setUser` — every error is anonymous
- **File:** `client/src/sentry.js:15`, `client/src/context/AuthContext.jsx`
- **Category:** Operability
- **Issue:** `sendDefaultPii: false` is correct, but there's no `Sentry.setUser({ id: user.id })` after login either. Errors come in without a user ID → triaging "this crashed for someone" is hard.
- **Fix:** Add `Sentry.setUser({ id: user.id })` in AuthContext's `applyAuth` (no email/PII, just internal id).

### 25. `Welcome.jsx` doesn't lock body scroll when intro panel is taller than viewport
- **File:** `client/src/pages/Welcome.jsx:157-160`
- **Category:** Polish / iOS
- **Issue:** On a small device (iPhone SE 1st gen) the 1RM step content can overflow with the keyboard open. Wrapper uses `min-h-screen flex flex-col items-center justify-center px-4 py-8` — no scroll container. Keyboard appears, inputs go under it.
- **Fix:** Add `overflow-y-auto` to the outer wrapper, ensure the panel fits with `pb-32` for keyboard clearance.

### 26. `aria-label="Loading REPLAB"` on Splash is fine, but `splashDone` from a stale tab can still flash
- **File:** `client/src/App.jsx:195, 250`
- **Category:** Polish
- **Issue:** Auto-dismiss after 2.7s + the chunk-reload-retry pattern combined could let the splash flash if a hot-update fires mid-mount. Edge case.
- **Fix:** Track `splashDone` in sessionStorage if you want zero flash across HMR.

### 27. Login error fallback uses English literal (deferred per user note)
- **File:** `client/src/pages/Login.jsx:73`
- **Category:** i18n (already deferred)
- **Issue:** Acknowledged in audit guidance — not re-flagging. P2 reference for the record.
- **Fix:** N/A pre-launch.

---

## Things that look correct (sanity checks that passed)

- **Apple 3.1.1 IAP gating.** `Upgrade.jsx:18` uses `Capacitor.isNativePlatform()` to hide every Stripe checkout/portal button on both iOS and Android. Native users see a static informational paragraph: "REPLAB Pro is currently only available on the web." — no link, no button, no tap target. `/clientworkouts/ai` routes redirect away on iOS at `App.jsx:303`.
- **Apple 5.1.1(v) account deletion.** In-app `/auth/delete-account` flow at `Profile.jsx:417-433` works with password + DELETE confirmation. Public web `/delete-account` page exists for Google Play compliance. AccountDeleted/Failed landing pages render cleanly.
- **`TestRoute` hard gate.** `App.jsx:121` — `if (import.meta.env.PROD) return <Navigate to="/" replace />;` — production refuses to render any `/test/*` route regardless of user. Solid.
- **Privacy + Terms.** No "TBD" / placeholder / lorem ipsum. Texas governing law set in `Terms.jsx:122`. Privacy correctly attributes ArkiTech Systems, LLC.
- **Feature flag gating.** `FF_FEATURED`, `FF_CHALLENGES`, `FF_TRAINERS` all default off, reviewer's fresh keychain stays locked. Three "Coming Soon" cards visible but non-interactive.
- **WorkoutSession alerts already removed.** WorkoutSession.jsx:147 comment confirms the upgrade ("Replaces window.alert() — those read like a debug build to App Review."). Bug is that Workouts.jsx still has 8.
- **Apple permission descriptions complete in `Info.plist`.** `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSCameraUsageDescription` all present and brand-appropriate.
- **Deep links.** `initDeepLinks` correctly scopes to `replab-fitness.com` and `www.replab-fitness.com`, strips host, forwards path through React Router. `/session/:templateId/:date?summary=1` is a routable target.
- **Audio (Web Audio API).** Wall-clock-based rest timer at `WorkoutSession.jsx:494-502` recomputes remaining on each tick — no drift after iOS background suspend. `initAudio()` plays a silent buffer on user gesture to unlock iOS Safari.
- **Sentry.** `sendDefaultPii: false`, environment correctly mapped, `enabled: import.meta.env.PROD`, no DSN warns once at boot only.
- **Stale-chunk recovery.** `App.jsx:23-42` `lazyWithRetry` reloads once via sessionStorage flag — solid fix for the "deploy mid-session blank screen" class of bug.
- **Workouts empty state.** No infinite spinner — code comment at `Workouts.jsx:5103` documents the prior bug was fixed and the page now always renders content with "Nothing scheduled" copy. (Empty state messaging itself flagged in #5 / #12.)
- **PageTracker UTM capture.** Stores UTM params from URL on first landing, clears after signup — clean.
- **Open-redirect guard.** `sanitizeRedirectPath` in AuthContext.jsx correctly rejects `//`, `\`, and cross-origin paths.
