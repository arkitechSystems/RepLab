// Workout names. Exercises the real db.js read/write paths against a fake
// pool that answers by SQL fragment, so these never touch a real database.
// They pin the display rule (legacy day name → template's CURRENT name →
// snapshot name), that renames are linked everywhere (renaming clears legacy
// day names for that user + template only), and saving a session as a new
// My Workouts workout.

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

const { default: db, sessionExercisesForTemplate } = await import('../db.js');

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

describe('renameTemplate (linked everywhere)', () => {
  const sql = () => state.calls.map(([s]) => s);

  it("renames the owner's template and clears legacy day names for that user + template only", async () => {
    state.handlers = [['UPDATE templates SET name', [{ id: 7, name: 'Heavy Legs' }]]];
    const out = await db.renameTemplate(1, 7, 'Heavy Legs');
    expect(out).toEqual({ id: 7, name: 'Heavy Legs' });
    const rename = state.calls.find(([s]) => s.includes('UPDATE templates SET name'));
    expect(rename[0]).toMatch(/WHERE id = \$2 AND user_id = \$3/);
    expect(rename[1]).toEqual(['Heavy Legs', 7, 1]);
    const clear = state.calls.find(([s]) => s.includes('UPDATE sessions SET custom_name = NULL'));
    expect(clear[0]).toMatch(/WHERE user_id = \$1 AND template_id = \$2/);
    expect(clear[1]).toEqual([1, 7]);
    // One transaction: BEGIN … COMMIT around both writes.
    expect(sql()[0]).toBe('BEGIN');
    expect(sql()[sql().length - 1]).toBe('COMMIT');
  });

  it("touches no sessions when it isn't the caller's template", async () => {
    const out = await db.renameTemplate(1, 7, 'Mine Now');
    expect(out).toBeNull();
    expect(sql().some((s) => s.includes('UPDATE sessions'))).toBe(false);
  });

  it('updateTemplate (full edit) also clears legacy day names for that user + template', async () => {
    state.handlers = [['UPDATE templates SET name', [{ id: 7, name: 'Leg Day' }]]];
    await db.updateTemplate(1, 7, 'Leg Day', '', []);
    const clear = state.calls.find(([s]) => s.includes('UPDATE sessions SET custom_name = NULL'));
    expect(clear[1]).toEqual([1, 7]);
  });
});

describe('saveSessionAsWorkout', () => {
  const wd = {
    name: 'Push A',
    exercises: [
      { name: 'Bench Press', setType: 'straight', sets: [
        { setNumber: 1, plannedReps: 8, suggestedWeight: 185 },
        { setNumber: 2, plannedReps: 8, suggestedWeight: 185 },
      ] },
      { name: 'Warm-up', isSectionHeader: true, sectionNotes: 'easy', sets: [] },
      { name: 'Dips', setType: 'straight', sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 0 }] },
    ],
  };

  it('creates a My Workouts template from the session with logged values and a de-duplicated name', async () => {
    state.handlers = [
      ['SELECT id, workout_data FROM sessions', [{ id: 50, workout_data: wd }]],
      ['FROM session_entries', [
        { exercise_name: 'Bench Press', set_number: 1, weight: '205', reps: 6 },
        { exercise_name: 'Dips', set_number: 1, weight: '0', reps: 12 },
      ]],
      ['INSERT INTO programs', [{ id: 3 }]],
      // First name taken, "(2)" free.
      ['LOWER(name) = LOWER($2)', (params) => (params[1] === '10/4/26 custom workout' ? [{ id: 99 }] : [])],
      ['next_sort', [{ next_sort: 4 }]],
      ['INSERT INTO templates', [{ id: 900 }]],
    ];
    const out = await db.saveSessionAsWorkout(1, 7, '2026-10-04', '10/4/26 custom workout');
    expect(out).toEqual({ id: 900, name: '10/4/26 custom workout (2)' });

    const insertTmpl = state.calls.find(([s]) => s.includes('INSERT INTO templates'));
    expect(insertTmpl[1]).toEqual([1, 3, '10/4/26 custom workout (2)', '', 4]);

    const insertEx = state.calls.find(([s]) => s.includes('INSERT INTO template_exercises'));
    // (template_id, exercise_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes)
    const p = insertEx[1];
    const rows = [];
    for (let i = 0; i < p.length; i += 10) rows.push(p.slice(i, i + 10));
    expect(rows.map((r) => [r[2], r[4], r[5], r[6], r[7], r[8]])).toEqual([
      ['Bench Press', 1, 6, 205, 0, false], // logged set → logged values
      ['Bench Press', 2, 8, 185, 0, false], // unlogged set → planned values
      ['Warm-up', 1, 0, 0, 1, true],        // section header kept
      ['Dips', 1, 12, 0, 2, false],
    ]);
    expect(state.calls.some(([s]) => s.includes('INSERT INTO custom_workout_events'))).toBe(true);
  });

  it('returns null (and creates nothing) when the caller has no such session', async () => {
    const out = await db.saveSessionAsWorkout(1, 7, '2026-10-04', 'X');
    expect(out).toBeNull();
    expect(state.calls.some(([s]) => s.includes('INSERT INTO templates'))).toBe(false);
  });
});

describe('sessionExercisesForTemplate', () => {
  it('maps a repeated exercise to its own logged sets in order', () => {
    const out = sessionExercisesForTemplate(
      [
        { name: 'Curl', sets: [{ plannedReps: 10, suggestedWeight: 30 }] },
        { name: 'Curl', sets: [{ plannedReps: 12, suggestedWeight: 25 }] },
      ],
      [
        { exercise_name: 'Curl', set_number: 2, weight: '20', reps: 15 },
        { exercise_name: 'Curl', set_number: 1, weight: '35', reps: 8 },
      ]
    );
    expect(out.map((e) => e.sets[0])).toEqual([{ reps: 8, weight: 35 }, { reps: 15, weight: 20 }]);
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
