// Program builder (sample calendar): the slot-list rules (pure) and, when a
// database is available (DATABASE_URL — the local Docker dev DB), the real
// PUT /programs/:id/layout transaction: copies, rest days, reorder, deletes,
// start weekday, ownership. The DB part self-skips without a database.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkLayout, slotsPlacingTemplate, LayoutError, MAX_PROGRAM_SLOTS } from '../programLayout.js';
import { validateBody } from '../validation.js';
import { programLayoutBody } from '../schemas/misc.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-at-least-thirty-two-chars-long';

const rest = { rest: true };
const week = (...days) => [...days, ...Array(7 - days.length).fill(rest)];

describe('checkLayout', () => {
  it('returns the templates the new layout no longer uses', () => {
    const slots = week({ templateId: 2 }, { copyOf: 2 }, rest);
    expect(checkLayout(slots, [1, 2, 3], [2])).toEqual([1, 3]);
  });

  it('accepts an empty program (all weeks deleted)', () => {
    expect(checkLayout([], [4, 5], [])).toEqual([4, 5]);
  });

  it('refuses partial weeks, too many weeks, foreign templates, a day used twice and missing copy sources', () => {
    expect(() => checkLayout([rest], [], [])).toThrow('whole weeks');
    expect(() => checkLayout(Array(MAX_PROGRAM_SLOTS + 7).fill(rest), [], [])).toThrow('at most 52 weeks');
    expect(() => checkLayout(week({ templateId: 99 }), [1], [])).toThrow('not in this program');
    expect(() => checkLayout(week({ templateId: 1 }, { templateId: 1 }), [1], [])).toThrow('place a copy');
    expect(() => checkLayout(week({ copyOf: 7 }), [], [])).toThrow('not found');
    try { checkLayout([rest], [], []); } catch (err) { expect(err).toBeInstanceOf(LayoutError); expect(err.status).toBe(400); }
  });
});

describe('slotsPlacingTemplate', () => {
  const t = (id, isRest = false) => ({ id, isRest });

  it('replaces a rest day on the chosen day (the rest template is dropped)', () => {
    const ordered = [t(1), t(2, true), t(3), t(9)];
    expect(slotsPlacingTemplate(ordered, 9, 1)).toEqual(
      [{ templateId: 1 }, { templateId: 9 }, { templateId: 3 }, rest, rest, rest, rest],
    );
  });

  it('fills an empty day in a later week, adding weeks of rest days as needed', () => {
    const slots = slotsPlacingTemplate([t(1), t(9)], 9, 10);
    expect(slots).toHaveLength(14);
    expect(slots[0]).toEqual({ templateId: 1 });
    expect(slots[10]).toEqual({ templateId: 9 });
    expect(slots.filter((s) => s.rest)).toHaveLength(12);
  });

  it('moves on to the next free day when the chosen day already has a workout', () => {
    const ordered = [t(1), t(2), t(3), t(4), t(5), t(6), t(7), t(9)];
    const slots = slotsPlacingTemplate(ordered, 9, 6);
    expect(slots).toHaveLength(14);
    expect(slots[6]).toEqual({ templateId: 7 });
    expect(slots[7]).toEqual({ templateId: 9 });
  });
});

describe('programLayoutBody', () => {
  function run(body) {
    const req = { body };
    let out = null;
    const res = { status(code) { out = { status: code }; return this; }, json(p) { out.body = p; return this; } };
    validateBody(programLayoutBody)(req, res, () => { out = { body: req.body }; });
    return out;
  }

  it('passes a week of keeps, copies and rests and a start weekday', () => {
    const r = run({ slots: week({ templateId: '5' }, { copyOf: 6 }), startWeekday: 1 });
    expect(r.status).toBeUndefined();
    expect(r.body.slots[0]).toEqual({ templateId: 5 });
    expect(r.body.startWeekday).toBe(1);
  });

  it('names the problem', () => {
    expect(run({ slots: [rest] }).body.error).toBe('Slots must be whole weeks (a multiple of 7 days)');
    expect(run({}).body.error).toMatch(/Slots must be a list|slots/);
    expect(run({ slots: week({ templateId: 1, rest: true }) }).body.error).toBe('slots.0: must be one of templateId, copyOf or rest');
    expect(run({ slots: week(), startWeekday: 7 }).body.error).toBe('Start day must be 0 (Sunday) to 6 (Saturday)');
  });
});

// ── Real database ──

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)('PUT /programs/:id/layout against the database', () => {
  let pool;
  let db;
  let userId;
  let otherUserId;
  let programId;
  let libraryProgramId;
  let libraryTemplateId;
  const ids = {};

  async function makeTemplate(name, sortOrder, { owner = userId, program = programId, isRest = false } = {}) {
    const { rows } = await pool.query(
      `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
       VALUES ($1, $2, $3, '', $4, $5) RETURNING id`,
      [owner, program, name, isRest, sortOrder],
    );
    await pool.query(
      `INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, superset_label)
       VALUES ($1, 'Bench Press', 1, 8, 135, 0, 'A1'), ($1, 'Bench Press', 2, 8, 145, 0, 'A1')`,
      [rows[0].id],
    );
    return rows[0].id;
  }

  async function programRows() {
    const { rows } = await pool.query(
      'SELECT id, name, is_rest, sort_order FROM templates WHERE program_id = $1 ORDER BY sort_order, id',
      [programId],
    );
    return rows;
  }

  beforeAll(async () => {
    ({ default: pool } = await import('../dbPool.js'));
    ({ default: db } = await import('../db.js'));
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const mkUser = async (tag) => (await pool.query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name)
       VALUES ($1, $2, 'x', 'Layout', 'Test') RETURNING id`,
      [`layout-${tag}-${stamp}@example.test`, `layout_${tag}_${stamp}`],
    )).rows[0].id;
    userId = await mkUser('a');
    otherUserId = await mkUser('b');
    programId = (await pool.query(`INSERT INTO programs (user_id, name) VALUES ($1, 'Layout Test') RETURNING id`, [userId])).rows[0].id;
    libraryProgramId = (await pool.query(`INSERT INTO programs (user_id, name) VALUES (NULL, $1) RETURNING id`, [`Layout Library ${stamp}`])).rows[0].id;
    libraryTemplateId = await makeTemplate('Library Legs', 0, { owner: null, program: libraryProgramId });
    ids.push = await makeTemplate('Push', 0);
    ids.pull = await makeTemplate('Pull', 1);
    ids.restA = await makeTemplate('Rest', 2, { isRest: true });
    ids.mine = await makeTemplate('My Arms', 0, { program: null });
    ids.foreign = await makeTemplate('Not Mine', 0, { owner: otherUserId, program: null });
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM templates WHERE program_id = ANY($1) OR user_id = ANY($2)', [[programId, libraryProgramId], [userId, otherUserId]]);
    await pool.query('DELETE FROM programs WHERE id = ANY($1)', [[programId, libraryProgramId]]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[userId, otherUserId]]);
  });

  it('rewrites the program: reorder, copies with their exercises, rest days, deletes and the start weekday', async () => {
    const slots = [
      { templateId: ids.pull }, { copyOf: ids.push }, { templateId: ids.push }, { rest: true },
      { copyOf: ids.mine }, { copyOf: libraryTemplateId }, { rest: true },
    ];
    const result = await db.setProgramLayout(userId, programId, slots, { startWeekday: 1 });
    expect(result.templateIds).toHaveLength(7);
    expect(result.startWeekday).toBe(1);

    const rows = await programRows();
    expect(rows.map((r) => r.name)).toEqual(['Pull', 'Push', 'Push', 'Rest', 'My Arms', 'Library Legs', 'Rest']);
    expect(rows.map((r) => r.sort_order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(rows[0].id).toBe(ids.pull);
    expect(rows[2].id).toBe(ids.push);
    // The old rest template wasn't used, so it's gone.
    expect(rows.some((r) => r.id === ids.restA)).toBe(false);
    // Copies are new rows owned by the user, with their own exercises.
    const pushCopy = rows[1];
    expect(pushCopy.id).not.toBe(ids.push);
    const { rows: ex } = await pool.query(
      'SELECT name, set_number, planned_reps, suggested_weight, superset_label FROM template_exercises WHERE template_id = $1 ORDER BY set_number',
      [pushCopy.id],
    );
    expect(ex).toEqual([
      { name: 'Bench Press', set_number: 1, planned_reps: 8, suggested_weight: '135', superset_label: 'A1' },
      { name: 'Bench Press', set_number: 2, planned_reps: 8, suggested_weight: '145', superset_label: 'A1' },
    ]);
    const { rows: owners } = await pool.query('SELECT DISTINCT user_id FROM templates WHERE program_id = $1', [programId]);
    expect(owners).toEqual([{ user_id: userId }]);
    // The source workouts are untouched.
    const { rows: src } = await pool.query('SELECT program_id FROM templates WHERE id = $1', [ids.mine]);
    expect(src[0].program_id).toBeNull();
    const { rows: prog } = await pool.query('SELECT program_details FROM programs WHERE id = $1', [programId]);
    expect(prog[0].program_details).toEqual({ startWeekday: 1 });
  });

  it('clears the start weekday and leaves it alone when not sent', async () => {
    const keep = (await programRows()).map((r) => ({ templateId: r.id }));
    expect((await db.setProgramLayout(userId, programId, keep)).startWeekday).toBe(1);
    expect((await db.setProgramLayout(userId, programId, keep, { startWeekday: null })).startWeekday).toBeNull();
    const { rows: prog } = await pool.query('SELECT program_details FROM programs WHERE id = $1', [programId]);
    expect(prog[0].program_details).toBeNull();
  });

  it("refuses other people's programs, library programs and workouts the user can't see, changing nothing", async () => {
    const before = await programRows();
    const keep = before.map((r) => ({ templateId: r.id }));
    expect(await db.setProgramLayout(otherUserId, programId, keep)).toBeNull();
    expect(await db.setProgramLayout(userId, libraryProgramId, [{ templateId: libraryTemplateId }, ...Array(6).fill({ rest: true })])).toBeNull();
    await expect(db.setProgramLayout(userId, programId, [...keep.slice(0, 6), { copyOf: ids.foreign }])).rejects.toThrow('not found');
    await expect(db.setProgramLayout(userId, programId, [...keep.slice(0, 6), { templateId: ids.mine }])).rejects.toThrow('not in this program');
    expect(await programRows()).toEqual(before);
  });

  it('Create a Workout with slotIndex lands on that day, replacing the rest day there', async () => {
    const before = await programRows();
    const restIdx = before.findIndex((r) => r.is_rest);
    const created = await db.createTemplate(userId, 'Legs', '', [{ name: 'Squat', sets: [{ reps: 5, weight: 225 }] }], programId, false, { slotIndex: restIdx });
    expect(created.slotPlaced).toBe(true);
    const rows = await programRows();
    expect(rows).toHaveLength(7);
    expect(rows[restIdx].id).toBe(created.id);
    expect(rows.some((r) => r.id === before[restIdx].id)).toBe(false);
  });

  it('Edit with alsoApplyTo updates the copies in the same program only', async () => {
    const rows = await programRows();
    const pushes = rows.filter((r) => r.name === 'Push').map((r) => r.id);
    await db.updateTemplate(userId, pushes[0], 'Push', '', [{ name: 'Incline Press', sets: [{ reps: 10, weight: 95 }] }], { alsoApplyTo: [pushes[1], ids.mine] });
    const { rows: ex } = await pool.query(
      'SELECT template_id, name FROM template_exercises WHERE template_id = ANY($1) ORDER BY template_id',
      [[...pushes, ids.mine]],
    );
    expect(ex.filter((e) => pushes.includes(e.template_id)).map((e) => e.name)).toEqual(['Incline Press', 'Incline Press']);
    // My Arms is in another program, so it wasn't touched.
    expect(ex.filter((e) => e.template_id === ids.mine).every((e) => e.name === 'Bench Press')).toBe(true);
  });
});
