// Daily workout reminder push scheduler.
//
// Wakes every 15 min. For each user with a registered device token + a
// stored timezone + a workout scheduled today (not rest) + no completed
// session today:
//
//   - If they have a streak ≥ 2: ping with "🔥 Don't break your N-day streak"
//   - If they have a streak < 2:    ping with "Today's workout: <Name>"
//
// Each push fires at the user's "usual" workout time, defined as the
// average minute-of-day across their last 30 days of completed sessions
// (≥3 sample threshold). Users without enough history fall back to a
// 6 PM–9 PM local window so new users still get reminders.
//
// Cooldown: 18 hours per user (column `last_streak_reminder_at`, kept by
// name for back-compat with the admin debug endpoint + DB migration).
// Stays dormant when FCM credentials aren't set.

import pool from './dbPool.js';
import { sendPushToUser } from './routes/push.js';
import { isFcmConfigured } from './pushProvider.js';

const TICK_MS = 15 * 60 * 1000;       // 15 min
const COOLDOWN_HOURS = 18;             // one ping per user per day at most

// Fallback window for users without enough session history to derive a
// personalized time (or no timezone set).
const FALLBACK_HOUR_START = 18;        // 6 PM local
const FALLBACK_HOUR_END = 21;          // 9 PM local (inclusive)

// How close to the user's avg workout time must local time be? Wider →
// more reliable delivery (tolerates tick drift); narrower → more precise.
// 20 min covers the 15-min tick cadence with margin.
const PERSONALIZED_TOLERANCE_MIN = 20;

// Minimum completed sessions in the lookback window before we trust the
// personalized average. Below this, fall back to the global 6-9 PM window.
const MIN_SAMPLE_SIZE = 3;
const LOOKBACK_DAYS = 30;

function localHour(tz) {
  if (!tz) return null;
  try {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()), 10);
  } catch {
    return null;
  }
}

// 0..1439, or null if tz invalid.
function localMinuteOfDay(tz) {
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const h = parseInt(parts.find((p) => p.type === 'hour').value, 10);
    const m = parseInt(parts.find((p) => p.type === 'minute').value, 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

function localDateStr(tz) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz || 'UTC' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Walk back from today (or yesterday if today not yet logged) and count
// consecutive non-rest session days. Mirrors the client-side streak logic
// in Workouts.jsx.
function computeStreak(sessionDateSet, todayStr) {
  let count = 0;
  const today = new Date(todayStr + 'T00:00:00');
  let cursor = new Date(today);
  if (!sessionDateSet.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (sessionDateSet.has(ds)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return count;
}

// Return average minute-of-day of completed sessions in user's local
// timezone over the last LOOKBACK_DAYS days, or null if we don't have
// enough samples to trust it.
async function getUserAvgWorkoutMinute(userId, tz) {
  if (!tz) return null;
  const { rows } = await pool.query(`
    SELECT
      AVG(
        EXTRACT(HOUR   FROM created_at AT TIME ZONE $2) * 60 +
        EXTRACT(MINUTE FROM created_at AT TIME ZONE $2)
      )::int AS avg_minute,
      COUNT(*) AS sample_count
    FROM sessions
    WHERE user_id = $1
      AND completed = TRUE
      AND created_at >= NOW() - ($3 || ' days')::interval
  `, [userId, tz, String(LOOKBACK_DAYS)]);
  const row = rows[0];
  if (!row || Number(row.sample_count) < MIN_SAMPLE_SIZE) return null;
  return row.avg_minute;
}

// Time-window gate. Returns { ok: bool, debug: string }. Personalized path
// is preferred; the fallback path keeps brand-new users from missing out.
function isWithinReminderWindow(localMin, avgMin, hour) {
  if (avgMin !== null && localMin !== null) {
    const diff = Math.abs(localMin - avgMin);
    // Handle midnight wraparound: 23:50 and 00:10 are 20 min apart, not 23h40m.
    const wrappedDiff = Math.min(diff, 1440 - diff);
    if (wrappedDiff <= PERSONALIZED_TOLERANCE_MIN) {
      return { ok: true, debug: `personalized (avg ${avgMin}min, now ${localMin}min, diff ${wrappedDiff}min)` };
    }
    return { ok: false, debug: `personalized-out (avg ${avgMin}min, now ${localMin}min, diff ${wrappedDiff}min)` };
  }
  if (hour !== null && hour >= FALLBACK_HOUR_START && hour <= FALLBACK_HOUR_END) {
    return { ok: true, debug: `fallback (${FALLBACK_HOUR_START}-${FALLBACK_HOUR_END} local, now ${hour}h)` };
  }
  return { ok: false, debug: `fallback-out (hour ${hour})` };
}

export function startStreakReminderScheduler() {
  if (!isFcmConfigured()) {
    console.log('[daily-reminder] FCM not configured — scheduler dormant');
  } else {
    console.log(`[daily-reminder] Started (personalized ±${PERSONALIZED_TOLERANCE_MIN}min, fallback ${FALLBACK_HOUR_START}-${FALLBACK_HOUR_END}h, tick ${TICK_MS / 60000}m, cooldown ${COOLDOWN_HOURS}h)`);
  }
  const tick = () => runTick().catch((err) => console.error('[daily-reminder] tick failed:', err.message));
  setTimeout(tick, 60 * 1000);
  setInterval(tick, TICK_MS);
}

// Single-user evaluation. Used both by the scheduler (full guard set) and
// the admin debug endpoint (with bypassable time/cooldown guards for
// testing). Returns a structured `{ sent, reason, ... }` result.
export async function evaluateAndMaybeNotify(userId, opts = {}) {
  const skipTimeWindow = !!opts.skipTimeWindow;
  const skipCooldown   = !!opts.skipCooldown;
  const { rows: userRows } = await pool.query(
    'SELECT id, timezone, last_streak_reminder_at FROM users WHERE id = $1',
    [userId]
  );
  const user = userRows[0];
  if (!user) return { sent: false, reason: 'user-not-found' };
  if (!isFcmConfigured()) return { sent: false, reason: 'fcm-not-configured' };
  if (!user.timezone) return { sent: false, reason: 'no-timezone-on-user' };

  if (!skipCooldown && user.last_streak_reminder_at) {
    const hoursAgo = (Date.now() - new Date(user.last_streak_reminder_at).getTime()) / 3600000;
    if (hoursAgo < COOLDOWN_HOURS) {
      return { sent: false, reason: 'cooldown-active', hoursAgo: Number(hoursAgo.toFixed(1)) };
    }
  }

  // Time gate — personalized first, fallback for users without history.
  if (!skipTimeWindow) {
    const avgMin = await getUserAvgWorkoutMinute(userId, user.timezone);
    const localMin = localMinuteOfDay(user.timezone);
    const hour = localHour(user.timezone);
    const window = isWithinReminderWindow(localMin, avgMin, hour);
    if (!window.ok) {
      return { sent: false, reason: 'outside-time-window', detail: window.debug };
    }
  }

  const today = localDateStr(user.timezone);

  const { rows: doneRows } = await pool.query(
    'SELECT 1 FROM sessions WHERE user_id = $1 AND date = $2 AND completed = TRUE LIMIT 1',
    [userId, today]
  );
  if (doneRows.length > 0) return { sent: false, reason: 'already-completed-today', today };

  const { rows: schedRows } = await pool.query(`
    SELECT t.id AS template_id, t.name, COALESCE(t.is_rest, FALSE) AS is_rest
    FROM schedule_days sd
    JOIN templates t ON t.id = sd.template_id
    WHERE sd.user_id = $1 AND sd.schedule_date = $2
    LIMIT 1
  `, [userId, today]);
  const sched = schedRows[0];
  if (!sched) return { sent: false, reason: 'no-workout-scheduled', today };
  if (sched.is_rest) return { sent: false, reason: 'rest-day', today };

  const { rows: sessRows } = await pool.query(`
    SELECT DISTINCT s.date
    FROM sessions s
    LEFT JOIN templates t ON t.id = s.template_id
    WHERE s.user_id = $1 AND s.completed = TRUE
      AND COALESCE(t.is_rest, FALSE) = FALSE
    ORDER BY s.date DESC
    LIMIT 60
  `, [userId]);
  const streak = computeStreak(new Set(sessRows.map((r) => r.date)), today);

  // Branch copy by streak level. Both branches still fire at the same
  // personalized-time / fallback-window gate.
  let title, body, kind;
  if (streak >= 2) {
    title = `🔥 Don't break your ${streak}-day streak`;
    body = `${sched.name} is on the schedule for today. Hit it before midnight.`;
    kind = 'streak_reminder';
  } else {
    title = `Today's workout: ${sched.name}`;
    body = `It's on your schedule. Take a few minutes to log a set.`;
    kind = 'workout_day_reminder';
  }

  const result = await sendPushToUser(userId, title, body, {
    kind,
    streak,
    templateId: sched.template_id,
    date: today,
  });

  await pool.query('UPDATE users SET last_streak_reminder_at = NOW() WHERE id = $1', [userId]);
  return {
    sent: (result?.sent ?? 0) > 0,
    reason: result?.skipped ? 'fcm-skipped' : 'pushed',
    streak,
    kind,
    templateName: sched.name,
    templateId: sched.template_id,
    date: today,
    deliveredTo: result?.sent ?? 0,
  };
}

async function runTick() {
  if (!isFcmConfigured()) return;

  // Candidates: users with at least one device token + a timezone, off
  // cooldown. We no longer require the user to have completed a session
  // in the last 7 days, since the non-streak branch now serves brand-new
  // users who don't have any history yet (so we'd otherwise never ping
  // them on their first scheduled day).
  const { rows: candidates } = await pool.query(`
    SELECT DISTINCT u.id
    FROM users u
    JOIN device_tokens d ON d.user_id = u.id
    WHERE u.timezone IS NOT NULL
      AND (u.last_streak_reminder_at IS NULL OR u.last_streak_reminder_at < NOW() - ($1 || ' hours')::interval)
  `, [String(COOLDOWN_HOURS)]);

  for (const u of candidates) {
    try {
      const result = await evaluateAndMaybeNotify(u.id);
      if (result.sent) {
        console.log(`[daily-reminder] user ${u.id}: kind=${result.kind}, streak=${result.streak}, "${result.templateName}" → ${result.deliveredTo} device(s)`);
      }
    } catch (err) {
      console.error(`[daily-reminder] user ${u.id} failed:`, err.message);
    }
  }
}
