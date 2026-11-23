// Session copy from a template (POST /sessions/initialize). Pins the goal
// seeding rule: on the user's own workouts the template's weight and reps
// become the session's Goal Wt / Goal Reps; library workouts don't.

import { describe, it, expect } from 'vitest';
import { buildSessionWorkoutData, blankEntriesFor } from '../sessionCopy.js';

const USER = 7;

const template = (over = {}) => ({
  id: 3,
  userId: USER,
  name: 'Push Day',
  exercises: [
    { name: 'WARM UP', isSectionHeader: true, sectionNotes: 'bike', sets: [] },
    {
      name: 'Bench Press',
      setType: 'straight',
      supersetLabel: 'A1',
      sets: [
        { setNumber: 1, plannedReps: 8, suggestedWeight: 135, setType: 'warmup' },
        { setNumber: 2, plannedReps: 8, suggestedWeight: 135, setType: 'straight' },
      ],
    },
    {
      name: 'Push-Up',
      setType: 'straight',
      sets: [{ setNumber: 1, plannedReps: 20, suggestedWeight: 0, setType: 'straight' }],
    },
  ],
  ...over,
});

describe('buildSessionWorkoutData', () => {
  it("seeds goals from the template's weight and reps on the user's own workout", () => {
    const wd = buildSessionWorkoutData(template(), {}, USER);
    const bench = wd.exercises[1];
    expect(bench.sets[0]).toMatchObject({ goalWeight: 135, goalReps: 8, suggestedWeight: 135, plannedReps: 8 });
    expect(bench.sets[1]).toMatchObject({ goalWeight: 135, goalReps: 8 });
  });

  it('gives no 0-lb goal for bodyweight, but the reps goal still applies', () => {
    const wd = buildSessionWorkoutData(template(), {}, USER);
    const pushUp = wd.exercises[2].sets[0];
    expect(pushUp.goalReps).toBe(20);
    expect(pushUp).not.toHaveProperty('goalWeight');
  });

  it("the user's own template beats last performance for goals and pre-filled weight", () => {
    const wd = buildSessionWorkoutData(template(), { 'Bench Press': { weight: 155, reps: 5 } }, USER);
    expect(wd.exercises[1].sets[0]).toMatchObject({ goalWeight: 135, goalReps: 8, suggestedWeight: 135, plannedReps: 8 });
  });

  it('bodyweight on the own template keeps the last-performance pre-fill weight', () => {
    const wd = buildSessionWorkoutData(template(), { 'Push-Up': { weight: 25, reps: 12 } }, USER);
    const pushUp = wd.exercises[2].sets[0];
    expect(pushUp.suggestedWeight).toBe(25);
    expect(pushUp).not.toHaveProperty('goalWeight');
    expect(pushUp).toMatchObject({ goalReps: 20, plannedReps: 20 });
  });

  it('library (global) templates get no template goals — last performance as before', () => {
    const wd = buildSessionWorkoutData(template({ userId: null }), { 'Bench Press': { weight: 155, reps: 5 } }, USER);
    const set = wd.exercises[1].sets[0];
    expect(set).not.toHaveProperty('goalWeight');
    expect(set).not.toHaveProperty('goalReps');
    expect(set).toMatchObject({ suggestedWeight: 155, plannedReps: 5 });
    expect(wd.exercises[2].sets[0]).toMatchObject({ suggestedWeight: 0, plannedReps: 20 });
  });

  it('never overwrites goals already on a set', () => {
    const t = template();
    t.exercises[1].sets[0] = { ...t.exercises[1].sets[0], goalWeight: 140, goalReps: 6 };
    const wd = buildSessionWorkoutData(t, {}, USER);
    expect(wd.exercises[1].sets[0]).toMatchObject({ goalWeight: 140, goalReps: 6 });
  });

  it('keeps section headers, superset labels and per-set types', () => {
    const wd = buildSessionWorkoutData(template(), {}, USER);
    expect(wd.name).toBe('Push Day');
    expect(wd.exercises[0]).toMatchObject({ name: 'WARM UP', isSectionHeader: true, sectionNotes: 'bike' });
    expect(wd.exercises[1].supersetLabel).toBe('A1');
    expect(wd.exercises[1].sets.map((s) => s.setType)).toEqual(['warmup', 'straight']);
    expect(wd.exercises[2]).not.toHaveProperty('supersetLabel');
  });

  it('builds one blank entry per set', () => {
    expect(blankEntriesFor(template())).toEqual([
      { exerciseName: 'Bench Press', setNumber: 1, weight: 0, reps: 0 },
      { exerciseName: 'Bench Press', setNumber: 2, weight: 0, reps: 0 },
      { exerciseName: 'Push-Up', setNumber: 1, weight: 0, reps: 0 },
    ]);
  });
});
