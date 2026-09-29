// Per-day workout names (session pencil → sessions.custom_name). Exercises
// the real db.js read/write paths against a fake pool that answers by SQL
// fragment, so these never touch a real database. They pin the display rule
// (day's name → template's CURRENT name → snapshot name) and that a rename
// only ever writes the one (user, template, date) session row.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { handlers: [], calls: [] };

function fakeQuery(sql, params) {
  state.calls.push([String(sql), params]);
  for (const [match, rows] of state.handlers) {
    if (String(sql).includes(match)) return { rows: typeof rows === 'function' ? rows(params) : rows };
  }
  return { rows: [] };
}

vi.mock('../dbPool.js', () => ({
  default: {
    query: vi.fn(async (sql, params) => fakeQuery(sql, params)),
    connect: vi.fn(async () => ({ query: vi.fn(async (sql, params) => fakeQuery(sql, params)), release: vi.fn() })),
    on: vi.fn(),
  },
}));

const { default: db } = await import('../db.js');

beforeEach(() => {
  state.handlers = [];
  state.calls = [];
});

const sessionRow = (over = {}) => ({
  id: 50, date: '2026-09-28', template_id: 7, created_at: null, last_activity_at: null,
  workout_data: { name: 'Leg Day (old snapshot)', exercises: [] },
  completed: true, custom_name: null, template_name: 'Leg Day', template_user_id: 1,
  template_is_rest: false, program_name: 'My Workouts', elapsed_secs: 0, ...over,
});

describe('getSession display name', () => {
  it("uses the day's own name when set", async () => {
    state.handlers = [['FROM sessions s', [sessionRow({ custom_name: 'Heavy Legs' })]]];
    const s = await db.getSession(1, 50);
    expect(s.templateName).toBe('Heavy Legs');
    expect(s.customName).toBe('Heavy Legs');
  });

  it("falls back to the template's CURRENT name, not the stale snapshot", async () => {
    state.handlers = [['FROM sessions s', [sessionRow({ template_name: 'Leg Day v2' })]]];
    const s = await db.getSession(1, 50);
    expect(s.templateName).toBe('Leg Day v2');
    expect(s.customName).toBeNull();
  });

  it('uses the snapshot name only when the template is gone', async () => {
    state.handlers = [['FROM sessions s', [sessionRow({ template_name: null, template_user_id: null })]]];
    const s = await db.getSession(1, 50);
    expect(s.templateName).toBe('Leg Day (old snapshot)');
  });

  it('only offers the pencil on the user’s own non-rest workouts', async () => {
    state.handlers = [['FROM sessions s', [sessionRow()]]];
    expect((await db.getSession(1, 50)).canRename).toBe(true);
    state.handlers = [['FROM sessions s', [sessionRow({ template_user_id: null })]]];
    expect((await db.getSession(1, 50)).canRename).toBe(false);
    state.handlers = [['FROM sessions s', [sessionRow({ template_user_id: 2 })]]];
    expect((await db.getSession(1, 50)).canRename).toBe(false);
    state.handlers = [['FROM sessions s', [sessionRow({ template_is_rest: true })]]];
    expect((await db.getSession(1, 50)).canRename).toBe(false);
  });
});

describe('setSessionCustomName', () => {
  it('writes only the one (user, template, date) session row', async () => {
    state.handlers = [['UPDATE sessions', [{ id: 50, custom_name: 'Heavy Legs' }]]];
    const out = await db.setSessionCustomName(1, 7, '2026-09-28', 'Heavy Legs');
    expect(out).toEqual({ id: 50, customName: 'Heavy Legs' });
    expect(state.calls).toHaveLength(1);
    const [sql, params] = state.calls[0];
    expect(sql).toMatch(/UPDATE sessions SET custom_name = \$4/);
    expect(sql).toMatch(/WHERE user_id = \$1 AND template_id = \$2 AND date = \$3/);
    expect(sql).not.toMatch(/templates/);
    expect(params).toEqual([1, 7, '2026-09-28', 'Heavy Legs']);
  });

  it('returns null when that date has no session', async () => {
    expect(await db.setSessionCustomName(1, 7, '2026-09-28', 'X')).toBeNull();
  });
});

describe('getSessionByTemplateAndDate', () => {
  it("returns the day's customName alongside the snapshot", async () => {
    state.handlers = [
      ['FROM sessions WHERE user_id', [{ id: 50, notes: {}, completed: false, workout_data: { name: 'Leg Day', exercises: [] }, custom_name: 'Heavy Legs' }]],
    ];
    const s = await db.getSessionByTemplateAndDate(1, 7, '2026-09-28');
    expect(s.customName).toBe('Heavy Legs');
    expect(s.workoutData.name).toBe('Leg Day'); // snapshot left as-is
  });
});

describe('getSchedule (Calendar / Workouts page)', () => {
  it("joins each date's session name and returns it as the display name", async () => {
    state.handlers = [['FROM schedule_days sd', [
      { schedule_date: '2026-09-28', template_id: 7, day_is_rest: false, template_name: 'Heavy Legs', template_is_rest: false, custom_name: 'Heavy Legs' },
      { schedule_date: '2026-09-30', template_id: 7, day_is_rest: false, template_name: 'Leg Day', template_is_rest: false, custom_name: null },
    ]]];
    const days = await db.getSchedule(1, '2026-09-28', '2026-10-04');
    expect(days[0]).toMatchObject({ date: '2026-09-28', templateName: 'Heavy Legs', customName: 'Heavy Legs' });
    // Same template on another date keeps the template's name.
    expect(days[1]).toMatchObject({ date: '2026-09-30', templateName: 'Leg Day', customName: null });
    const [sql] = state.calls[0];
    expect(sql).toMatch(/COALESCE\(ds\.custom_name, t\.name\) AS template_name/);
    expect(sql).toMatch(/LEFT JOIN LATERAL/);
    expect(sql).toMatch(/s\.date = to_char\(sd\.schedule_date, 'YYYY-MM-DD'\)/);
  });
});

describe('History list + Community feed', () => {
  it('getSessions computes the display name in SQL', async () => {
    await db.getSessions(1);
    const [sql] = state.calls[0];
    expect(sql).toMatch(/COALESCE\(NULLIF\(TRIM\(s\.custom_name\), ''\), t\.name, 'Unknown'\) AS template_name/);
  });

  it("feed 'completed workout' items carry the day's name", async () => {
    state.handlers = [
      ['WITH done AS', [{ id: 50, user_id: 2, date: '2026-09-28', occurred_at: new Date().toISOString(), template_name: 'Heavy Legs', total_volume: 1000, exercise_count: 3 }]],
    ];
    const feed = await db.getCommunityFeed({ limit: 10, sinceDays: 7, viewerId: 1 });
    const wk = feed.items.find((i) => i.kind === 'workout');
    expect(wk.workoutName).toBe('Heavy Legs');
    const feedSql = state.calls.find(([sql]) => sql.includes('WITH done AS'))[0];
    expect(feedSql).toMatch(/NULLIF\(TRIM\(d\.custom_name\), ''\), t\.name, 'Workout'\) AS template_name/);
  });

  it("like push text for a workout uses the day's name", async () => {
    state.handlers = [['FROM sessions s', [{ user_id: 2, workout_name: 'Heavy Legs' }]]];
    const item = await db.getCommunityItem('workout', 50);
    expect(item.workoutName).toBe('Heavy Legs');
    expect(state.calls[0][0]).toMatch(/NULLIF\(TRIM\(s\.custom_name\), ''\), t\.name, 'Workout'\) AS workout_name/);
  });
});
