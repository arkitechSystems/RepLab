import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseCard from '../components/ExerciseCard';
import UndoToast from '../components/UndoToast';

// Neumorphic theme constants
const N = {
  bg: '#e0e5ec',
  raised: '8px 8px 16px #b8bec7, -8px -8px 16px #ffffff',
  raisedSm: '4px 4px 8px #b8bec7, -4px -4px 8px #ffffff',
  inset: 'inset 3px 3px 6px #b8bec7, inset -3px -3px 6px #ffffff',
  insetSm: 'inset 2px 2px 4px #b8bec7, inset -2px -2px 4px #ffffff',
  dark: '#3a4255',
  muted: '#8a95a5',
  accent: '#5b6abf',
  gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
};

function exKey(exercises, exerciseOrName, idx) {
  const name = typeof exerciseOrName === 'string' ? exerciseOrName : exerciseOrName.name;
  let occurrence = 0;
  for (let i = 0; i < idx; i++) {
    if (!exercises[i].isSectionHeader && exercises[i].name === name) occurrence++;
  }
  return occurrence > 0 ? `${name}::${occurrence}` : name;
}
function exNameFromKey(key) {
  const sep = key.lastIndexOf('::');
  return sep > 0 ? key.slice(0, sep) : key;
}
function findExIdx(exercises, key) {
  for (let i = 0; i < exercises.length; i++) {
    if (!exercises[i].isSectionHeader && exKey(exercises, exercises[i], i) === key) return i;
  }
  return -1;
}

const CHEST_ONE_TEMPLATE = {
  name: 'Chest One',
  exercises: [
    { name: 'WARM UP', isSectionHeader: true, sectionNotes: '5 min incline walk, arm circles, band pull-aparts', sets: [] },
    { name: 'Flat Dumbbell Press', setType: 'warm_up', sets: [
      { setNumber: 1, plannedReps: 15, suggestedWeight: 30 },
      { setNumber: 2, plannedReps: 12, suggestedWeight: 40 },
    ]},
    { name: 'HYPERTROPHY — HIGH VOLUME', isSectionHeader: true, sectionNotes: 'Controlled reps, 60-90s rest between sets', sets: [] },
    { name: 'Flat Dumbbell Press', setType: 'straight', sets: [
      { setNumber: 1, plannedReps: 10, suggestedWeight: 75 },
      { setNumber: 2, plannedReps: 10, suggestedWeight: 75 },
      { setNumber: 3, plannedReps: 10, suggestedWeight: 75 },
      { setNumber: 4, plannedReps: 8, suggestedWeight: 80 },
    ]},
    { name: 'Incline Barbell Press', setType: 'straight', sets: [
      { setNumber: 1, plannedReps: 10, suggestedWeight: 135 },
      { setNumber: 2, plannedReps: 10, suggestedWeight: 135 },
      { setNumber: 3, plannedReps: 8, suggestedWeight: 145 },
    ]},
    { name: 'Cable Fly', setType: 'straight', sets: [
      { setNumber: 1, plannedReps: 12, suggestedWeight: 30 },
      { setNumber: 2, plannedReps: 12, suggestedWeight: 30 },
      { setNumber: 3, plannedReps: 12, suggestedWeight: 30 },
    ]},
    { name: 'BURNOUT', isSectionHeader: true, sectionNotes: 'Minimal rest, chase the pump', sets: [] },
    { name: 'Pec Deck', setType: 'drop', sets: [
      { setNumber: 1, plannedReps: 15, suggestedWeight: 120 },
      { setNumber: 2, plannedReps: 12, suggestedWeight: 100 },
      { setNumber: 3, plannedReps: 10, suggestedWeight: 80 },
    ]},
    { name: 'Push Ups', setType: 'straight', sets: [
      { setNumber: 1, plannedReps: 20, suggestedWeight: 0 },
      { setNumber: 2, plannedReps: 15, suggestedWeight: 0 },
    ]},
  ],
};

export default function NeumorphicSessionTest() {
  const navigate = useNavigate();
  const [template, setTemplate] = useState(CHEST_ONE_TEMPLATE);
  const [entries, setEntries] = useState({});
  const [completedSets, setCompletedSets] = useState(new Set());
  const [autoFilled, setAutoFilled] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [undoToast, setUndoToast] = useState(null);
  const [pbs] = useState({});
  const exerciseRefs = useRef({});
  const scrollToExercise = useRef(null);

  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [inputsLocked, setInputsLocked] = useState(true);
  const [structureLocked] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restDuration, setRestDuration] = useState(90);

  useEffect(() => {
    const initial = {};
    template.exercises.forEach((ex, idx) => {
      if (ex.isSectionHeader) return;
      const key = exKey(template.exercises, ex, idx);
      initial[key] = ex.sets.map((s) => ({
        weight: s.suggestedWeight || '',
        reps: '',
        setType: s.setType || ex.setType || 'straight',
      }));
    });
    setEntries(initial);
  }, []);

  useEffect(() => {
    if (!timerStarted || isCompleted) return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [timerStarted, isCompleted]);

  useEffect(() => {
    if (!restRunning || restSeconds <= 0) return;
    const t = setTimeout(() => setRestSeconds(s => s - 1), 1000);
    if (restSeconds <= 1) setRestRunning(false);
    return () => clearTimeout(t);
  }, [restRunning, restSeconds]);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function startTimer() {
    if (!timerStarted) { setTimerStarted(true); setInputsLocked(false); }
  }

  function startRestTimer() { setRestSeconds(restDuration); setRestRunning(true); }

  function handleChange(exerciseName, setIdx, field, value) {
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseName] = [...(updated[exerciseName] || [])];
      updated[exerciseName][setIdx] = {
        ...updated[exerciseName][setIdx],
        [field]: field === 'setType' ? value : (value === -1 ? -1 : value === '' ? '' : Math.max(0, Number(value))),
      };
      return updated;
    });
  }

  function handleBlur() {}

  function handleToggleComplete(exerciseKey, setIdx) {
    const key = `${exerciseKey}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); if (navigator.vibrate) navigator.vibrate(15); startTimer(); startRestTimer(); }
      return next;
    });
  }

  function handleAddSet(exerciseKey) {
    const tIdx = findExIdx(template.exercises, exerciseKey);
    if (tIdx < 0) return;
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[tIdx], sets: [...exercises[tIdx].sets] };
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets.push({ setNumber: ex.sets.length + 1, plannedReps: lastSet?.plannedReps || 10, suggestedWeight: lastSet?.suggestedWeight || 0 });
      exercises[tIdx] = ex;
      return { ...prev, exercises };
    });
    setEntries((prev) => ({ ...prev, [exerciseKey]: [...(prev[exerciseKey] || []), { weight: '', reps: '' }] }));
  }

  function handleDeleteSet(exerciseKey, setIdx) {
    const tIdx = findExIdx(template.exercises, exerciseKey);
    if (tIdx < 0) return;
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      exercises[tIdx] = { ...exercises[tIdx], sets: exercises[tIdx].sets.filter((_, i) => i !== setIdx) };
      return { ...prev, exercises };
    });
    setEntries((prev) => ({ ...prev, [exerciseKey]: (prev[exerciseKey] || []).filter((_, i) => i !== setIdx) }));
    setCompletedSets((prev) => { const n = new Set(); for (const k of prev) { if (!k.startsWith(exerciseKey + '-')) n.add(k); } return n; });
  }

  function handleNoteChange(exerciseKey, value) { setNotes((prev) => ({ ...prev, [exerciseKey]: value })); }

  function handleSwapExercise(oldKey, newName) {
    const tIdx = findExIdx(template.exercises, oldKey);
    if (tIdx < 0) return;
    const numSets = template.exercises[tIdx]?.sets?.length || 0;
    const newExercises = template.exercises.map((ex, i) => i === tIdx ? { ...ex, name: newName } : ex);
    const newKey = exKey(newExercises, newName, tIdx);
    setTemplate((prev) => ({ ...prev, exercises: prev.exercises.map((ex, i) => i === tIdx ? { ...ex, name: newName, sets: ex.sets.map(s => ({ ...s, plannedReps: '', suggestedWeight: 0 })) } : ex) }));
    setEntries((prev) => { const u = { ...prev }; delete u[oldKey]; u[newKey] = Array.from({ length: numSets }, () => ({ weight: '', reps: '' })); return u; });
    setNotes((prev) => { const u = { ...prev }; delete u[oldKey]; return u; });
    setCompletedSets((prev) => { const n = new Set(); for (const k of prev) { if (!k.startsWith(oldKey + '-')) n.add(k); } return n; });
  }

  function handleAddExercise(name, afterIndex) {
    if (!name?.trim()) return;
    const exerciseName = name.trim();
    const newExercise = { name: exerciseName, sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 0 }] };
    const newExercises = [...template.exercises];
    const insertIdx = afterIndex !== undefined ? afterIndex + 1 : newExercises.length;
    newExercises.splice(insertIdx, 0, newExercise);
    const newKey = exKey(newExercises, exerciseName, insertIdx);
    setTemplate((prev) => { const exercises = [...prev.exercises]; exercises.splice(insertIdx, 0, newExercise); return { ...prev, exercises }; });
    setEntries((prev) => ({ ...prev, [newKey]: [{ weight: '', reps: '' }] }));
    scrollToExercise.current = insertIdx;
  }

  function handleDeleteExercise(exerciseKey) {
    const exerciseIdx = findExIdx(template.exercises, exerciseKey);
    if (exerciseIdx < 0) return;
    const exerciseData = template.exercises[exerciseIdx];
    const exerciseEntries = entries[exerciseKey];
    setTemplate((prev) => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== exerciseIdx) }));
    setEntries((prev) => { const u = { ...prev }; delete u[exerciseKey]; return u; });
    setCompletedSets((prev) => { const n = new Set(); for (const k of prev) { if (!k.startsWith(exerciseKey + '-')) n.add(k); } return n; });
    setUndoToast({
      type: 'exercise', exerciseName: exerciseKey, exerciseIndex: exerciseIdx,
      message: `Deleted ${exNameFromKey(exerciseKey)}`,
      undoFn: () => {
        setTemplate((prev) => { const exercises = [...prev.exercises]; exercises.splice(exerciseIdx, 0, exerciseData); return { ...prev, exercises }; });
        if (exerciseEntries) setEntries((prev) => ({ ...prev, [exerciseKey]: exerciseEntries }));
      },
    });
  }

  function handleMoveExercise(fromIdx, toIdx) {
    setTemplate((prev) => { const exercises = [...prev.exercises]; const [moved] = exercises.splice(fromIdx, 1); exercises.splice(toIdx, 0, moved); return { ...prev, exercises }; });
  }

  const totalSets = template.exercises.filter(ex => !ex.isSectionHeader).reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  const completedCount = completedSets.size;
  const progressPct = totalSets > 0 ? Math.round((completedCount / totalSets) * 100) : 0;

  return (
    <div className="pb-24" style={{ background: N.bg, minHeight: '100vh' }}>
      {/* Back button */}
      <div className="px-4 pt-6 mb-4">
        <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-sm font-semibold active:opacity-70" style={{ color: N.accent }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      {/* Header */}
      <div className="px-4 mb-4">
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: N.dark, letterSpacing: '-0.5px' }}>{template.name}</h1>
        <p style={{ fontSize: '12px', color: N.muted, marginTop: '2px' }}>Test Session · Will's Hypertrophy Program</p>
      </div>

      {/* Timer Card */}
      <div className="mx-4 mb-4" style={{ background: N.bg, borderRadius: '20px', boxShadow: N.raised, padding: '16px' }}>
        {/* Workout Timer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: timerStarted ? '#667eea' : '#ccc', boxShadow: timerStarted ? '0 0 8px rgba(102,126,234,0.5)' : 'none' }} />
            <span style={{ fontSize: '10px', color: N.muted, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700 }}>Workout</span>
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: N.dark }}>{formatTime(elapsed)}</span>
        </div>

        {/* Rest Timer */}
        <div style={{ background: N.bg, borderRadius: '12px', boxShadow: N.insetSm, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: restRunning ? '#764ba2' : '#ccc', boxShadow: restRunning ? '0 0 8px rgba(118,75,162,0.5)' : 'none' }} />
            <span style={{ fontSize: '10px', color: N.muted, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700 }}>Rest</span>
          </div>
          {restRunning ? (
            <span style={{ fontSize: '18px', fontWeight: 800, color: N.dark }}>{formatTime(restSeconds)}</span>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              {[60, 90, 120].map(s => (
                <button key={s} onClick={() => { setRestDuration(s); setRestSeconds(s); setRestRunning(true); }} style={{
                  padding: '5px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 700,
                  color: restDuration === s ? N.accent : N.muted,
                  background: N.bg,
                  boxShadow: restDuration === s ? N.raisedSm : N.insetSm,
                  transition: 'all 0.2s',
                }}>{s}s</button>
              ))}
            </div>
          )}
        </div>

        {/* Begin / Progress */}
        {!timerStarted ? (
          <button onClick={startTimer} style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
            background: N.gradient, color: 'white', fontSize: '14px', fontWeight: 700,
            cursor: 'pointer', boxShadow: '4px 4px 10px #b8bec7',
          }} className="active:scale-[0.98] transition-all">
            Begin Workout
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', color: N.muted, fontWeight: 600 }}>
              <span>{completedCount}/{totalSets} sets</span>
              <span style={{ color: N.accent }}>{progressPct}%</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: N.bg, boxShadow: N.insetSm, position: 'relative' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, borderRadius: '4px', background: N.gradient, transition: 'width 0.5s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Exercise Cards */}
      <div className="px-4">
        {template.exercises.map((exercise, idx) => {
          const eKey = exercise.isSectionHeader ? null : exKey(template.exercises, exercise, idx);
          const wrapCb = (fn) => fn ? (_name, ...args) => fn(eKey, ...args) : undefined;
          return (
          <div key={exercise.isSectionHeader ? `section-${idx}` : eKey}>
            {undoToast && undoToast.type === 'exercise' && undoToast.exerciseIndex === idx && (
              <UndoToast message={undoToast.message} onUndo={() => { undoToast.undoFn(); setUndoToast(null); }} onExpire={() => setUndoToast(null)} />
            )}
            {exercise.isSectionHeader ? (
            <div className="mb-3" style={{ animationDelay: `${idx * 60}ms` }}>
              <div style={{
                borderRadius: '16px', background: N.bg, boxShadow: N.raisedSm, overflow: 'hidden',
                borderLeft: `4px solid ${N.accent}`,
              }}>
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '9px', color: N.accent, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 800 }}>Section</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: N.dark, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{exercise.name}</span>
                </div>
                {exercise.sectionNotes && (
                  <div style={{ padding: '0 16px 12px 46px' }}>
                    <p style={{ fontSize: '11px', color: N.muted, lineHeight: 1.5 }}>{exercise.sectionNotes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div ref={(el) => { exerciseRefs.current[eKey] = el; if (el && scrollToExercise.current === idx) { scrollToExercise.current = null; setTimeout(() => { const target = el.getBoundingClientRect().top + window.scrollY; const start = window.scrollY; const dist = target - start; const duration = 600; let t0 = null; function step(ts) { if (!t0) t0 = ts; const p = Math.min((ts - t0) / duration, 1); const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; window.scrollTo(0, start + dist * ease); if (p < 1) requestAnimationFrame(step); } requestAnimationFrame(step); }, 50); } }} className="fade-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <ExerciseCard
              exercise={exercise}
              exerciseKey={eKey}
              entries={entries[eKey]}
              pbs={pbs}
              readOnly={structureLocked}
              inputsLocked={inputsLocked}
              onLockedTap={inputsLocked ? () => {} : undefined}
              onChange={inputsLocked ? undefined : wrapCb(handleChange)}
              onBlur={inputsLocked ? undefined : wrapCb(handleBlur)}
              completedSets={completedSets}
              autoFilled={autoFilled}
              onToggleComplete={inputsLocked ? undefined : wrapCb(handleToggleComplete)}
              onAddSet={structureLocked ? undefined : wrapCb(handleAddSet)}
              onDeleteSet={structureLocked ? undefined : wrapCb(handleDeleteSet)}
              onSwapExercise={structureLocked ? undefined : (_oldName, newName) => handleSwapExercise(eKey, newName)}
              onAddExercise={structureLocked ? undefined : (name) => handleAddExercise(name, idx)}
              onDeleteExercise={structureLocked ? undefined : () => handleDeleteExercise(eKey)}
              onMoveUp={structureLocked ? undefined : (idx > 0 ? () => handleMoveExercise(idx, idx - 1) : undefined)}
              onMoveDown={structureLocked ? undefined : (idx < template.exercises.length - 1 ? () => handleMoveExercise(idx, idx + 1) : undefined)}
              note={notes[eKey] || ''}
              onNoteChange={inputsLocked ? undefined : (_name, value) => handleNoteChange(eKey, value)}
              allWorkoutExercises={template.exercises.map(e => e.name)}
            />
          </div>
          )}
          {undoToast && undoToast.type === 'exercise' && undoToast.exerciseIndex >= template.exercises.length && idx === template.exercises.length - 1 && (
            <div className="fixed bottom-28 left-4 right-4 z-50">
              <UndoToast message={undoToast.message} onUndo={() => { undoToast.undoFn(); setUndoToast(null); }} onExpire={() => setUndoToast(null)} />
            </div>
          )}
          </div>
          );
        })}
      </div>

      {/* Mark Complete */}
      {timerStarted && !isCompleted && (
        <div className="px-4 mt-6">
          <button onClick={() => { if (completedCount === 0) { alert('Complete at least one set first'); return; } setIsCompleted(true); }}
            style={{
              width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
              background: N.gradient, color: 'white', fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', boxShadow: '6px 6px 12px #b8bec7',
            }} className="active:scale-[0.98] transition-all">
            Mark Complete — {completedCount}/{totalSets} sets
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="px-4 mt-6">
          <div style={{ background: N.bg, borderRadius: '24px', boxShadow: N.raised, padding: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '42px', fontWeight: 800, color: N.accent }}>Done</div>
            <div style={{ fontSize: '12px', color: N.muted, marginTop: '4px' }}>{completedCount} sets · {formatTime(elapsed)}</div>
            <button onClick={() => navigate('/test')} style={{
              marginTop: '20px', padding: '12px 24px', borderRadius: '14px', border: 'none',
              background: N.gradient, color: 'white', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', boxShadow: '4px 4px 10px #b8bec7',
            }} className="active:scale-[0.98] transition-all">
              Back to Test Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
