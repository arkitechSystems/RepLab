// Deep link / Universal Link / App Link handler.
//
// On native iOS/Android, when an external link to one of our domains is
// tapped (Universal Link on iOS, App Link on Android), the OS routes it
// into the app and fires `appUrlOpen` on @capacitor/app. We strip the host
// and forward the in-app path to React Router so the user lands on the
// matching screen instead of bouncing through the browser.
//
// Web is a no-op — links to the web app already open in the browser.
//
// PRE-LAUNCH TODO: edit APP_HOSTS to include your real production hostnames
// (web app + any redirect domains). Until then, deep links from external
// sources won't be matched and will fall back to a normal browser open.

import { Capacitor } from '@capacitor/core';

const APP_HOSTS = [
  // TODO: replace with your real production hosts before submitting to stores.
  // Examples once you decide your domain (audit B1 / decision):
  // 'replab.com',
  // 'www.replab.com',
  // 'replab.onrender.com',
];

let initialized = false;

export async function initDeepLinks(navigate) {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return; // web: no-op
  if (typeof navigate !== 'function') return;
  initialized = true;

  let App;
  try {
    ({ App } = await import('@capacitor/app'));
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[deeplink] @capacitor/app unavailable:', err?.message || err);
    return;
  }

  App.addListener('appUrlOpen', (event) => {
    try {
      const u = new URL(event.url);
      if (!APP_HOSTS.includes(u.host)) return;
      const target = u.pathname + u.search + u.hash;
      if (target && target !== '/') {
        // Defer one tick so router is ready if the app is cold-launching.
        setTimeout(() => navigate(target), 0);
      }
    } catch {
      // Malformed URL or non-routable scheme — ignore.
    }
  }).catch(() => {});
}

export async function teardownDeepLinks() {
  if (!Capacitor.isNativePlatform()) { initialized = false; return; }
  try {
    const { App } = await import('@capacitor/app');
    await App.removeAllListeners();
  } catch (_) {}
  initialized = false;
}
