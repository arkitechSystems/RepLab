import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ExerciseCard from '../components/ExerciseCard';
import { useExercises } from '../hooks/useExercises';
import StickyHeader from '../components/StickyHeader';
import UndoToast from '../components/UndoToast';

// Unique key helper (same as WorkoutSession)
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

// Hardcoded "Chest One" workout — completely independent of any real data
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

export default function NewWorkoutSessionTest() {
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

  // Timers
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [inputsLocked, setInputsLocked] = useState(true);
  const [structureLocked, setStructureLocked] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Rest timer
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restDuration, setRestDuration] = useState(90);

  // Breathing phase for organic blob animations
  const [breathPhase, setBreathPhase] = useState(0);

  // Initialize entries from template
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

  // Workout timer
  useEffect(() => {
    if (!timerStarted || isCompleted) return;
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [timerStarted, isCompleted]);

  // Rest timer
  useEffect(() => {
    if (!restRunning || restSeconds <= 0) return;
    const t = setTimeout(() => setRestSeconds(s => s - 1), 1000);
    if (restSeconds <= 1) setRestRunning(false);
    return () => clearTimeout(t);
  }, [restRunning, restSeconds]);

  // Breathing animation
  useEffect(() => {
    const interval = setInterval(() => setBreathPhase(p => (p + 1) % 100), 80);
    return () => clearInterval(interval);
  }, []);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function startTimer() {
    if (!timerStarted) {
      setTimerStarted(true);
      setInputsLocked(false);
    }
  }

  function startRestTimer() {
    setRestSeconds(restDuration);
    setRestRunning(true);
  }

  // Handlers
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
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (navigator.vibrate) navigator.vibrate(15);
        startTimer();
        startRestTimer();
      }
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
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseKey] = [...(updated[exerciseKey] || []), { weight: '', reps: '' }];
      return updated;
    });
  }

  function handleDeleteSet(exerciseKey, setIdx) {
    const tIdx = findExIdx(template.exercises, exerciseKey);
    if (tIdx < 0) return;
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      const ex = { ...exercises[tIdx], sets: exercises[tIdx].sets.filter((_, i) => i !== setIdx) };
      exercises[tIdx] = ex;
      return { ...prev, exercises };
    });
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseKey] = (updated[exerciseKey] || []).filter((_, i) => i !== setIdx);
      return updated;
    });
    setCompletedSets((prev) => {
      const next = new Set();
      for (const k of prev) {
        if (!k.startsWith(exerciseKey + '-')) next.add(k);
      }
      return next;
    });
  }

  function handleNoteChange(exerciseKey, value) {
    setNotes((prev) => ({ ...prev, [exerciseKey]: value }));
  }

  function handleSwapExercise(oldKey, newName) {
    const tIdx = findExIdx(template.exercises, oldKey);
    if (tIdx < 0) return;
    const numSets = template.exercises[tIdx]?.sets?.length || 0;
    const newExercises = template.exercises.map((ex, i) => i === tIdx ? { ...ex, name: newName } : ex);
    const newKey = exKey(newExercises, newName, tIdx);
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => i === tIdx ? { ...ex, name: newName, sets: ex.sets.map(s => ({ ...s, plannedReps: '', suggestedWeight: 0 })) } : ex),
    }));
    setEntries((prev) => {
      const updated = { ...prev };
      delete updated[oldKey];
      updated[newKey] = Array.from({ length: numSets }, () => ({ weight: '', reps: '' }));
      return updated;
    });
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
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      exercises.splice(insertIdx, 0, newExercise);
      return { ...prev, exercises };
    });
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
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      const [moved] = exercises.splice(fromIdx, 1);
      exercises.splice(toIdx, 0, moved);
      return { ...prev, exercises };
    });
  }

  const totalSets = template.exercises.filter(ex => !ex.isSectionHeader).reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  const completedCount = completedSets.size;
  const progressPct = totalSets > 0 ? Math.round((completedCount / totalSets) * 100) : 0;

  // Purple theme colors
  const purple = 'rgba(139,92,246';
  const blue = 'rgba(59,130,246';

  return (
    <div className="pb-24" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a1628 100%)', minHeight: '100vh' }}>
      {/* Back button */}
      <div className="px-4 pt-6 mb-2">
        <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-sm font-medium active:opacity-70" style={{ color: `${purple},0.7)` }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      {/* Animated bars decoration — runs when timer started */}
      {timerStarted && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', padding: '0 16px', marginBottom: '8px', overflow: 'hidden' }}>
          {Array.from({ length: 60 }, (_, i) => {
            const h = 4 + Math.sin((breathPhase + i * 2) * 0.1) * 12;
            return (
              <div key={i} style={{
                width: '100%',
                maxWidth: '5px',
                height: `${h}px`,
                borderRadius: '2px',
                background: `linear-gradient(to top, ${purple},${0.3 + (h / 30)}), ${blue},${0.3 + (h / 30)}))`,
                transition: 'height 0.08s linear',
              }} />
            );
          })}
        </div>
      )}

      <StickyHeader
        title={template.name}
        subtitle="Test Session · Will's Hypertrophy Program"
        bottomContent={(collapsed) => (
          <div className="mt-2">
            {/* Workout Timer */}
            <div className="rounded-t-lg overflow-hidden" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', borderBottom: 'none' }}>
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: timerStarted ? '#a78bfa' : '#333', boxShadow: timerStarted ? '0 0 8px rgba(167,139,250,0.5)' : 'none' }} />
                  <span style={{ fontSize: '10px', color: `${purple},0.5)`, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>Workout</span>
                </div>
                <span style={{ fontSize: '18px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px', textShadow: '0 0 12px rgba(139,92,246,0.4)' }}>{formatTime(elapsed)}</span>
              </div>
            </div>

            {/* Rest Timer */}
            <div className="rounded-b-lg overflow-hidden" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(139,92,246,0.12)', borderTop: '1px solid rgba(139,92,246,0.06)' }}>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: restRunning ? '#60a5fa' : '#333', boxShadow: restRunning ? '0 0 8px rgba(96,165,250,0.5)' : 'none' }} />
                  <span style={{ fontSize: '10px', color: `${blue},0.5)`, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>Rest</span>
                </div>
                <div className="flex items-center gap-3">
                  {restRunning ? (
                    <span style={{ fontSize: '18px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px', textShadow: '0 0 12px rgba(59,130,246,0.4)' }}>{formatTime(restSeconds)}</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {[60, 90, 120].map(s => (
                        <button key={s} onClick={() => { setRestDuration(s); setRestSeconds(s); setRestRunning(true); }}
                          style={{
                            padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: restDuration === s ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                            color: restDuration === s ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                          }}>
                          {s}s
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Begin / Progress */}
            {!timerStarted ? (
              <button onClick={startTimer} style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none', marginTop: '12px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))',
                color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 0 20px rgba(139,92,246,0.3)',
              }} className="active:scale-[0.98] transition-all">
                Begin Workout
              </button>
            ) : (
              <div className="mt-3">
                <div className="flex justify-between mb-1" style={{ fontSize: '11px', color: `${purple},0.5)` }}>
                  <span>{completedCount}/{totalSets} sets</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.1)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))' }} />
                </div>
              </div>
            )}
          </div>
        )}
      />

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
            <div className="fade-slide-up mb-3" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.15)', background: 'linear-gradient(90deg, rgba(139,92,246,0.08), transparent)' }}>
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-1 h-6 rounded-full shrink-0" style={{ background: '#8b5cf6' }} />
                  <span style={{ fontSize: '9px', color: `${purple},0.6)`, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700 }}>Section</span>
                  <span className="text-sm font-black text-white uppercase tracking-wide">{exercise.name}</span>
                </div>
                {exercise.sectionNotes && (
                  <div className="px-4 pb-3 pl-8">
                    <div className="ml-0.5 pl-3" style={{ borderLeft: '1px solid rgba(139,92,246,0.15)' }}>
                      <p style={{ fontSize: '12px', color: 'rgba(167,139,250,0.5)', lineHeight: 1.5 }}>{exercise.sectionNotes}</p>
                    </div>
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
            {undoToast && undoToast.type === 'set' && undoToast.exerciseName === eKey && (
              <UndoToast message={undoToast.message} onUndo={() => { undoToast.undoFn(); setUndoToast(null); }} onExpire={() => setUndoToast(null)} />
            )}
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
          <button
            onClick={() => {
              if (completedCount === 0) { alert('Complete at least one set first'); return; }
              setIsCompleted(true);
            }}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))',
              color: 'white', fontSize: '16px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 0 20px rgba(139,92,246,0.3)',
            }}
            className="active:scale-[0.98] transition-all"
          >
            Mark Complete — {completedCount}/{totalSets} sets
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="px-4 mt-6">
          <div className="rounded-2xl p-8 text-center" style={{
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #0a1628 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Background blob */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', width: '200px', height: '200px',
              transform: `translate(-50%, -50%) scale(${0.8 + Math.sin(breathPhase * 0.063) * 0.2})`,
              borderRadius: `${40 + Math.sin(breathPhase * 0.04) * 15}% ${60 - Math.sin(breathPhase * 0.04) * 15}% ${50 + Math.cos(breathPhase * 0.05) * 10}% ${50 - Math.cos(breathPhase * 0.05) * 10}%`,
              background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.15) 50%, transparent 70%)',
              filter: 'blur(20px)', transition: 'all 0.08s linear',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '48px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', textShadow: '0 0 20px rgba(139,92,246,0.5)' }}>Done</div>
              <div style={{ fontSize: '12px', color: 'rgba(167,139,250,0.5)', marginTop: '4px', letterSpacing: '2px' }}>{completedCount} sets · {formatTime(elapsed)}</div>
              <button onClick={() => navigate('/test')} style={{
                marginTop: '20px', padding: '12px 24px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.6), rgba(59,130,246,0.6))',
                color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 0 12px rgba(139,92,246,0.3)',
              }} className="active:scale-[0.98] transition-all">
                Back to Test Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
