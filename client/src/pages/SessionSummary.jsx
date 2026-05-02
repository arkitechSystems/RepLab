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
      <div className="min-h-screen bg-black px-4 pt-12 pb-24">
        <div
          className="relative overflow-hidden fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div
            className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }}
          />
          <div className="relative p-6 text-center">
            <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
              Error
            </p>
            <h2 className="text-[28px] font-black text-white tracking-tight mb-4" style={{ letterSpacing: '-0.02em', lineHeight: '0.95' }}>
              {error}
            </h2>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center px-6 py-3 text-[11px] uppercase font-bold text-wf-red border border-wf-red/40 hover:bg-wf-red/10 active:scale-95 transition"
              style={{ borderRadius: '2px', letterSpacing: '0.25em' }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black px-4 pt-12 pb-24">
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div
            className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }}
          />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
              Summary
            </p>
            <div className="h-8 w-2/3 mb-6 animate-pulse" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }} />
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="h-4 w-1/2 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }} />
              <div className="h-4 w-3/4 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }} />
              <div className="h-4 w-2/5 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }} />
              <div className="h-4 w-3/5 animate-pulse" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
      sessionDate={typeof data.date === 'string' ? data.date.slice(0, 10) : null}
      onClose={() => navigate(-1)}
    />
  );
}
