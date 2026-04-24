import { VERSES } from '../data/verses';

// Non-repeating random verse selection.
// Remembers the last ~75% of picks in localStorage so the user sees every verse
// before any repeat. Resets once the exclusion pool would leave nothing.

const RECENT_KEY = 'wf-bible-verses-recent';
const MAX_RECENT = Math.floor(VERSES.length * 0.75);

export function pickNextVerse() {
  let recent;
  try { recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { recent = []; }

  const allIdx = VERSES.map((_, i) => i);
  const pool = allIdx.filter((i) => !recent.includes(i));
  const candidates = pool.length > 0 ? pool : allIdx;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const nextRecent = [...recent, picked].slice(-MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent)); } catch {}

  return { verse: VERSES[picked], index: picked };
}

// For the sandbox — doesn't touch the recent-pool, so the test page can cycle
// freely without interfering with the user's real rotation state.
export function getVerseAt(i) {
  return VERSES[((i % VERSES.length) + VERSES.length) % VERSES.length];
}
