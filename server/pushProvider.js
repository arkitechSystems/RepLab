// Thin wrapper around firebase-admin for sending push notifications.
// Dormant until FCM_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS)
// is set — isFcmConfigured() is false, all send calls no-op.
//
// iOS token flow: the client (client/src/utils/push.js) swaps the raw APNs
// token for an FCM token via @capacitor-firebase/messaging before
// registering with the server, so every token in the device_tokens table
// is an FCM token regardless of platform. iOS delivery requires:
//   - GoogleService-Info.plist in the Xcode project (client/ios/App/App/)
//   - Firebase Messaging pod (auto-added by `npx cap sync` once the
//     @capacitor-firebase/messaging dep is in package.json)
// See _marketing/iOS-SUBMISSION-PLAYBOOK.md for the Mac-side steps.

import admin from 'firebase-admin';

let initialized = false;
let initError = null;

function init() {
  if (initialized || initError) return;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  const hasAdc = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw && !hasAdc) return; // not configured; stay dormant

  try {
    if (raw) {
      const creds = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(creds) });
    } else {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
    initialized = true;
    console.log('[push] Firebase Admin initialized');
  } catch (err) {
    initError = err;
    console.error('[push] Firebase Admin init failed:', err.message);
  }
}

export function isFcmConfigured() {
  init();
  return initialized;
}

// Send one payload to many tokens. Returns { sent, invalidTokens } so the
// caller can prune dead tokens from the DB.
export async function sendFcmToTokens(tokens, { title, body, data = {} }) {
  init();
  if (!initialized || !tokens || tokens.length === 0) {
    return { sent: 0, invalidTokens: [] };
  }

  const message = {
    notification: { title, body },
    // FCM requires all data values to be strings.
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    const invalidTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error) {
        const code = r.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          invalidTokens.push(tokens[i]);
        }
      }
    });
    return { sent: response.successCount, invalidTokens };
  } catch (err) {
    console.error('[push] FCM send error:', err.message);
    return { sent: 0, invalidTokens: [] };
  }
}
