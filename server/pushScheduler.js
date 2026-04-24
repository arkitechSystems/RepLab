// Idle-session reminder scheduler.
//
// Runs on an interval. Finds sessions that are:
//   - not yet marked complete
//   - last touched >= IDLE_REMINDER_HOURS ago (default 4h)
//   - haven't already received a reminder
// ...and sends "You forgot to mark your workout complete." via FCM.
//
// Stays dormant until FCM credentials exist (isFcmConfigured()). Safe to start
// unconditionally at boot — it'll log once that it's idle and then quietly
// no-op each tick until a reminder is actually eligible.

import pool from './dbPool.js';
import { sendPushToUser } from './routes/push.js';
import { isFcmConfigured } from './pushProvider.js';

const TICK_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_IDLE_HOURS = 4;

export function startIdleReminderScheduler() {
  const idleHours = Number(process.env.IDLE_REMINDER_HOURS) || DEFAULT_IDLE_HOURS;

  if (!isFcmConfigured()) {
    console.log(`[push-scheduler] FCM not configured — idle-reminder scheduler dormant`);
  } else {
    console.log(`[push-scheduler] Started (idle threshold: ${idleHours}h, tick: ${TICK_MS / 60000}m)`);
  }

  const tick = () => runIdleReminderTick(idleHours).catch((err) => {
    console.error('[push-scheduler] tick failed:', err.message);
  });

  // Small start delay so the scheduler doesn't fire during DB init.
  setTimeout(tick, 30 * 1000);
  setInterval(tick, TICK_MS);
}

async function runIdleReminderTick(idleHours) {
  // Dormant path — cheap to check each tick; no DB query if unconfigured.
  if (!isFcmConfigured()) return;

  const { rows } = await pool.query(
    `SELECT id, user_id, template_id, date
     FROM sessions
     WHERE completed = FALSE
       AND reminder_sent_at IS NULL
       AND last_activity_at IS NOT NULL
       AND last_activity_at < NOW() - ($1 || ' hours')::interval
     ORDER BY last_activity_at ASC
     LIMIT 200`,
    [String(idleHours)]
  );

  if (rows.length === 0) return;

  for (const session of rows) {
    try {
      const result = await sendPushToUser(
        session.user_id,
        'RepLab',
        'You forgot to mark your workout complete.',
        { sessionId: session.id, templateId: session.template_id, date: session.date, kind: 'idle_reminder' }
      );
      // Mark as sent regardless of delivery count — we tried, and we don't
      // want to spam if all the user's tokens happen to be stale. The flag
      // gets cleared the moment they come back and touch the session (see
      // createSession + /sessions/activity endpoint).
      await pool.query(
        'UPDATE sessions SET reminder_sent_at = NOW() WHERE id = $1',
        [session.id]
      );
      if (result.sent > 0) {
        console.log(`[push-scheduler] reminder sent to user ${session.user_id} for session ${session.id}`);
      }
    } catch (err) {
      console.error(`[push-scheduler] send failed for session ${session.id}:`, err.message);
    }
  }
}
