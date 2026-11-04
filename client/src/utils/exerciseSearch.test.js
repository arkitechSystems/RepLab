// Shared exercise search (shared/exerciseSearch.js via utils/exerciseSearch):
// gym abbreviations, word-by-word matching, ranking, and the "closest
// matches" spelling fallback that tops results up to 3.
import { describe, it, expect } from 'vitest';
import { getAllExercises } from './exerciseLibrary';
import {
  searchExercises, searchExerciseList, pickerSearch, matchesExerciseQuery,
  normalizeExerciseText, EXERCISE_ABBREVIATIONS, startsFuzzyGroup,
} from './exerciseSearch';

// The app's built-in library plus names from the server seed that are
// written with abbreviations.
const LIBRARY = [
  ...getAllExercises(),
  { name: 'BB Squats', muscle: 'Quads' },
  { name: 'DB Walking Lunges', muscle: 'Quads' },
  { name: 'Dumbbell RDL', muscle: 'Hamstrings' },
  { name: 'Single-Leg RDL', muscle: 'Hamstrings' },
  { name: 'Hammer Curl (DB)', muscle: 'Biceps' },
  { name: 'Glute-Ham Raise', muscle: 'Hamstrings' },
  { name: 'Stiff Leg Deadlift', muscle: 'Hamstrings' },
  { name: 'PULL-UP', muscle: 'Back' },
];
const names = (list) => list.map((e) => e.name);

describe('normalizeExerciseText', () => {
  it('lowercases and treats hyphens/punctuation as spaces', () => {
    expect(normalizeExerciseText('Pull-Ups')).toBe('pull ups');
    expect(normalizeExerciseText('Hammer Curl (DB)')).toBe('hammer curl db');
    expect(normalizeExerciseText("  Farmer's  Walk ")).toBe('farmers walk');
  });
});

describe('abbreviations', () => {
  it('has lowercase single-word keys and normalized expansions', () => {
    const keys = Object.keys(EXERCISE_ABBREVIATIONS);
    expect(keys.length).toBeGreaterThanOrEqual(25);
    for (const [k, list] of Object.entries(EXERCISE_ABBREVIATIONS)) {
      expect(normalizeExerciseText(k)).toBe(k);
      for (const exp of list) expect(normalizeExerciseText(exp)).toBe(exp);
    }
  });

  it('"bb" finds barbell exercises first, including names written "BB"', () => {
    const { matches, suggestions } = searchExercises(LIBRARY, 'bb');
    expect(suggestions).toEqual([]);
    expect(matches[0].name).toMatch(/^Barbell /);
    expect(names(matches)).toContain('BB Squats');
    expect(names(matches)).toContain('Barbell Row');
  });

  it('"db row" → Dumbbell Row first', () => {
    const { matches } = searchExercises(LIBRARY, 'db row');
    expect(matches[0].name).toBe('Dumbbell Row');
    expect(names(matches)).not.toContain('Barbell Row');
  });

  it('"rdl" → Romanian Deadlift variants', () => {
    const found = names(searchExercises(LIBRARY, 'rdl').matches);
    expect(found).toEqual(expect.arrayContaining(['Romanian Deadlift', 'Dumbbell RDL', 'Single-Leg RDL']));
  });

  it('long form finds names written with an abbreviation', () => {
    expect(names(searchExercises(LIBRARY, 'dumbbell hammer').matches)).toContain('Hammer Curl (DB)');
    expect(names(searchExercises(LIBRARY, 'barbell squat').matches)).toContain('BB Squats');
    expect(names(searchExercises(LIBRARY, 'romanian deadlift').matches)).toContain('Dumbbell RDL');
  });

  it('more gym shorthand', () => {
    expect(searchExercises(LIBRARY, 'ohp').matches[0].name).toBe('Overhead Press');
    expect(searchExercises(LIBRARY, 'cgbp').matches[0].name).toBe('Close-Grip Bench Press');
    expect(searchExercises(LIBRARY, 'ghr').matches[0].name).toBe('Glute-Ham Raise');
    expect(searchExercises(LIBRARY, 'sldl').matches[0].name).toBe('Stiff Leg Deadlift');
    expect(searchExercises(LIBRARY, 'tbar').matches[0].name).toBe('T-Bar Row');
    expect(searchExercises(LIBRARY, 'bss').matches[0].name).toMatch(/^Bulgarian Split Squat/);
  });
});

describe('word-by-word matching', () => {
  it('"pull ups" = "Pull-Ups" = "PULL-UP"', () => {
    const found = names(searchExercises(LIBRARY, 'pull ups').matches);
    expect(found).toEqual(expect.arrayContaining(['Pull-Ups', 'Pull Ups', 'PULL-UP']));
    expect(names(searchExercises(LIBRARY, 'pullups').matches)).toContain('Pull-Ups');
  });

  it('words can come in any order; every word must match', () => {
    expect(names(searchExercises(LIBRARY, 'row dumbbell').matches)).toEqual(['Dumbbell Row']);
    expect(matchesExerciseQuery('Incline Dumbbell Press', 'incline press')).toBe(true);
    expect(matchesExerciseQuery('Incline Dumbbell Press', 'incline row')).toBe(false);
  });

  it('plain substring searches still work', () => {
    expect(names(searchExercises(LIBRARY, 'bench').matches)).toContain('Barbell Bench Press');
    expect(names(searchExercises(LIBRARY, 'pulldo').matches)).toContain('Lat Pulldown');
  });
});

describe('ranking', () => {
  it('starts-with > whole word > partial, then list order', () => {
    const list = [{ name: 'Single-Arm Arrow Fly' }, { name: 'Barbell Row' }, { name: 'Rowing Machine' }, { name: 'Row Machine' }];
    expect(names(searchExercises(list, 'row').matches)).toEqual(['Rowing Machine', 'Row Machine', 'Barbell Row', 'Single-Arm Arrow Fly']);
  });

  it('pickerSearch floats saved exercises to the top of the matches', () => {
    const list = [{ name: 'Barbell Row', muscle: 'Back' }, { name: 'Dumbbell Row', muscle: 'Back', isFavorite: true }, { name: 'Cable Row', muscle: 'Back' }];
    expect(names(pickerSearch(list, 'row'))).toEqual(['Dumbbell Row', 'Barbell Row', 'Cable Row']);
  });
});

describe('spelling fallback (minimum 3 results)', () => {
  it.each([
    ['benhc pres', /Bench Press$/],
    ['romainian deadlit', /^Romanian Deadlift$/],
    ['latpuldown', /^Lat Pulldown$/],
  ])('"%s" → 3 closest matches, right exercise first', (query, first) => {
    const { matches, suggestions } = searchExercises(LIBRARY, query);
    expect(matches).toEqual([]);
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0].name).toMatch(first);
  });

  it('2 exact hits get 1 closest-match fill, never repeating a hit', () => {
    const list = [{ name: 'Cable Fly' }, { name: 'Incline Cable Fly' }, { name: 'Chest Fly' }, { name: 'Cable Crunch' }, { name: 'Leg Press' }];
    const { matches, suggestions } = searchExercises(list, 'cable fly');
    expect(names(matches)).toEqual(['Cable Fly', 'Incline Cable Fly']);
    expect(suggestions).toHaveLength(1);
    expect(names(matches)).not.toContain(suggestions[0].name);
  });

  it('3 or more hits → no fill', () => {
    expect(searchExercises(LIBRARY, 'curl').suggestions).toEqual([]);
  });

  it('empty query returns the list as-is with nothing forced', () => {
    const list = [{ name: 'B' }, { name: 'A' }];
    expect(searchExercises(list, '   ')).toEqual({ matches: list, suggestions: [] });
    expect(searchExercises(list, '')).toEqual({ matches: list, suggestions: [] });
  });

  it('pickerSearch marks fill rows isFuzzy so screens can label them', () => {
    const rows = pickerSearch(LIBRARY, 'latpuldown');
    expect(rows.every((r) => r.isFuzzy)).toBe(true);
    expect(startsFuzzyGroup(rows, 0)).toBe(true);
    expect(startsFuzzyGroup(rows, 1)).toBe(false);
    const mixed = pickerSearch([{ name: 'Cable Fly' }, { name: 'Incline Cable Fly' }, { name: 'Chest Fly' }], 'cable fly');
    expect(mixed.map((r) => !!r.isFuzzy)).toEqual([false, false, true]);
    expect(startsFuzzyGroup(mixed, 2)).toBe(true);
  });

  it('works on plain name strings too', () => {
    expect(searchExerciseList(['Lat Pulldown', 'Leg Press', 'Leg Curl', 'Calf Raise'], 'latpuldown')[0]).toBe('Lat Pulldown');
  });

  it('uniqueNames drops repeated names', () => {
    const list = [{ name: 'Leg Press', id: 1 }, { name: 'leg press', id: 2 }];
    expect(searchExercises(list, 'leg press', { uniqueNames: true }).matches.map((e) => e.id)).toEqual([1]);
  });
});
