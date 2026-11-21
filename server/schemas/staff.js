// Request-body schemas for the JSON routes of the admin and Trainer Central
// pages (routes/admin.js, routes/trainer.js).
//
// These pages already check values against their allowed lists with their
// own messages, so the schemas only add what was missing: a number or object
// where text belongs (which crashed on .trim()), and length limits. The
// handlers keep every existing message.
//
// Not validated with a schema: the HTML form posts (login, password,
// announcements, flags, builds, correspondence, create/edit workout, ...) —
// they redirect back to the page with a message instead of answering 400 —
// and POST /admin/backup/restore, which checks the backup file itself.

import { z } from 'zod';
import {
  optionalId, optionalText, optionalAmount, optionalBoolean, MAX_NAME_LEN, MAX_DESCRIPTION_LEN,
} from '../validation.js';

const MUSCLE = 100;
const VIDEO_ID = 200;

// POST /admin/workout-manager/api/exercises, POST /trainer/api/exercises
export const staffCreateExerciseBody = z.looseObject({
  name: optionalText(MAX_NAME_LEN),
  muscleGroup: optionalText(MUSCLE),
});

// POST /admin/workout-manager/api/programs, POST /trainer/api/programs
export const staffCreateProgramBody = z.looseObject({
  name: optionalText(MAX_NAME_LEN),
  description: optionalText(MAX_DESCRIPTION_LEN),
});

// POST /admin/users/:id/reset-password
export const adminResetPasswordBody = z.looseObject({ password: optionalText(200) });

// PUT /admin/exercise-library/video/:id
export const exerciseVideoBody = z.looseObject({ videoId: optionalText(VIDEO_ID) });

// POST /admin/exercise-library/add
export const exerciseAddBody = z.looseObject({
  name: optionalText(MAX_NAME_LEN),
  muscle: optionalText(MUSCLE),
  videoId: optionalText(VIDEO_ID),
});

// PUT /admin/exercise-library/rename/:id
export const exerciseRenameBody = z.looseObject({ name: optionalText(MAX_NAME_LEN) });

// POST /admin/code-errors/update
export const codeErrorUpdateBody = z.looseObject({ note: optionalText(5000) });

// POST /trainer/api/clients
export const assignClientBody = z.looseObject({ clientId: optionalId });

// POST /trainer/api/clients/:clientId/programs — a program with its workouts.
const clientSet = z.looseObject({
  setType: optionalText(50),
  setNumber: optionalAmount(),
  plannedReps: optionalAmount(),
  suggestedWeight: optionalAmount(),
}, { error: 'must be an object' });

const clientExercise = z.looseObject({
  name: optionalText(MAX_NAME_LEN),
  sets: z.array(clientSet, { error: 'must be a list' }).max(100, 'must have 100 sets or fewer').nullable().optional(),
}, { error: 'must be an object' });

const clientWorkout = z.looseObject({
  name: optionalText(MAX_NAME_LEN),
  description: optionalText(MAX_DESCRIPTION_LEN),
  isRest: optionalBoolean,
  exercises: z.array(clientExercise, { error: 'must be a list' }).max(100, 'Max 100 exercises per workout').nullable().optional(),
}, { error: 'must be an object' });

export const clientProgramBody = z.looseObject({
  name: optionalText(MAX_NAME_LEN),
  description: optionalText(MAX_DESCRIPTION_LEN),
  workouts: z.array(clientWorkout, { error: 'must be a list' }).max(400, 'must have 400 workouts or fewer').nullable().optional(),
});
