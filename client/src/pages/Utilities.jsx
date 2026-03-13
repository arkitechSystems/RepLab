import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import StickyHeader from '../components/StickyHeader';

const MUSCLE_GROUPS = [
  'Chest', 'Shoulders', 'Traps', 'Biceps', 'Back', 'Triceps', 'Quads', 'Glutes', 'Hamstrings',
];

const MUSCLE_KEYWORDS = {
  Chest: ['bench press', 'chest', 'fly', 'flye', 'dip', 'push up', 'pushup', 'pec'],
  Shoulders: ['shoulder press', 'overhead press', 'lateral raise', 'front raise', 'face pull', 'delt', 'arnold', 'military press'],
  Traps: ['shrug', 'trap', 'upright row'],
  Biceps: ['curl', 'bicep', 'hammer curl', 'preacher'],
  Back: ['row', 'pulldown', 'pull-up', 'pull up', 'pullup', 'lat', 'deadlift', 'back'],
  Triceps: ['tricep', 'pushdown', 'skull crusher', 'close grip', 'extension', 'kickback'],
  Quads: ['squat', 'leg press', 'leg extension', 'lunge', 'split squat', 'front squat', 'quad'],
  Glutes: ['hip thrust', 'glute', 'bridge', 'kickback'],
  Hamstrings: ['hamstring', 'leg curl', 'romanian deadlift', 'rdl', 'stiff leg', 'nordic'],
};

// Order matters: more specific matches first
const MUSCLE_PRIORITY = ['Hamstrings', 'Glutes', 'Quads', 'Traps', 'Biceps', 'Triceps', 'Shoulders', 'Chest', 'Back'];

function classifyExercise(name) {
  const lower = name.toLowerCase();
  for (const group of MUSCLE_PRIORITY) {
    if (MUSCLE_KEYWORDS[group].some((kw) => lower.includes(kw))) return group;
  }
  return null;
}

function PRsSection() {
  const [pbs, setPbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);

  useEffect(() => {
    api('/pbs')
      .then(setPbs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group PBs: muscleGroup -> exerciseName -> [{ weight, reps }]
  const grouped = {};
  for (const pb of pbs) {
    const group = classifyExercise(pb.exerciseName);
    if (!group) continue;
    if (!grouped[group]) grouped[group] = {};
    if (!grouped[group][pb.exerciseName]) grouped[group][pb.exerciseName] = [];
    grouped[group][pb.exerciseName].push({ weight: pb.bestWeight, reps: pb.bestReps });
  }
  // Sort weights descending within each exercise
  for (const group of Object.values(grouped)) {
    for (const ex of Object.keys(group)) {
      group[ex].sort((a, b) => b.weight - a.weight);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-skeleton rounded-xl h-16" />
        ))}
      </div>
    );
  }

  const hasAny = Object.keys(grouped).length > 0;

  return (
    <div className="space-y-2">
      {!hasAny && (
        <div className="glass-card rounded-xl p-6 text-center">
          <p className="text-wf-gray-400 text-sm">No PRs recorded yet</p>
          <p className="text-wf-gray-500 text-xs mt-1">Complete workouts to start tracking</p>
        </div>
      )}
      {MUSCLE_GROUPS.filter((g) => grouped[g]).map((group) => {
        const exercises = grouped[group];
        const exerciseNames = Object.keys(exercises);
        const isExpanded = expandedGroup === group;
        const totalPRs = exerciseNames.reduce((s, ex) => s + exercises[ex].length, 0);

        return (
          <div key={group} className="glass-card rounded-xl overflow-hidden">
            <button
              onClick={() => { setExpandedGroup(isExpanded ? null : group); setExpandedExercise(null); }}
              className="w-full px-4 py-3.5 flex items-center justify-between active:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-wf-red/15 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.66 6.66 0 01-2.077 1.07m-2.386 0a6.66 6.66 0 01-2.077-1.07" />
                  </svg>
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-semibold text-white">{group}</h4>
                  <p className="text-xs text-wf-gray-500">{exerciseNames.length} exercise{exerciseNames.length !== 1 ? 's' : ''} &middot; {totalPRs} PR{totalPRs !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-wf-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {isExpanded && (
              <div className="border-t border-white/10 px-3 pb-3">
                {exerciseNames.map((exName) => {
                  const records = exercises[exName];
                  const isExExpanded = expandedExercise === exName;
                  return (
                    <div key={exName} className="mt-2">
                      <button
                        onClick={() => setExpandedExercise(isExExpanded ? null : exName)}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 flex items-center justify-between active:bg-white/10 transition-colors"
                      >
                        <span className="text-sm font-medium text-white">{exName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-wf-gray-500">{records.length} weight{records.length !== 1 ? 's' : ''}</span>
                          <svg
                            className={`w-4 h-4 text-wf-gray-500 transition-transform duration-200 ${isExExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </button>

                      {isExExpanded && (
                        <div className="mt-1.5 space-y-1 pl-2">
                          {/* Column headers */}
                          <div className="flex items-center px-3 py-1">
                            <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600">Weight</span>
                            <span className="w-20 text-[10px] uppercase tracking-widest text-wf-gray-600 text-right">Best Reps</span>
                          </div>
                          {records.map((r) => (
                            <div
                              key={r.weight}
                              className="flex items-center px-3 py-2 rounded-lg bg-white/[0.03]"
                            >
                              <span className="flex-1 text-sm text-white font-medium tabular-nums">
                                {r.weight} <span className="text-xs text-wf-gray-500">lbs</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-bold text-amber-400 tabular-nums">{r.reps}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HIITTimer({ onClose }) {
  const [setup, setSetup] = useState(true);
  const [sets, setSets] = useState(8);
  const [workTime, setWorkTime] = useState(30);
  const [restTime, setRestTime] = useState(15);

  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState('work'); // 'work' | 'rest' | 'done'
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef(null);
  const [skipTransition, setSkipTransition] = useState(false);

  const totalSets = sets;
  const totalTime = sets * workTime + (sets - 1) * restTime;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  function startTimer() {
    setSetup(false);
    setCurrentSet(1);
    setPhase('work');
    setSecondsLeft(workTime);
    setRunning(true);
    setPaused(false);
    setSkipTransition(true);
  }

  function togglePause() {
    setPaused((p) => !p);
  }

  function resetTimer() {
    clearTimer();
    setSetup(true);
    setRunning(false);
    setPaused(false);
    setPhase('work');
    setCurrentSet(1);
    setSecondsLeft(0);
  }

  useEffect(() => {
    if (!running || paused || phase === 'done') {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Time's up for this interval
          if (phase === 'work') {
            if (currentSet >= totalSets) {
              setPhase('done');
              setRunning(false);
              navigator.vibrate?.([100, 50, 100, 50, 200]);
              return 0;
            }
            setSkipTransition(true);
            setPhase('rest');
            navigator.vibrate?.([40, 30, 40]);
            return restTime;
          } else {
            // rest -> next work
            setSkipTransition(true);
            setCurrentSet((s) => s + 1);
            setPhase('work');
            navigator.vibrate?.([40, 30, 40]);
            return workTime;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, paused, phase, currentSet, totalSets, workTime, restTime, clearTimer]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const phaseColor = phase === 'work' ? 'text-green-400' : phase === 'rest' ? 'text-yellow-400' : 'text-red-500';
  const phaseBg = phase === 'work' ? 'bg-green-500' : phase === 'rest' ? 'bg-yellow-500' : 'bg-red-500';
  const phaseRingColor = phase === 'work' ? '#22c55e' : phase === 'rest' ? '#eab308' : '#ef4444';

  // Re-enable transition after skip
  useEffect(() => {
    if (skipTransition) {
      const id = requestAnimationFrame(() => setSkipTransition(false));
      return () => cancelAnimationFrame(id);
    }
  }, [skipTransition]);

  // Progress ring — aim one step ahead so the 1s CSS transition stays in sync
  const maxTime = phase === 'work' ? workTime : phase === 'rest' ? restTime : 1;
  const progress = phase === 'done' ? 1 : skipTransition ? 0 : Math.min(1, (maxTime - secondsLeft + 1) / maxTime);
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress);

  // Overall progress
  const completedSets = phase === 'done' ? totalSets : currentSet - 1 + (phase === 'rest' ? 1 : 0);
  const overallPct = Math.round((completedSets / totalSets) * 100);

  if (setup) {
    return (
      <div className="fixed inset-x-0 top-[40px] bottom-0 z-50 bg-black flex flex-col">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <button onClick={onClose} className="text-wf-red text-sm font-medium flex items-center gap-1 active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <h2 className="text-lg font-black text-white">HIIT Timer</h2>
          <div className="w-12" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Timer icon */}
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-8">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Settings */}
          <div className="w-full max-w-sm space-y-6">
            <div className="glass-card rounded-xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Sets</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSets((s) => Math.max(1, s - 1))} className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-white text-lg font-bold active:scale-90">−</button>
                  <span className="text-white text-xl font-black w-8 text-center tabular-nums">{sets}</span>
                  <button onClick={() => setSets((s) => s + 1)} className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-white text-lg font-bold active:scale-90">+</button>
                </div>
              </div>

              <div className="border-t border-white/10" />

              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Work Time</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setWorkTime((t) => Math.max(5, t - 5))} className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-white text-lg font-bold active:scale-90">−</button>
                  <span className="text-white text-xl font-black w-12 text-center tabular-nums">{workTime}s</span>
                  <button onClick={() => setWorkTime((t) => t + 5)} className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-white text-lg font-bold active:scale-90">+</button>
                </div>
              </div>

              <div className="border-t border-white/10" />

              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Rest Time</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setRestTime((t) => Math.max(5, t - 5))} className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-white text-lg font-bold active:scale-90">−</button>
                  <span className="text-white text-xl font-black w-12 text-center tabular-nums">{restTime}s</span>
                  <button onClick={() => setRestTime((t) => t + 5)} className="w-9 h-9 rounded-full glass-card flex items-center justify-center text-white text-lg font-bold active:scale-90">+</button>
                </div>
              </div>
            </div>

            {/* Total time preview */}
            <div className="text-center text-wf-gray-400 text-sm">
              Total: <span className="text-white font-semibold">{formatTime(totalTime)}</span>
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={startTimer}
            className="mt-8 w-full max-w-sm btn-gradient text-white font-bold py-4 rounded-xl text-lg active:scale-[0.98] transition-all"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="safe-top px-4 pt-4 pb-2 flex items-center justify-between">
        <button onClick={resetTimer} className="text-wf-red text-sm font-medium flex items-center gap-1 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Reset
        </button>
        <span className="text-xs text-wf-gray-400 font-medium uppercase tracking-widest">
          Set {Math.min(currentSet, totalSets)} / {totalSets}
        </span>
        <div className="w-12" />
      </div>

      {/* Overall progress bar */}
      <div className="px-6 py-2">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${phaseBg}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Timer display */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Phase label */}
        <p className={`text-sm font-bold uppercase tracking-[0.3em] mb-6 ${phaseColor}`}>
          {phase === 'work' ? 'Work' : phase === 'rest' ? 'Rest' : 'Complete'}
        </p>

        {/* Ring timer */}
        <div className="relative w-56 h-56 mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="100" cy="100" r="90"
              fill="none"
              stroke={phaseRingColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={skipTransition ? '' : 'transition-all duration-1000 ease-linear'}
              style={{ filter: `drop-shadow(0 0 8px ${phaseRingColor})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-6xl font-black tabular-nums ${phaseColor}`}>
              {phase === 'done' ? '0:00' : formatTime(secondsLeft)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button
            onClick={resetTimer}
            className="w-14 h-14 rounded-full glass-card flex items-center justify-center text-wf-gray-400 active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>

          {phase !== 'done' ? (
            <button
              onClick={togglePause}
              className={`w-20 h-20 rounded-full flex items-center justify-center active:scale-90 transition-transform ${
                paused ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-white/10'
              }`}
            >
              {paused ? (
                <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-20 h-20 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center active:scale-90 transition-transform"
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-14 h-14 rounded-full glass-card flex items-center justify-center text-wf-gray-400 active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Utilities() {
  const [showHIIT, setShowHIIT] = useState(false);

  return (
    <div>
      <StickyHeader title="Utilities" />

      <div className="px-4 space-y-4 pb-4">
        {/* Personal Records */}
        <div>
          <h2 className="text-xs text-wf-gray-400 font-medium uppercase tracking-wider mb-2">Personal Records</h2>
          <PRsSection />
        </div>

        {/* HIIT Timer */}
        <div>
          <h2 className="text-xs text-wf-gray-400 font-medium uppercase tracking-wider mb-2">Tools</h2>
        </div>
        <button
          onClick={() => setShowHIIT(true)}
          className="w-full glass-card rounded-xl p-5 active:scale-[0.98] transition-transform fade-slide-up text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">HIIT Timer</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Interval timer for high-intensity workouts</p>
            </div>
            <svg className="w-5 h-5 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>
      </div>

      {showHIIT && <HIITTimer onClose={() => setShowHIIT(false)} />}
    </div>
  );
}
