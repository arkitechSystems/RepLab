// Idle-session scheduler.
//
// Runs on an interval and does two things each tick:
//
//   1. AUTO-COMPLETE (always, regardless of push config): finds sessions the
//      user started but walked away from — not yet complete, idle for
//      >= AUTO_COMPLETE_HOURS (default 4h), and carrying at least one real
//      logged set — and marks them complete. This finalizes the workout into
//      the user's history even if they closed the app without tapping "Mark
//      Complete". PRs are already saved on every autosave, so this just flips
//      the flag. This is a data-integrity feature, so it runs whether or not
//      FCM/push is configured.
//
//   2. IDLE REMINDER (only when FCM is configured): for whatever idle sessions
//      remain after step 1 (i.e. ones with no logged data yet), sends
//      "You forgot to mark your workout complete." via FCM, once.
//
// Auto-complete runs first, so a finished-but-abandoned workout gets saved
// rather than nagged about.

import pool from './dbPool.js';
import db from './db.js';
import { sendPushToUser } from './routes/push.js';
import { isFcmConfigured } from './pushProvider.js';
import { notifyPRCelebration, notifyFirstWorkout } from './postSessionPushes.js';

const TICK_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_IDLE_HOURS = 4;
const DEFAULT_AUTO_COMPLETE_HOURS = 4;

export function startIdleReminderScheduler() {
  const idleHours = Number(process.env.IDLE_REMINDER_HOURS) || DEFAULT_IDLE_HOURS;
  const autoCompleteHours = Number(process.env.AUTO_COMPLETE_HOURS) || DEFAULT_AUTO_COMPLETE_HOURS;

  console.log(
    `[session-scheduler] Started (auto-complete: ${autoCompleteHours}h, ` +
    `reminder: ${idleHours}h${isFcmConfigured() ? '' : ' — dormant, FCM not configured'}, ` +
    `tick: ${TICK_MS / 60000}m)`
  );

  const tick = () => runTick(idleHours, autoCompleteHours).catch((err) => {
    console.error('[session-scheduler] tick failed:', err.message);
  });

  // Small start delay so the scheduler doesn't fire during DB init.
  setTimeout(tick, 30 * 1000);
  setInterval(tick, TICK_MS);
}

async function runTick(idleHours, autoCompleteHours) {
  // 1. Auto-complete abandoned-but-worked sessions — always runs.
  await runAutoCompleteTick(autoCompleteHours);
  // 2. Remind about the rest — push only, so skip when FCM is unconfigured.
  if (isFcmConfigured()) await runIdleReminderTick(idleHours);
}

async function runAutoCompleteTick(autoCompleteHours) {
  let completed;
  try {
    completed = await db.autoCompleteIdleSessions(autoCompleteHours);
  } catch (err) {
    console.error('[session-scheduler] auto-complete query failed:', err.message);
    return;
  }
  if (!completed || completed.length === 0) return;

  console.log(`[session-scheduler] auto-completed ${completed.length} idle session(s)`);

  // Fire the same post-complete notifications a manual "Mark Complete" would,
  // so the user still gets their PR celebration. Push-only + fire-and-forget;
  // skip entirely when FCM is unconfigured so we don't queue no-op work.
  if (!isFcmConfigured()) return;
  for (const session of completed) {
    notifyPRCelebration(session.user_id, session.id).catch(() => {});
    notifyFirstWorkout(session.user_id).catch(() => {});
  }
}

async function runIdleReminderTick(idleHours) {
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
        console.log(`[session-scheduler] reminder sent to user ${session.user_id} for session ${session.id}`);
      }
    } catch (err) {
      console.error(`[session-scheduler] send failed for session ${session.id}:`, err.message);
    }
  }
}
