import { useEffect, useState } from 'react';

// Client-only feature flags persisted in localStorage. Used pre-launch to
// keep "coming soon" features off for Apple App Review while leaving an
// escape hatch for dev/QA.
//
// To unlock a flag from any device, visit any URL with ?ff=<key>; the
// effect below persists the flag to localStorage. To re-lock, remove the
// `rl_ff_<key>` key in localStorage.
//
// The Apple App Review demo account has a fresh keychain/localStorage and
// no way to inject a URL param, so reviewers always see the locked state.

export const FF_FEATURED = 'featured';
export const FF_CHALLENGES = 'challenges';
export const FF_TRAINERS = 'trainers';

const STORAGE_PREFIX = 'rl_ff_';

function readFlag(key) {
  try { return localStorage.getItem(STORAGE_PREFIX + key) === '1'; } catch { return false; }
}

// Reads the flag for a given key and reacts to the ?ff=<key> URL param,
// persisting it to localStorage when present.
export function useFeatureFlag(key) {
  const [enabled, setEnabled] = useState(() => readFlag(key));
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('ff') === key) {
        localStorage.setItem(STORAGE_PREFIX + key, '1');
        setEnabled(true);
      }
    } catch {}
  }, [key]);
  return enabled;
}
