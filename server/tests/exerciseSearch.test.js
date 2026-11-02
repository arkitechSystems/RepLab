// Server side of the shared exercise search (shared/exerciseSearch.js):
// db.getExercises search (GET /exercises, Trainer Central, admin workout
// manager) and the browser script served to the /workouts dashboard pages.
// Uses a fake pool — never touches a real database.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import vm from 'vm';

const state = { rows: [], calls: [] };

vi.mock('../dbPool.js', () => ({
  default: {
    query: vi.fn(async (sql, params) => {
      state.calls.push([String(sql), params]);
      return { rows: String(sql).includes('FROM exercises e') ? state.rows : [] };
    }),
    connect: vi.fn(),
    on: vi.fn(),
  },
}));

const { default: db } = await import('../db.js');
const { searchExercises, exerciseSearchBrowserScript, EXERCISE_ABBREVIATIONS } = await import('../exerciseSearch.js');
const shared = await import('../../shared/exerciseSearch.js');

const row = (id, name, over = {}) => ({
  id, name, muscle_group: 'Back', tags: [], is_custom: false, created_by: null,
  video_id: null, hidden_from_library: false, is_favorite: false, ...over,
});

const LIBRARY = [
  row(1, 'Barbell Row'), row(2, 'Dumbbell Row'), row(3, 'Lat Pulldown'), row(4, 'Romanian Deadlift', { muscle_group: 'Hamstrings' }),
  row(5, 'Dumbbell RDL', { muscle_group: 'Hamstrings' }), row(6, 'Pull-Ups'), row(7, 'Seated Cable Row'),
  row(8, 'Barbell Bench Press', { muscle_group: 'Chest' }), row(9, 'BB Squats', { muscle_group: 'Quads' }),
];

beforeEach(() => {
  state.rows = LIBRARY;
  state.calls = [];
});

describe('db.getExercises search', () => {
  it('expands abbreviations and ranks the best match first', async () => {
    const list = await db.getExercises(7, { search: 'db row' });
    expect(list[0].name).toBe('Dumbbell Row');
    expect(list[0].isFuzzy).toBeUndefined();
    const [sql] = state.calls[0];
    expect(sql).not.toContain('ILIKE');
    expect(sql).not.toContain('LIMIT');
  });

  it('fills to 3 with closest spellings, marked isFuzzy', async () => {
    const list = await db.getExercises(7, { search: 'latpuldown', limit: 20 });
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ name: 'Lat Pulldown', isFuzzy: true });
    expect(list.every((e) => e.isFuzzy)).toBe(true);
  });

  it('applies the limit after searching', async () => {
    const list = await db.getExercises(7, { search: 'row', limit: 2 });
    expect(list.map((e) => e.name)).toEqual(['Barbell Row', 'Dumbbell Row']);
  });

  it('without a search keeps the SQL limit', async () => {
    await db.getExercises(7, { limit: 5 });
    const [sql, params] = state.calls[0];
    expect(sql).toContain('LIMIT $2');
    expect(params).toEqual([7, 5]);
  });
});

describe('server copy of the shared search', () => {
  it('is the shared module (one abbreviation list)', () => {
    expect(EXERCISE_ABBREVIATIONS).toBe(shared.EXERCISE_ABBREVIATIONS);
    expect(searchExercises(['Romanian Deadlift', 'Leg Press'], 'rdl').matches).toEqual(['Romanian Deadlift']);
  });

  it('browser script for the /workouts pages exposes the same search', () => {
    const ctx = {};
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(exerciseSearchBrowserScript(), ctx);
    // Only the two globals — the Fuse UMD build's own vars stay scoped.
    expect(Object.keys(ctx).sort()).toEqual(['Fuse', 'RepLabExerciseSearch', 'window']);
    const lib = [{ name: 'Dumbbell Row' }, { name: 'Barbell Row' }, { name: 'Lat Pulldown' }, { name: 'Leg Press' }];
    const { matches, suggestions } = ctx.RepLabExerciseSearch.searchExercises(lib, 'db row');
    expect(matches.map((e) => e.name)).toEqual(['Dumbbell Row']);
    expect(suggestions).toHaveLength(2);
    const fuzzy = ctx.RepLabExerciseSearch.searchExercises(lib, 'latpuldown');
    expect(fuzzy.suggestions[0].name).toBe('Lat Pulldown');
  });
});
