// Missed-workout detection + Resume / Skip for the "It looks like you missed
// a workout" prompt (routes/schedule.js → /schedule/missed*).
//
// "Missed" matches the Calendar's red-slash rule (Calendar.jsx isSkipped /
// Workouts.jsx 'missed'): a past schedule_days row with a non-rest workout and
// no completed session for that template on that date. On top of that, the
// prompt only considers misses that are:
//   - within the last MISSED_WINDOW_DAYS days (older = auto-skipped, never
//     prompted), and
//   - after the user's most recent completed workout day (missed Monday,
//     trained Tuesday → Monday isn't prompted; they already moved on). This
//     also guarantees Resume never moves a completed day.
//   - not already skipped via the prompt (schedule_days.missed_skipped_at).
// An in-progress (started, unfinished) session isn't completed, so it counts.
//
// All dates are 'YYYY-MM-DD' strings in the user's local calendar — the client
// sends its local today; the server never uses its own (UTC) date for this.

import { DAY_SESSION_NAME_JOIN } from './workoutDayName.js';

export const MISSED_WINDOW_DAYS = 14;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

// The client's local date can legitimately differ from the server's UTC date
// by one day either way (UTC−12 … UTC+14). Anything further is a bad clock
// or a forged request.
export function isPlausibleToday(today, now = new Date()) {
  if (!isValidDate(today)) return false;
  const utcToday = now.toISOString().slice(0, 10);
  return Math.abs(daysBetween(utcToday, today)) <= 1;
}

// Pure core of the detection. `schedule` rows: { date, templateId,
// templateName, dayIsRest, templateIsRest, skipped }. `completed`: { date,
// templateId } for completed sessions. Returns missed days, earliest first.
export function computeMissed({ schedule, completed, today }) {
  const windowStart = addDays(today, -MISSED_WINDOW_DAYS);
  let lastDone = null;
  for (const c of completed) {
    if (c.date <= today && (!lastDone || c.date > lastDone)) lastDone = c.date;
  }
  const done = new Set(completed.map((c) => `${c.templateId}|${c.date}`));
  return schedule
    .filter((d) =>
      d.templateId
      && !d.dayIsRest && !d.templateIsRest
      && !d.skipped
      && d.date < today
      && d.date >= windowStart
      && (!lastDone || d.date > lastDone)
      && !done.has(`${d.templateId}|${d.date}`))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((d) => ({ date: d.date, templateId: d.templateId, templateName: d.templateName || null }));
}

// Loads the window's schedule + completed sessions and runs computeMissed.
// `q` is pool or a transaction client.
export async function getMissedWorkouts(q, userId, today) {
  const windowStart = addDays(today, -MISSED_WINDOW_DAYS);
  const { rows: schedule } = await q.query(
    `SELECT to_char(sd.schedule_date, 'YYYY-MM-DD') AS date, sd.template_id,
            COALESCE(sd.is_rest, FALSE) AS day_is_rest,
            COALESCE(t.is_rest, FALSE) AS template_is_rest,
            COALESCE(ds.custom_name, t.name) AS template_name,
            (sd.missed_skipped_at IS NOT NULL) AS skipped
       FROM schedule_days sd
       LEFT JOIN templates t ON t.id = sd.template_id
       ${DAY_SESSION_NAME_JOIN('sd.user_id', 'sd.template_id', 'sd.schedule_date')}
      WHERE sd.user_id = $1 AND sd.schedule_date >= $2::date AND sd.schedule_date < $3::date`,
    [userId, windowStart, today]
  );
  // sessions.date is TEXT 'YYYY-MM-DD', so a string range compares correctly.
  const { rows: completed } = await q.query(
    `SELECT template_id, date FROM sessions
      WHERE user_id = $1 AND completed = TRUE AND date >= $2 AND date <= $3`,
    [userId, windowStart, today]
  );
  return computeMissed({
    schedule: schedule.map((r) => ({
      date: r.date,
      templateId: r.template_id,
      templateName: r.template_name,
      dayIsRest: r.day_is_rest,
      templateIsRest: r.template_is_rest,
      skipped: r.skipped,
    })),
    completed: completed.map((r) => ({ templateId: r.template_id, date: String(r.date).slice(0, 10) })),
    today,
  });
}

// Resume: move the earliest missed day to today by shifting EVERY
// schedule_days row on or after it (workouts, rest days, one-offs, today's own
// workout) forward by the same number of days. Updated latest-first so each
// row's new slot is already free under the (user_id, schedule_date) unique
// index — same approach as POST /schedule/shift. Returns rows moved.
export async function shiftScheduleFrom(client, userId, fromDate, days) {
  const { rows } = await client.query(
    `SELECT id FROM schedule_days
      WHERE user_id = $1 AND schedule_date >= $2::date
      ORDER BY schedule_date DESC`,
    [userId, fromDate]
  );
  for (const row of rows) {
    await client.query(
      'UPDATE schedule_days SET schedule_date = schedule_date + $2::int WHERE id = $1',
      [row.id, days]
    );
  }
  return rows.length;
}

// Skip: stamp the given missed days so the prompt never offers them again.
// Dates are untouched, so the Calendar keeps showing them as Missed.
export async function markMissedSkipped(client, userId, dates) {
  if (dates.length === 0) return 0;
  const r = await client.query(
    `UPDATE schedule_days SET missed_skipped_at = NOW()
      WHERE user_id = $1 AND schedule_date = ANY($2::date[]) AND missed_skipped_at IS NULL`,
    [userId, dates]
  );
  return r.rowCount;
}
