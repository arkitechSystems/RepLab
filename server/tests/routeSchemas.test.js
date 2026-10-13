// Route body schemas (schemas/*.js): what the app sends still passes (and is
// normalized), wrong types are a 400 naming the field, and each route keeps
// the error message it sent before Zod.

import { describe, it, expect } from 'vitest';
import { validateBody } from '../validation.js';
import * as auth from '../schemas/auth.js';
import * as misc from '../schemas/misc.js';
import * as staff from '../schemas/staff.js';

// Runs validateBody like Express would: { status, body } on rejection, or
// { body } (the normalized request body) when it passes.
function run(schema, body) {
  const req = { body };
  let out = null;
  const res = {
    status(code) { out = { status: code }; return this; },
    json(payload) { out.body = payload; return this; },
  };
  validateBody(schema)(req, res, () => { out = { body: req.body }; });
  return out;
}
const error = (schema, body) => run(schema, body).body.error;

describe('auth', () => {
  it('signup passes what the app sends and turns a numeric zip code into text', () => {
    const r = run(auth.signupBody, {
      identifier: 'a@b.com', password: 'Testpass123!', firstName: 'A', lastName: 'B',
      zipCode: 75001, timezone: 'America/Chicago', deviceInfo: { platform: 'ios' }, referralCode: null,
    });
    expect(r.status).toBeUndefined();
    expect(r.body.zipCode).toBe('75001');
    expect(r.body.deviceInfo).toEqual({ platform: 'ios' });
  });

  it('missing signup fields are left to the handler (its messages are unchanged)', () => {
    expect(run(auth.signupBody, {}).status).toBeUndefined();
    expect(run(auth.loginBody, {}).status).toBeUndefined();
  });

  it('a non-text password or identifier is a 400 instead of a crash', () => {
    expect(run(auth.signupBody, { identifier: 'a@b.com', password: 12345678 })).toEqual({
      status: 400, body: { error: 'password: must be text', field: 'password' },
    });
    expect(error(auth.loginBody, { identifier: { $ne: null }, password: 'x' })).toBe('identifier: must be text');
    expect(error(auth.deleteAccountBody, { password: ['x'] })).toBe('password: must be text');
  });

  it('caps absurdly long values', () => {
    expect(error(auth.signupBody, { firstName: 'x'.repeat(201) })).toBe('firstName: must be 200 characters or fewer');
  });
});

describe('metrics', () => {
  it('normalizes numbers, numeric strings and blanks', () => {
    expect(run(misc.metricsBody, { height: '70', weight: 180, bodyFat: '', maxBench: null }).body).toEqual({
      height: 70, weight: 180, bodyFat: null, maxBench: null, maxSquat: null, maxDeadlift: null,
    });
  });
  it('keeps the existing messages', () => {
    expect(error(misc.metricsBody, { height: 'tall' })).toBe('Height must be a number');
    expect(error(misc.metricsBody, { bodyFat: 101 })).toBe('Body fat must be between 0 and 100');
  });
});

describe('feedback / challenges', () => {
  it('feedback needs type and message', () => {
    expect(error(misc.feedbackBody, { type: 'bug' })).toBe('type and message are required');
    expect(error(misc.feedbackBody, { type: 3, message: 'x' })).toBe('type: must be text');
    expect(run(misc.feedbackBody, { type: 'bug', message: 'hi' }).status).toBeUndefined();
  });
  it('challenge values are whole numbers 1–99999', () => {
    const msg = 'A valid number is required (1–99999)';
    for (const value of [undefined, 0, 100000, 5.5, '50']) expect(error(misc.challengeEntryBody, { value })).toBe(msg);
    expect(run(misc.challengeEntryBody, { value: 50 }).body.value).toBe(50);
  });
});

describe('cardio', () => {
  it('normalizes an entry exactly as before', () => {
    expect(run(misc.cardioBody, {
      cardio_type: ' treadmill ', duration_secs: '1200', distance_m: '', calories: 99.6, avg_heart_rate: '140.2',
      notes: 'n'.repeat(600), metadata: [1], session_id: '12',
    }).body).toEqual({
      cardio_type: 'treadmill', duration_secs: 1200, distance_m: null, calories: 100, avg_heart_rate: 140,
      notes: 'n'.repeat(500), metadata: {}, session_id: 12,
    });
  });
  it('keeps the existing messages', () => {
    expect(error(misc.cardioBody, { cardio_type: 'swimming', duration_secs: 60 })).toBe('Invalid cardio_type');
    expect(error(misc.cardioBody, { cardio_type: 'rowing', duration_secs: 0 }))
      .toBe('duration_secs must be a positive number under 12 hours');
    expect(error(misc.cardioBody, { cardio_type: 'rowing', duration_secs: 60, avg_heart_rate: 300 }))
      .toBe('avg_heart_rate out of plausible range (30-230)');
    expect(error(misc.cardioBody, { cardio_type: 'rowing', duration_secs: 60, session_id: 'x' }))
      .toBe('session_id must be an integer');
  });
});

describe('programs / sharing', () => {
  it('program name and description rules', () => {
    expect(error(misc.createProgramBody, { name: '  ' })).toBe('Program name is required');
    expect(error(misc.createProgramBody, {})).toBe('Program name is required');
    expect(error(misc.renameProgramBody, { name: 'x'.repeat(201) })).toBe('Program name must be 200 characters or fewer');
    expect(error(misc.createProgramBody, { name: 'A', description: 5 })).toBe('Description must be a string');
    expect(run(misc.createProgramBody, { name: 'A', description: null }).status).toBeUndefined();
  });
  it('sharing needs a program/workout and a recipient', () => {
    expect(error(misc.shareProgramBody, { programId: 3 })).toBe('Program and recipient are required');
    expect(error(misc.shareProgramBody, { programId: '', recipientIdentifier: 'sam' })).toBe('Program and recipient are required');
    expect(error(misc.inviteBody, { recipientIdentifier: 'sam' })).toBe('Workout and recipient are required');
    expect(run(misc.shareProgramBody, { programId: '7', recipientIdentifier: 5551234567 }).body)
      .toMatchObject({ programId: 7, recipientIdentifier: '5551234567' });
    expect(error(misc.shareProgramBody, { programId: 'abc', recipientIdentifier: 'sam' })).toBe('programId: must be an id number');
  });
});

describe('community / feed reactions / exercises / push / ai', () => {
  it('community settings', () => {
    expect(error(misc.communitySettingsBody, { category: 'nope', enabled: true })).toBe('Invalid category');
    expect(error(misc.communitySettingsBody, { category: 'pr', enabled: 'yes' })).toBe('enabled must be a boolean');
    expect(error(misc.communitySettingsBody, { category: 'pr', enabled: false, removePast: null })).toBe('removePast must be a boolean');
    expect(run(misc.communitySettingsBody, { category: 'all', enabled: false, removePast: true }).status).toBeUndefined();
    expect(error(misc.communityNotificationsBody, {})).toBe('likes must be a boolean');
  });
  it('feed reactions', () => {
    expect(error(misc.feedReactionBody, { reaction: 'fire' })).toBe('itemId is required');
    expect(error(misc.feedReactionBody, { itemId: 'x'.repeat(513), reaction: 'fire' })).toBe('itemId is required');
    expect(error(misc.feedReactionBody, { itemId: 'pr-1' })).toBe('invalid reaction');
    expect(error(misc.feedReactionBody, { itemId: 'pr-1', reaction: 'meh' })).toBe('invalid reaction');
    expect(run(misc.feedReactionBody, { itemId: 'pr-1', reaction: null }).status).toBeUndefined();
    expect(run(misc.feedReactionBody, { itemId: 'pr-1', reaction: 'clap' }).status).toBeUndefined();
  });
  it('custom exercises', () => {
    expect(error(misc.createExerciseBody, { name: 'Curl' })).toBe('Name and muscle group are required');
    expect(error(misc.createExerciseBody, { name: 7, muscleGroup: 'Arms' })).toBe('name: must be text');
    expect(error(misc.createExerciseBody, { name: 'Curl', muscleGroup: 'Arms', tags: 'arms' })).toBe('tags: must be a list');
  });
  it('push tokens', () => {
    expect(error(misc.pushRegisterBody, {})).toBe('pushToken is required');
    expect(error(misc.pushUnregisterBody, { pushToken: '' })).toBe('pushToken is required');
    expect(run(misc.pushRegisterBody, { pushToken: 'tok', platform: 'android' }).body.platform).toBe('android');
  });
  it('AI swap needs a list of current exercises, if sent', () => {
    expect(error(misc.aiSuggestSwapBody, { exerciseName: 'Curl', currentWorkoutExercises: 'Curl' }))
      .toBe('currentWorkoutExercises: must be a list');
    expect(run(misc.aiSuggestSwapBody, { exerciseName: 'Curl', currentWorkoutExercises: null }).status).toBeUndefined();
  });
});

describe('admin / Trainer Central', () => {
  it('a number where a name belongs is a 400, not a crash', () => {
    expect(error(staff.staffCreateExerciseBody, { name: 5, muscleGroup: 'Chest' })).toBe('name: must be text');
    expect(error(staff.exerciseRenameBody, { name: {} })).toBe('name: must be text');
    expect(run(staff.staffCreateProgramBody, {}).status).toBeUndefined(); // handler says "Program name is required"
  });
  it('a client program keeps what the builder sends', () => {
    const r = run(staff.clientProgramBody, {
      name: 'Block 1',
      workouts: [{ name: 'Day 1', isRest: false, exercises: [{ name: 'Squat', sets: [{ plannedReps: '8', suggestedWeight: '' }] }] }],
    });
    expect(r.status).toBeUndefined();
    expect(r.body.workouts[0].exercises[0].sets[0]).toEqual({ plannedReps: 8, suggestedWeight: null });
    expect(error(staff.clientProgramBody, { name: 'B', workouts: 'x' })).toBe('workouts: must be a list');
    expect(error(staff.assignClientBody, { clientId: 'abc' })).toBe('clientId: must be an id number');
  });
});
