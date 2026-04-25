// Streak-reminder push scheduler.
//
// Wakes every 15 min. Finds users who:
//   - have a registered device token + a stored timezone
//   - haven't been reminded in the last 18 hours
//   - currently sit between 6 PM and 9 PM in their local time
//   - have a current streak ≥ 2 (no point pestering "1-day streak")
//   - have a workout (not rest) scheduled for today
//   - have NOT yet completed today's session
// …and pings them with: "🔥 Don't break your N-day streak. <Workout> is on
// the schedule for today." Tap → /session/:templateId/:date (handled by
// the existing pushNotificationActionPerformed listener in client/src/utils/push.js).
//
// Stays dormant when FCM credentials aren't set, same pattern as the idle
// reminder scheduler.

import pool from './dbPool.js';
import { sendPushToUser } from './routes/push.js';
import { isFcmConfigured } from './pushProvider.js';

const TICK_MS = 15 * 60 * 1000;       // 15 min
const REMINDER_HOUR_START = 18;        // 6 PM local
const REMINDER_HOUR_END = 21;          // 9 PM local (inclusive)
const COOLDOWN_HOURS = 18;             // never re-ping the same user within this window

function localHour(tz) {
  if (!tz) return null;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    return parseInt(fmt.format(new Date()), 10);
  } catch {
    return null;
  }
}

// YYYY-MM-DD in the given timezone (en-CA gives that format natively).
function localDateStr(tz) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz || 'UTC' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Walk back from today (or yesterday if today not yet logged) and count
// consecutive non-rest session days. Mirrors the client-side logic in
// Workouts.jsx so the reminder agrees with what the user sees on screen.
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

export function startStreakReminderScheduler() {
  if (!isFcmConfigured()) {
    console.log('[streak-reminder] FCM not configured — scheduler dormant');
  } else {
    console.log(`[streak-reminder] Started (window ${REMINDER_HOUR_START}:00–${REMINDER_HOUR_END}:59 local, tick ${TICK_MS / 60000}m, cooldown ${COOLDOWN_HOURS}h)`);
  }
  const tick = () => runTick().catch((err) => console.error('[streak-reminder] tick failed:', err.message));
  // Small start delay so DB init has time to settle on boot.
  setTimeout(tick, 60 * 1000);
  setInterval(tick, TICK_MS);
}

// Single-user evaluation. Returns a structured result describing each gate
// the user passed/failed and whether the push was sent. Used both by the
// scheduler (with all guards on) and by the admin debug endpoint (with the
// time-window and cooldown guards bypassable for testing).
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

  const hour = localHour(user.timezone);
  if (!skipTimeWindow && (hour === null || hour < REMINDER_HOUR_START || hour > REMINDER_HOUR_END)) {
    return { sent: false, reason: 'outside-time-window', localHour: hour };
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
  if (streak < 2) return { sent: false, reason: 'streak-too-short', streak };

  const title = `🔥 Don't break your ${streak}-day streak`;
  const body = `${sched.name} is on the schedule for today. Hit it before midnight.`;
  const result = await sendPushToUser(userId, title, body, {
    kind: 'streak_reminder',
    streak,
    templateId: sched.template_id,
    date: today,
  });

  await pool.query('UPDATE users SET last_streak_reminder_at = NOW() WHERE id = $1', [userId]);
  return {
    sent: (result?.sent ?? 0) > 0,
    reason: result?.skipped ? 'fcm-skipped' : 'pushed',
    streak,
    templateName: sched.name,
    templateId: sched.template_id,
    date: today,
    deliveredTo: result?.sent ?? 0,
  };
}

async function runTick() {
  if (!isFcmConfigured()) return;

  const { rows: candidates } = await pool.query(`
    SELECT DISTINCT u.id
    FROM users u
    JOIN device_tokens d ON d.user_id = u.id
    WHERE u.timezone IS NOT NULL
      AND (u.last_streak_reminder_at IS NULL OR u.last_streak_reminder_at < NOW() - ($1 || ' hours')::interval)
      AND EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.user_id = u.id AND s.completed = TRUE
          AND s.created_at > NOW() - INTERVAL '7 days'
      )
  `, [String(COOLDOWN_HOURS)]);

  for (const u of candidates) {
    try {
      const result = await evaluateAndMaybeNotify(u.id);
      if (result.sent) {
        console.log(`[streak-reminder] user ${u.id}: streak=${result.streak}, "${result.templateName}" → ${result.deliveredTo} device(s)`);
      }
    } catch (err) {
      console.error(`[streak-reminder] user ${u.id} failed:`, err.message);
    }
  }
}
