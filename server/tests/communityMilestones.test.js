// RepLab Community feed v2 (2026-11): streak milestones, program
// completions, the master/category sharing toggles, and the feed only
// showing PR / program started / program completed / streak items.
//
// The pure streak helpers always run. The rest needs a real PostgreSQL
// (DATABASE_URL — the local Docker DB, never production) and self-skips
// without one, like cascade-delete.test.js. Each DB test uses its own users
// and cleans up through db.deleteUser.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { streakRunAround, streakMilestoneFor } from '../communityMilestones.js';
import { parseCommunityItemKey, communityItemKey } from '../communityItems.js';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-at-least-thirty-two-chars-long';

const HAS_DB = !!process.env.DATABASE_URL;

function day(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe('streak helpers', () => {
  const dates = new Set(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06']);

  it('finds the run of consecutive days around a day', () => {
    expect(streakRunAround(dates, '2026-03-02')).toEqual({ start: '2026-03-01', end: '2026-03-03', length: 3 });
    expect(streakRunAround(dates, '2026-03-06')).toEqual({ start: '2026-03-05', end: '2026-03-06', length: 2 });
    expect(streakRunAround(dates, '2026-03-04')).toBeNull();
  });

  it('crosses month ends', () => {
    const s = new Set(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(streakRunAround(s, '2026-03-01').length).toBe(3);
  });

  it('reports the highest multiple of 5 reached and the day it was hit', () => {
    expect(streakMilestoneFor({ start: '2026-03-01', end: '2026-03-04', length: 4 })).toBeNull();
    expect(streakMilestoneFor({ start: '2026-03-01', end: '2026-03-05', length: 5 }))
      .toEqual({ milestone: 5, reachedOn: '2026-03-05' });
    expect(streakMilestoneFor({ start: '2026-03-01', end: '2026-03-12', length: 12 }))
      .toEqual({ milestone: 10, reachedOn: '2026-03-10' });
  });
});

describe('community item keys', () => {
  it('round-trips the four feed kinds and rejects the retired ones', () => {
    for (const type of ['pr', 'program', 'programComplete', 'streak']) {
      expect(parseCommunityItemKey(communityItemKey(type, 12))).toEqual({ type, id: 12 });
    }
    expect(communityItemKey('programComplete', 3)).toBe('pc-3');
    expect(communityItemKey('streak', 3)).toBe('st-3');
    expect(parseCommunityItemKey('wk-3')).toBeNull();
    expect(parseCommunityItemKey('cw-3')).toBeNull();
  });
});

describe.skipIf(!HAS_DB)('community milestones + sharing (real DB)', () => {
  let pool;
  let db;
  let recordCommunityMilestones;
  const userIds = [];
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  async function makeUser(tag) {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, username)
       VALUES ($1, 'x', $2) RETURNING id`,
      [`cm-${tag}-${suffix}@test.local`, `cm_${tag}_${suffix}`]
    );
    userIds.push(rows[0].id);
    return rows[0].id;
  }

  async function makeProgram(userId, workoutCount) {
    const { rows: [p] } = await pool.query(
      `INSERT INTO programs (user_id, name) VALUES ($1, $2) RETURNING id`,
      [userId, `CM Program ${suffix}`]
    );
    const templateIds = [];
    for (let i = 0; i < workoutCount; i++) {
      const { rows: [t] } = await pool.query(
        `INSERT INTO templates (user_id, program_id, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, p.id, `CM Day ${i + 1}`, i]
      );
      templateIds.push(t.id);
    }
    return { programId: p.id, templateIds };
  }

  async function completeSession(userId, templateId, date) {
    const { rows: [s] } = await pool.query(
      `INSERT INTO sessions (user_id, template_id, date, completed) VALUES ($1, $2, $3, TRUE) RETURNING id`,
      [userId, templateId, date]
    );
    return recordCommunityMilestones(userId, s.id).then((r) => ({ ...r, sessionId: s.id }));
  }

  async function milestones(userId) {
    const { rows } = await pool.query(
      `SELECT milestone, to_char(reached_on, 'YYYY-MM-DD') AS reached_on
         FROM streak_milestones WHERE user_id = $1 ORDER BY id`,
      [userId]
    );
    return rows;
  }

  beforeAll(async () => {
    ({ default: pool } = await import('../dbPool.js'));
    ({ default: db } = await import('../db.js'));
    ({ recordCommunityMilestones } = await import('../communityMilestones.js'));
    const { default: initDb } = await import('../initDb.js');
    await initDb();
  }, 120000);

  afterAll(async () => {
    for (const id of userIds) {
      try { await db.deleteUser(id); } catch { /* best effort */ }
    }
  });

  it('posts a streak at 5 and 10 days, once each, even when a day is re-completed', async () => {
    const u = await makeUser('streak');
    const { templateIds: [t] } = await makeProgram(u, 1);
    for (let i = -4; i <= -1; i++) await completeSession(u, t, day(i));
    expect(await milestones(u)).toEqual([]);

    const fifth = await completeSession(u, t, day(0));
    expect(fifth.streakId).toBeTruthy();
    expect(await milestones(u)).toEqual([{ milestone: 5, reached_on: day(0) }]);

    // Re-completing the same day (undo + Mark Complete again) doesn't repost.
    const again = await recordCommunityMilestones(u, fifth.sessionId);
    expect(again.streakId).toBeNull();

    // Logging earlier missed days lengthens the same streak: 6–9 days post
    // nothing new, 10 days posts the 10.
    for (let i = -5; i >= -8; i--) {
      expect((await completeSession(u, t, day(i))).streakId).toBeNull();
    }
    expect((await completeSession(u, t, day(-9))).streakId).toBeTruthy();
    expect(await milestones(u)).toEqual([
      { milestone: 5, reached_on: day(0) },
      { milestone: 10, reached_on: day(0) },
    ]);
  });

  it("doesn't repost when the same streak re-crosses a milestone after a deleted session", async () => {
    const u = await makeUser('redo');
    const { templateIds: [t] } = await makeProgram(u, 1);
    const ids = [];
    for (let i = -5; i <= -1; i++) ids.push((await completeSession(u, t, day(i))).sessionId);
    expect((await milestones(u)).map((m) => m.milestone)).toEqual([5]);

    // Delete the first day, then log today: still a 5-day run, same streak.
    await pool.query('DELETE FROM sessions WHERE id = $1', [ids[0]]);
    const today = await completeSession(u, t, day(0));
    expect(today.streakId).toBeNull();
    expect((await milestones(u)).map((m) => m.milestone)).toEqual([5]);
  });

  it('ignores rest days and old (backfilled) streaks', async () => {
    const u = await makeUser('old');
    const { templateIds: [t] } = await makeProgram(u, 1);
    for (let i = -40; i <= -36; i++) await completeSession(u, t, day(i));
    expect(await milestones(u)).toEqual([]);

    const { rows: [rest] } = await pool.query(
      `INSERT INTO templates (user_id, name, is_rest) VALUES ($1, 'Rest', TRUE) RETURNING id`,
      [u]
    );
    for (let i = -4; i <= 0; i++) await completeSession(u, rest.id, day(i));
    expect(await milestones(u)).toEqual([]);
  });

  it('records a program completion once per enrollment', async () => {
    const u = await makeUser('prog');
    const { programId, templateIds } = await makeProgram(u, 4);
    const { rows: [start] } = await pool.query(
      `INSERT INTO program_starts (user_id, program_id, program_name, started_at)
       VALUES ($1, $2, $3, NOW() - INTERVAL '10 days') RETURNING id`,
      [u, programId, `CM Program ${suffix}`]
    );

    // Final workout alone (1 of 4) isn't enough.
    let r = await completeSession(u, templateIds[3], day(-3));
    expect(r.programCompletionId).toBeNull();
    // Half the workouts but not the final one again: the final is already
    // logged, so day 1 brings it to 2 of 4 → complete.
    r = await completeSession(u, templateIds[0], day(-2));
    expect(r.programCompletionId).toBeTruthy();

    const { rows } = await pool.query(
      'SELECT program_start_id, program_name FROM program_completions WHERE user_id = $1',
      [u]
    );
    expect(rows).toEqual([{ program_start_id: start.id, program_name: `CM Program ${suffix}` }]);

    // More workouts after completing don't post again.
    r = await completeSession(u, templateIds[1], day(-1));
    expect(r.programCompletionId).toBeNull();
  });

  it("doesn't count workouts logged before enrolling", async () => {
    const u = await makeUser('early');
    const { programId, templateIds } = await makeProgram(u, 4);
    for (const i of [0, 1]) {
      await pool.query(
        'INSERT INTO sessions (user_id, template_id, date, completed) VALUES ($1, $2, $3, TRUE)',
        [u, templateIds[i], day(-20 + i)]
      );
    }
    await pool.query(
      `INSERT INTO program_starts (user_id, program_id, program_name) VALUES ($1, $2, 'P')`,
      [u, programId]
    );
    // Final workout today = 1 of 4 since enrolling (the 2 earlier ones don't count).
    let r = await completeSession(u, templateIds[3], day(0));
    expect(r.programCompletionId).toBeNull();
    // A second one since enrolling reaches half → completed.
    r = await completeSession(u, templateIds[2], day(0));
    expect(r.programCompletionId).toBeTruthy();
  });

  it('master off turns every category off, master on turns them all back on', async () => {
    const u = await makeUser('master');
    let s = await db.setCommunitySharing(u, 'streak', false);
    expect(s).toEqual({ all: true, pr: true, program: true, programComplete: true, streak: false });

    s = await db.setCommunitySharing(u, 'all', false);
    expect(s).toEqual({ all: false, pr: false, program: false, programComplete: false, streak: false });

    s = await db.setCommunitySharing(u, 'all', true);
    expect(s).toEqual({ all: true, pr: true, program: true, programComplete: true, streak: true });

    // Every category off: the master stays on.
    for (const c of ['pr', 'program', 'programComplete', 'streak']) s = await db.setCommunitySharing(u, c, false);
    expect(s.all).toBe(true);

    // A category turned on while the master is off turns the master on.
    await db.setCommunitySharing(u, 'all', false);
    s = await db.setCommunitySharing(u, 'pr', true);
    expect(s).toEqual({ all: true, pr: true, program: false, programComplete: false, streak: false });
  });

  it('feed shows only the four kinds and respects each toggle', async () => {
    const u = await makeUser('feed');
    const { programId, templateIds } = await makeProgram(u, 1);
    await pool.query(
      `INSERT INTO program_starts (user_id, program_id, program_name, started_at)
       VALUES ($1, $2, 'Feed Program', NOW() - INTERVAL '2 days')`,
      [u, programId]
    );
    for (let i = -4; i <= 0; i++) await completeSession(u, templateIds[0], day(i));
    await pool.query(
      `INSERT INTO personal_bests (user_id, template_id, exercise_name, best_weight, best_reps, achieved_at)
       VALUES ($1, $2, 'CM Bench', 200, 5, NOW())`,
      [u, templateIds[0]]
    );

    const mine = async () => {
      const feed = await db.getCommunityFeed({ limit: 100, sinceDays: 30 });
      return feed.items.filter((i) => i.userId === u).map((i) => i.kind).sort();
    };
    expect(await mine()).toEqual(['pr', 'program', 'programComplete', 'streak']);

    const streakItem = (await db.getCommunityFeed({ limit: 100, sinceDays: 30 }))
      .items.find((i) => i.userId === u && i.kind === 'streak');
    expect(streakItem.days).toBe(5);
    expect(streakItem.id).toMatch(/^st-\d+$/);

    await db.setCommunitySharing(u, 'streak', false, true);
    expect(await mine()).toEqual(['pr', 'program', 'programComplete']);
    await db.setCommunitySharing(u, 'programComplete', false, true);
    expect(await mine()).toEqual(['pr', 'program']);

    await db.setCommunitySharing(u, 'all', false);
    expect(await mine()).toEqual([]);
    await db.setCommunitySharing(u, 'all', true);
    // Removed (streak, program complete) stay removed; kept ones come back.
    expect(await mine()).toEqual(['pr', 'program']);
  });
});
