// Request-body schemas (Zod) for the routes that save workout data: sessions,
// schedule and templates (TanStack Query migration, phase 9). A body with the
// wrong shape is rejected with a 400 that names the field, e.g.
//   { error: 'entries.3.reps: must be a whole number' }
// instead of reaching the database and failing as a 500 (or worse, saving
// something half-broken).
//
// The schemas are deliberately lenient about what the app already sends —
// numbers typed into inputs may arrive as strings, and empty inputs as '' or
// null — because a rejected workout save is shown to the user as an error
// and is not retried. They normalize those to numbers, and only refuse what
// the database would refuse or misstore anyway. Unknown fields are kept
// (workout_data is stored as JSON and grows new fields over time).
import { z } from 'zod';

export const MAX_NAME_LEN = 200;
export const MAX_DESCRIPTION_LEN = 5000;
const MAX_EXERCISES_PER_TEMPLATE = 100;
const MAX_ENTRIES_PER_SESSION = 2000;

// Zod error option: 'is required' when the field is missing, else `text`.
export const say = (text) => ({ error: (issue) => (issue.input === undefined ? 'is required' : text) });

export const dateString = z.string(say('must be a date (YYYY-MM-DD)'))
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)');

// A positive whole-number id; a numeric string ("835") is accepted.
export const id = z.preprocess(
  (v) => (typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v),
  z.number(say('must be an id number')).int('must be an id number').positive('must be an id number'),
);

// '' / null / undefined → 0; numeric strings → numbers.
export const toNumber = (v) => {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return v;
};
const amount = z.preprocess(toNumber, z.number({ error: 'must be a number' }).finite('must be a number'));
const wholeNumber = z.preprocess(toNumber, z.number({ error: 'must be a whole number' }).int('must be a whole number'));
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : toNumber(v)),
  z.number({ error: 'must be a number' }).finite('must be a number').nullable(),
);

export const plainObject = (what) => z.record(z.string(), z.unknown(), { error: `must be ${what}` });

// ── Sessions ──

const sessionEntry = z.looseObject({
  exerciseName: z.string(say('must be text')).max(MAX_NAME_LEN, `must be ${MAX_NAME_LEN} characters or fewer`),
  setNumber: z.preprocess(toNumber, z.number({ error: 'must be a whole number' }).int('must be a whole number')),
  weight: amount.optional(),
  reps: wholeNumber.optional(),
  isCompleted: z.boolean({ error: 'must be true or false' }).nullable().optional(),
  cardioMetric: z.string({ error: 'must be text' }).nullable().optional(),
  cardioValue: optionalNumber.optional(),
  setType: z.string({ error: 'must be text' }).nullable().optional(),
}, { error: 'must be an object' });

const workoutData = z.looseObject({
  name: z.string({ error: 'must be text' }).nullable().optional(),
  exercises: z.array(z.looseObject({
    name: z.string({ error: 'must be text' }).nullable().optional(),
    sets: z.array(plainObject('an object'), { error: 'must be a list' }).nullable().optional(),
  }, { error: 'must be an object' }), { error: 'must be a list' }).optional(),
}, { error: 'must be an object' });

// POST /sessions — save a workout day (whole day each time).
export const saveSessionBody = z.looseObject({
  templateId: id,
  date: dateString,
  entries: z.array(sessionEntry, say('must be a list'))
    .min(1, 'must have at least one set')
    .max(MAX_ENTRIES_PER_SESSION, `must have ${MAX_ENTRIES_PER_SESSION} sets or fewer`),
  notes: z.unknown().optional(), // stored as JSON as-is
  workoutData: workoutData.nullable().optional(),
  confirmOverwrite: z.boolean({ error: 'must be true or false' }).optional(),
});

// PUT /sessions/complete — Mark Complete / Undo.
export const completeSessionBody = z.looseObject({
  templateId: id,
  date: dateString,
  completed: z.boolean(say('must be true or false')),
});

// POST /sessions/initialize
export const initializeSessionBody = z.looseObject({
  templateId: id,
  date: dateString,
});

// ── Schedule ──

// PUT /schedule — set days (no templateId and not rest = clear the day).
export const scheduleBody = z.looseObject({
  schedule: z.array(z.looseObject({
    date: dateString,
    templateId: id.nullable().optional(),
    isRest: z.boolean({ error: 'must be true or false' }).optional(),
  }, { error: 'must be an object' }), say('must be a list')),
  programStartId: z.unknown().optional(),
});

// ── Templates ──

// POST /templates and PUT /templates/:id — name, description, exercise list.
export const templateBody = z.looseObject({
  name: z.string({ error: 'Template name is required' })
    .refine((s) => s.trim().length > 0, 'Template name is required')
    .refine((s) => s.length <= MAX_NAME_LEN, `Template name must be ${MAX_NAME_LEN} characters or fewer`),
  description: z.string({ error: 'Description must be a string' })
    .max(MAX_DESCRIPTION_LEN, `Description must be ${MAX_DESCRIPTION_LEN} characters or fewer`)
    .nullable().optional(),
  exercises: z.array(z.looseObject({
    name: z.string({ error: 'must be text' })
      .max(MAX_NAME_LEN, `Exercise name must be ${MAX_NAME_LEN} characters or fewer`).nullable().optional(),
    sets: z.array(plainObject('an object'), { error: 'must be a list' }).nullable().optional(),
  }, { error: 'must be an object' }), { error: 'Exercises must be an array' })
    .max(MAX_EXERCISES_PER_TEMPLATE, `Max ${MAX_EXERCISES_PER_TEMPLATE} exercises per template`)
    .nullable().optional(),
  programId: id.nullable().optional(),
  isRest: z.boolean({ error: 'must be true or false' }).nullable().optional(),
});

// Messages that already read as a full sentence ("Program name is required")
// or already name their field ("duration_secs must be ...") are sent as-is;
// others get the field path in front ("entries.3.reps: must be a whole number").
const SENTENCE = /^[A-Z]/;

export function firstIssueMessage(error) {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';
  const path = issue.path.join('.');
  const field = String(issue.path[issue.path.length - 1] ?? '');
  if (SENTENCE.test(issue.message) || !path || (field && issue.message.startsWith(`${field} `))) return issue.message;
  return `${path}: ${issue.message}`;
}

// Shared field types for the route schemas in schemas/.

// Optional text: missing / null allowed; anything else must be a string.
export const optionalText = (max, label) => z.string({ error: label ? `${label} must be text` : 'must be text' })
  .max(max, label ? `${label} must be ${max} characters or fewer` : `must be ${max} characters or fewer`)
  .nullable().optional();

// Like optionalText, but a number is accepted and turned into text (zip
// codes, phone numbers typed into number-ish inputs).
export const optionalTextish = (max, label) => z.preprocess(
  (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : v),
  z.string({ error: label ? `${label} must be text` : 'must be text' })
    .max(max, label ? `${label} must be ${max} characters or fewer` : `must be ${max} characters or fewer`)
    .nullable(),
).optional();

// Optional number: '' / null / missing → null; numeric strings → numbers.
export const optionalAmount = (label) => z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : toNumber(v)),
  z.number({ error: label ? `${label} must be a number` : 'must be a number' })
    .finite(label ? `${label} must be a number` : 'must be a number').nullable(),
).optional();

// '' / null → missing, then a positive id (numeric strings accepted).
export const optionalId = z.preprocess((v) => (v === '' || v === null ? undefined : v), id.optional());

export const optionalBoolean = z.boolean({ error: 'must be true or false' }).nullable().optional();
export const optionalObject = plainObject('an object').nullable().optional();

// Express middleware: replaces req.body with the parsed (normalized) body, or
// answers 400 naming the first bad field.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: firstIssueMessage(result.error), field: result.error.issues[0]?.path.join('.') || null });
    }
    req.body = result.data;
    next();
  };
}
