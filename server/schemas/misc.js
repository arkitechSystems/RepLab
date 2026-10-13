// Request-body schemas for the smaller route files: metrics, feedback,
// challenges, cardio, programs, sharing, community, feed reactions,
// exercises, push and AI. Same approach as validation.js — the messages are
// the ones these routes already sent, so the app sees no difference except
// that a wrong type is now a 400 naming the field instead of a 500.
//
// Deliberately not validated with a schema (their handlers already check
// everything, or answer in a way a 400 would break):
// - POST /errors/client — accepts whatever a crashing page can send.
// - POST /waitlist — rules depend on whether the caller is signed in.
// - POST /installs, /installs/link, /billing/create-checkout-session —
//   already fully checked in the handler.
// - POST /billing/webhook — raw body, verified by Stripe's signature.
// - /workouts/* dashboard forms — redirect back with a message instead of 400.

import { z } from 'zod';
import {
  optionalId, optionalText, optionalTextish, MAX_NAME_LEN, MAX_DESCRIPTION_LEN,
} from '../validation.js';

// Runs an existing hand-written check inside the schema: `check` returns the
// cleaned value or throws/returns { error } with the message to send.
const fromCheck = (check) => z.unknown().transform((value, ctx) => {
  let result;
  try {
    result = check(value);
  } catch (err) {
    ctx.addIssue({ code: 'custom', message: err.message });
    return z.NEVER;
  }
  if (result && typeof result === 'object' && typeof result.error === 'string') {
    ctx.addIssue({ code: 'custom', message: result.error });
    return z.NEVER;
  }
  return result;
});

// ── Metrics (PUT /metrics) ──

// Accepts a number or numeric string; '' / null / missing clears the field.
export function parseMetric(value, { min = 0, max = 9999, label }) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) throw new Error(`${label} must be a number`);
  if (num < min || num > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return num;
}

export const metricsBody = fromCheck((body) => {
  const b = body && typeof body === 'object' ? body : {};
  return {
    height: parseMetric(b.height, { min: 0, max: 120, label: 'Height' }),
    weight: parseMetric(b.weight, { min: 0, max: 1500, label: 'Weight' }),
    bodyFat: parseMetric(b.bodyFat, { min: 0, max: 100, label: 'Body fat' }),
    maxBench: parseMetric(b.maxBench, { min: 0, max: 2000, label: 'Max bench' }),
    maxSquat: parseMetric(b.maxSquat, { min: 0, max: 2000, label: 'Max squat' }),
    maxDeadlift: parseMetric(b.maxDeadlift, { min: 0, max: 2000, label: 'Max deadlift' }),
  };
});

// ── Feedback (POST /feedback) ──

export const feedbackBody = z.looseObject({
  type: optionalText(100),
  message: optionalText(10000),
}).refine((b) => b.type && b.message, 'type and message are required');

// ── Challenges (POST /challenges/:challenge) ──

const CHALLENGE_VALUE = 'A valid number is required (1–99999)';
export const challengeEntryBody = z.looseObject({
  value: z.number({ error: CHALLENGE_VALUE }).int(CHALLENGE_VALUE).min(1, CHALLENGE_VALUE).max(99999, CHALLENGE_VALUE),
});

// ── Cardio (POST /cardio, PUT /cardio/:id) ──

export const CARDIO_TYPES = new Set([
  'treadmill',
  'elliptical',
  'stationary_bike',
  'stair_master',
  'rowing',
  'assault_bike',
  'jogging',
]);

export function sanitizeCardio(body) {
  const cardio_type = String(body.cardio_type || '').trim();
  if (!CARDIO_TYPES.has(cardio_type)) return { error: 'Invalid cardio_type' };
  const duration_secs = Number(body.duration_secs);
  if (!Number.isFinite(duration_secs) || duration_secs <= 0 || duration_secs > 60 * 60 * 12) {
    return { error: 'duration_secs must be a positive number under 12 hours' };
  }
  const distance_m = body.distance_m == null || body.distance_m === '' ? null : Number(body.distance_m);
  if (distance_m != null && (!Number.isFinite(distance_m) || distance_m < 0)) {
    return { error: 'distance_m must be a non-negative number' };
  }
  const calories = body.calories == null || body.calories === '' ? null : Math.round(Number(body.calories));
  if (calories != null && (!Number.isFinite(calories) || calories < 0)) {
    return { error: 'calories must be a non-negative integer' };
  }
  const avg_heart_rate = body.avg_heart_rate == null || body.avg_heart_rate === ''
    ? null
    : Math.round(Number(body.avg_heart_rate));
  if (avg_heart_rate != null && (!Number.isFinite(avg_heart_rate) || avg_heart_rate < 30 || avg_heart_rate > 230)) {
    return { error: 'avg_heart_rate out of plausible range (30-230)' };
  }
  const notes = body.notes == null ? null : String(body.notes).slice(0, 500);
  const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
    ? body.metadata
    : {};
  const session_id = body.session_id == null || body.session_id === '' ? null : Number(body.session_id);
  if (session_id != null && !Number.isInteger(session_id)) return { error: 'session_id must be an integer' };
  return { cardio_type, duration_secs, distance_m, calories, avg_heart_rate, notes, metadata, session_id };
}

export const cardioBody = fromCheck((body) => sanitizeCardio(body && typeof body === 'object' ? body : {}));

// ── Programs (POST /programs, PUT /programs/:id) ──

const programName = z.string({ error: 'Program name is required' })
  .refine((s) => s.trim().length > 0, 'Program name is required')
  .refine((s) => s.length <= MAX_NAME_LEN, `Program name must be ${MAX_NAME_LEN} characters or fewer`);

export const createProgramBody = z.looseObject({
  name: programName,
  description: z.string({ error: 'Description must be a string' })
    .max(MAX_DESCRIPTION_LEN, `Description must be ${MAX_DESCRIPTION_LEN} characters or fewer`)
    .nullable().optional(),
});

export const renameProgramBody = z.looseObject({ name: programName });

// ── Sharing (POST /sharing/send, POST /sharing/invite) ──

export const shareProgramBody = z.looseObject({
  programId: optionalId,
  recipientIdentifier: optionalTextish(320),
}).refine((b) => b.programId && b.recipientIdentifier, 'Program and recipient are required');

export const inviteBody = z.looseObject({
  templateId: optionalId,
  recipientIdentifier: optionalTextish(320),
}).refine((b) => b.templateId && b.recipientIdentifier, 'Workout and recipient are required');

// ── Community (PUT /community/settings, PUT /community/notifications) ──

// Keep in sync with COMMUNITY_SETTING_KEYS in db.js.
export const COMMUNITY_SETTING_KEYS = new Set(['all', 'pr', 'program', 'workout', 'custom']);

export const communitySettingsBody = z.looseObject({
  category: z.string({ error: 'Invalid category' }).refine((k) => COMMUNITY_SETTING_KEYS.has(k), 'Invalid category'),
  enabled: z.boolean({ error: 'enabled must be a boolean' }),
  removePast: z.boolean({ error: 'removePast must be a boolean' }).optional(),
});

export const communityNotificationsBody = z.looseObject({
  likes: z.boolean({ error: 'likes must be a boolean' }),
});

// ── Feed reactions (PUT /feed-reactions) ──

export const FEED_REACTIONS = new Set(['fire', 'flex', 'hundo', 'clap']);
const MAX_ITEM_ID_LEN = 512; // item ids come from the client, keep bounded

export const feedReactionBody = z.looseObject({
  itemId: z.string({ error: 'itemId is required' })
    .min(1, 'itemId is required')
    .max(MAX_ITEM_ID_LEN, 'itemId is required'),
}).refine((b) => b.reaction === null || FEED_REACTIONS.has(b.reaction), 'invalid reaction');

// ── Exercises (POST /exercises) ──

export const createExerciseBody = z.looseObject({
  name: optionalText(MAX_NAME_LEN),
  muscleGroup: optionalText(100),
  tags: z.array(z.string({ error: 'must be text' }).max(100, 'must be 100 characters or fewer'), { error: 'must be a list' })
    .max(50, 'must have 50 tags or fewer')
    .nullable().optional(),
}).refine((b) => b.name && b.muscleGroup, 'Name and muscle group are required');

// ── Push (POST /push/register, DELETE /push/unregister) ──

const pushToken = z.string({ error: 'pushToken is required' })
  .min(1, 'pushToken is required')
  .max(4096, 'pushToken is too long');

export const pushRegisterBody = z.looseObject({ pushToken });
export const pushUnregisterBody = z.looseObject({ pushToken });

// ── AI (POST /ai/*) ──
// Text fields are cleaned by the route's sanitizePromptInput, which accepts
// any value; only the shapes the handlers depend on are checked here.

export const aiSuggestSwapBody = z.looseObject({
  currentWorkoutExercises: z.array(z.unknown(), { error: 'must be a list' }).nullable().optional(),
});

