# iOS release from the cloud Mac (Terminal only)

How to build RepLab for iOS and upload it to App Store Connect without clicking through Xcode.
Written so a Claude Code session running **on the cloud Mac** can do the whole thing. The App Store
Connect web steps (version page, subtitle, What's New, picking the build, submitting) are done
separately in Chrome from the Windows PC.

## Facts

- Bundle ID `com.replab.fitness`, Apple Team ID `BMPD2FUVGY`, signing is Automatic.
- Capacitor project with Swift Package Manager: open/build `client/ios/App/App.xcodeproj`
  (there is **no** `.xcworkspace`).
- Version and build numbers live in the repo now: `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in
  `client/ios/App/App.xcodeproj/project.pbxproj` (both Debug and Release). Every upload needs a build
  number higher than the last one App Store Connect has seen. Last manual upload before this doc: 1.2.23 (23).
- Export settings: `client/ios/ExportOptions.plist` (`destination=upload` → uploads straight to App Store Connect).
- The upload uses the Apple account signed in to Xcode (Xcode → Settings → Accounts). If it isn't signed in,
  ask Will to sign in there — never type his Apple password yourself.
- Run `npx cap sync ios` **only on the Mac**. On Windows it writes backslash paths into Package.swift and the app crashes.

## Steps (run from the repo root on the Mac)

1. Throw away the files Xcode and npm rewrite on their own, then pull:
   ```sh
   git checkout -- client/ios/App/App.xcodeproj/project.pbxproj client/package-lock.json
   git pull origin main
   ```
2. Check the version numbers are the ones you want to ship:
   ```sh
   grep -E "MARKETING_VERSION|CURRENT_PROJECT_VERSION" client/ios/App/App.xcodeproj/project.pbxproj
   ```
3. Build the web app and copy it into the iOS project. `npm run build` is required — `cap sync` only
   copies the existing `dist/`, so skipping it silently ships old code.
   ```sh
   cd client
   npm install
   npm run build
   npx cap sync ios
   ```
4. Archive (still in `client/`):
   ```sh
   xcodebuild archive \
     -project ios/App/App.xcodeproj \
     -scheme App \
     -configuration Release \
     -destination "generic/platform=iOS" \
     -archivePath ios/App/build/RepLab.xcarchive \
     DEVELOPMENT_TEAM=BMPD2FUVGY \
     -allowProvisioningUpdates
   ```
   Look for `** ARCHIVE SUCCEEDED **`. If `-scheme App` is not found, run
   `xcodebuild -list -project ios/App/App.xcodeproj` and use the scheme it lists.
5. Export and upload:
   ```sh
   xcodebuild -exportArchive \
     -archivePath ios/App/build/RepLab.xcarchive \
     -exportOptionsPlist ios/ExportOptions.plist \
     -exportPath ios/App/build/export \
     -allowProvisioningUpdates
   ```
   Look for `** EXPORT SUCCEEDED **` and an "Upload succeeded" line.
6. Keep the archive so crash reports from this build can be symbolicated later:
   ```sh
   open ios/App/build/RepLab.xcarchive
   ```
   This adds it to Xcode's Organizer. Don't delete archives of shipped builds.
7. Tell Will the version and build number that went up. The build shows in App Store Connect after
   10–30 minutes of processing.

## Common errors

| Error | Meaning / fix |
|---|---|
| `You don't have the required contracts to perform an operation` | An Apple agreement needs accepting in App Store Connect → Business. Will has to accept it. |
| `No Accounts` / `No signing certificate` | Xcode isn't signed in to the Apple account. Will signs in via Xcode → Settings → Accounts. |
| `The bundle version must be higher than the previously uploaded version` | Raise `CURRENT_PROJECT_VERSION` (both places), commit, push, rebuild. |
| `git pull` refuses because of local changes to `project.pbxproj` | Expected — Xcode rewrites it. Run step 1's `git checkout --` line. |

## After the upload (Windows side, in Chrome)

App Store Connect → RepLab → the new version → pick the build → What's New → submit for review.
Subtitle is **Fitness Training App** (RepLab is described as a fitness app, never "Strength & Hypertrophy").
