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

// Hardcoded sample workout — same shape as NewWorkoutSessionTest
const CHEST_ONE_TEMPLATE = {
  name: 'Nike Workout Session',
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

export default function NikeWorkoutSessionTest() {
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

  // Display settings (mirrors WorkoutSession.jsx)
  const [showGoals, setShowGoals] = useState(true);
  const [showSetType, setShowSetType] = useState(true);
  const [showSessionMenu, setShowSessionMenu] = useState(false);

  // Timer pinning (lock = stay visible when sticky header collapses)
  const [pinWorkoutTimer, setPinWorkoutTimer] = useState(false);
  const [pinRestTimer, setPinRestTimer] = useState(true);

  // Floating timers (pop-out)
  const [workoutFloating, setWorkoutFloating] = useState(false);
  const [restFloating, setRestFloating] = useState(false);

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

  return (
    <div className="pb-24" style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      {/* Back button — Nike red */}
      <div className="px-4 pt-6 mb-2">
        <button onClick={() => navigate('/test')} className="flex items-center gap-1 text-[11px] uppercase font-bold active:opacity-70" style={{ color: 'rgba(239,68,68,0.9)', letterSpacing: '0.2em' }}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      </div>

      <StickyHeader
        title={template.name.toUpperCase()}
        titleStyle={{ fontSize: '26.4px' }}
        subtitle="Test Session · Will's Hypertrophy Program"
        children={(
          <div className="relative shrink-0">
            <button
              onClick={() => setShowSessionMenu(!showSessionMenu)}
              aria-label="Session settings"
              className="w-9 h-9 flex items-center justify-center active:scale-[0.95] active:opacity-60 transition-all"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {showSessionMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSessionMenu(false)} />
                <div
                  className="absolute right-0 top-11 z-50 w-60 overflow-hidden"
                  style={{
                    borderRadius: '2px',
                    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent)' }} />
                  <div className="px-4 pt-3 pb-2 border-b border-white/10">
                    <span className="text-[9px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.8)', letterSpacing: '0.3em' }}>Display</span>
                  </div>
                  <button
                    onClick={() => setShowGoals(v => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between text-[12px] text-white active:bg-white/5 transition-colors"
                  >
                    <span className="font-medium">Goal Weight / Reps</span>
                    <div className={`w-8 h-5 rounded-full transition-colors ${showGoals ? 'bg-wf-red' : 'bg-white/15'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${showGoals ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                  <button
                    onClick={() => setShowSetType(v => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between text-[12px] text-white active:bg-white/5 transition-colors border-t border-white/5"
                  >
                    <span className="font-medium">Set Type</span>
                    <div className={`w-8 h-5 rounded-full transition-colors ${showSetType ? 'bg-wf-red' : 'bg-white/15'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${showSetType ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        bottomContent={(collapsed) => (
          <div className="mt-3">
            {/* Workout Timer — Nike card */}
            <div className="overflow-hidden" style={{
              borderRadius: '2px',
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              position: 'relative',
              display: (collapsed && !pinWorkoutTimer) ? 'none' : undefined,
            }}>
              {/* Red top accent bar */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent)' }} />
              <div className="relative px-4 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: timerStarted ? '#ef4444' : '#333', boxShadow: timerStarted ? '0 0 8px rgba(239,68,68,0.7)' : 'none' }} />
                  <span className="text-[10px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.8)', letterSpacing: '0.3em' }}>Workout</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span style={{ fontSize: '22px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{formatTime(elapsed)}</span>
                  {/* Pop-out */}
                  <button onClick={() => setWorkoutFloating(true)} aria-label="Pop out workout timer" className="w-6 h-6 flex items-center justify-center active:scale-90 transition-all" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                  {/* Lock toggle */}
                  <button onClick={() => setPinWorkoutTimer(p => !p)} aria-label={pinWorkoutTimer ? 'Unlock timer' : 'Lock timer'} className="w-6 h-6 flex items-center justify-center active:scale-90 transition-all" style={{ color: pinWorkoutTimer ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.4)' }}>
                    {pinWorkoutTimer ? (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Rest Timer — Nike card, connected below */}
            <div className="overflow-hidden mt-1.5" style={{
              borderRadius: '2px',
              background: 'linear-gradient(160deg, #1a1a1a 0%, #111111 100%)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
              position: 'relative',
              display: (collapsed && !pinRestTimer) ? 'none' : undefined,
            }}>
              <div className="relative px-4 py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: restRunning ? '#ef4444' : '#333', boxShadow: restRunning ? '0 0 8px rgba(239,68,68,0.7)' : 'none' }} />
                  <span className="text-[10px] uppercase font-light" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.3em' }}>Rest</span>
                </div>
                <div className="flex items-center gap-2.5">
                  {restRunning ? (
                    <span style={{ fontSize: '18px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{formatTime(restSeconds)}</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {[60, 90, 120].map(s => (
                        <button key={s} onClick={() => { setRestDuration(s); setRestSeconds(s); setRestRunning(true); }}
                          className="active:scale-[0.95] transition-all"
                          style={{
                            padding: '4px 10px', borderRadius: '2px',
                            fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
                            textTransform: 'uppercase', border: '1px solid',
                            borderColor: restDuration === s ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)',
                            background: restDuration === s ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
                            color: restDuration === s ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.35)',
                            cursor: 'pointer',
                          }}>
                          {s}s
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Pop-out */}
                  <button onClick={() => setRestFloating(true)} aria-label="Pop out rest timer" className="w-6 h-6 flex items-center justify-center active:scale-90 transition-all" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                  {/* Lock toggle */}
                  <button onClick={() => setPinRestTimer(p => !p)} aria-label={pinRestTimer ? 'Unlock rest timer' : 'Lock rest timer'} className="w-6 h-6 flex items-center justify-center active:scale-90 transition-all" style={{ color: pinRestTimer ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.4)' }}>
                    {pinRestTimer ? (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Begin / Progress */}
            {!timerStarted ? (
              <button onClick={startTimer}
                className="active:scale-[0.98] transition-all w-full mt-3"
                style={{
                  padding: '14px', borderRadius: '2px', border: 'none',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
                  color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  letterSpacing: '0.25em', textTransform: 'uppercase',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}>
                Begin Workout
              </button>
            ) : (
              <div className="mt-3">
                <div className="flex justify-between mb-1.5 text-[10px] uppercase font-semibold" style={{ letterSpacing: '0.2em' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{completedCount}/{totalSets} Sets</span>
                  <span style={{ color: 'rgba(239,68,68,0.9)' }}>{progressPct}%</span>
                </div>
                <div className="h-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }}>
                  <div className="h-full transition-all duration-500" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.6))', borderRadius: '2px' }} />
                </div>
              </div>
            )}
          </div>
        )}
      />

      {/* Nike-style overrides for ExerciseCard (scoped to this test page only) */}
      <style>{`
        /* Keep light-gray bg from .exercise-card-light-test, but apply Nike shape (sharp corners + heavy shadow + red accent bar) */
        .nike-session-wrap .exercise-card-light-test.glass-card {
          border: none !important;
          border-radius: 2px !important;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4) !important;
          position: relative;
          overflow: hidden !important;
        }
        .nike-session-wrap .exercise-card-light-test.glass-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent);
          z-index: 2;
          pointer-events: none;
        }
        /* Keep the set-type select transparent so the short overlay (WU, DS, REG, etc.) is what shows, not the full label */
        .nike-session-wrap .exercise-card-light-test select {
          color: transparent !important;
        }
      `}</style>

      {/* Exercise Cards */}
      <div className="px-4 nike-session-wrap">
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
              <div className="overflow-hidden" style={{
                borderRadius: '2px',
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                position: 'relative',
              }}>
                {/* Red top accent bar */}
                <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent)' }} />
                {/* Ambient red spotlight */}
                <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

                <div className="relative px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.7)', letterSpacing: '0.3em' }}>Section</span>
                    <span className="text-[16px] font-black text-white uppercase tracking-tight" style={{ fontFamily: 'system-ui' }}>{exercise.name}</span>
                  </div>
                  {exercise.sectionNotes && (
                    <p className="text-[11px] font-light mt-2" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{exercise.sectionNotes}</p>
                  )}
                </div>
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
              showGoalWeight={showGoals}
              showGoalReps={showGoals}
              showSetType={showSetType}
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

      {/* Mark Complete — Nike style */}
      {timerStarted && !isCompleted && (
        <div className="px-4 mt-6">
          <button
            onClick={() => {
              if (completedCount === 0) { alert('Complete at least one set first'); return; }
              setIsCompleted(true);
            }}
            className="active:scale-[0.98] transition-all w-full"
            style={{
              padding: '16px', borderRadius: '2px', border: 'none',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
              color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.25em', textTransform: 'uppercase',
              boxShadow: '0 4px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            Mark Complete — {completedCount}/{totalSets} Sets
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="px-4 mt-6">
          <div className="relative overflow-hidden text-center p-8" style={{
            borderRadius: '2px',
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {/* Red top accent */}
            <div className="absolute top-0 left-0 right-0" style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent)' }} />
            {/* Ambient red spotlight */}
            <div className="absolute -top-20 -right-10 w-[300px] h-[300px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 60%)', filter: 'blur(40px)' }} />

            <div className="relative">
              <p className="text-[10px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.75)', letterSpacing: '0.3em' }}>Session Complete</p>
              <div className="text-[56px] font-black text-white tracking-tight mt-3 leading-[0.9]" style={{ fontFamily: 'system-ui', textShadow: '0 0 20px rgba(239,68,68,0.25)' }}>DONE.</div>
              <div className="text-[11px] uppercase font-semibold mt-3" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.25em' }}>{completedCount} Sets · {formatTime(elapsed)}</div>
              <button onClick={() => navigate('/test')}
                className="active:scale-[0.98] transition-all mt-6"
                style={{
                  padding: '12px 24px', borderRadius: '2px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.1)',
                  color: 'rgba(239,68,68,0.95)', fontSize: '11px', fontWeight: 700,
                  letterSpacing: '0.25em', textTransform: 'uppercase', cursor: 'pointer',
                }}>
                Back to Test Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Workout Timer — pop-out */}
      {workoutFloating && (
        <div className="fixed z-50" style={{ top: '16px', right: '16px' }}>
          <div style={{
            borderRadius: '2px',
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: '10px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent)' }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: timerStarted ? '#ef4444' : '#333', boxShadow: timerStarted ? '0 0 6px rgba(239,68,68,0.7)' : 'none' }} />
            <span className="text-[9px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.8)', letterSpacing: '0.25em' }}>Workout</span>
            <span style={{ fontSize: '16px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{formatTime(elapsed)}</span>
            <button onClick={() => setWorkoutFloating(false)} aria-label="Close" className="w-5 h-5 flex items-center justify-center active:scale-90 transition-all" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Rest Timer — pop-out */}
      {restFloating && (
        <div className="fixed z-50" style={{ top: workoutFloating ? '64px' : '16px', right: '16px' }}>
          <div style={{
            borderRadius: '2px',
            background: 'linear-gradient(160deg, #1a1a1a 0%, #111111 100%)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: restRunning ? '#ef4444' : '#333', boxShadow: restRunning ? '0 0 6px rgba(239,68,68,0.7)' : 'none' }} />
            <span className="text-[9px] uppercase font-light" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.25em' }}>Rest</span>
            {restRunning ? (
              <span style={{ fontSize: '16px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{formatTime(restSeconds)}</span>
            ) : (
              <span className="text-[10px] font-light" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em' }}>Idle</span>
            )}
            <button onClick={() => setRestFloating(false)} aria-label="Close" className="w-5 h-5 flex items-center justify-center active:scale-90 transition-all" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
