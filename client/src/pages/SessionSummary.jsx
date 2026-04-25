import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { exKey, WorkoutSummary } from './WorkoutSession';

// Re-creates the post-workout WorkoutSummary modal for a previously-completed
// session, given its id. Loads /sessions/:id, reshapes the flat entry array
// into the Record<exerciseKey, [{weight, reps, setType}]> shape WorkoutSummary
// expects, and rebuilds the completedSets Set from the is_completed flags.

function formatTimeFromSeconds(secs) {
  if (!secs || secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SessionSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api(`/sessions/${id}`, { signal: controller.signal })
      .then(setData)
      .catch((err) => { if (err.name !== 'AbortError') setError('Failed to load summary'); });
    return () => controller.abort();
  }, [id]);

  if (error) {
    return (
      <div className="px-4 pt-12 text-center">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={() => navigate(-1)} className="text-wf-cyan text-sm">Back</button>
      </div>
    );
  }

  if (!data) return null;

  const wd = data.workoutData || { name: data.templateName || 'Workout', exercises: [] };

  // The WorkoutSummary expects:
  //   template:     { id, name, exercises: [...] }
  //   entries:      Record<exerciseKey, Array<{weight, reps, setType}>>
  //   completedSets: Set<string>  ("exerciseKey-setIdx" for each completed set)
  //
  // session_entries is a flat list keyed by exerciseName. Multiple exercises
  // with the same name (rare, but possible — e.g. dropsets) are de-duped via
  // exKey() which appends ::1, ::2 to repeats in the same workout.
  const template = {
    id: data.templateId ?? Number(id),
    name: wd.name || data.templateName || 'Workout',
    exercises: wd.exercises || [],
  };

  const entries = {};
  const completedSets = new Set();
  // Group server entries by exerciseName, then walk the workout's exercises
  // in order so multiple instances of the same exercise consume the right
  // slice of the server-side entries (mirrors the restore logic in
  // WorkoutSession.jsx).
  const byExercise = new Map();
  for (const e of data.entries || []) {
    if (!byExercise.has(e.exerciseName)) byExercise.set(e.exerciseName, []);
    byExercise.get(e.exerciseName).push(e);
  }
  for (const [, list] of byExercise) {
    list.sort((a, b) => a.setNumber - b.setNumber);
  }
  const consumed = {};
  for (let exIdx = 0; exIdx < template.exercises.length; exIdx++) {
    const ex = template.exercises[exIdx];
    if (ex.isSectionHeader) continue;
    const key = exKey(template.exercises, ex, exIdx);
    const allSaved = byExercise.get(ex.name) || [];
    const start = consumed[ex.name] || 0;
    const setCount = ex.sets?.length || 0;
    const slice = allSaved.slice(start, start + setCount);
    consumed[ex.name] = start + setCount;
    entries[key] = slice.map((s, i) => {
      if (s.isCompleted) completedSets.add(`${key}-${i}`);
      const setType = ex.sets?.[i]?.setType || ex.setType || 'straight';
      return { weight: s.weight ?? '', reps: s.reps ?? '', setType };
    });
    // Pad with empty entries if the workout had more sets defined than logged
    while (entries[key].length < setCount) {
      const i = entries[key].length;
      const setType = ex.sets?.[i]?.setType || ex.setType || 'straight';
      entries[key].push({ weight: '', reps: '', setType });
    }
  }

  return (
    <WorkoutSummary
      template={template}
      programName={data.programName || ''}
      entries={entries}
      completedSets={completedSets}
      elapsed={data.elapsedSecs || 0}
      formatTime={formatTimeFromSeconds}
      onClose={() => navigate(-1)}
    />
  );
}
