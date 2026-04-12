import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';

// RepLab exercise video CDN (Render static site, source: replab-videos/)
const VIDEO_CDN = 'https://replab-videos.onrender.com';

// Daily workout templates
const WORKOUTS = {
  'chest': {
    name: 'Chest',
    subtitle: 'Chest',
    description: "This chest workout starts with a barbell bench warm-up progressing to working sets, followed by a 10×10 German Volume Training block on incline DB press, then isolation flyes and a max push-up burnout to finish.",
    exercises: [
      {
        name: 'Barbell Bench (Warm Up)',
        isSectionHeader: true,
        sectionNotes: 'Warm up with progressive sets. Pause reps on sets 2 and 3 — hold the bar 1 inch off the chest for 2 seconds before pressing.',
        setType: 'warm_up',
        videoUrl: `${VIDEO_CDN}/wills-hypertrophy-program/chest/dumbbell-lateral-raise.mp4`,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Barbell Bench',
        setType: 'warm_up',
        description: "Warm-up sets to prime your chest, shoulders, and triceps. Sets 2 and 3 are pause reps — lower the bar to just above your chest, hold for a 2-count, then press explosively. Set 4 is heavier to activate the nervous system before working sets.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 6, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 5, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 2, suggestedWeight: 0 },
          { setNumber: 4, plannedReps: 2, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Barbell Bench',
        setType: 'straight',
        description: "Working sets. Controlled reps with a full range of motion — touch the chest, press to full lockout. Aim for 8-10 reps per set. If you hit 10 on all 3 sets, increase weight next session.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 0 },
        ],
      },
      {
        name: 'DB Incline Bench Press',
        setType: 'straight',
        description: "10×10 German Volume Training — 10 sets of 10 reps with only 60 seconds rest between sets. Use a weight you could do 20 reps with. This is about volume and time under tension, not max weight. The burn will be intense by set 6.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 4, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 5, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 6, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 7, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 8, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 9, plannedReps: 10, suggestedWeight: 0 },
          { setNumber: 10, plannedReps: 10, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Straight Arm Kneeling Upper Chest Cable Flyes',
        setType: 'straight',
        description: "Kneel in front of a low cable with arms straight. Bring the handles up and together in front of your upper chest, squeezing at the top. This targets the upper chest fibers that are hard to hit with pressing alone. Keep the arms nearly straight throughout.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 15, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Pec Deck Flyes',
        setType: 'straight',
        description: "Isolation finisher on the pec deck. Squeeze hard at the peak contraction and control the negative. Go to near-failure on each set.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 15, suggestedWeight: 0 },
          { setNumber: 3, plannedReps: 15, suggestedWeight: 0 },
        ],
      },
      {
        name: 'Max Push-Ups',
        setType: 'straight',
        description: "Final burnout — one set to absolute failure. Your chest is completely pre-fatigued at this point, so even bodyweight will be a challenge. Log your total reps.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
        ],
      },
    ],
  },
  'bis-rds': { name: 'Bis/RDs', subtitle: 'Biceps, Rear Delts', description: 'Bicep and rear delt focused session with supersets and isolation work.', exercises: [] },
  'quads': { name: 'Quads', subtitle: 'Quads, Calves', description: 'Quad-dominant leg day with leg extensions, squats, leg press, and calf work.', exercises: [] },
  'tris-shoulders': { name: 'Tris/Shoulders', subtitle: 'Triceps, Shoulders', description: 'Tricep and shoulder session with pressing movements and isolation burnouts.', exercises: [] },
  'back-traps': { name: 'Back/Traps', subtitle: 'Back, Traps', description: 'Pulling session — rows, pulldowns, shrugs, and rear delt work.', exercises: [] },
  'glutes-hams': { name: 'Glutes/Hams', subtitle: 'Glutes, Hamstrings', description: 'Posterior chain focused — RDLs, hip thrusts, leg curls, and walking lunges.', exercises: [] },
};

// Program structure: 12 weeks, 6 workouts per week
const WEEKLY_SCHEDULE = ['chest', 'bis-rds', 'quads', 'tris-shoulders', 'back-traps', 'glutes-hams'];

const PROGRAM = {
  name: "Will's Hypertrophy Program",
  description: '12 Week Resistance Training Program focused on muscle hypertrophy',
  totalWeeks: 12,
  daysPerWeek: WEEKLY_SCHEDULE,
};

export default function FeaturedWorkoutSession() {
  const navigate = useNavigate();
  const { workoutId } = useParams();
  const location = useLocation();

  // If navigated from calendar/home with specific week+day, start there
  const navState = location.state || {};
  const [selectedWeek, setSelectedWeek] = useState(navState.week || null);
  const [selectedDay, setSelectedDay] = useState(navState.day || null);
  const [currentIdx, setCurrentIdx] = useState(navState.day ? -1 : -1);
  const [entries, setEntries] = useState({});
  const [completedSets, setCompletedSets] = useState(new Set());
  const containerRef = useRef(null);

  // Sync state when navigation changes (component may be reused by React Router)
  useEffect(() => {
    const s = location.state || {};
    if (s.week) setSelectedWeek(s.week);
    if (s.day) {
      setSelectedDay(s.day);
      setCurrentIdx(-1);
    }
  }, [location.key]);

  // Workout timer
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [pinTimer, setPinTimer] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [timerFloating, setTimerFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 16, y: 100 });
  const floatStartRef = useRef(null);

  // Timer tick
  useEffect(() => {
    if (!timerStarted) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timerStarted]);

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function startTimer() {
    if (!timerStarted) setTimerStarted(true);
  }

  // Floating timer drag handlers
  function handleFloatTouchStart(e) {
    const t = e.touches[0];
    floatStartRef.current = { x: t.clientX - floatPos.x, y: t.clientY - floatPos.y };
  }
  function handleFloatTouchMove(e) {
    if (!floatStartRef.current) return;
    const t = e.touches[0];
    setFloatPos({ x: t.clientX - floatStartRef.current.x, y: t.clientY - floatStartRef.current.y });
  }
  function handleFloatTouchEnd() { floatStartRef.current = null; }

  const workout = selectedDay ? WORKOUTS[selectedDay] : null;
  const totalExercises = workout ? workout.exercises.length : 0;
  const exercise = currentIdx >= 0 && workout ? workout.exercises[currentIdx] : null;

  function handleChange(setIdx, field, value) {
    if (!exercise) return;
    const key = exercise.name;
    setEntries((prev) => {
      const updated = { ...prev };
      updated[key] = [...(updated[key] || exercise.sets.map(() => ({ weight: '', reps: '' })))];
      updated[key][setIdx] = {
        ...updated[key][setIdx],
        [field]: field === 'setType' ? value : (value === '' ? '' : Math.max(0, Number(value))),
      };
      return updated;
    });
  }

  function handleToggleComplete(setIdx) {
    if (!exercise) return;
    const key = `${exercise.name}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        if (navigator.vibrate) navigator.vibrate(15);
      }
      return next;
    });
  }

  function goNext() {
    if (currentIdx < totalExercises - 1) {
      setCurrentIdx(currentIdx + 1);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (currentIdx === 0) {
      setCurrentIdx(-1);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  const progressPct = totalExercises > 0 ? Math.round(((currentIdx + 1) / totalExercises) * 100) : 0;

  // WEEK LIST VIEW — shows all 12 weeks
  if (!selectedWeek) {
    return (
      <div className="min-h-screen bg-black pb-24">
        <div className="px-4 pt-6 mb-2">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>

        <div className="px-4">
          {/* Program header */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
              Featured Program
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
              {PROGRAM.name}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
              {PROGRAM.description}
            </div>
          </div>

          {/* Week cards */}
          <div className="space-y-3">
            {Array.from({ length: PROGRAM.totalWeeks }, (_, i) => i + 1).map((week) => {
              const weightBonus = Math.floor((week - 1) / 2) * 5;
              return (
                <div
                  key={week}
                  onClick={() => { setSelectedWeek(week); window.scrollTo({ top: 0, behavior: 'instant' }); }}
                  className="cursor-pointer active:scale-[0.98] transition-transform fade-slide-up"
                  style={{
                    animationDelay: `${Math.min(week * 40, 400)}ms`,
                    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0808 50%, #0a0606 100%)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    border: '0.75px solid rgba(255,255,255,0.15)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: '40%', height: '80%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)', filter: 'blur(20px)' }} />
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                        Week {week}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        {PROGRAM.daysPerWeek.map(d => WORKOUTS[d].name).join(' · ')}
                      </div>
                      {weightBonus > 0 && (
                        <div style={{ fontSize: '10px', color: 'rgba(239,68,68,0.5)', marginTop: '4px' }}>
                          +{weightBonus} lbs progressive overload
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // DAY LIST VIEW — shows the 6 workouts for the selected week
  if (selectedWeek && !selectedDay) {
    const weightBonus = Math.floor((selectedWeek - 1) / 2) * 5;
    return (
      <div className="min-h-screen bg-black pb-24">
        <div className="px-4 pt-6 mb-2">
          <button onClick={() => { setSelectedWeek(null); window.scrollTo({ top: 0, behavior: 'instant' }); }} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All Weeks
          </button>
        </div>

        <div className="px-4">
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
              Week {selectedWeek} of {PROGRAM.totalWeeks}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
              {PROGRAM.name}
            </div>
            {weightBonus > 0 && (
              <div style={{ fontSize: '12px', color: 'rgba(239,68,68,0.5)', marginTop: '4px' }}>
                +{weightBonus} lbs progressive overload this week
              </div>
            )}
          </div>

          <div className="space-y-3">
            {PROGRAM.daysPerWeek.map((dayKey, i) => {
              const dayWorkout = WORKOUTS[dayKey];
              const hasExercises = dayWorkout.exercises.length > 0;
              return (
                <div
                  key={dayKey}
                  onClick={() => {
                    if (hasExercises) {
                      setSelectedDay(dayKey);
                      setCurrentIdx(-1);
                      window.scrollTo({ top: 0, behavior: 'instant' });
                    }
                  }}
                  className={`fade-slide-up ${hasExercises ? 'cursor-pointer active:scale-[0.98]' : 'opacity-50'} transition-transform`}
                  style={{
                    animationDelay: `${i * 60}ms`,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700, color: '#ef4444',
                      }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>
                          {dayWorkout.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                          {dayWorkout.subtitle}
                          {hasExercises ? ` · ${dayWorkout.exercises.length} exercises` : ' · Coming soon'}
                        </div>
                      </div>
                    </div>
                    {hasExercises ? (
                      <svg className="w-5 h-5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Soon</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Rest day */}
            <div className="fade-slide-up" style={{
              animationDelay: `${PROGRAM.daysPerWeek.length * 60}ms`,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '14px',
              padding: '16px 20px',
              border: '1px solid rgba(255,255,255,0.04)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>Day 7 — Rest</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EXERCISE OVERVIEW — shows exercise list for the selected day's workout
  if (selectedDay && currentIdx === -1) {
    return (
      <div className="min-h-screen bg-black pb-24">
        <div className="px-4 pt-6 mb-2">
          <button onClick={() => { setSelectedDay(null); window.scrollTo({ top: 0, behavior: 'instant' }); }} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Week {selectedWeek}
          </button>
        </div>

        <div className="px-4">
          {/* Workout header card */}
          <div style={{
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0808 50%, #0a0606 100%)',
            borderRadius: '24px',
            padding: '28px 24px',
            position: 'relative',
            overflow: 'hidden',
            border: '0.75px solid rgba(255,255,255,0.3)',
            boxShadow: '0 0 20px rgba(255,255,255,0.07), 0 0 40px rgba(255,255,255,0.03)',
            marginBottom: '16px',
          }}>
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '60%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.35) 0%, transparent 70%)', filter: 'blur(30px)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                Week {selectedWeek} · Day {PROGRAM.daysPerWeek.indexOf(selectedDay) + 1}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
                {workout.name}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                {workout.subtitle}
              </div>
              <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '16px' }} />

              {/* Start button — above description */}
              {totalExercises > 0 && (
                <button
                  onClick={() => { setCurrentIdx(0); startTimer(); }}
                  style={{
                    width: '100%', padding: '16px', borderRadius: '14px', border: 'none', marginBottom: '16px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(249,115,22,0.9))',
                    color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(239,68,68,0.3)',
                  }}
                  className="active:scale-[0.98] transition-all"
                >
                  Start Guided Workout
                </button>
              )}

              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                {workout.description}
              </p>
            </div>
          </div>

          {/* Exercise list */}
          {totalExercises > 0 ? (
            <>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>
                {totalExercises} Exercises
              </div>
              {workout.exercises.map((ex, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 0',
                  borderBottom: i < totalExercises - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#ef4444',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{ex.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                      {ex.sets.length} sets
                      {ex.setType && ex.setType !== 'straight' && ` · ${ex.setType.replace('_', ' ')}`}
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏗️</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Coming Soon</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>This workout is being built. Check back soon!</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Exercise page
  const exEntries = entries[exercise.name] || exercise.sets.map((s) => ({ weight: s.suggestedWeight || '', reps: '' }));

  return (
    <div className="min-h-screen bg-black pb-24" ref={containerRef}>
      {/* Header */}
      <div className="px-4 pt-6 mb-2 flex items-center justify-between">
        <button onClick={goPrev} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {currentIdx === 0 ? 'Overview' : 'Previous'}
        </button>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>
          {currentIdx + 1} / {totalExercises}
        </span>
      </div>

      {/* Sticky exercise header — stays at top when scrolling */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-xl" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Progress bar */}
        <div className="px-4 pt-2 pb-2">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }}
            />
          </div>
        </div>
        {/* Workout timer — inside sticky header */}
        {timerStarted && !timerFloating && (
          <div className={`px-4 pb-2 ${!pinTimer ? 'hidden' : ''}`} id="featured-timer">
            <div className="rounded-lg overflow-hidden bg-black">
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Workout</span>
                  <span className="bg-black/60 rounded-md px-2.5 py-1">
                    <span className="text-lg font-mono-stat font-bold text-white tracking-wider" style={{ letterSpacing: '2px' }}>{formatTime(elapsed)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setTimerFloating(true); }}
                    className="p-1.5 rounded-md text-wf-gray-500 active:scale-90 hover:text-white/70 transition-colors"
                    title="Pop out timer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPinTimer(p => !p); }}
                    className={`relative w-8 h-[18px] rounded-full transition-all duration-200 ${pinTimer ? '' : 'bg-wf-gray-700'}`}
                    style={pinTimer ? { background: 'linear-gradient(to right, rgba(239,68,68,0.8), rgba(239,68,68,0.3))' } : {}}
                    title={pinTimer ? 'Unpin timer' : 'Pin timer'}
                  >
                    {pinTimer && (
                      <svg className="absolute left-[3px] top-[3px] w-[12px] h-[12px] text-white/70" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
                      </svg>
                    )}
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 ${pinTimer ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Navigation arrows + exercise counter */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${currentIdx === 0 ? 'opacity-20' : ''}`}
          >
            <svg className="w-5 h-5" style={{ color: 'rgba(239,68,68,0.7)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
            Exercise {currentIdx + 1} of {totalExercises}
          </div>
          <button
            onClick={goNext}
            disabled={currentIdx >= totalExercises - 1}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${currentIdx >= totalExercises - 1 ? 'opacity-20' : ''}`}
          >
            <svg className="w-5 h-5" style={{ color: 'rgba(239,68,68,0.7)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
        {/* Exercise name + timer */}
        <div className="px-4 pb-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                {exercise.name}
              </h2>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {exercise.sets.length} sets · {exercise.setType?.replace('_', ' ') || 'straight'}
              </div>
            </div>
            {/* Compact timer when not pinned */}
            {timerStarted && !pinTimer && !timerFloating && (
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Workout Time</span>
                <div className="flex items-center gap-1.5">
                <span className="text-sm font-mono-stat font-bold text-wf-gray-400">{formatTime(elapsed)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setTimerFloating(true); }}
                  className="p-1 rounded text-wf-gray-500 active:scale-90"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-2">

        {/* Video */}
        {exercise.videoUrl && (
          <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '16px', position: 'relative' }}>
            {/* Two stacked videos for seamless crossfade loop */}
            {[0, 1].map((idx) => (
              <video
                key={`${exercise.name}-vid-${idx}`}
                ref={(el) => {
                  if (!el) return;
                  const other = el.parentElement.querySelector(`video:${idx === 0 ? 'last-child' : 'first-child'}`);
                  let raf;
                  const check = () => {
                    if (el.duration && el.currentTime >= el.duration - 0.15) {
                      // Start the other video from 0 and bring it on top
                      if (other && other.paused) {
                        other.currentTime = 0;
                        other.play().catch(() => {});
                      }
                      el.style.opacity = '0';
                      if (other) other.style.opacity = '1';
                      // Reset this video after it's hidden
                      setTimeout(() => {
                        el.currentTime = 0;
                        el.pause();
                      }, 100);
                    }
                    raf = requestAnimationFrame(check);
                  };
                  el.addEventListener('play', () => { raf = requestAnimationFrame(check); });
                  el.addEventListener('pause', () => { cancelAnimationFrame(raf); });
                  // Start first video immediately
                  if (idx === 0) {
                    el.style.opacity = '1';
                    el.play().catch(() => {});
                  } else {
                    el.style.opacity = '0';
                  }
                }}
                src={exercise.videoUrl}
                className="w-full aspect-video object-cover"
                style={{ position: idx === 0 ? 'relative' : 'absolute', top: 0, left: 0, transition: 'opacity 0.05s linear' }}
                muted
                playsInline
                preload="auto"
              />
            ))}
          </div>
        )}

        {/* Sets */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '14px',
          border: '2px solid rgba(239,68,68,0.4)',
          overflow: 'hidden',
        }}>
          {/* Column headers */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-2" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            <div className="w-5 shrink-0" />
            <div className="w-8 shrink-0 text-center">Set</div>
            <div className="flex-1 text-center">Goal Wt</div>
            <div className="flex-1 text-center">Actual Wt</div>
            <div className="flex-1 text-center">Goal Reps</div>
            <div className="flex-1 text-center">Actual Reps</div>
          </div>

          {exercise.sets.map((set, idx) => {
            const entry = exEntries[idx] || {};
            const isCompleted = completedSets.has(`${exercise.name}-${idx}`);
            return (
              <div
                key={idx}
                className={`px-4 py-3 flex items-center gap-2 border-t transition-colors duration-200 ${isCompleted ? 'bg-green-500/10' : ''}`}
                style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                {/* Checkmark */}
                <button
                  onClick={() => handleToggleComplete(idx)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isCompleted ? 'bg-green-500 border-green-500' : 'border-wf-gray-500 bg-transparent'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>

                {/* Set number */}
                <div className="w-8 shrink-0 text-center text-xs text-wf-gray-400 font-medium">{set.setNumber}</div>

                {/* Goal Weight */}
                <div className="flex-1">
                  <div className="w-full rounded-lg px-2 py-2.5 text-center text-sm bg-black/40 border border-white/5" style={{ color: 'rgba(239,68,68,0.6)', fontFamily: 'system-ui', fontWeight: 200, letterSpacing: '-1px' }}>
                    {set.suggestedWeight || '—'}
                  </div>
                </div>

                {/* Actual Weight */}
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={entry.weight ?? ''}
                    placeholder={set.suggestedWeight ? String(set.suggestedWeight) : '0'}
                    onChange={(e) => handleChange(idx, 'weight', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={`w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base focus:outline-none ${isCompleted ? 'completed text-white' : 'text-white'}`}
                  />
                </div>

                {/* Goal Reps */}
                <div className="flex-1">
                  <div className="w-full rounded-lg px-2 py-2.5 text-center text-sm bg-black/40 border border-white/5" style={{ color: 'rgba(239,68,68,0.6)', fontFamily: 'system-ui', fontWeight: 200, letterSpacing: '-1px' }}>
                    {set.plannedReps || '—'}
                  </div>
                </div>

                {/* Actual Reps */}
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={entry.reps ?? ''}
                    placeholder={set.plannedReps ? String(set.plannedReps) : '0'}
                    onChange={(e) => handleChange(idx, 'reps', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={`w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base focus:outline-none ${isCompleted ? 'completed text-white' : 'text-white'}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* How to Perform — below exercise card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          marginTop: '20px',
        }}>
          <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.5)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
            How to Perform
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
            {exercise.description}
          </p>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="px-4 py-6">
        <div className="flex gap-3">
          <button
            onClick={goPrev}
            className="flex-1 py-4 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {currentIdx === 0 ? 'Overview' : 'Previous'}
          </button>
          {currentIdx < totalExercises - 1 ? (
            <button
              onClick={goNext}
              className="flex-[2] py-4 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(249,115,22,0.9))',
                color: 'white',
                boxShadow: '0 0 16px rgba(239,68,68,0.3)',
              }}
            >
              Next Exercise
            </button>
          ) : (
            <button
              onClick={() => {
                clearInterval(timerRef.current);
                setTimerFloating(false);
                setShowSummary(true);
              }}
              className="flex-[2] py-4 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all bg-wf-red/90 hover:bg-wf-red text-white"
            >
              Complete Workout
            </button>
          )}
        </div>
      </div>

      {/* Workout Summary */}
      {showSummary && workout && (() => {
        const completedExercises = workout.exercises.filter((ex, i) => {
          return ex.sets.some((_, si) => completedSets.has(`${ex.name}-${si}`));
        });
        const totalSetsCompleted = completedSets.size;
        const totalSetsAvailable = workout.exercises.reduce((s, ex) => s + ex.sets.length, 0);
        const totalVolume = workout.exercises.reduce((vol, ex) => {
          const exEntries = entries[ex.name] || [];
          return vol + exEntries.reduce((sum, e) => {
            const w = Number(e.weight) || 0;
            const r = Number(e.reps) || 0;
            return sum + (w > 0 ? w * r : 0);
          }, 0);
        }, 0);

        return (
          <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center px-4" style={{ backdropFilter: 'blur(8px)' }}>
            <div className="w-full max-w-sm">
              <div style={{
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0808 50%, #0a0606 100%)',
                borderRadius: '24px',
                padding: '32px 24px',
                border: '0.75px solid rgba(255,255,255,0.2)',
                boxShadow: '0 0 40px rgba(239,68,68,0.1)',
              }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>&#10003;</div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Workout Complete!</h2>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{workout.name} — Week {selectedWeek}</p>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>{formatTime(elapsed)}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Duration</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>{totalSetsCompleted}/{totalSetsAvailable}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Sets</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>{completedExercises.length}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Exercises</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>{totalVolume.toLocaleString()}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Volume (lbs)</div>
                    </div>
                  </div>

                  {/* Exercise breakdown */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    {workout.exercises.map((ex, i) => {
                      const exCompleted = ex.sets.filter((_, si) => completedSets.has(`${ex.name}-${si}`)).length;
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < workout.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{ex.name}</span>
                          <span style={{ fontSize: '12px', color: exCompleted === ex.sets.length ? '#22c55e' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                            {exCompleted}/{ex.sets.length}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowSummary(false);
                    setCurrentIdx(-1);
                    setSelectedDay(null);
                    setTimerStarted(false);
                    setElapsed(0);
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }}
                  style={{
                    width: '100%', padding: '16px', borderRadius: '14px', border: 'none', marginTop: '20px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(249,115,22,0.9))',
                    color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 0 20px rgba(239,68,68,0.3)',
                  }}
                  className="active:scale-[0.98] transition-all"
                >
                  Back to Week {selectedWeek}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating timer — draggable */}
      {timerFloating && timerStarted && (
        <div
          className="fixed z-50 touch-none"
          style={{ left: floatPos.x, top: floatPos.y }}
          onTouchStart={handleFloatTouchStart}
          onTouchMove={handleFloatTouchMove}
          onTouchEnd={handleFloatTouchEnd}
        >
          <div className="bg-wf-gray-900/95 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-sm flex items-center gap-3">
            <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Workout</span>
            <span className="text-lg font-black text-white tabular-nums font-mono-stat">{formatTime(elapsed)}</span>
            <button
              onClick={() => setTimerFloating(false)}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
