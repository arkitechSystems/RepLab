// Single source of truth for every value that changes at the LLC / signing-
// identity cutover. Anything that becomes a different string after the LLC
// clears (Apple Team ID, Android signing fingerprint, bundle ID, production
// domain, sender email) reads from process.env here, with a sane default for
// local dev / pre-cutover production. Update Render env vars at cutover and
// the server picks up the new values without a code change.
//
// Native build files (capacitor.config.json, iOS pbxproj, Android gradle,
// AndroidManifest, mobile/app.json, MainActivity.java, strings.xml) cannot be
// env-driven at build time and are tracked in MIGRATION.md at the repo root.

const APP_URL = process.env.APP_URL || 'https://replab-fitness.com';

function stripScheme(url) {
  return url.replace(/^https?:\/\//, '');
}

const APP_HOST = process.env.APP_HOST || stripScheme(APP_URL);

const APP_BUNDLE_ID = process.env.APP_BUNDLE_ID || 'com.replab.fitness';

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || 'TEAMID';

const ANDROID_SIGNING_SHA256 =
  process.env.ANDROID_SIGNING_SHA256 ||
  '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';

const EMAIL_FROM_TRANSACTIONAL =
  process.env.EMAIL_FROM_TRANSACTIONAL || 'REPLAB <noreply@email.replab-fitness.com>';
const EMAIL_FROM_ADMIN =
  process.env.EMAIL_FROM_ADMIN || 'REPLAB <noreply@email.replab-fitness.com>';

export default {
  APP_URL,
  APP_HOST,
  APP_BUNDLE_ID,
  APPLE_TEAM_ID,
  ANDROID_SIGNING_SHA256,
  EMAIL_FROM_TRANSACTIONAL,
  EMAIL_FROM_ADMIN,
};
