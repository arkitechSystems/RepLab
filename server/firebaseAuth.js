// Verifies Firebase Auth ID tokens for "Continue with Google / Apple".
//
// The client signs the user in with the provider through Firebase Auth
// (native plugin on iOS/Android, Firebase JS SDK popup on web) and sends us
// the resulting Firebase ID token. We verify it here in pure JS — signature
// against Google's securetoken JWKS, issuer/audience against our Firebase
// project — then map it to a RepLab user and issue our own JWT pair. Firebase
// is only the identity broker; it never becomes our session system.
//
// Reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'replabapp-c3a0d';

// jose caches the key set and refetches on unknown `kid`, honoring the
// endpoint's Cache-Control, so this is safe to share across requests.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

// Firebase provider ids we accept → our short provider names.
const PROVIDERS = {
  'google.com': 'google',
  'apple.com': 'apple',
};

// Returns { provider, providerUid, email, emailVerified, name } or throws.
// `providerUid` is the provider's own stable account id (Google `sub`, Apple
// `sub`), taken from firebase.identities — not the Firebase uid — so the
// mapping survives if the Firebase project's user records are ever reset.
export async function verifyFirebaseIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
    algorithms: ['RS256'],
  });
  if (!payload.sub) throw new Error('Token has no subject');

  const firebase = payload.firebase || {};
  const signInProvider = firebase.sign_in_provider;
  const provider = PROVIDERS[signInProvider];
  if (!provider) throw new Error(`Unsupported sign-in provider: ${signInProvider}`);

  const providerUid = firebase.identities?.[signInProvider]?.[0] || payload.sub;

  return {
    provider,
    providerUid: String(providerUid),
    email: typeof payload.email === 'string' ? payload.email.toLowerCase().trim() : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : null,
  };
}
