// Weekly summary push scheduler.
//
// Fires Sunday 6 PM–8 PM in each user's local timezone with a snapshot
// of the past 7 days: workouts logged, total volume, new PRs.
//
// Cooldown: 7 days per user via users.last_weekly_summary_at — prevents
// re-firing across overlapping ticks AND if a user's tz crosses midnight
// during the window.
//
// Stays dormant when FCM credentials aren't set.

import pool from './dbPool.js';
import { sendPushToUser } from './routes/push.js';
import { isFcmConfigured } from './pushProvider.js';

const TICK_MS = 30 * 60 * 1000;       // 30 min — fine for a once-a-week ping
const REMINDER_HOUR_START = 18;        // 6 PM local
const REMINDER_HOUR_END = 20;          // 8 PM local (inclusive)
const COOLDOWN_HOURS = 24 * 6;         // 6 days — never fire twice in same week
const SUNDAY_WEEKDAY = 0;              // JS Date.getDay() returns 0 for Sunday

function localHour(tz) {
  if (!tz) return null;
  try {
    return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()), 10);
  } catch {
    return null;
  }
}

function localWeekday(tz) {
  if (!tz) return null;
  try {
    // 'short' returns Sun/Mon/.../Sat — map to JS weekday number.
    const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(new Date());
    return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[day];
  } catch {
    return null;
  }
}

function formatVolume(lb) {
  const n = Number(lb) || 0;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000)  return `${Math.round(n).toLocaleString()}`;
  return String(Math.round(n));
}

export function startWeeklySummaryScheduler() {
  if (!isFcmConfigured()) {
    console.log('[weekly-summary] FCM not configured — scheduler dormant');
  } else {
    console.log(`[weekly-summary] Started (Sun ${REMINDER_HOUR_START}-${REMINDER_HOUR_END}h local, tick ${TICK_MS / 60000}m, cooldown ${COOLDOWN_HOURS}h)`);
  }
  const tick = () => runTick().catch((err) => console.error('[weekly-summary] tick failed:', err.message));
  setTimeout(tick, 120 * 1000); // 2 min start delay so DB init settles
  setInterval(tick, TICK_MS);
}

async function runTick() {
  if (!isFcmConfigured()) return;

  // Candidate filter: token + tz + off cooldown + completed at least one
  // session in the last 7 days (no point sending a "your week" digest to
  // a user with an empty week).
  const { rows: candidates } = await pool.query(`
    SELECT DISTINCT u.id, u.timezone
    FROM users u
    JOIN device_tokens d ON d.user_id = u.id
    WHERE u.timezone IS NOT NULL
      AND (u.last_weekly_summary_at IS NULL OR u.last_weekly_summary_at < NOW() - ($1 || ' hours')::interval)
      AND EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.user_id = u.id
          AND s.completed = TRUE
          AND s.created_at > NOW() - INTERVAL '7 days'
      )
  `, [String(COOLDOWN_HOURS)]);

  for (const u of candidates) {
    try {
      const weekday = localWeekday(u.timezone);
      const hour = localHour(u.timezone);
      if (weekday !== SUNDAY_WEEKDAY) continue;
      if (hour === null || hour < REMINDER_HOUR_START || hour > REMINDER_HOUR_END) continue;

      // Aggregate the past 7 days. session_entries is the source of truth
      // for completed sets, weights, reps. PR count comes from personal_bests
      // achieved_at within the same window.
      const { rows: statsRows } = await pool.query(`
        WITH wk_sessions AS (
          SELECT s.id
          FROM sessions s
          WHERE s.user_id = $1
            AND s.completed = TRUE
            AND s.created_at > NOW() - INTERVAL '7 days'
        )
        SELECT
          (SELECT COUNT(*)::int FROM wk_sessions) AS workout_count,
          COALESCE((
            SELECT SUM(se.weight * se.reps)::int
            FROM session_entries se
            WHERE se.session_id IN (SELECT id FROM wk_sessions)
              AND se.is_completed = TRUE
              AND se.weight > 0 AND se.reps > 0
          ), 0) AS total_volume,
          (
            SELECT COUNT(*)::int
            FROM personal_bests pb
            WHERE pb.user_id = $1
              AND pb.achieved_at > NOW() - INTERVAL '7 days'
          ) AS new_prs
      `, [u.id]);
      const stats = statsRows[0];
      if (!stats || stats.workout_count === 0) continue;

      const parts = [`${stats.workout_count} workout${stats.workout_count === 1 ? '' : 's'}`];
      if (stats.total_volume > 0) parts.push(`${formatVolume(stats.total_volume)} lb volume`);
      if (stats.new_prs > 0) parts.push(`${stats.new_prs} new PR${stats.new_prs === 1 ? '' : 's'}`);

      const title = '✨ Your week in REPLAB';
      const body = parts.join(' · ');

      const result = await sendPushToUser(u.id, title, body, {
        kind: 'weekly_summary',
        workoutCount: stats.workout_count,
        totalVolume: stats.total_volume,
        newPrs: stats.new_prs,
      });

      await pool.query('UPDATE users SET last_weekly_summary_at = NOW() WHERE id = $1', [u.id]);

      if ((result?.sent ?? 0) > 0) {
        console.log(`[weekly-summary] user ${u.id}: ${stats.workout_count}w · ${formatVolume(stats.total_volume)}lb · ${stats.new_prs}PRs → ${result.sent} device(s)`);
      }
    } catch (err) {
      console.error(`[weekly-summary] user ${u.id} failed:`, err.message);
    }
  }
}
