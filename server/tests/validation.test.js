// Zod request schemas for the workout-data save routes (validation.js).
// Every shape the app actually sends must pass — a rejected workout save is
// shown as an error and not retried — and a bad shape must name its field.
import { describe, it, expect } from 'vitest';
import {
  saveSessionBody, completeSessionBody, initializeSessionBody, scheduleBody, templateBody, firstIssueMessage,
} from '../validation.js';

const ok = (schema, body) => {
  const r = schema.safeParse(body);
  if (!r.success) throw new Error(`expected OK, got: ${firstIssueMessage(r.error)}`);
  return r.data;
};
const err = (schema, body) => {
  const r = schema.safeParse(body);
  if (r.success) throw new Error('expected a validation error');
  return firstIssueMessage(r.error);
};

// What WorkoutSession's autosave sends (see buildSaveBody in the client).
const sessionSave = () => ({
  templateId: 835,
  date: '2026-10-07',
  entries: [
    { exerciseName: 'Leg Extension', setNumber: 1, weight: '12.5', reps: '10', isCompleted: true, setType: 'straight' },
    { exerciseName: 'Leg Extension', setNumber: 2, weight: '', reps: 0, isCompleted: false, setType: 'dropset' },
    { exerciseName: 'Bike', setNumber: 1, weight: 0, reps: 0, cardioMetric: 'time', cardioValue: null, isCompleted: false },
  ],
  notes: { 'Leg Extension': 'knee felt good' },
  workoutData: {
    name: 'Rehab Leg Workout',
    exercises: [
      { name: 'Warm-up', isSectionHeader: true, sectionNotes: '', sets: [] },
      { name: 'Leg Extension', setType: 'straight', supersetLabel: 'A', sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: '12.5', goalReps: 12 }] },
    ],
    cardioSelections: { bike: true },
  },
  confirmOverwrite: true,
});

describe('POST /sessions body', () => {
  it('accepts what the app sends, turning typed numbers into numbers', () => {
    const data = ok(saveSessionBody, sessionSave());
    expect(data.entries[0]).toMatchObject({ weight: 12.5, reps: 10, isCompleted: true });
    expect(data.entries[1]).toMatchObject({ weight: 0, reps: 0 });
    expect(data.entries[2].cardioValue).toBeNull();
    expect(data.workoutData.exercises[1].supersetLabel).toBe('A'); // extra fields kept
    expect(data.workoutData.cardioSelections).toEqual({ bike: true });
  });

  it("accepts a Calendar copy (blank sets, no isCompleted) and a string templateId", () => {
    ok(saveSessionBody, { templateId: '835', date: '2026-10-09', entries: [{ exerciseName: 'Squat', setNumber: 1, weight: 0, reps: 0 }], notes: {}, workoutData: { name: 'Legs', exercises: [] } });
  });

  it('names the bad field', () => {
    expect(err(saveSessionBody, { ...sessionSave(), date: '10/7/2026' })).toBe('date: must be a date (YYYY-MM-DD)');
    expect(err(saveSessionBody, { ...sessionSave(), templateId: 'abc' })).toBe('templateId: must be an id number');
    expect(err(saveSessionBody, { ...sessionSave(), entries: [] })).toBe('entries: must have at least one set');
    const bad = sessionSave();
    bad.entries[1].reps = 'ten';
    expect(err(saveSessionBody, bad)).toBe('entries.1.reps: must be a whole number');
    bad.entries[1].reps = 10.5;
    expect(err(saveSessionBody, bad)).toBe('entries.1.reps: must be a whole number');
    const bad2 = sessionSave();
    bad2.entries[0].isCompleted = 'yes';
    expect(err(saveSessionBody, bad2)).toBe('entries.0.isCompleted: must be true or false');
  });

  it('says which required field is missing', () => {
    expect(err(saveSessionBody, { templateId: 1 })).toBe('date: is required');
    expect(err(saveSessionBody, { templateId: 1, date: '2026-10-07' })).toBe('entries: is required');
  });
});

describe('PUT /sessions/complete and POST /sessions/initialize bodies', () => {
  it('accepts Mark Complete and Undo', () => {
    expect(ok(completeSessionBody, { templateId: 835, date: '2026-10-07', completed: true }).completed).toBe(true);
    ok(completeSessionBody, { templateId: 835, date: '2026-10-07', completed: false });
    ok(initializeSessionBody, { templateId: 835, date: '2026-10-07' });
  });

  it('requires completed to be true or false (a missing one used to store NULL)', () => {
    expect(err(completeSessionBody, { templateId: 835, date: '2026-10-07' })).toBe('completed: is required');
    expect(err(completeSessionBody, { templateId: 835, date: '2026-10-07', completed: 'true' })).toBe('completed: must be true or false');
  });
});

describe('PUT /schedule body', () => {
  it('accepts assign, clear, rest day and Begin Program', () => {
    ok(scheduleBody, { schedule: [{ date: '2026-10-10', templateId: 5 }, { date: '2026-10-11', templateId: null }, { date: '2026-10-12', isRest: true }], programStartId: 2 });
    ok(scheduleBody, { schedule: [{ date: '2026-10-10', templateId: 5, isRest: false }] });
  });

  it('names the bad field', () => {
    expect(err(scheduleBody, {})).toBe('schedule: is required');
    expect(err(scheduleBody, { schedule: [{ date: '2026-10-10', templateId: 0 }] })).toBe('schedule.0.templateId: must be an id number');
    expect(err(scheduleBody, { schedule: [{ date: '2026-10-10', isRest: 'no' }] })).toBe('schedule.0.isRest: must be true or false');
    expect(err(scheduleBody, { schedule: [{ templateId: 5 }] })).toBe('schedule.0.date: is required');
  });
});

describe('POST /templates and PUT /templates/:id body', () => {
  it('accepts create, edit and AI-generated workouts', () => {
    ok(templateBody, { name: 'Legs', description: '', exercises: [{ name: 'Squat', setType: 'straight', sets: [{ reps: 10, weight: 0 }] }], programId: 3, communityShare: true });
    ok(templateBody, { name: 'Legs', exercises: [{ name: 'Hdr', isSectionHeader: true, sectionNotes: '', sets: [] }] });
    ok(templateBody, { name: 'Rest', isRest: true, programId: null });
  });

  it('keeps the existing messages', () => {
    expect(err(templateBody, { programId: 1 })).toBe('Template name is required');
    expect(err(templateBody, { name: '   ' })).toBe('Template name is required');
    expect(err(templateBody, { name: 'x'.repeat(201) })).toBe('Template name must be 200 characters or fewer');
    expect(err(templateBody, { name: 'Legs', exercises: 'squat' })).toBe('Exercises must be an array');
    expect(err(templateBody, { name: 'Legs', exercises: Array.from({ length: 101 }, () => ({ name: 'x', sets: [] })) })).toBe('Max 100 exercises per template');
    expect(err(templateBody, { name: 'Legs', exercises: [{ name: 'y'.repeat(201) }] })).toBe('Exercise name must be 200 characters or fewer');
  });
});
