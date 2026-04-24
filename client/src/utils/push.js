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
// The token we register is the platform-native push token returned by the
// Capacitor plugin (APNs on iOS, FCM on Android). For FCM sends to reach
// iOS devices, the Capacitor iOS project needs the Firebase Messaging SDK
// added at app-store-prep time; until then iOS registrations will sit in
// the DB but won't actually receive sends.

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
    console.warn('[push] failed to register token with server:', err?.message || err);
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
    console.warn('[push] plugin not available:', err?.message || err);
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

    PushNotifications.addListener('registration', (tokenObj) => {
      if (tokenObj?.value) {
        registerTokenOnServer(tokenObj.value, platform);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] registration error:', err?.error || err);
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
    console.warn('[push] init failed:', err?.message || err);
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
    console.warn('[push] unregister failed:', err?.message || err);
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
  } catch (_) {}

  initialized = false;
  currentToken = null;
}
