// Where each user signed up (2026-11-27): the iOS app, the Android app, or
// the website. Shown on the admin dashboard (Daily Summary signups, User
// Sign Ups, Device Breakdown) and in the new-signup email.
//
// - Adds users.signup_platform: 'ios' | 'android' | 'web', NULL = unknown.
// - Backfills existing users only where signup_device proves a native app:
//   the apps send deviceInfo like "iPhone 15 Pro · ios 18.2" (see
//   server/signupPlatform.js platformFromDeviceInfo — same rule). Everyone
//   else stays NULL ("Unknown"): a browser-style device ("iPhone (Safari)")
//   can't tell the website from an old app build, so it isn't guessed.

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_platform TEXT`);
  // Drop-then-add so the migration can run again on a database that already
  // has it (IF NOT EXISTS isn't available for constraints).
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_signup_platform_check`);
  pgm.sql(`
    ALTER TABLE users ADD CONSTRAINT users_signup_platform_check
      CHECK (signup_platform IN ('ios', 'android', 'web'))
  `);
  pgm.sql(`
    UPDATE users
       SET signup_platform = substring(signup_device from '(?:^|· )(ios|android)(?: |$)')
     WHERE signup_platform IS NULL
       AND signup_device ~ '(^|· )(ios|android)( |$)'
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_signup_platform_check`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS signup_platform`);
};
