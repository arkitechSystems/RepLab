// Background jobs, run by pg-boss (a job queue stored in our own Postgres,
// in its own `pgboss` schema). Replaces five hand-built setInterval timers.
//
// Why: with timers, every running server copy did every job — during a Render
// deploy the old and new server overlap, so a reminder could go out twice,
// and a job that failed just waited for the next tick. pg-boss runs each
// scheduled job on exactly one server, never two runs of the same job at
// once (queue policy 'stately'), retries failures, and keeps a week of run
// history in the database.
//
// The work each job does is unchanged — the same functions the timers called.
// The timers are still there as a fallback: set BACKGROUND_JOBS=timers to use
// them, and they start automatically if pg-boss can't start.
//
// Schedules are cron, in UTC. Jobs that depend on a user's local time
// (reminders, weekly summary) check it themselves on every run, as before.

import { PgBoss } from 'pg-boss';
import { runDailySummary } from './dailySummaryJob.js';
import { runIdleSessionTick, describeIdleSessionJob, startIdleReminderScheduler } from './pushScheduler.js';
import { runDailyReminderTick, startStreakReminderScheduler } from './streakReminderScheduler.js';
import { runWeeklySummaryTick, startWeeklySummaryScheduler } from './weeklySummaryScheduler.js';
import { flushPendingLikePushes, startCommunityLikeScheduler } from './communityLikeNotifier.js';

const MINUTE = 60;

export const JOBS = [
  // Admin email after 13:00 UTC; repeat runs are no-ops once sent.
  { name: 'daily-summary-email', cron: '*/10 * * * *', run: () => runDailySummary() },
  // Auto-complete abandoned workouts + "forgot to mark complete" push.
  { name: 'idle-sessions', cron: '*/15 * * * *', run: runIdleSessionTick, describe: describeIdleSessionJob },
  // Workout-day / streak reminder at each user's usual workout time.
  { name: 'daily-workout-reminder', cron: '*/15 * * * *', run: runDailyReminderTick },
  // Sunday-evening weekly summary push.
  { name: 'weekly-summary-push', cron: '*/30 * * * *', run: runWeeklySummaryTick },
  // Batched follow-up pushes for Community applause.
  { name: 'community-like-pushes', cron: '* * * * *', run: flushPendingLikePushes },
];

export const QUEUE_OPTIONS = {
  // At most one waiting and one running job per queue, across all servers.
  policy: 'stately',
  retryLimit: 2,
  retryDelay: 30,
  retryBackoff: true,
  // A run that hangs is failed (and retried) after this long.
  expireInSeconds: 15 * MINUTE,
  // Keep finished runs a week, for checking what ran.
  deleteAfterSeconds: 7 * 24 * 60 * MINUTE,
};

function startTimers() {
  // The daily summary's old timer lived in index.js; same 10-minute cadence.
  const tickDailySummary = () => runDailySummary()
    .catch((err) => console.error('Daily summary tick failed (will retry):', err.message));
  tickDailySummary();
  setInterval(tickDailySummary, 10 * MINUTE * 1000);
  startIdleReminderScheduler();
  startStreakReminderScheduler();
  startWeeklySummaryScheduler();
  startCommunityLikeScheduler();
}

export function createBoss(connectionString = process.env.DATABASE_URL) {
  return new PgBoss({
    connectionString,
    ssl: connectionString?.includes('localhost') ? false : { rejectUnauthorized: false },
    // Its own small pool, separate from the app's (dbPool.js).
    max: 3,
    application_name: 'replab-jobs',
  });
}

// Creates the queues, registers a worker and a schedule for each job, and
// removes schedules for jobs no longer in the list.
export async function registerJobs(boss, jobs = JOBS, queueOptions = QUEUE_OPTIONS) {
  for (const job of jobs) {
    if (await boss.getQueue(job.name)) {
      // updateQueue can't change the policy; every queue here is created 'stately'.
      const { policy, ...updatable } = queueOptions;
      await boss.updateQueue(job.name, updatable);
    } else {
      await boss.createQueue(job.name, queueOptions);
    }
    await boss.work(job.name, async () => {
      try {
        await job.run();
      } catch (err) {
        // Logged (and so sent to Sentry), then thrown so pg-boss retries it.
        console.error(`[jobs] ${job.name} failed:`, err.message);
        throw err;
      }
    });
    await boss.schedule(job.name, job.cron);
  }
  const names = new Set(jobs.map((j) => j.name));
  for (const s of await boss.getSchedules()) {
    if (!names.has(s.name)) await boss.unschedule(s.name, s.key);
  }
}

// Called once the server is listening. Returns { mode: 'jobs' | 'timers', stop }.
export async function startBackgroundJobs({
  mode = process.env.BACKGROUND_JOBS,
  boss = null,
  jobs = JOBS,
  fallback = startTimers,
  handleShutdown = true,
} = {}) {
  if (mode === 'timers') {
    console.log('[jobs] BACKGROUND_JOBS=timers — using the old timers');
    fallback();
    return { mode: 'timers', stop: async () => {} };
  }

  const b = boss ?? createBoss();
  b.on('error', (err) => console.error('[jobs] pg-boss error:', err.message));
  try {
    await b.start();
    await registerJobs(b, jobs);
  } catch (err) {
    console.error('[jobs] pg-boss failed to start — falling back to timers:', err.message);
    await b.stop({ graceful: false }).catch(() => {});
    fallback();
    return { mode: 'timers', stop: async () => {} };
  }

  for (const job of jobs) {
    console.log(`[jobs] ${job.name}: ${job.cron}${job.describe ? ` (${job.describe()})` : ''}`);
  }

  const stop = () => b.stop({ graceful: true, timeout: 15000 });
  if (handleShutdown) {
    // Render sends SIGTERM before replacing the server: let a running job
    // finish (up to 15s) so it isn't cut off halfway, then exit.
    for (const signal of ['SIGTERM', 'SIGINT']) {
      process.once(signal, () => {
        stop().catch(() => {}).finally(() => process.exit(0));
      });
    }
  }
  return { mode: 'jobs', stop };
}
