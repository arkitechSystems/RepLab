import { describe, it, expect } from 'vitest';
import {
  buildCreateWorkoutBody,
  createWorkoutUrl,
  parseCreateWorkoutParams,
  ownProgramChoices,
  hasRealExercise,
} from './createWorkout';
import { exKey } from '../pages/WorkoutSession';

describe('createWorkoutUrl / parseCreateWorkoutParams', () => {
  it('round-trips name, description, program and date', () => {
    const url = createWorkoutUrl({ name: '  Push Day ', description: 'Chest & tris', programId: 12, date: '2026-11-25' });
    expect(url.startsWith('/session/create?')).toBe(true);
    expect(parseCreateWorkoutParams(url.slice(url.indexOf('?')))).toEqual({
      name: 'Push Day', description: 'Chest & tris', programId: 12, date: '2026-11-25', slot: null,
    });
  });

  it('leaves out an empty description, no program and a bad date', () => {
    const url = createWorkoutUrl({ name: 'Legs', description: '  ', programId: null, date: 'tomorrow' });
    expect(url).toBe('/session/create?name=Legs');
    expect(parseCreateWorkoutParams('?name=Legs&programId=abc')).toEqual({ name: 'Legs', description: '', programId: null, date: null, slot: null });
  });

  it('carries the program builder day (slot) only with a program', () => {
    const url = createWorkoutUrl({ name: 'Legs', programId: 4, slot: 9 });
    expect(url).toBe('/session/create?name=Legs&programId=4&slot=9');
    expect(parseCreateWorkoutParams(url.slice(url.indexOf('?'))).slot).toBe(9);
    expect(createWorkoutUrl({ name: 'Legs', slot: 9 })).toBe('/session/create?name=Legs');
    expect(parseCreateWorkoutParams('?name=Legs&slot=9').slot).toBeNull();
    expect(parseCreateWorkoutParams('?name=Legs&programId=4&slot=x').slot).toBeNull();
  });
});

describe('ownProgramChoices', () => {
  it("lists the user's own programs, not My Workouts or library programs", () => {
    const programs = [
      { id: 1, userId: null, name: "Will's Hypertrophy" },
      { id: 2, userId: 5, name: 'My Workouts' },
      { id: 3, userId: 5, name: 'Summer Cut' },
    ];
    expect(ownProgramChoices(programs).map((p) => p.id)).toEqual([3]);
    expect(ownProgramChoices(undefined)).toEqual([]);
  });
});

describe('buildCreateWorkoutBody', () => {
  const exercises = [
    { name: 'Upper', isSectionHeader: true, sectionNotes: 'heavy', sets: [] },
    {
      name: 'Bench Press',
      supersetLabel: 'A1',
      sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 0 }, { setNumber: 2, plannedReps: 10, suggestedWeight: 0 }],
    },
    { name: 'Push-Up', sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 0 }] },
    { name: 'Bench Press', sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 0 }] },
  ];
  const entries = {
    'Bench Press': [{ weight: '135', reps: '8', setType: 'warmup' }, { weight: 135, reps: 8, setType: 'straight' }],
    'Push-Up': [{ weight: -1, reps: '20', setType: 'straight' }],
    'Bench Press::1': [{ weight: '', reps: '', setType: 'drop' }],
  };

  it("turns each set's entered weight and reps into the template's goal weight and reps", () => {
    const body = buildCreateWorkoutBody({ name: ' Push Day ', description: '', programId: null, exercises, entries, goals: {}, keyFor: exKey });
    expect(body.name).toBe('Push Day');
    expect(body.exercises[1]).toEqual({
      name: 'Bench Press',
      setType: 'warmup',
      supersetLabel: 'A1',
      sets: [
        { reps: 8, weight: 135, setType: 'warmup' },
        { reps: 8, weight: 135, setType: 'straight' },
      ],
    });
  });

  it("the exercise's type is its most common set type", () => {
    const ex = [{ name: 'Squat', sets: [{ setNumber: 1 }, { setNumber: 2 }, { setNumber: 3 }] }];
    const ent = { Squat: [{ setType: 'warmup', reps: 5 }, { setType: 'straight', reps: 5 }, { setType: 'straight', reps: 5 }] };
    const body = buildCreateWorkoutBody({ name: 'X', exercises: ex, entries: ent, keyFor: exKey });
    expect(body.exercises[0].setType).toBe('straight');
    expect(body.exercises[0].sets.map((s) => s.setType)).toEqual(['warmup', 'straight', 'straight']);
  });

  it('keeps section headers', () => {
    const body = buildCreateWorkoutBody({ name: 'X', exercises, entries, keyFor: exKey });
    expect(body.exercises[0]).toEqual({ name: 'Upper', isSectionHeader: true, sectionNotes: 'heavy', sets: [] });
  });

  it('bodyweight (-1) saves as weight 0 but keeps the reps', () => {
    const body = buildCreateWorkoutBody({ name: 'X', exercises, entries, keyFor: exKey });
    expect(body.exercises[2].sets).toEqual([{ reps: 20, weight: 0, setType: 'straight' }]);
  });

  it('a repeated exercise uses its own entries; blanks fall back to goals, then planned reps', () => {
    let body = buildCreateWorkoutBody({ name: 'X', exercises, entries, keyFor: exKey });
    expect(body.exercises[3]).toMatchObject({ name: 'Bench Press', setType: 'drop', sets: [{ reps: 10, weight: 0, setType: 'drop' }] });
    body = buildCreateWorkoutBody({ name: 'X', exercises, entries, goals: { 'Bench Press::1': [{ weight: '95', reps: '12' }] }, keyFor: exKey });
    expect(body.exercises[3].sets[0]).toMatchObject({ reps: 12, weight: 95 });
  });

  it('no program → saveToMyWorkouts; a chosen program → programId', () => {
    expect(buildCreateWorkoutBody({ name: 'X', exercises, entries, keyFor: exKey })).toMatchObject({ saveToMyWorkouts: true });
    const withProgram = buildCreateWorkoutBody({ name: 'X', description: ' notes ', programId: '9', exercises, entries, keyFor: exKey });
    expect(withProgram).toMatchObject({ programId: 9, description: 'notes' });
    expect(withProgram).not.toHaveProperty('saveToMyWorkouts');
  });

  it('hasRealExercise ignores section headers', () => {
    expect(hasRealExercise([{ name: 'A', isSectionHeader: true }])).toBe(false);
    expect(hasRealExercise(exercises)).toBe(true);
  });
});
