// Event-driven push notifications fired when a user marks a session
// complete. Two flavors:
//
//   - PR Celebration: any personal record set during the session.
//   - First Workout: user's very first completed session ever (deduped
//     via the users.welcomed_at column so it only fires once per user).
//
// All sends are fire-and-forget — never throw to the caller. If FCM is
// not configured the module no-ops cleanly.

import pool from './dbPool.js';
import { sendPushToUser } from './routes/push.js';
import { isFcmConfigured } from './pushProvider.js';

function formatWeight(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return String(w);
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

// Sends a push when the just-completed session yielded one or more new
// PRs. The window is the last 4 hours before `last_activity_at` —
// `created_at` would be wrong for sessions where the row was created
// hours/days before the user actually lifted (PRs from a different
// session on the same template would satisfy `>= created_at` and re-fire
// the push). 4 hours covers any realistic single workout. Caps body
// length at 3 named exercises with "+N more" suffix so iOS doesn't
// truncate mid-name.
export async function notifyPRCelebration(userId, sessionId) {
  if (!isFcmConfigured()) return;
  try {
    const { rows } = await pool.query(`
      SELECT
        pb.exercise_name,
        pb.best_weight,
        pb.best_reps,
        s.template_id
      FROM personal_bests pb
      JOIN sessions s
        ON s.user_id = pb.user_id
       AND s.template_id = pb.template_id
       AND s.id = $2
      WHERE pb.user_id = $1
        AND pb.achieved_at >= COALESCE(s.last_activity_at, s.created_at) - INTERVAL '4 hours'
        AND pb.achieved_at <= COALESCE(s.last_activity_at, s.created_at) + INTERVAL '1 minute'
      ORDER BY pb.achieved_at DESC
    `, [userId, sessionId]);

    if (rows.length === 0) return;

    let title;
    let body;
    if (rows.length === 1) {
      const pr = rows[0];
      title = '🏆 New PR!';
      body = `${pr.exercise_name}: ${formatWeight(pr.best_weight)} lb × ${Number(pr.best_reps)}`;
    } else {
      title = `🏆 ${rows.length} new PRs!`;
      const names = rows.slice(0, 3).map((pr) => pr.exercise_name);
      const more = rows.length > 3 ? ` +${rows.length - 3} more` : '';
      body = names.join(', ') + more;
    }

    await sendPushToUser(userId, title, body, {
      kind: 'pr_celebration',
      sessionId,
      templateId: rows[0].template_id,
      prCount: rows.length,
    });
  } catch (err) {
    console.error('[pr-celebration] failed:', err.message);
  }
}

// Sends a welcome push on the user's first completed session ever.
// Deduped via users.welcomed_at — if it's already set, no-op. Sets the
// column after sending so the push fires exactly once per user even if
// they toggle complete off and on again.
export async function notifyFirstWorkout(userId) {
  if (!isFcmConfigured()) return;
  try {
    const { rows: userRows } = await pool.query(
      'SELECT welcomed_at FROM users WHERE id = $1',
      [userId]
    );
    if (!userRows[0] || userRows[0].welcomed_at) return;

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1 AND completed = TRUE',
      [userId]
    );
    if ((countRows[0]?.n ?? 0) < 1) return;

    await sendPushToUser(
      userId,
      'Welcome to the lab',
      "First workout done. The hard part is starting — you cleared that.",
      { kind: 'first_workout' }
    );

    await pool.query(
      'UPDATE users SET welcomed_at = NOW() WHERE id = $1 AND welcomed_at IS NULL',
      [userId]
    );
  } catch (err) {
    console.error('[first-workout] failed:', err.message);
  }
}
