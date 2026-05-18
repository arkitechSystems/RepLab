import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import StickyHeader from '../components/StickyHeader';
import { beepCountdown, beepPhaseChange, beepComplete, initAudio } from '../utils/sounds';
import { useAuth } from '../context/AuthContext';
import { MUSCLE_GROUPS, classifyExercise } from '../utils/muscleGroup';

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

  const NIKE_PANEL = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  return (
    <div className="space-y-2">
      {/* Search bar */}
      {hasAny && (
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={prSearch}
            onChange={(e) => setPrSearch(e.target.value)}
            placeholder="Search exercises..."
            className="w-full glass-input rounded-[2px] pl-10 pr-10 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none"
          />
          {prSearch && (
            <button
              onClick={() => setPrSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-wf-gray-500 active:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {!hasAny && (
        <div className="p-6 flex flex-col items-center text-center" style={NIKE_PANEL}>
          <div className="w-14 h-14 flex items-center justify-center mb-3" style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.10) 100%)',
            borderRadius: '2px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(245,158,11,0.20)',
          }}>
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0012.75 10.5h-1.5A3.375 3.375 0 007.5 14.25v4.5m9-9V6a3 3 0 00-3-3h-3a3 3 0 00-3 3v3.75" />
            </svg>
          </div>
          <h3 className="text-[14px] font-bold uppercase text-white tracking-wider mb-1.5" style={{ letterSpacing: '0.15em' }}>No Personal Records Yet</h3>
          <p className="text-wf-gray-400 text-sm">Complete workouts to start tracking your personal bests for each exercise.</p>
        </div>
      )}
      {q && filteredGroups.length === 0 && (
        <div className="p-6 text-center" style={NIKE_PANEL}>
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
          <div key={group} className="overflow-hidden" style={{ ...NIKE_PANEL, borderLeft: '3px solid #f59e0b' }}>
            <button
              onClick={() => { setExpandedGroup(isExpanded ? null : group); setExpandedExercise(null); }}
              className="w-full px-5 py-4 flex items-center justify-between active:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.10) 100%)',
                  borderRadius: '2px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(245,158,11,0.20)',
                }}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#fbbf24">
                    <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-left">
                  <h4 className="text-[13px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>{group}</h4>
                  <p className="text-[11px] text-white/40 font-light mt-0.5">{exerciseNames.length} exercise{exerciseNames.length !== 1 ? 's' : ''} · {totalPRs} PR{totalPRs !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-white/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
    const NIKE_PANEL = {
      background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
      borderRadius: '2px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
    };
    const stepperBtn = "w-11 h-11 flex items-center justify-center text-white text-lg font-bold active:scale-90 transition-transform";
    const stepperBtnStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px' };
    return (
      <div className="fixed inset-x-0 top-[40px] bottom-0 z-50 bg-black flex flex-col safe-bottom">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-10 h-10 rounded-[2px] flex items-center justify-center transition-all active:scale-90 ${soundEnabled ? 'bg-white/10 text-white' : 'bg-white/5 text-wf-gray-600'}`}
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

        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">
          {/* Nike intro panel — red accent matching the rest of the app's
              CTAs. */}
          <div className="relative overflow-hidden mb-4 fade-slide-up" style={NIKE_PANEL}>
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
            <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
            <div className="relative p-6">
              <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
                Interval Timer
              </p>
              <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                HIIT TIMER
              </h1>
              <p className="text-[12px] text-white/40 font-light mt-2 leading-relaxed">
                Set your sets, work seconds, and rest seconds. Tap start when you're ready.
              </p>
            </div>
          </div>

          {/* Settings panel */}
          <div className="p-5 mb-4 fade-slide-up" style={{ ...NIKE_PANEL, animationDelay: '60ms' }}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em' }}>Sets</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSets((s) => Math.max(1, s - 1))} className={stepperBtn} style={stepperBtnStyle}>−</button>
                  <span className="text-white text-2xl font-black w-10 text-center tabular-nums">{sets}</span>
                  <button onClick={() => setSets((s) => s + 1)} className={stepperBtn} style={stepperBtnStyle}>+</button>
                </div>
              </div>

              <div className="border-t border-white/5" />

              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em' }}>Work Time</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setWorkTime((t) => Math.max(5, t - 5))} className={stepperBtn} style={stepperBtnStyle}>−</button>
                  <span className="text-white text-2xl font-black w-14 text-center tabular-nums">{workTime}<span className="text-base text-white/40 ml-0.5">s</span></span>
                  <button onClick={() => setWorkTime((t) => t + 5)} className={stepperBtn} style={stepperBtnStyle}>+</button>
                </div>
              </div>

              <div className="border-t border-white/5" />

              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em' }}>Rest Time</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setRestTime((t) => Math.max(5, t - 5))} className={stepperBtn} style={stepperBtnStyle}>−</button>
                  <span className="text-white text-2xl font-black w-14 text-center tabular-nums">{restTime}<span className="text-base text-white/40 ml-0.5">s</span></span>
                  <button onClick={() => setRestTime((t) => t + 5)} className={stepperBtn} style={stepperBtnStyle}>+</button>
                </div>
              </div>

              <div className="border-t border-white/5" />

              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em' }}>Total</span>
                <span className="text-white text-2xl font-black tabular-nums">{formatTime(totalTime)}</span>
              </div>
            </div>
          </div>

          {/* Start button — Nike CTA pattern */}
          <button
            onClick={startTimer}
            className="w-full active:scale-[0.98] text-white font-bold uppercase py-4 text-sm transition-transform"
            style={{
              letterSpacing: '0.2em',
              borderRadius: '2px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  return (
    // Inset top by `top-[60px]` so the running view starts BELOW the global
    // app header (logo + avatar bar) instead of letting that header float
    // on top of the Set X/Y indicator.
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black flex flex-col safe-bottom" style={{ top: 60 }}>
      {/* Header — Nike-style: 2px-corner Reset chip on left, Set N/Y in
          the middle as a Nike eyebrow, sound toggle on right. */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
        <button
          onClick={resetTimer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold text-white/80 active:scale-[0.97] transition-transform"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '2px',
            letterSpacing: '0.2em',
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Reset
        </button>
        <div className="text-center">
          <p className="text-[9px] uppercase font-bold mb-0.5" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
            Set
          </p>
          <p className="text-[14px] font-black text-white tabular-nums" style={{ fontFamily: 'system-ui', lineHeight: '1', letterSpacing: '-0.02em' }}>
            {Math.min(currentSet, totalSets)} <span className="text-white/30 font-bold">/</span> {totalSets}
          </p>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
          className={`w-10 h-10 flex items-center justify-center transition-all active:scale-90 ${soundEnabled ? 'text-white' : 'text-wf-gray-600'}`}
          style={{
            background: soundEnabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '2px',
          }}
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

      {/* Overall progress bar — sharper 2px-corner block with phase color */}
      <div className="px-6 py-3">
        <div className="h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
          <div
            className={`h-full transition-all duration-500 ease-out ${phaseBg}`}
            style={{ width: `${overallPct}%`, borderRadius: '2px' }}
          />
        </div>
      </div>

      {/* Timer display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Phase label */}
        <p className={`text-lg font-black uppercase mb-4 ${phaseColor}`} style={{ letterSpacing: '0.4em' }}>
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
            aria-label="Reset timer"
            className="w-14 h-14 rounded-full glass-card flex items-center justify-center text-wf-gray-400 active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>

          {phase !== 'done' ? (
            <button
              onClick={togglePause}
              aria-label={paused ? 'Resume' : 'Pause'}
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
              aria-label="Done"
              className="w-20 h-20 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center active:scale-90 transition-transform"
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          )}

          <button
            onClick={resetTimer}
            aria-label="Close timer"
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

// Open a styled print window for the 1RM percentage breakdown so the
// user can save it as a PDF via the browser's print dialog. Uses the same
// approach as exportProgramPDF — no extra deps, just a clean printable
// HTML page that auto-opens print.
function exportPercentageBreakdownPDF({ exercise, oneRM, weight, reps, percentages }) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rows = percentages.map((pct) => {
    const pctWeight = Math.round(oneRM * pct / 100);
    const displayReps = pct === 100 ? '1' : pct >= 95 ? '2–3' : pct >= 90 ? '3–5' : pct >= 85 ? '5–7' : pct >= 80 ? '7–10' : pct >= 75 ? '10–12' : pct >= 70 ? '12–15' : pct >= 65 ? '15–18' : '18–22';
    const zone = pct >= 90 ? 'Strength' : pct >= 75 ? 'Hypertrophy' : 'Endurance';
    const zoneColor = pct >= 90 ? '#ef4444' : pct >= 75 ? '#3b82f6' : '#22c55e';
    const isMax = pct === 100;
    return `
      <tr class="${isMax ? 'max-row' : ''}">
        <td class="pct-cell">
          <div class="pct">${pct}%</div>
          <div class="zone" style="color: ${zoneColor};">${zone}</div>
        </td>
        <td class="weight-cell"><span class="weight-num">${pctWeight}</span> <span class="lbs">LBS</span></td>
        <td class="reps-cell">${displayReps}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>1RM Breakdown — ${escape(exercise)}</title>
  <style>
    @page { size: letter; margin: 0.6in; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 32px;
    }
    .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.4em; color: #ef4444; font-weight: 700; margin: 0 0 6px; }
    h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; line-height: 0.95; margin: 0 0 8px; text-transform: uppercase; }
    .meta { font-size: 11px; color: #555; margin: 0 0 4px; }
    .max-summary {
      margin: 24px 0 28px;
      padding: 24px;
      background: linear-gradient(160deg, #fafafa 0%, #f0f0f0 100%);
      border-left: 4px solid #ef4444;
      border-radius: 2px;
    }
    .max-eyebrow { font-size: 9px; text-transform: uppercase; letter-spacing: 0.3em; color: #ef4444; font-weight: 700; margin: 0 0 6px; }
    .max-num { font-size: 56px; font-weight: 900; letter-spacing: -0.03em; line-height: 0.95; margin: 0; }
    .max-num .lbs { font-size: 20px; font-weight: 700; color: #888; margin-left: 8px; }
    .max-exercise { font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #444; font-weight: 700; margin: 6px 0 0; }
    .max-input { font-size: 10px; color: #777; margin: 8px 0 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.25em; color: #777; font-weight: 700;
      padding: 8px 12px; border-bottom: 2px solid #ddd; text-align: left;
    }
    thead th.center { text-align: center; }
    thead th.right { text-align: right; }
    tbody tr { border-bottom: 1px solid #eee; }
    tbody tr.max-row { background: rgba(239,68,68,0.06); }
    .pct-cell { width: 110px; padding: 10px 12px; vertical-align: top; }
    .pct { font-size: 14px; font-weight: 700; color: #333; }
    .max-row .pct { color: #ef4444; }
    .zone { font-size: 9px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-top: 2px; }
    .weight-cell { text-align: center; padding: 10px 12px; }
    .weight-num { font-size: 16px; font-weight: 700; color: #555; font-variant-numeric: tabular-nums; }
    .max-row .weight-num { color: #111; }
    .lbs { font-size: 10px; color: #999; }
    .reps-cell { width: 100px; text-align: right; padding: 10px 12px; font-size: 13px; color: #777; font-variant-numeric: tabular-nums; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 9px; color: #999; line-height: 1.6; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <p class="eyebrow">Calculator</p>
  <h1>1 Rep Max Breakdown</h1>
  <p class="meta">${escape(dateStr)} · REPLAB</p>

  <div class="max-summary">
    <p class="max-eyebrow">Estimated 1 Rep Max</p>
    <p class="max-num">${oneRM}<span class="lbs">LBS</span></p>
    <p class="max-exercise">${escape(exercise)}</p>
    <p class="max-input">From ${weight} lbs × ${reps} reps · average of Epley, Brzycki, Lombardi, Mayhew &amp; Wathan formulas</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>%</th>
        <th class="center">Weight</th>
        <th class="right">Rep Range</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <p class="footer">
    Generated by REPLAB — replab-fitness.com · Use these zones to plan your
    training: ≥90% strength, 75-90% hypertrophy, &lt;75% endurance.
  </p>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 250);
    });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to export to PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

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

  const NIKE_PANEL = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };
  const labelClass = 'text-[10px] uppercase font-bold mb-1.5 block';
  const labelStyle = { color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' };
  const inputClass = 'w-full glass-input rounded-[2px] px-4 py-3 text-white text-base font-semibold focus:outline-none placeholder:text-wf-gray-600 transition-all';

  return (
    <div className="fixed inset-x-0 top-[40px] bottom-0 z-50 bg-black flex flex-col safe-bottom">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1">
        {/* Nike intro panel — eyebrow + heavy display title. */}
        <div className="relative overflow-hidden mb-4 fade-slide-up" style={NIKE_PANEL}>
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #06b6d4, rgba(6,182,212,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(6,182,212,0.85)', letterSpacing: '0.4em' }}>
              Calculator
            </p>
            <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              1 REP MAX ESTIMATOR
            </h1>
            <p className="text-[12px] text-white/40 font-light mt-2 leading-relaxed">
              Average of five peer-reviewed 1RM formulas — pick a lift, plug in your last set, and get training-zone breakdowns.
            </p>
          </div>
        </div>

        {/* Exercise selector */}
        <div className="p-5 mb-4 fade-slide-up" style={NIKE_PANEL}>
          <label className={labelClass} style={labelStyle}>Select Exercise</label>
          <button
            onClick={() => setShowExerciseList(!showExerciseList)}
            className="w-full glass-input rounded-[2px] px-4 py-3 text-left flex items-center justify-between focus:outline-none"
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
            <div className="mt-3 overflow-hidden" style={{ background: '#0a0a0a', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="p-3 border-b border-white/10">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search exercises..."
                  className="w-full bg-white/5 rounded-[2px] px-3 py-2 text-sm text-white placeholder:text-wf-gray-600 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredCategories.map((cat) => (
                  <div key={cat.category}>
                    <div className="px-3 py-2 bg-white/[0.03]">
                      <span className="text-[10px] uppercase font-bold text-white/40" style={{ letterSpacing: '0.25em' }}>{cat.category}</span>
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

        {/* Weight & Reps inputs */}
        {selectedExercise && (
          <div className="p-5 mb-4 fade-slide-up space-y-4" style={NIKE_PANEL}>
            <div>
              <label className={labelClass} style={labelStyle}>Weight Lifted (lbs)</label>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 225"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Reps Performed</label>
              <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="e.g. 5"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {valid && (
          <>
            <div className="relative overflow-hidden mb-4 fade-slide-up" style={NIKE_PANEL}>
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
              <div className="relative p-6 text-center">
                <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
                  Estimated 1 Rep Max
                </p>
                <p className="text-[64px] font-black text-white tabular-nums" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.03em' }}>
                  {oneRM}<span className="text-[24px] font-bold text-white/40 ml-2">LBS</span>
                </p>
                <p className="text-[11px] uppercase font-bold text-white/60 mt-2" style={{ letterSpacing: '0.2em' }}>
                  {selectedExercise}
                </p>
                <p className="text-[10px] text-wf-gray-500 mt-3 leading-relaxed">
                  Average of Epley, Brzycki, Lombardi, Mayhew & Wathan formulas
                </p>
              </div>
            </div>

            {/* Percentage breakdown — internal scroll with sticky title +
                column headers. Export to PDF opens a print-styled window
                with the same data so the user can save it locally. */}
            <div
              className="overflow-hidden fade-slide-up flex flex-col"
              style={{ ...NIKE_PANEL, animationDelay: '60ms', maxHeight: '60vh' }}
            >
              {/* Sticky title row + Export button */}
              <div className="px-5 py-4 border-b border-white/5 flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
                    Training Zones
                  </p>
                  <h4 className="text-[18px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                    PERCENTAGE BREAKDOWN
                  </h4>
                </div>
                <button
                  onClick={() => exportPercentageBreakdownPDF({ exercise: selectedExercise, oneRM, weight: w, reps: r, percentages })}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-white active:scale-[0.97] transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                    boxShadow: '0 4px 12px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.15)',
                    borderRadius: '2px',
                    letterSpacing: '0.15em',
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export PDF
                </button>
              </div>

              {/* Sticky column headers */}
              <div
                className="px-4 py-2 border-b border-white/5 flex items-center gap-2 shrink-0"
                style={{ background: '#141414' }}
              >
                <span className="w-14 text-[9px] uppercase font-bold text-white/35" style={{ letterSpacing: '0.25em' }}>%</span>
                <span className="flex-1 text-[9px] uppercase font-bold text-white/35 text-center" style={{ letterSpacing: '0.25em' }}>Weight</span>
                <span className="w-20 text-[9px] uppercase font-bold text-white/35 text-right" style={{ letterSpacing: '0.25em' }}>Rep Range</span>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto px-4 py-1 flex-1">
                {percentages.map((pct) => {
                  const pctWeight = Math.round(oneRM * pct / 100);
                  const displayReps = pct === 100 ? '1' : pct >= 95 ? '2–3' : pct >= 90 ? '3–5' : pct >= 85 ? '5–7' : pct >= 80 ? '7–10' : pct >= 75 ? '10–12' : pct >= 70 ? '12–15' : pct >= 65 ? '15–18' : '18–22';
                  const zone = pct >= 90 ? 'Strength' : pct >= 75 ? 'Hypertrophy' : 'Endurance';
                  const zoneColor = pct >= 90 ? '#ef4444' : pct >= 75 ? '#3b82f6' : '#22c55e';
                  return (
                    <div
                      key={pct}
                      className={`flex items-center gap-2 py-2.5 border-t border-white/5 first:border-t-0 ${pct === 100 ? 'bg-wf-red/5' : ''}`}
                    >
                      <div className="w-14">
                        <span className={`text-sm font-mono-stat ${pct === 100 ? 'text-wf-red font-bold' : 'text-white/60'}`}>{pct}%</span>
                        <span className="block text-[9px] uppercase font-bold mt-0.5" style={{ color: zoneColor, letterSpacing: '0.15em' }}>{zone}</span>
                      </div>
                      <span className={`flex-1 text-center text-base font-mono-stat tabular-nums ${pct === 100 ? 'text-white font-bold' : 'text-white/55'}`}>{pctWeight} <span className="text-[10px] text-white/30">LBS</span></span>
                      <span className="w-20 text-sm font-mono-stat text-white/40 text-right">{displayReps}</span>
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

// Single Nike-style row used by every utility entry on the page. Renders as
// <button>, <a>, or locked <div> based on the props. Color drives the left
// accent stripe, the icon block tint, and the soft glow shadow on the icon
// block — same color identity each card had in the old glass-card design,
// just expressed in the Nike pattern (2px corners, square icon block,
// uppercase letterspaced title).
function UtilityRow({ color, icon, title, subtitle, onClick, href, locked = false, animationDelay = 0 }) {
  const cardStyle = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
    borderLeft: `3px solid ${color}`,
    animationDelay: `${animationDelay}ms`,
  };
  const iconBlock = {
    background: `linear-gradient(135deg, ${color}25 0%, ${color}10 100%)`,
    borderRadius: '2px',
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px ${color}20`,
  };
  const inner = (
    <div className="p-5 flex items-center gap-4">
      <div className="w-12 h-12 flex items-center justify-center shrink-0" style={iconBlock}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[13px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>
          {title}
        </h3>
        <p className="text-[11px] text-white/40 font-light mt-0.5 leading-relaxed">
          {subtitle}
        </p>
      </div>
      {locked ? (
        <span
          className="text-[10px] font-bold uppercase tracking-wider shrink-0"
          style={{
            background: 'rgba(234,179,8,0.18)',
            color: '#facc15',
            border: '1px solid rgba(234,179,8,0.4)',
            borderRadius: '2px',
            padding: '2px 8px',
            letterSpacing: '0.2em',
          }}
        >
          Pro
        </span>
      ) : (
        <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </div>
  );

  if (locked) {
    return (
      <div className="w-full overflow-hidden fade-slide-up text-left opacity-60" style={cardStyle}>
        {inner}
      </div>
    );
  }
  if (href) {
    return (
      <a href={href} className="w-full overflow-hidden fade-slide-up text-left block active:scale-[0.98] transition-transform" style={cardStyle}>
        {inner}
      </a>
    );
  }
  return (
    <button onClick={onClick} className="w-full overflow-hidden fade-slide-up text-left active:scale-[0.98] transition-transform" style={cardStyle}>
      {inner}
    </button>
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
      <StickyHeader title="UTILITIES" titleStyle={{ fontSize: '26.4px' }} />

      <div className="px-4 pb-4">
        {/* Nike-style intro panel — eyebrow + heavy display title with the
            same red accent stripe + ambient spotlight pattern used on the
            Profile and Workouts pages. */}
        <div
          className="relative overflow-hidden mb-4 fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
              Toolkit
            </p>
            <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              UTILITIES
            </h1>
            <p className="text-[12px] text-white/40 font-light mt-2 leading-relaxed">
              Calculators, timers, and quick references that live alongside your workouts.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <UtilityRow
            color="#a855f7"
            onClick={() => navigate('/community')}
            animationDelay={0}
            title="Community"
            subtitle="Activity feed, friends, and leaderboards"
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#c084fc" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            )}
          />

          <UtilityRow
            color="#22c55e"
            onClick={() => navigate('/progress')}
            animationDelay={20}
            title="Progress"
            subtitle="Same weight, more reps? Set-by-set progressive overload."
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.5 4.5L21.75 6m0 0H15m6.75 0v6.75" />
              </svg>
            )}
          />

          <UtilityRow
            color="#f59e0b"
            onClick={() => setShowPRs(true)}
            animationDelay={60}
            title="Personal Records"
            subtitle="View your PRs by muscle group"
            icon={(
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#fbbf24">
                <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
              </svg>
            )}
          />

          <UtilityRow
            color="#f43f5e"
            onClick={() => navigate('/plate-calculator')}
            animationDelay={100}
            title="Plate Calculator"
            subtitle="See which plates to load on each side of the bar"
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#fb7185" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
              </svg>
            )}
          />

          <UtilityRow
            color="#06b6d4"
            onClick={() => setShow1RM(true)}
            animationDelay={120}
            title="1 Rep Max Estimator"
            subtitle="Estimate your max from any rep range"
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#22d3ee" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
              </svg>
            )}
          />

          <UtilityRow
            color="#22c55e"
            onClick={() => setShowHIIT(true)}
            animationDelay={140}
            title="HIIT Timer"
            subtitle="Interval timer for high-intensity workouts"
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          />

          <UtilityRow
            color="#3b82f6"
            onClick={() => navigate('/exercises')}
            animationDelay={180}
            title="Exercise Library"
            subtitle="Browse exercises and add custom ones"
            icon={(
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            )}
          />

          {/* Pro-tier rows (BMR, Macros, Body Fat, Ideal Proportions, RPE/RIR)
              are hidden until the calculators are built and Pro is offered. */}
        </div>
      </div>

      {showPRs && (
        <div className="fixed inset-x-0 top-[40px] bottom-0 z-50 bg-black flex flex-col safe-bottom">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <button onClick={() => setShowPRs(false)} className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
            <div className="w-12" />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1">
            {/* Nike intro panel */}
            <div
              className="relative overflow-hidden mb-4 fade-slide-up"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #f59e0b, rgba(245,158,11,0.25), transparent)' }} />
              <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
              <div className="relative p-6">
                <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(245,158,11,0.85)', letterSpacing: '0.4em' }}>
                  Records
                </p>
                <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                  PERSONAL RECORDS
                </h1>
                <p className="text-[12px] text-white/40 font-light mt-2 leading-relaxed">
                  Your best lift at every weight, grouped by muscle.
                </p>
              </div>
            </div>
            <PRsSection />
          </div>
        </div>
      )}
      {showHIIT && <HIITTimer onClose={() => setShowHIIT(false)} />}
      {show1RM && <OneRepMaxEstimator onClose={() => setShow1RM(false)} />}
    </div>
  );
}
