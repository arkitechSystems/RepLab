// Background jobs (backgroundJobs.js).
//
// Unit part: the BACKGROUND_JOBS=timers switch and the fall-back to timers
// when pg-boss can't start.
//
// Integration part (needs DATABASE_URL — a local test database, see
// e2e/README.md; skipped otherwise): real pg-boss against Postgres, with two
// "servers" running at once like during a Render deploy. Checks a job never
// runs on both at the same time, a failed run is retried, and the schedules
// are the ones the app relies on.

import { describe, it, expect, vi, afterEach } from 'vitest';

const timers = vi.hoisted(() => ({
  idle: vi.fn(), streak: vi.fn(), weekly: vi.fn(), likes: vi.fn(), daily: vi.fn(async () => 'too-early'),
}));

vi.mock('../dailySummaryJob.js', () => ({ runDailySummary: timers.daily }));
vi.mock('../pushScheduler.js', () => ({
  runIdleSessionTick: vi.fn(async () => {}),
  describeIdleSessionJob: () => 'test',
  startIdleReminderScheduler: timers.idle,
}));
vi.mock('../streakReminderScheduler.js', () => ({
  runDailyReminderTick: vi.fn(async () => {}),
  startStreakReminderScheduler: timers.streak,
}));
vi.mock('../weeklySummaryScheduler.js', () => ({
  runWeeklySummaryTick: vi.fn(async () => {}),
  startWeeklySummaryScheduler: timers.weekly,
}));
vi.mock('../communityLikeNotifier.js', () => ({
  flushPendingLikePushes: vi.fn(async () => 0),
  startCommunityLikeScheduler: timers.likes,
}));

const { startBackgroundJobs, registerJobs, createBoss, JOBS, QUEUE_OPTIONS } = await import('../backgroundJobs.js');

const HAS_DB = !!process.env.DATABASE_URL;
const describeIfDb = HAS_DB ? describe : describe.skip;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check, timeoutMs = 20000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting');
    await sleep(100);
  }
}

describe('startBackgroundJobs — fallback to timers', () => {
  it('BACKGROUND_JOBS=timers starts the old timers and no job queue', async () => {
    const fallback = vi.fn();
    const result = await startBackgroundJobs({ mode: 'timers', fallback, handleShutdown: false });
    expect(result.mode).toBe('timers');
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('if pg-boss fails to start, the old timers run instead', async () => {
    const fallback = vi.fn();
    const boss = {
      on: vi.fn(),
      start: vi.fn().mockRejectedValue(new Error('permission denied to create schema')),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await startBackgroundJobs({ boss, fallback, handleShutdown: false });
    expect(result.mode).toBe('timers');
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0][0]).toContain('falling back to timers');
    errors.mockRestore();
  });

  it('the default fallback starts all five timers', async () => {
    vi.useFakeTimers();
    try {
      await startBackgroundJobs({ mode: 'timers', handleShutdown: false });
      expect(timers.daily).toHaveBeenCalled();
      expect(timers.idle).toHaveBeenCalled();
      expect(timers.streak).toHaveBeenCalled();
      expect(timers.weekly).toHaveBeenCalled();
      expect(timers.likes).toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describeIfDb('background jobs on pg-boss (integration)', () => {
  const bosses = [];
  const testQueues = [];
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  async function startBoss() {
    const boss = createBoss(process.env.DATABASE_URL);
    boss.on('error', () => {});
    await boss.start();
    bosses.push(boss);
    return boss;
  }

  afterEach(async () => {
    const [first] = bosses;
    if (first) {
      for (const name of testQueues.splice(0)) {
        await first.unschedule(name).catch(() => {});
        await first.deleteQueue(name).catch(() => {});
      }
    }
    for (const b of bosses.splice(0)) await b.stop({ graceful: false, close: true });
  });

  it('with two servers running, a job never runs on both at once and a third waiting copy is refused', async () => {
    const name = `test-stately-${suffix}`;
    testQueues.push(name);
    let active = 0;
    let maxActive = 0;
    let runs = 0;
    const job = {
      name,
      cron: '0 0 1 1 *', // never fires during the test
      run: async () => {
        runs++;
        active++;
        maxActive = Math.max(maxActive, active);
        await sleep(1500);
        active--;
      },
    };
    const serverA = await startBoss();
    const serverB = await startBoss();
    await registerJobs(serverA, [job]);
    await registerJobs(serverB, [job]);

    expect(await serverA.send(name)).toBeTruthy();
    await waitFor(() => active === 1);
    // One running; one more may wait; a third is refused.
    expect(await serverB.send(name)).toBeTruthy();
    expect(await serverA.send(name)).toBeNull();

    await waitFor(() => runs === 2 && active === 0);
    await sleep(3000); // nothing else sneaks in
    expect(runs).toBe(2);
    expect(maxActive).toBe(1);
  }, 40000);

  it('a failed run is retried and then succeeds', async () => {
    const name = `test-retry-${suffix}`;
    testQueues.push(name);
    let calls = 0;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const job = {
      name,
      cron: '0 0 1 1 *',
      run: async () => {
        calls++;
        if (calls === 1) throw new Error('Resend is down');
      },
    };
    const boss = await startBoss();
    await registerJobs(boss, [job], { ...QUEUE_OPTIONS, retryDelay: 1, retryBackoff: false });
    const id = await boss.send(name);

    await waitFor(() => calls === 2);
    let state;
    for (let i = 0; i < 50 && state !== 'completed'; i++) {
      state = (await boss.getJobById(name, id))?.state;
      if (state !== 'completed') await sleep(200);
    }
    expect(state).toBe('completed');
    expect(errors.mock.calls.some((c) => String(c[0]).includes(`${name} failed`))).toBe(true);
    errors.mockRestore();
  }, 40000);

  it('the app registers its five jobs with the expected schedules', async () => {
    const boss = await startBoss();
    const fallback = vi.fn();
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await startBackgroundJobs({ boss, fallback, handleShutdown: false });
    logs.mockRestore();
    expect(result.mode).toBe('jobs');
    expect(fallback).not.toHaveBeenCalled();

    const schedules = Object.fromEntries((await boss.getSchedules()).map((s) => [s.name, s.cron]));
    expect(schedules).toEqual({
      'daily-summary-email': '*/10 * * * *',
      'idle-sessions': '*/15 * * * *',
      'daily-workout-reminder': '*/15 * * * *',
      'weekly-summary-push': '*/30 * * * *',
      'community-like-pushes': '* * * * *',
    });
    for (const job of JOBS) {
      const queue = await boss.getQueue(job.name);
      expect(queue.policy).toBe('stately');
      expect(queue.retryLimit).toBe(QUEUE_OPTIONS.retryLimit);
    }
  }, 40000);

  it('a job removed from the list loses its schedule', async () => {
    const name = `test-removed-${suffix}`;
    testQueues.push(name);
    const boss = await startBoss();
    await registerJobs(boss, [...JOBS, { name, cron: '0 0 1 1 *', run: async () => {} }]);
    expect((await boss.getSchedules()).map((s) => s.name)).toContain(name);
    await registerJobs(boss, JOBS);
    expect((await boss.getSchedules()).map((s) => s.name)).not.toContain(name);
  }, 40000);
});
