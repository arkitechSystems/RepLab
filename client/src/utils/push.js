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
// Token flow:
//   - Android: @capacitor/push-notifications returns an FCM token directly
//     (Capacitor wraps Google Play Services on Android).
//   - iOS: @capacitor/push-notifications returns a raw APNs token, which
//     our firebase-admin server can't deliver to. So on iOS we ADDITIONALLY
//     call @capacitor-firebase/messaging's getToken() to retrieve an FCM
//     token (which Firebase produces internally once APNs registration
//     succeeds), and register THAT with our server.
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

export async function initPushNotifications() {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return; // web: no-op

  initialized = true;

  let PushNotifications;
  try {
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] plugin not available:', err?.message || err);
    return;
  }

  try {
    // On iOS this triggers the system permission prompt the first time.
    // Android 13+ also requires runtime POST_NOTIFICATIONS permission; the
    // plugin handles both under one call.
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    const platform = Capacitor.getPlatform(); // 'ios' | 'android'

    PushNotifications.addListener('registration', async (tokenObj) => {
      // On Android, tokenObj.value is already an FCM token — register as-is.
      // On iOS, tokenObj.value is a raw APNs token; swap it for the FCM
      // token that Firebase produces once APNs registration succeeds. The
      // server's firebase-admin can only deliver to FCM tokens, so if FCM
      // is unavailable on the iOS build (GoogleService-Info.plist missing,
      // Firebase pod not linked) we skip registration entirely rather than
      // store a dead APNs token.
      let token = tokenObj?.value;
      if (!token) return;
      if (platform === 'ios') {
        try {
          const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
          const fcm = await FirebaseMessaging.getToken();
          if (fcm?.token) {
            token = fcm.token;
          } else {
            if (import.meta.env.DEV) console.warn('[push] FCM getToken returned empty on iOS — skipping registration');
            return;
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[push] FCM unavailable on iOS, skipping registration:', err?.message || err);
          return;
        }
      }
      registerTokenOnServer(token, platform);
    });

    PushNotifications.addListener('registrationError', (err) => {
      if (import.meta.env.DEV) console.warn('[push] registration error:', err?.error || err);
    });

    // Foreground receipt — no-op for now; we can wire an in-app toast later.
    PushNotifications.addListener('pushNotificationReceived', () => {});

    // User tapped the notification. Navigate to the session if the payload
    // carries templateId/date (see server/pushScheduler.js data fields).
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action?.notification?.data || {};
      if (data.templateId && data.date) {
        const target = `/session/${data.templateId}/${data.date}`;
        if (typeof window !== 'undefined') window.location.assign(target);
      }
    });

    await PushNotifications.register();
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[push] init failed:', err?.message || err);
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
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
  } catch (_) {}

  initialized = false;
  currentToken = null;
}
