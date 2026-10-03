// "Continue with Google / Apple" — provider sign-in through Firebase Auth.
//
// Firebase is only the identity broker here: we sign the user in with the
// provider, take the resulting Firebase ID token, hand it to our server
// (POST /auth/social), and then sign straight back out of Firebase. Our own
// JWT access/refresh pair remains the only session.
//
// Native (iOS/Android): @capacitor-firebase/authentication drives the OS
// sign-in sheets (Google blocks its OAuth page inside WebViews, so a web
// redirect can't work there). Web: the same plugin's web implementation,
// which wraps the Firebase JS SDK popup — with a redirect fallback when the
// browser blocks popups.

import { Capacitor } from '@capacitor/core';

const REDIRECT_FLAG = 'replab_social_redirect';

// Firebase web-app config. Only needed on web — native reads
// GoogleService-Info.plist / google-services.json instead. Values come from
// Firebase console → Project settings → Your apps → Web app.
const WEB_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'replabapp-c3a0d.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'replabapp-c3a0d',
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Hide the buttons on web until the Firebase web config is in the build, so
// production never shows buttons that can't work.
export function isSocialAuthAvailable() {
  if (Capacitor.isNativePlatform()) return true;
  return !!(WEB_CONFIG.apiKey && WEB_CONFIG.appId);
}

let pluginPromise = null;

// Loads (and on web, initializes Firebase for) the plugin. Call it on page
// mount so the click handler doesn't wait on a network import — Safari only
// allows the popup while the tap's user activation is still fresh.
//
// Resolves to { plugin } — NEVER to the plugin itself. A Capacitor plugin is
// a Proxy that answers every property, including `then`, so resolving a
// promise (or returning from an async function) with it makes JS treat it as
// a thenable and call plugin.then(), which never settles: the await hangs
// forever and no native call is made. That was the "stuck Google / Apple
// button" bug. Always unwrap with `(await preloadSocialAuth())?.plugin`.
export function preloadSocialAuth() {
  if (!isSocialAuthAvailable()) return Promise.resolve(null);
  if (!pluginPromise) {
    pluginPromise = (async () => {
      if (!Capacitor.isNativePlatform()) {
        const { initializeApp, getApps } = await import('firebase/app');
        if (getApps().length === 0) initializeApp(WEB_CONFIG);
      }
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      return { plugin: FirebaseAuthentication };
    })().catch((err) => {
      pluginPromise = null;
      throw err;
    });
  }
  return pluginPromise;
}

// True for "user closed the sheet / popup" across platforms, so the UI can
// stay quiet instead of showing an error for a deliberate cancel.
export function isSocialCancel(err) {
  const text = `${err?.code || ''} ${err?.message || ''}`;
  return /cancel|closed-by-user|popup-closed|1001|12501|SIGN_IN_CANCELLED/i.test(text);
}

function splitName(displayName) {
  if (!displayName || typeof displayName !== 'string') return { firstName: '', lastName: '' };
  const parts = displayName.trim().split(/\s+/);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

// Turns a completed plugin sign-in into what our server needs, then signs
// out of Firebase (best-effort) so no second session lingers on the device.
// keepSession leaves Firebase signed in — account deletion needs that for
// revokeAppleSignIn, which signs out itself afterwards.
async function finishSignIn(FirebaseAuthentication, result, provider, keepSession = false) {
  const { token } = await FirebaseAuthentication.getIdToken();
  // Apple only shares the name on the very first authorization; the native
  // plugin surfaces it as user.displayName. Google's name is also in the
  // ID token, which the server falls back to.
  const { firstName, lastName } = splitName(result?.user?.displayName);
  const credential = result?.credential || {};
  if (!keepSession) FirebaseAuthentication.signOut().catch(() => {});
  return {
    provider,
    idToken: token,
    firstName,
    lastName,
    // Used only by account deletion to revoke Sign in with Apple (see
    // revokeAppleSignIn). iOS returns an authorization code; web/Android
    // return an Apple access token.
    appleRevokeToken: provider === 'apple' ? (credential.authorizationCode || credential.accessToken || null) : null,
  };
}

function runProviderSignIn(FirebaseAuthentication, provider, mode) {
  if (provider === 'google') {
    return FirebaseAuthentication.signInWithGoogle(mode ? { mode } : undefined);
  }
  return FirebaseAuthentication.signInWithApple({ scopes: ['email', 'name'], ...(mode ? { mode } : {}) });
}

// Signs in with 'google' | 'apple'. Resolves to { provider, idToken,
// firstName, lastName, appleRevokeToken }, or to null when the web popup was
// blocked and we fell back to a full-page redirect (the page is navigating
// away; completeSocialRedirect() picks it up on return). Pass
// { keepSession: true } only for the delete-account confirmation.
export async function signInWithProvider(provider, { keepSession = false } = {}) {
  const FirebaseAuthentication = (await preloadSocialAuth())?.plugin;
  if (!FirebaseAuthentication) throw new Error('Google and Apple sign-in are not available yet.');

  if (Capacitor.isNativePlatform()) {
    const result = await runProviderSignIn(FirebaseAuthentication, provider);
    return finishSignIn(FirebaseAuthentication, result, provider, keepSession);
  }

  try {
    const result = await runProviderSignIn(FirebaseAuthentication, provider, 'popup');
    return finishSignIn(FirebaseAuthentication, result, provider, keepSession);
  } catch (err) {
    // No redirect fallback for the delete confirmation — it must finish in
    // this page load to revoke Apple before the account is gone.
    if (err?.code !== 'auth/popup-blocked' || keepSession) throw err;
    try { sessionStorage.setItem(REDIRECT_FLAG, provider); } catch {}
    await runProviderSignIn(FirebaseAuthentication, provider, 'redirect');
    return null;
  }
}

// Web only: finishes a sign-in that fell back to a redirect. Resolves to the
// same shape as signInWithProvider, or null when no redirect is pending.
export async function completeSocialRedirect() {
  if (Capacitor.isNativePlatform()) return null;
  let provider = null;
  try { provider = sessionStorage.getItem(REDIRECT_FLAG); } catch {}
  if (!provider) return null;
  try { sessionStorage.removeItem(REDIRECT_FLAG); } catch {}

  const FirebaseAuthentication = (await preloadSocialAuth())?.plugin;
  if (!FirebaseAuthentication) return null;
  const result = await FirebaseAuthentication.getRedirectResult();
  if (!result?.user) return null;
  return finishSignIn(FirebaseAuthentication, result, provider);
}

// Apple requires apps that offer Sign in with Apple to revoke the user's
// Apple tokens when they delete their account. Call right after the server
// confirms deletion, using the result of signInWithProvider('apple',
// { keepSession: true }) from the delete confirmation — Firebase's revoke
// call needs that Firebase session. Also removes the Firebase Auth user
// record and signs out. Every step is best-effort: the RepLab account is
// already deleted by the time this runs.
export async function finishSocialAccountDeletion(appleRevokeToken) {
  const FirebaseAuthentication = (await preloadSocialAuth().catch(() => null))?.plugin;
  if (!FirebaseAuthentication) return;
  if (appleRevokeToken) {
    await FirebaseAuthentication.revokeAccessToken({ token: appleRevokeToken }).catch((err) => {
      if (import.meta.env.DEV) console.warn('Apple token revoke failed:', err);
    });
  }
  await FirebaseAuthentication.deleteUser().catch(() => {});
  await FirebaseAuthentication.signOut().catch(() => {});
}

// Drops a Firebase session kept by { keepSession: true } when the deletion
// didn't go through (server error, user backed out).
export async function signOutSocial() {
  const FirebaseAuthentication = (await preloadSocialAuth().catch(() => null))?.plugin;
  if (FirebaseAuthentication) await FirebaseAuthentication.signOut().catch(() => {});
}
