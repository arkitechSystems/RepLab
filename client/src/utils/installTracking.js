// Native app install tracking.
//
// On the first launch of the iOS/Android app we mint a random install id,
// persist it, fire a `first_app_open` PostHog event, and report the install
// to the server (POST /installs). Once a user is signed in we attach their
// account to that install (POST /installs/link) so the admin dashboard can
// show install -> account conversion.
//
// Both server calls fail silently and are retried on the next launch / login
// — the "reported" and "linked" flags are only written after a 2xx.
//
// Web is a no-op: only Capacitor native builds count as installs.
import { Capacitor } from '@capacitor/core';
import { api } from '../api';
import { track } from './analytics';

const KEY_ID = 'replab_install_id';
const KEY_REPORTED = 'replab_install_reported';
const KEY_LINKED = 'replab_install_linked';

// Prefer @capacitor/preferences (native key/value store — survives WebView
// storage eviction on iOS); fall back to localStorage if the plugin fails.
let prefsPromise = null;
function getPrefs() {
  if (!prefsPromise) {
    prefsPromise = import('@capacitor/preferences')
      .then((m) => m.Preferences)
      .catch(() => null);
  }
  return prefsPromise;
}

async function getItem(key) {
  const prefs = await getPrefs();
  if (prefs) {
    try {
      const { value } = await prefs.get({ key });
      return value ?? null;
    } catch {}
  }
  try { return localStorage.getItem(key); } catch { return null; }
}

async function setItem(key, value) {
  const prefs = await getPrefs();
  if (prefs) {
    try {
      await prefs.set({ key, value });
      return;
    } catch {}
  }
  try { localStorage.setItem(key, value); } catch {}
}

function makeUuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  // RFC4122 v4 fallback for older WebViews without randomUUID.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function getAppVersion() {
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    if (!info?.version) return null;
    return info.build ? `${info.version} (${info.build})` : info.version;
  } catch {
    return null;
  }
}

function getPlatform() {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : null;
}

// Single in-flight promise so StrictMode double-effects / concurrent callers
// don't mint two ids or double-report.
let reportPromise = null;

// Ensure this install has an id and has been reported to the server.
// Resolves to the install id (or null on web / unsupported platform).
// Never throws.
export function reportInstall() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  if (!reportPromise) {
    reportPromise = doReport().catch(() => null).finally(() => {
      // Allow a later call (e.g. after login) to retry a failed report.
      reportPromise = null;
    });
  }
  return reportPromise;
}

async function doReport() {
  const platform = getPlatform();
  if (!platform) return null;

  let installId = await getItem(KEY_ID);
  const appVersion = await getAppVersion();

  if (!installId) {
    installId = makeUuid();
    await setItem(KEY_ID, installId);
    track('first_app_open', {
      platform,
      app_version: appVersion,
      install_id: installId,
    });
  }

  if ((await getItem(KEY_REPORTED)) !== '1') {
    try {
      await api('/installs', {
        method: 'POST',
        body: JSON.stringify({ installId, platform, appVersion }),
      });
      await setItem(KEY_REPORTED, '1');
    } catch {
      // Offline / server down — retry on next launch.
    }
  }
  return installId;
}

let linkPromise = null;

// Attach the signed-in user to this install. Call whenever a user is
// authenticated (login, signup, or app start with a saved session).
// No-op on web, if already linked, or if the install hasn't reached the
// server yet (retried on next call). Never throws.
export function linkInstallToUser() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  if (!linkPromise) {
    linkPromise = doLink().catch(() => {}).finally(() => { linkPromise = null; });
  }
  return linkPromise;
}

async function doLink() {
  if ((await getItem(KEY_LINKED)) === '1') return;
  const installId = await reportInstall();
  if (!installId) return;
  if ((await getItem(KEY_REPORTED)) !== '1') return; // report first, link later
  await api('/installs/link', {
    method: 'POST',
    body: JSON.stringify({ installId }),
  });
  await setItem(KEY_LINKED, '1');
}
