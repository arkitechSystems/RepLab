// Where a user signed up: the iOS app, the Android app, or the website
// (users.signup_platform: 'ios' | 'android' | 'web' | NULL = unknown).
//
// The client sends `platform` (Capacitor.getPlatform()) in the POST
// /auth/signup and first-sign-in POST /auth/social bodies. App builds from
// before that field existed don't send it, but they do send `deviceInfo`
// (only the native apps do — see client/src/utils/deviceInfo.js), shaped like
// "iPhone 15 Pro · ios 18.2" / "Pixel 8 · android 15", so the platform is
// read from that. Anything else stays NULL ("Unknown") — never guessed as
// "Website", so an old app build isn't counted as a website signup.

export const SIGNUP_PLATFORMS = ['ios', 'android', 'web'];

export const PLATFORM_LABELS = { ios: 'iOS app', android: 'Android app', web: 'Website' };

export function platformLabel(platform) {
  return PLATFORM_LABELS[platform] || 'Unknown';
}

export function normalizePlatform(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return SIGNUP_PLATFORMS.includes(v) ? v : null;
}

// deviceInfo from the native apps: "<model> · <os> <version>" (os is
// Capacitor's lowercase 'ios' / 'android'), or "<platform> device" when the
// model and OS are missing. The server's User-Agent fallback (parseDevice)
// never produces either shape.
export function platformFromDeviceInfo(deviceInfo) {
  if (typeof deviceInfo !== 'string') return null;
  const m = deviceInfo.match(/(?:^|· )(ios|android)(?: |$)/);
  return m ? m[1] : null;
}

export function signupPlatformFrom({ platform, deviceInfo } = {}) {
  return normalizePlatform(platform) || platformFromDeviceInfo(deviceInfo);
}
