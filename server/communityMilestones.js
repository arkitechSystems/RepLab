// RepLab Community milestone events, recorded when a workout is marked
// complete (PUT /sessions/complete, and the idle auto-complete in
// pushScheduler.js). Each event is a row with a stable id, so feed items
// ("pc-<id>", "st-<id>") can be liked like PRs and program starts.
//
// Workout streak (same rule as the streak reminder push and the Workouts
// home streak): consecutive calendar days with a completed, non-rest
// workout. A milestone is a multiple of 5 (5, 10, 15…). When a completed
// workout leaves the user on a run of N days, the highest multiple of 5 that
// is ≤ N is posted, once:
//   - re-saving / editing / un-completing and re-completing a day never posts
//     again (unique per user + milestone + the day it was reached),
//   - a run that re-crosses a milestone after a session is deleted doesn't
//     repost: a milestone ≥ N already reached on or after the current run's
//     first day counts as the same streak,
//   - only current streaks post (the run must reach today or the last couple
//     of days), so backfilling old history doesn't announce old streaks.
//
// Program completion: a featured/library program the user enrolled in (Begin
// Program → program_starts) counts as completed when, since enrolling, they
// have completed the program's final workout (last non-rest workout by
// order) AND at least half of the program's non-rest workouts. Recorded once
// per enrollment (program_completions.program_start_id is unique); only the
// latest enrollment in that program is checked.
//
// Everything here is best-effort: callers fire and forget, failures are
// logged and never affect the workout save.

import pool from './dbPool.js';

export const STREAK_MILESTONE_STEP = 5;
// How many days before "today" (server UTC) a run may end and still post —
// covers time zones ahead of / behind UTC.
const STREAK_RECENT_DAYS = 2;
// Share of a program's non-rest workouts that must be logged since enrolling.
export const PROGRAM_COMPLETE_MIN_SHARE = 0.5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The run of consecutive days in `dates` (a Set of YYYY-MM-DD) that contains
// `day`, as { start, end, length }, or null when `day` isn't in the set.
export function streakRunAround(dates, day) {
  if (!dates.has(day)) return null;
  let start = day;
  while (dates.has(addDays(start, -1))) start = addDays(start, -1);
  let end = day;
  while (dates.has(addDays(end, 1))) end = addDays(end, 1);
  const length = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  return { start, end, length };
}

// The milestone a run has reached: { milestone, reachedOn } or null (< 5).
export function streakMilestoneFor(run) {
  if (!run) return null;
  const milestone = Math.floor(run.length / STREAK_MILESTONE_STEP) * STREAK_MILESTONE_STEP;
  if (milestone < STREAK_MILESTONE_STEP) return null;
  return { milestone, reachedOn: addDays(run.start, milestone - 1) };
}

// Records a streak milestone if completing the workout on `day` reached one.
// Returns the new streak_milestones id, or null.
export async function recordStreakMilestone(client, userId, day, today = new Date().toISOString().slice(0, 10)) {
  if (!DATE_RE.test(day || '')) return null;
  const { rows } = await client.query(
    `SELECT DISTINCT s.date
       FROM sessions s
       LEFT JOIN templates t ON t.id = s.template_id
      WHERE s.user_id = $1 AND s.completed = TRUE
        AND COALESCE(t.is_rest, FALSE) = FALSE
        AND s.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    [userId]
  );
  const run = streakRunAround(new Set(rows.map((r) => r.date)), day);
  const hit = streakMilestoneFor(run);
  if (!hit) return null;
  if (run.end < addDays(today, -STREAK_RECENT_DAYS)) return null;
  const { rows: inserted } = await client.query(
    `INSERT INTO streak_milestones (user_id, milestone, run_start, reached_on)
     SELECT $1, $2, $3::date, $4::date
      WHERE NOT EXISTS (
        SELECT 1 FROM streak_milestones
         WHERE user_id = $1 AND milestone >= $2 AND reached_on >= $3::date
      )
     ON CONFLICT (user_id, milestone, reached_on) DO NOTHING
     RETURNING id`,
    [userId, hit.milestone, run.start, hit.reachedOn]
  );
  return inserted[0]?.id ?? null;
}

// Records a program completion if this completed session finished the
// user's latest enrollment in its program. Returns the new id, or null.
export async function recordProgramCompletion(client, userId, sessionId) {
  const { rows: sessRows } = await client.query(
    `SELECT t.program_id
       FROM sessions s
       JOIN templates t ON t.id = s.template_id
      WHERE s.id = $1 AND s.user_id = $2 AND s.completed = TRUE
        AND t.program_id IS NOT NULL AND COALESCE(t.is_rest, FALSE) = FALSE`,
    [sessionId, userId]
  );
  const programId = sessRows[0]?.program_id;
  if (!programId) return null;

  const { rows: startRows } = await client.query(
    `SELECT ps.id, ps.program_name,
            -- a day of slack for time zones (sessions.date is the user's local day)
            to_char((ps.started_at - INTERVAL '1 day')::date, 'YYYY-MM-DD') AS since_day,
            EXISTS (SELECT 1 FROM program_completions pc WHERE pc.program_start_id = ps.id) AS done
       FROM program_starts ps
      WHERE ps.user_id = $1 AND ps.program_id = $2
      ORDER BY ps.started_at DESC, ps.id DESC
      LIMIT 1`,
    [userId, programId]
  );
  const start = startRows[0];
  if (!start || start.done) return null;

  const { rows: [progress] } = await client.query(
    `WITH workouts AS (
       SELECT t.id, t.sort_order
         FROM templates t
        WHERE t.program_id = $2 AND COALESCE(t.is_rest, FALSE) = FALSE
     ), final AS (
       SELECT id FROM workouts ORDER BY sort_order DESC NULLS LAST, id DESC LIMIT 1
     ), logged AS (
       SELECT DISTINCT s.template_id
         FROM sessions s
        WHERE s.user_id = $1 AND s.completed = TRUE
          AND s.template_id IN (SELECT id FROM workouts)
          AND s.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          AND s.date >= $3
     )
     SELECT (SELECT COUNT(*) FROM workouts)::int AS total,
            (SELECT COUNT(*) FROM logged)::int AS logged,
            EXISTS (SELECT 1 FROM logged WHERE template_id = (SELECT id FROM final)) AS final_done`,
    [userId, programId, start.since_day]
  );
  if (!progress || progress.total === 0 || !progress.final_done) return null;
  if (progress.logged < Math.ceil(progress.total * PROGRAM_COMPLETE_MIN_SHARE)) return null;

  const { rows: inserted } = await client.query(
    `INSERT INTO program_completions (user_id, program_start_id, program_id, program_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (program_start_id) DO NOTHING
     RETURNING id`,
    [userId, start.id, programId, start.program_name]
  );
  return inserted[0]?.id ?? null;
}

// Entry point: call (fire-and-forget) after a session is marked complete.
// Runs under a per-user advisory lock so two completions at once can't
// double-post. Never throws.
export async function recordCommunityMilestones(userId, sessionId) {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error('[community-milestones] db connect failed:', err.message);
    return { streakId: null, programCompletionId: null };
  }
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('community-milestones'), $1)", [userId]);
    const { rows } = await client.query(
      'SELECT date FROM sessions WHERE id = $1 AND user_id = $2 AND completed = TRUE',
      [sessionId, userId]
    );
    let streakId = null;
    let programCompletionId = null;
    if (rows[0]) {
      streakId = await recordStreakMilestone(client, userId, rows[0].date);
      programCompletionId = await recordProgramCompletion(client, userId, sessionId);
    }
    await client.query('COMMIT');
    return { streakId, programCompletionId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[community-milestones] failed:', err.message);
    return { streakId: null, programCompletionId: null };
  } finally {
    client.release();
  }
}
