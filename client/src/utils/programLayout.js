// Program builder ("sample calendar") helpers — pure, so they're tested
// directly (programLayout.test.js). A program is its templates in order:
// position i = Week floor(i/7)+1, Day (i%7)+1; rest days are isRest
// templates. The builder edits a list of days ("slots") and saves it with
// PUT /programs/:id/layout, where each day is { templateId } (keep),
// { copyOf } (a new copy — the same workout on several days is always a
// separate copy) or { rest: true }. Programs are whole weeks.

export const MAX_PROGRAM_WEEKS = 52;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_PAGE_WEEKS = 4;

// The program's days: its templates (sortOrder order, prehab warm-ups left
// out) padded with null (an empty day) to whole weeks, at least one week.
export function programDays(templates) {
  const list = (templates || [])
    .filter((t) => t && !t.isPrehab)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
  const weeks = Math.max(1, Math.ceil(list.length / 7));
  return Array.from({ length: weeks * 7 }, (_, i) => list[i] || null);
}

export const weekCount = (days) => Math.max(1, Math.ceil(days.length / 7));
export const weekOf = (slotIndex) => Math.floor(slotIndex / 7);

// Saved start weekday (0 = Sunday … 6 = Saturday), or null for "Day 1–7".
export function startWeekdayOf(program) {
  const v = program?.programDetails?.startWeekday;
  return Number.isInteger(v) && v >= 0 && v <= 6 ? v : null;
}

// Weekday of day-of-week index d (0–6) when the program starts on `start`.
export const weekdayFor = (d, start) => (start == null ? null : (start + d) % 7);

// "Day 3" or, with a start weekday, "Day 3 · Wed".
export function dayLabel(dayIndex, start) {
  const wd = weekdayFor(dayIndex % 7, start);
  return wd == null ? `Day ${(dayIndex % 7) + 1}` : `Day ${(dayIndex % 7) + 1} · ${WEEKDAY_SHORT[wd]}`;
}

// Column headers for the month grid: D1–D7, or weekday names.
export function dayHeaders(start) {
  return Array.from({ length: 7 }, (_, d) => (start == null ? `D${d + 1}` : WEEKDAY_SHORT[weekdayFor(d, start)]));
}

export const isWorkout = (t) => !!t && !t.isRest;

// Request body slots for a day list. Days may hold a template (kept), null
// (empty → rest day) or a { copyOf } placeholder.
export function toLayoutSlots(days) {
  return days.map((d) => {
    if (!d) return { rest: true };
    if (d.copyOf != null) return { copyOf: d.copyOf };
    return { templateId: d.id };
  });
}

// ── Edits: each returns a new day list ──

export function setDay(days, index, value) {
  const next = days.slice();
  next[index] = value;
  return next;
}

export function addWeek(days) {
  return [...days, ...Array(7).fill(null)];
}

// Copies of a week's workouts go on a new last week (rest days stay rest).
export function duplicateWeek(days, week) {
  const copies = days.slice(week * 7, week * 7 + 7).map((d) => (isWorkout(d) ? { copyOf: d.id } : null));
  return [...days, ...copies];
}

export function deleteWeek(days, week) {
  return [...days.slice(0, week * 7), ...days.slice(week * 7 + 7)];
}

// Move a day's workout to another day: the two days swap (moving onto a
// rest or empty day leaves rest behind).
export function moveDay(days, from, to) {
  const next = days.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// Other copies of a workout in the same program: same name (trimmed, any
// case), not rest, same owner.
export function copiesInProgram(templates, template) {
  if (!template || template.programId == null) return [];
  const key = (template.name || '').trim().toLowerCase();
  return (templates || []).filter((t) => t.id !== template.id
    && t.programId === template.programId
    && !t.isRest
    && t.userId === template.userId
    && (t.name || '').trim().toLowerCase() === key);
}

// One entry per different workout in the program (first copy of each name),
// for "Add a workout already in this program".
export function distinctWorkouts(templates) {
  const seen = new Set();
  const out = [];
  for (const t of templates || []) {
    if (!isWorkout(t)) continue;
    const key = (t.name || '').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
