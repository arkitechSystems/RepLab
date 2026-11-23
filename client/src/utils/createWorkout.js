// "Create a Workout" built on the workout session screen (create mode).
// Pure helpers so the route and the POST /templates body are tested directly
// (createWorkout.test.js).

export const CREATE_WORKOUT_PATH = '/session/create';

// Route for the create-mode session screen. Everything it needs is in the
// query string, so a reload keeps the name / description / program (the
// exercises typed so far are lost on reload — nothing is saved until Create
// Workout is pressed). `date` (from the Calendar) puts the new workout on
// that day after it's saved.
export function createWorkoutUrl({ name, description, programId, date } = {}) {
  const q = new URLSearchParams();
  q.set('name', (name || '').trim());
  if (description && description.trim()) q.set('description', description.trim());
  if (programId) q.set('programId', String(programId));
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) q.set('date', date);
  return `${CREATE_WORKOUT_PATH}?${q.toString()}`;
}

export function parseCreateWorkoutParams(search) {
  const q = new URLSearchParams(search || '');
  const programId = Number(q.get('programId'));
  const date = q.get('date');
  return {
    name: (q.get('name') || '').trim(),
    description: (q.get('description') || '').trim(),
    programId: Number.isInteger(programId) && programId > 0 ? programId : null,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  };
}

// Programs a new workout can go in: the user's own (userId set), minus the
// auto-created "My Workouts" bucket (no program = My Workouts) and library
// programs (userId null).
export function ownProgramChoices(programs) {
  return (programs || []).filter((p) => p && p.userId != null && (p.name || '').trim().toLowerCase() !== 'my workouts');
}

const positive = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// POST /templates body from the session screen's state.
//  - exercises: the screen's template.exercises (section headers included)
//  - entries:   { [exerciseKey]: [{ weight, reps, setType }, ...] }
//  - goals:     goalOverrides, same keys ({ weight, reps } per set) — used
//               when a set's weight / reps box was left blank
//  - keyFor:    WorkoutSession's exKey(exercises, ex, idx)
// Each set's entered weight and reps become the template's goal weight
// (suggestedWeight, sent as `weight`) and goal reps (plannedReps, sent as
// `reps`); bodyweight / blank weight is 0. Blank reps fall back to the set's
// planned reps (the server's default is 10). Set types, section headers and
// superset labels are kept.
export function buildCreateWorkoutBody({ name, description, programId, exercises, entries, goals, keyFor }) {
  const list = (exercises || []).map((ex, idx) => {
    if (ex.isSectionHeader) {
      return { name: ex.name, isSectionHeader: true, sectionNotes: ex.sectionNotes || '', sets: [] };
    }
    const key = keyFor(exercises, ex, idx);
    const exEntries = entries?.[key] || [];
    const exGoals = goals?.[key] || [];
    // Exercise type = the most common set type (ties: the first set's), so a
    // warm-up first set doesn't make the whole exercise a warm-up.
    const types = (ex.sets || []).map((s, i) => exEntries[i]?.setType || s.setType || ex.setType || 'straight');
    const counts = new Map();
    types.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
    let setType = types[0] || ex.setType || 'straight';
    for (const [t, n] of counts) if (n > counts.get(setType)) setType = t;
    return {
      name: ex.name,
      setType,
      ...(ex.supersetLabel ? { supersetLabel: ex.supersetLabel } : {}),
      sets: (ex.sets || []).map((s, i) => {
        const e = exEntries[i] || {};
        const g = exGoals[i] || {};
        const weight = positive(e.weight) ?? positive(g.weight) ?? 0;
        const reps = positive(e.reps) ?? positive(g.reps) ?? positive(s.plannedReps) ?? 10;
        return {
          reps: Math.round(reps),
          weight,
          setType: e.setType || s.setType || setType,
        };
      }),
    };
  }).filter((ex) => (ex.name || '').trim());

  return {
    name: (name || '').trim(),
    description: (description || '').trim(),
    exercises: list,
    ...(programId ? { programId: Number(programId) } : { saveToMyWorkouts: true }),
  };
}

export function hasRealExercise(exercises) {
  return (exercises || []).some((ex) => !ex.isSectionHeader && (ex.name || '').trim());
}
