#!/bin/sh
# Xcode Cloud: runs after the repo is cloned, before Xcode resolves Swift
# packages and builds. The iOS project is a Capacitor wrapper, so the web app
# has to be built and synced into it first:
#   npm ci → vite build (client/dist) → npx cap sync ios
# `cap sync` also regenerates CapApp-SPM/Package.swift with macOS paths (the
# Windows-generated copy can contain backslashes, which break SPM).
set -e

echo "== Installing Node =="
export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
node -v
npm -v

cd "$CI_PRIMARY_REPOSITORY_PATH/client"

echo "== npm ci =="
npm ci

echo "== Building web app =="
npm run build

echo "== Syncing into the iOS project =="
npx cap sync ios

echo "== Done =="
