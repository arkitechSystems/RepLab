// Convert raw error objects/messages into friendly, user-facing copy.
// Keeps server stack traces and HTTP status text out of the UI.
export function friendlyError(err, fallback = "Something went wrong. Try again in a moment.") {
  const msg = (err?.message || String(err || '')).toLowerCase();
  if (/network|fetch|offline|connection/.test(msg)) return "Couldn't reach REPLAB. Check your connection and try again.";
  if (/401|unauthor|session.*expir|jwt/.test(msg)) return "Your session expired. Please sign in again.";
  if (/429|rate.*limit|too many/.test(msg)) return "You're going a little fast. Wait a moment and try again.";
  if (/email.*taken|already.*exist/.test(msg)) return "That email is already registered. Try signing in instead.";
  if (/invalid.*credential|incorrect.*password|wrong.*password/.test(msg)) return "Email or password didn't match. Try again or reset your password.";
  if (/email.*invalid|invalid.*email/.test(msg)) return "That doesn't look like a valid email address.";
  if (/password.*too.*short|password.*weak/.test(msg)) return "Password needs to be at least 8 characters with one uppercase and one number.";
  return fallback;
}
