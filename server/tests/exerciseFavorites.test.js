// Saved exercises (bookmark on ExerciseDetail). Exercises the real db.js
// paths against a fake pool that answers by SQL fragment, so these never
// touch a real database. They pin that isFavorite rides along in the single
// GET /exercises query, that saving is idempotent, and that only exercises
// the user can see (master or their own custom) can be saved.

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

const exRow = (over = {}) => ({
  id: 1, name: 'Barbell Bench Press', muscle_group: 'Chest', tags: [], is_custom: false,
  created_by: null, video_id: null, hidden_from_library: false, is_favorite: false, ...over,
});

describe('getExercises isFavorite', () => {
  it('maps is_favorite from one joined query scoped to the caller', async () => {
    state.handlers = [['FROM exercises e', [exRow({ id: 1, is_favorite: true }), exRow({ id: 2, name: 'Pushups', is_favorite: false })]]];
    const list = await db.getExercises(7);
    expect(list.map((e) => [e.id, e.isFavorite])).toEqual([[1, true], [2, false]]);
    // One query, joining the caller's favorites — no per-exercise lookups.
    expect(state.calls).toHaveLength(1);
    const [sql, params] = state.calls[0];
    expect(sql).toContain('LEFT JOIN exercise_favorites f ON f.exercise_id = e.id AND f.user_id = $1');
    expect(params[0]).toBe(7);
  });

  it('keeps search and muscle filters working with the join', async () => {
    await db.getExercises(7, { search: 'press', muscle: 'Chest' });
    const [sql, params] = state.calls[0];
    expect(sql).toContain('e.muscle_group = $2');
    expect(sql).toContain('e.name ILIKE $3');
    expect(params).toEqual([7, 'Chest', '%press%']);
  });
});

describe('setExerciseFavorite', () => {
  it('saves with an idempotent insert when the exercise is visible', async () => {
    state.handlers = [['SELECT id FROM exercises', [{ id: 42 }]]];
    expect(await db.setExerciseFavorite(7, 42, true)).toBe(true);
    const insert = state.calls.find(([sql]) => sql.includes('INSERT INTO exercise_favorites'));
    expect(insert[0]).toContain('ON CONFLICT (user_id, exercise_id) DO NOTHING');
    expect(insert[1]).toEqual([7, 42]);
  });

  it('unsaves with a delete scoped to the caller', async () => {
    state.handlers = [['SELECT id FROM exercises', [{ id: 42 }]]];
    expect(await db.setExerciseFavorite(7, 42, false)).toBe(true);
    const del = state.calls.find(([sql]) => sql.includes('DELETE FROM exercise_favorites'));
    expect(del[0]).toContain('user_id = $1 AND exercise_id = $2');
    expect(del[1]).toEqual([7, 42]);
  });

  it("refuses exercises the caller can't see and writes nothing", async () => {
    // No visible row: missing, or another user's custom.
    expect(await db.setExerciseFavorite(7, 99, true)).toBe(false);
    const [visSql, visParams] = state.calls[0];
    expect(visSql).toContain('(created_by IS NULL OR created_by = $2)');
    expect(visParams).toEqual([99, 7]);
    expect(state.calls.some(([sql]) => sql.includes('exercise_favorites'))).toBe(false);
  });
});
