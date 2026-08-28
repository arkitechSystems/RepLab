// Push notification bootstrap for Capacitor (iOS + Android).
//
// On web this is a no-op — `Capacitor.isNativePlatform()` is false in the
// browser, so we never request permission and never attempt to register.
// When bundled into the iOS or Android app via `npx cap sync`, the real
// plugin is wired up and this module starts behaving.
//
// Call initPushNotifications() once the user is authenticated. It's
// idempotent — guarded by a module-level flag — so re-running on every
// auth state change is safe and cheap.
//
// Single plugin: @capacitor-firebase/messaging handles permissions,
// registration, and FCM tokens on both platforms directly — no separate
// @capacitor/push-notifications plugin. (Previously we ran both, which
// meant they fought over the native foreground-notification handler; only
// one plugin can own it at a time.)
//
// Token flow:
//   - Android: getToken() returns an FCM token directly once Firebase is
//     configured; notification permission only gates the visible alert on
//     Android 13+, not FCM token generation.
//   - iOS: the native plugin calls UIApplication.registerForRemoteNotifications()
//     as soon as it loads (every launch — this does NOT show a permission
//     prompt, it just opens the APNs channel). Once AppDelegate forwards the
//     resulting device token, the plugin sets it as the Firebase APNs token
//     and fires 'apnsTokenReceived', at which point getToken() can produce
//     a real FCM token. We also listen for 'tokenReceived' (Firebase's own
//     refresh callback) and do an immediate getToken() pull on init, to
//     cover both "listener attaches before/after the native token arrives"
//     race directions.
//   - Prerequisites for iOS FCM: GoogleService-Info.plist must be in the
//     Xcode project and Firebase Messaging pod must be installed. See
//     _marketing/iOS-SUBMISSION-PLAYBOOK.md.

import { Capacitor } from '@capacitor/core';
import { api } from '../api';

let initialized = false;
let currentToken = null;

async function registerTokenOnServer(token, platform) {
  try {
    await api('/push/register', {
      method: 'POST',
      body: JSON.stringify({ pushToken: token, platform }),
    });
    currentToken = token;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] failed to register token with server:', err?.message || err);
  }
}

// initPushNotifications(): SAFE for auto-call on auth. Never triggers the
// OS permission prompt — only attaches listeners and finishes registering
// if the user has ALREADY granted permission (via a previous explicit
// requestPushPermission() call). Apple guideline 4.5.4 requires push
// permission requests to follow a contextualized user action, so the
// prompt is gated behind requestPushPermission() below — call that from
// an "Enable Notifications" button with explanatory copy, NOT from app
// launch / auth state changes.
export async function initPushNotifications() {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return; // web: no-op

  let FirebaseMessaging;
  try {
    ({ FirebaseMessaging } = await import('@capacitor-firebase/messaging'));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] plugin not available:', err?.message || err);
    return;
  }

  try {
    // ONLY check current status — never call requestPermissions() from this
    // path. If the user hasn't granted yet, exit silently; the explicit
    // requestPushPermission() function below is the only path that prompts.
    const perm = await FirebaseMessaging.checkPermissions();
    if (perm.receive !== 'granted') return;

    initialized = true;
    const platform = Capacitor.getPlatform(); // 'ios' | 'android'

    // Fires with a ready-to-use FCM token — on Android this is the primary
    // path; on iOS it's Firebase's token-refresh callback (fires once the
    // APNs token has been set, see apnsTokenReceived below).
    FirebaseMessaging.addListener('tokenReceived', (event) => {
      if (event?.token) registerTokenOnServer(event.token, platform);
    });

    if (platform === 'ios') {
      // Fires once AppDelegate forwards the APNs device token and the
      // plugin sets it on Messaging — pull the FCM token explicitly here
      // in case 'tokenReceived' doesn't also fire for this transition.
      FirebaseMessaging.addListener('apnsTokenReceived', async () => {
        try {
          const fcm = await FirebaseMessaging.getToken();
          if (fcm?.token) registerTokenOnServer(fcm.token, platform);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[push] getToken after APNs registration failed:', err?.message || err);
        }
      });
    }

    // Foreground receipt — no-op for now; we can wire an in-app toast later.
    FirebaseMessaging.addListener('notificationReceived', () => {});

    // User tapped the notification. Navigate to the session if the payload
    // carries templateId/date (see server/pushScheduler.js data fields).
    FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
      const data = action?.notification?.data || {};
      if (data.templateId && data.date) {
        const target = `/session/${data.templateId}/${data.date}`;
        if (typeof window !== 'undefined') window.location.assign(target);
      }
    });

    // Pull path: covers the case where APNs/FCM registration already
    // completed earlier in this launch (e.g. permission was granted in a
    // prior session) before the listeners above were attached.
    try {
      const fcm = await FirebaseMessaging.getToken();
      if (fcm?.token) registerTokenOnServer(fcm.token, platform);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[push] initial getToken failed, relying on listeners:', err?.message || err);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] init failed:', err?.message || err);
  }
}

// requestPushPermission(): explicit user-initiated permission flow. CALL
// THIS from an "Enable Notifications" button (or similar) that has already
// shown the user explanatory copy ("Get reminders for your scheduled
// workouts"). Returns 'granted' / 'denied' / 'unavailable'. Apple guideline
// 4.5.4: the OS permission prompt must follow a contextualized user
// action, NOT fire automatically on app launch.
export async function requestPushPermission() {
  if (!Capacitor.isNativePlatform()) return 'unavailable';

  let FirebaseMessaging;
  try {
    ({ FirebaseMessaging } = await import('@capacitor-firebase/messaging'));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] plugin not available:', err?.message || err);
    return 'unavailable';
  }

  try {
    let perm = await FirebaseMessaging.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await FirebaseMessaging.requestPermissions();
    }
    if (perm.receive !== 'granted') return perm.receive || 'denied';

    // Permission granted — drive initialization so listeners + token
    // registration happen. initPushNotifications() is idempotent.
    await initPushNotifications();
    return 'granted';
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] requestPushPermission failed:', err?.message || err);
    return 'denied';
  }
}

export async function teardownPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    initialized = false;
    currentToken = null;
    return;
  }

  try {
    if (currentToken) {
      await api('/push/unregister', {
        method: 'DELETE',
        body: JSON.stringify({ pushToken: currentToken }),
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] unregister failed:', err?.message || err);
  }

  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    await FirebaseMessaging.removeAllListeners();
  } catch (_) {}

  initialized = false;
  currentToken = null;
}
