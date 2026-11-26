// Keeps the phone's own copies of a workout day in step when the schedule
// slides (missed-workout Resume, Calendar "push schedule back").
//
// The server moves started-but-unfinished sessions with their day
// (server/missedWorkouts.js shiftUnfinishedSessionsFrom). Two things on the
// phone are also tied to (templateId, date):
//   1. Queued saves (TanStack mutations, persisted while offline). One that
//      reaches the server AFTER the move would recreate the session on the old
//      date — so before moving we wait for every queued save/complete on or
//      after fromDate to go through, and refuse to move if they can't.
//   2. The in-session backup of typed numbers (replab:session:{tid}:{date}) —
//      renamed to the new date so reopening the moved day still restores it.
//      The workout timer (wf-timer-{tid}-{date}) is dropped: its start time
//      belongs to the old day.

import { SAVE_SESSION, COMPLETE_SESSION } from '../queries/sessionMutations';

const BACKUP_PREFIX = 'replab:session:';
const TIMER_PREFIX = 'wf-timer-';

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mutationDate(m) {
  const v = m.state.variables || {};
  return v.body?.date ?? v.date ?? null;
}

const SESSION_KEYS = [JSON.stringify(SAVE_SESSION), JSON.stringify(COMPLETE_SESSION)];

// Unsent workout saves/completions dated on or after fromDate.
export function pendingDaySaves(client, fromDate) {
  return client.getMutationCache().getAll().filter((m) => {
    if (m.state.status !== 'pending') return false;
    if (!SESSION_KEYS.includes(JSON.stringify(m.options.mutationKey))) return false;
    const date = mutationDate(m);
    return typeof date === 'string' && date >= fromDate;
  });
}

// Sends any queued saves for those days and waits for them. Resolves true
// once none are left, false if they're still waiting after timeoutMs (offline
// or the server is unreachable) — the caller must not move the schedule then.
export async function flushDaySaves(client, fromDate, { timeoutMs = 10000, pollMs = 200 } = {}) {
  if (pendingDaySaves(client, fromDate).length === 0) return true;
  client.resumePausedMutations().catch(() => {});
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    if (pendingDaySaves(client, fromDate).length === 0) return true;
  }
  return false;
}

// Renames backups dated on or after fromDate by `days`; drops their timers.
// Latest dates first so a rename never lands on a key that hasn't moved yet.
export function moveLocalSessionData(fromDate, days, storage = globalThis.localStorage) {
  if (!days || !storage) return 0;
  let moved = 0;
  try {
    const backups = [];
    const timers = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k) continue;
      if (k.startsWith(BACKUP_PREFIX)) {
        const [tid, date] = k.slice(BACKUP_PREFIX.length).split(':');
        if (tid && date && date >= fromDate) backups.push({ k, tid, date });
      } else if (k.startsWith(TIMER_PREFIX)) {
        const m = /^wf-timer-(.+)-(\d{4}-\d{2}-\d{2})$/.exec(k);
        if (m && m[2] >= fromDate) timers.push(k);
      }
    }
    backups.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (days < 0) backups.reverse();
    for (const b of backups) {
      const value = storage.getItem(b.k);
      storage.removeItem(b.k);
      if (value != null) {
        storage.setItem(`${BACKUP_PREFIX}${b.tid}:${addDays(b.date, days)}`, value);
        moved++;
      }
    }
    for (const k of timers) storage.removeItem(k);
  } catch { /* storage disabled — nothing to move */ }
  return moved;
}

export const STILL_SAVING_MESSAGE =
  'Your workout is still saving. Connect to the internet, wait a moment, then try again.';
