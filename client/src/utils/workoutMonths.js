// My Workouts page: workouts grouped by the month they were created, newest
// month first ("NOVEMBER 2026"), newest workout first within a month.
// Workouts with no createdAt (made before 2026-11-27 and never started — the
// server backfills the rest from their first session) go last, in a group
// called "EARLIER", newest first by their place in the list.

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY',
  'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

export const EARLIER_LABEL = 'EARLIER';

function createdTime(t) {
  if (!t?.createdAt) return null;
  const ms = new Date(t.createdAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Newest first: created time, then (same time / no time) list position, then id.
export function newestFirst(a, b) {
  const ta = createdTime(a);
  const tb = createdTime(b);
  if (ta != null && tb != null && ta !== tb) return tb - ta;
  if (ta != null && tb == null) return -1;
  if (ta == null && tb != null) return 1;
  return ((b.sortOrder ?? 0) - (a.sortOrder ?? 0)) || (b.id - a.id);
}

// [{ key, label, items }] in display order. Months use the phone's local time.
export function groupWorkoutsByMonth(templates) {
  const groups = new Map();
  for (const t of [...(templates || [])].sort(newestFirst)) {
    const ms = createdTime(t);
    let key = 'earlier';
    let label = EARLIER_LABEL;
    if (ms != null) {
      const d = new Date(ms);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key).items.push(t);
  }
  // Sorted input means months already come newest first and "earlier" last.
  return [...groups.values()];
}
