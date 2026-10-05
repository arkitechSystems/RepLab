import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Pre-launch feature gates for Featured Workouts, Challenges and Trainers.
// They're account-based: only the owner's account sees these sections, on
// any device. Everyone else — including the Apple App Review demo account —
// sees them locked/hidden.
//
// To open a section to someone else, add their username to PREVIEW_USERNAMES
// (lowercase). To launch a section for everyone, remove its gate at the call
// site.
//
// Replaced the old per-device `?ff=<key>` URL unlock (2026-10-04), which
// worked for whoever opened the link regardless of account.

export const FF_FEATURED = 'featured';
export const FF_CHALLENGES = 'challenges';
export const FF_TRAINERS = 'trainers';

const PREVIEW_USERNAMES = new Set(['wmartin']);

// Leftover localStorage keys from the retired ?ff= unlock.
const LEGACY_STORAGE_PREFIX = 'rl_ff_';

export function useFeatureFlag(key) {
  const { user } = useAuth();

  useEffect(() => {
    try { localStorage.removeItem(LEGACY_STORAGE_PREFIX + key); } catch {}
  }, [key]);

  // Always unlocked under `vite dev` (npm run dev) so gated features can be
  // built locally. import.meta.env.DEV is baked in at build time, so
  // production web and the native apps are unaffected.
  if (import.meta.env.DEV) return true;
  const username = String(user?.username || '').trim().toLowerCase();
  return PREVIEW_USERNAMES.has(username);
}
