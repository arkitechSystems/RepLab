import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import StickyHeader from '../components/StickyHeader';
import { beepCountdown, beepPhaseChange, beepComplete, initAudio } from '../utils/sounds';
import { useAuth } from '../context/AuthContext';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPremium = user?.plan && user.plan !== 'Free';
  const [pbs, setPbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [prSearch, setPrSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api('/pbs', { signal: controller.signal })
      .then(setPbs)
      .catch((err) => { if (err.name !== 'AbortError') setLoadError('Failed to load personal bests'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Group PBs: muscleGroup -> exerciseName -> [{ weight, reps }]
  const grouped = {};
  for (const pb of pbs) {
    const group = classifyExercise(pb.exerciseName);
    if (!group) continue;
    if (!grouped[group]) grouped[group] = {};
    if (!grouped[group][pb.exerciseName]) grouped[group][pb.exerciseName] = [];
    grouped[group][pb.exerciseName].push({ weight: pb.bestWeight, reps: pb.bestReps, achievedAt: pb.achievedAt, sessionId: pb.sessionId });
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

  if (loadError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-3">{loadError}</p>
        <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
      </div>
    );
  }

  const hasAny = Object.keys(grouped).length > 0;

  // Filter by search (Pro only)
  const q = isPremium ? prSearch.toLowerCase().trim() : '';
  const filteredGroups = MUSCLE_GROUPS.filter((g) => {
    if (!grouped[g]) return false;
    if (!q) return true;
    return Object.keys(grouped[g]).some((ex) => ex.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-2">
      {/* Search bar */}
      {hasAny && (
        <div className="relative mb-2">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={prSearch}
            onChange={(e) => {
              if (!isPremium) {
                navigate('/upgrade');
                return;
              }
              setPrSearch(e.target.value);
            }}
            onFocus={() => { if (!isPremium) navigate('/upgrade'); }}
            placeholder="Search exercises..."
            className="w-full glass-input rounded-xl pl-10 pr-20 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none"
            readOnly={!isPremium}
          />
          {isPremium && prSearch ? (
            <button
              onClick={() => setPrSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-wf-gray-500 active:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded-full">PRO</span>
          )}
        </div>
      )}

      {!hasAny && (
        <div className="glass-card rounded-xl p-6 text-center">
          <p className="text-wf-gray-400 text-sm">No PRs recorded yet</p>
          <p className="text-wf-gray-500 text-xs mt-1">Complete workouts to start tracking</p>
        </div>
      )}
      {q && filteredGroups.length === 0 && (
        <div className="glass-card rounded-xl p-6 text-center">
          <p className="text-wf-gray-400 text-sm">No exercises matching "{prSearch}"</p>
        </div>
      )}
      {filteredGroups.map((group) => {
        const allExercises = grouped[group];
        const exerciseNames = q
          ? Object.keys(allExercises).filter((ex) => ex.toLowerCase().includes(q))
          : Object.keys(allExercises);
        const exercises = {};
        for (const name of exerciseNames) exercises[name] = allExercises[name];
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
                            <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Date</span>
                            <span className="w-16 text-[10px] uppercase tracking-widest text-wf-gray-600 text-right">Reps</span>
                          </div>
                          {records.map((r) => {
                            const dateStr = r.achievedAt ? new Date(r.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';
                            const calDate = r.achievedAt ? new Date(r.achievedAt) : null;
                            return (
                              <div
                                key={r.weight}
                                className="flex items-center px-3 py-2 rounded-lg bg-white/[0.03]"
                              >
                                <span className="flex-1 text-sm text-white font-medium tabular-nums">
                                  {r.weight} <span className="text-xs text-wf-gray-500">lbs</span>
                                </span>
                                {calDate ? (
                                  <button
                                    onClick={() => r.sessionId ? navigate(`/history/${r.sessionId}`) : navigate('/calendar')}
                                    className="flex-1 text-center text-xs text-wf-blue font-medium active:opacity-70 transition-opacity"
                                  >
                                    {dateStr}
                                  </button>
                                ) : (
                                  <span className="flex-1 text-center text-xs text-wf-gray-500">{dateStr}</span>
                                )}
                                <div className="w-16 flex items-center justify-end gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-sm font-bold text-amber-400 tabular-nums">{r.reps}</span>
                                </div>
                              </div>
                            );
                          })}
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

  const [soundEnabled, setSoundEnabled] = useState(true);

  function startTimer() {
    initAudio(); // iOS requires user gesture to unlock audio
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
        // Countdown beeps at 3, 2, 1
        if (soundEnabled && prev >= 2 && prev <= 4) {
          beepCountdown();
        }

        if (prev <= 1) {
          // Time's up for this interval
          if (phase === 'work') {
            if (currentSet >= totalSets) {
              setPhase('done');
              setRunning(false);
              navigator.vibrate?.([100, 50, 100, 50, 200]);
              if (soundEnabled) beepComplete();
              return 0;
            }
            setSkipTransition(true);
            setPhase('rest');
            navigator.vibrate?.([40, 30, 40]);
            if (soundEnabled) beepPhaseChange();
            return restTime;
          } else {
            // rest -> next work
            setSkipTransition(true);
            setCurrentSet((s) => s + 1);
            setPhase('work');
            navigator.vibrate?.([40, 30, 40]);
            if (soundEnabled) beepPhaseChange();
            return workTime;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, paused, phase, currentSet, totalSets, workTime, restTime, clearTimer, soundEnabled]);

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
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${soundEnabled ? 'bg-white/10 text-white' : 'bg-white/5 text-wf-gray-600'}`}
            title={soundEnabled ? 'Sound on' : 'Sound off'}
          >
            {soundEnabled ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
          </button>
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col safe-top safe-bottom">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={resetTimer} className="text-wf-red text-sm font-medium flex items-center gap-1 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Reset
        </button>
        <span className="text-xs text-wf-gray-400 font-medium uppercase tracking-widest">
          Set {Math.min(currentSet, totalSets)} / {totalSets}
        </span>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${soundEnabled ? 'bg-white/10 text-white' : 'bg-white/5 text-wf-gray-600'}`}
        >
          {soundEnabled ? (
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          ) : (
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          )}
        </button>
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
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Phase label */}
        <p className={`text-lg font-bold uppercase tracking-[0.3em] mb-4 ${phaseColor}`}>
          {phase === 'work' ? 'Work' : phase === 'rest' ? 'Rest' : 'Complete'}
        </p>

        {/* Ring timer — scales to fill available space */}
        <div className="relative mb-4" style={{ width: 'min(75vw, 75vh, 360px)', height: 'min(75vw, 75vh, 360px)' }}>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="100" cy="100" r="90"
              fill="none"
              stroke={phaseRingColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={skipTransition ? '' : 'transition-all duration-1000 ease-linear'}
              style={{ filter: `drop-shadow(0 0 12px ${phaseRingColor})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-black tabular-nums ${phaseColor}`} style={{ fontSize: 'min(18vw, 80px)' }}>
              {phase === 'done' ? '0:00' : formatTime(secondsLeft)}
            </span>
            <span className="text-wf-gray-500 text-xs uppercase tracking-widest mt-1">
              {phase === 'done' ? 'Done' : phase === 'work' ? `${secondsLeft}s remaining` : `${secondsLeft}s rest`}
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
              onClick={resetTimer}
              className="w-20 h-20 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center active:scale-90 transition-transform"
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          )}

          <button
            onClick={resetTimer}
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

// Exercise library for 1RM estimator
const ORM_EXERCISES = [
  { category: 'Barbell', exercises: [
    'Barbell Bench Press', 'Incline Barbell Bench Press', 'Close-Grip Bench Press',
    'Barbell Back Squat', 'Front Squat', 'Barbell Deadlift', 'Sumo Deadlift',
    'Overhead Press', 'Barbell Row', 'Romanian Deadlift', 'Hip Thrust',
  ]},
  { category: 'Dumbbell', exercises: [
    'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Shoulder Press',
    'Dumbbell Row', 'Dumbbell Curl', 'Dumbbell Lunges',
  ]},
  { category: 'Machine / Cable', exercises: [
    'Leg Press', 'Hack Squat', 'Lat Pulldown', 'Cable Row', 'Leg Extension', 'Leg Curl',
  ]},
  { category: 'Bodyweight', exercises: [
    'Weighted Pull-Up', 'Weighted Dip', 'Weighted Chin-Up',
  ]},
];

// 1RM formulas from peer-reviewed research — average for best accuracy
function calculate1RM(weight, reps) {
  if (reps === 1) return weight;
  const w = weight;
  const r = reps;
  // Epley (1985)
  const epley = w * (1 + r / 30);
  // Brzycki (1993) — most accurate for < 10 reps
  const brzycki = w * (36 / (37 - r));
  // Lombardi (1989)
  const lombardi = w * Math.pow(r, 0.10);
  // Mayhew et al. (1992)
  const mayhew = (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r));
  // Wathan (1994)
  const wathan = (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r));
  // Average of all five for best estimate
  return Math.round((epley + brzycki + lombardi + mayhew + wathan) / 5);
}

function OneRepMaxEstimator({ onClose }) {
  const [selectedExercise, setSelectedExercise] = useState('');
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const w = Number(weight);
  const r = Number(reps);
  const valid = w > 0 && r > 0 && r <= 30 && selectedExercise;

  const oneRM = valid ? calculate1RM(w, r) : 0;

  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60];

  // Filter exercises by search
  const filteredCategories = ORM_EXERCISES.map((cat) => ({
    ...cat,
    exercises: cat.exercises.filter((ex) =>
      ex.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.exercises.length > 0);

  return (
    <div className="fixed inset-x-0 top-[40px] bottom-0 z-50 bg-black flex flex-col">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={onClose} className="text-wf-red text-sm font-medium flex items-center gap-1 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h2 className="text-lg font-black text-white">1 Rep Max Estimator</h2>
        <div className="w-12" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {/* Exercise selector */}
        <div className="glass-card rounded-xl p-5 mb-4 fade-slide-up">
          <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-2 block">Select Exercise</label>
          <button
            onClick={() => setShowExerciseList(!showExerciseList)}
            className="w-full glass-input rounded-xl px-4 py-3 text-left flex items-center justify-between focus:outline-none"
          >
            <span className={selectedExercise ? 'text-white font-semibold' : 'text-wf-gray-600'}>
              {selectedExercise || 'Choose an exercise...'}
            </span>
            <svg className={`w-5 h-5 text-wf-gray-500 transition-transform ${showExerciseList ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Exercise dropdown */}
          {showExerciseList && (
            <div className="mt-3 rounded-xl border border-white/10 bg-wf-gray-900 overflow-hidden">
              {/* Search */}
              <div className="p-3 border-b border-white/10">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search exercises..."
                  className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-white placeholder:text-wf-gray-600 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredCategories.map((cat) => (
                  <div key={cat.category}>
                    <div className="px-3 py-2 bg-white/[0.03]">
                      <span className="text-[10px] uppercase tracking-widest text-wf-gray-500 font-semibold">{cat.category}</span>
                    </div>
                    {cat.exercises.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => {
                          setSelectedExercise(ex);
                          setShowExerciseList(false);
                          setSearchQuery('');
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors active:bg-white/10 ${
                          selectedExercise === ex ? 'text-wf-red font-semibold bg-wf-red/5' : 'text-white hover:bg-white/5'
                        }`}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                ))}
                {filteredCategories.length === 0 && (
                  <div className="px-4 py-6 text-center text-wf-gray-500 text-sm">No exercises found</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Weight & Reps inputs — only show after exercise selected */}
        {selectedExercise && (
          <div className="glass-card rounded-xl p-5 mb-4 fade-slide-up">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1.5 block">Weight Lifted (lbs)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g. 225"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none placeholder:text-wf-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1.5 block">Reps Performed</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none placeholder:text-wf-gray-600"
                />
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {valid && (
          <>
            <div className="glass-card rounded-xl p-5 mb-4 fade-slide-up border border-wf-red/20 bg-wf-red/5 text-center">
              <p className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1">Estimated 1 Rep Max</p>
              <p className="text-4xl font-black text-white">{oneRM} <span className="text-lg text-wf-gray-400">lbs</span></p>
              <p className="text-sm text-white/80 font-semibold mt-1">{selectedExercise}</p>
              <p className="text-xs text-wf-gray-500 mt-1">Average of Epley, Brzycki, Lombardi, Mayhew & Wathan formulas</p>
            </div>

            {/* Percentage breakdown */}
            <div className="glass-card rounded-xl overflow-hidden fade-slide-up" style={{ animationDelay: '60ms' }}>
              <div className="px-4 py-3 border-b border-white/10">
                <h4 className="text-sm font-semibold text-white">Percentage Breakdown</h4>
                <p className="text-xs text-wf-gray-500 mt-0.5">Training zones for {selectedExercise}</p>
              </div>
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 py-1.5 mb-1">
                  <span className="w-14 text-[10px] uppercase tracking-widest text-wf-gray-600">%</span>
                  <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Weight</span>
                  <span className="w-20 text-[10px] uppercase tracking-widest text-wf-gray-600 text-right">Rep Range</span>
                </div>
                {percentages.map((pct) => {
                  const pctWeight = Math.round(oneRM * pct / 100);
                  const displayReps = pct === 100 ? '1' : pct >= 95 ? '2–3' : pct >= 90 ? '3–5' : pct >= 85 ? '5–7' : pct >= 80 ? '7–10' : pct >= 75 ? '10–12' : pct >= 70 ? '12–15' : pct >= 65 ? '15–18' : '18–22';
                  const zone = pct >= 90 ? 'Strength' : pct >= 75 ? 'Hypertrophy' : 'Endurance';
                  const zoneColor = pct >= 90 ? 'text-red-400' : pct >= 75 ? 'text-blue-400' : 'text-green-400';
                  return (
                    <div
                      key={pct}
                      className={`flex items-center gap-2 py-2.5 border-t border-white/5 ${pct === 100 ? 'bg-wf-red/5' : ''}`}
                    >
                      <div className="w-14">
                        <span className={`text-sm font-mono-stat ${pct === 100 ? 'text-wf-red font-bold' : 'text-wf-gray-400'}`}>{pct}%</span>
                        <span className={`block text-[9px] ${zoneColor}`}>{zone}</span>
                      </div>
                      <span className={`flex-1 text-center text-sm font-mono-stat ${pct === 100 ? 'text-white font-bold' : 'text-wf-gray-400'}`}>{pctWeight} lbs</span>
                      <span className="w-20 text-sm font-mono-stat text-wf-gray-500 text-right">{displayReps}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Utilities() {
  const navigate = useNavigate();
  const [showHIIT, setShowHIIT] = useState(false);
  const [showPRs, setShowPRs] = useState(false);
  const [show1RM, setShow1RM] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div>
      <StickyHeader title="Utilities" />

      <div className="px-4 space-y-4 pb-4">
        {/* Personal Records card */}
        <button
          onClick={() => setShowPRs(true)}
          className="w-full glass-card rounded-xl p-5 active:scale-[0.98] transition-transform fade-slide-up text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">Personal Records</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">View your PRs by muscle group</p>
            </div>
            <svg className="w-5 h-5 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>

        {/* HIIT Timer card */}
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

        {/* Exercise Library card */}
        <button
          onClick={() => navigate('/exercises')}
          className="w-full glass-card rounded-xl p-5 active:scale-[0.98] transition-transform fade-slide-up text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">Exercise Library</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Browse exercises and add custom ones</p>
            </div>
            <svg className="w-5 h-5 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>

        {/* 1 Rep Max Estimator card */}
        <button
          onClick={() => setShow1RM(true)}
          className="w-full glass-card rounded-xl p-5 active:scale-[0.98] transition-transform fade-slide-up text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-wf-blue/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-wf-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">1 Rep Max Estimator</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Estimate your max from any rep range</p>
            </div>
            <svg className="w-5 h-5 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>

        {/* BMR / Calorie Calculator card */}
        <div className="w-full glass-card rounded-xl p-5 fade-slide-up text-left opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">BMR / Calorie Calculator</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Estimate your daily calorie needs based on your stats and activity level</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider shrink-0">Pro</span>
          </div>
        </div>

        {/* Macro Calculator card */}
        <div className="w-full glass-card rounded-xl p-5 fade-slide-up text-left opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">Macro Calculator</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Break down your calories into protein, carbs, and fat for any goal</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider shrink-0">Pro</span>
          </div>
        </div>

        {/* Body Fat Calculator card */}
        <div className="w-full glass-card rounded-xl p-5 fade-slide-up text-left opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">Body Fat Calculator</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Estimate your body fat percentage using the U.S. Navy method</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider shrink-0">Pro</span>
          </div>
        </div>

        {/* Plate Calculator card */}
        <a href="/platecalc/" className="w-full glass-card rounded-xl p-5 fade-slide-up text-left block active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">Plate Calculator</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">See which plates to load on each side of the bar</p>
            </div>
            <svg className="w-5 h-5 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </a>

        {/* Ideal Body Proportions card */}
        <div className="w-full glass-card rounded-xl p-5 fade-slide-up text-left opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">Ideal Body Proportions</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Calculate your ideal muscle proportions based on bone structure</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider shrink-0">Pro</span>
          </div>
        </div>

        {/* RPE / RIR Calculator card */}
        <div className="w-full glass-card rounded-xl p-5 fade-slide-up text-left opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">RPE / RIR Calculator</h3>
              <p className="text-wf-gray-400 text-sm mt-0.5">Convert between Rate of Perceived Exertion and Reps in Reserve</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider shrink-0">Pro</span>
          </div>
        </div>
      </div>

      {showPRs && (
        <div className="fixed inset-x-0 top-[40px] bottom-0 z-50 bg-black flex flex-col">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <button onClick={() => setShowPRs(false)} className="text-wf-red text-sm font-medium flex items-center gap-1 active:opacity-70">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
            <h2 className="text-lg font-black text-white">Personal Records</h2>
            <div className="w-12" />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">
            <PRsSection />
          </div>
        </div>
      )}
      {showHIIT && <HIITTimer onClose={() => setShowHIIT(false)} />}
      {show1RM && <OneRepMaxEstimator onClose={() => setShow1RM(false)} />}
    </div>
  );
}
