import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';

// Daily workout templates
const WORKOUTS = {
  'chest': {
    name: 'Chest',
    subtitle: 'Chest, Triceps, Shoulders',
    description: "This push workout uses a pre-exhaust strategy — we start with isolation flyes to fatigue the chest before moving to heavy compounds. This forces your pecs to work harder during bench and dips, maximizing hypertrophy. The session finishes with tricep burnouts and shoulder work.",
    exercises: [
      {
        name: 'Mid Upper Chest Flyes',
        setType: 'straight',
        description: "Start with a cable fly variation to pre-exhaust the chest. Keep your elbows slightly bent, squeeze at the top, and control the negative. This isolation move warms up the pec fibers and ensures your chest — not your triceps — is the limiting factor on the compounds that follow.",
        videoUrl: '/videos/Barbell Back Squat.mp4',
        sets: [
          { setNumber: 1, plannedReps: 20, suggestedWeight: 30 },
          { setNumber: 2, plannedReps: 20, suggestedWeight: 30 },
          { setNumber: 3, plannedReps: 20, suggestedWeight: 30 },
        ],
      },
      {
        name: 'Banded Close-Grip DB Bench',
        setType: 'straight',
        description: "A unique variation: wrap a resistance band around your back and grip each end with the dumbbells. The band adds peak tension at the top of the press where dumbbells normally get easier. Close grip shifts emphasis to the inner chest and triceps.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 85 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 85 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 85 },
        ],
      },
      {
        name: 'Incline DB Press',
        setType: 'straight',
        description: "Set the bench to 30-45 degrees. Incline pressing targets the upper chest (clavicular head), which is often underdeveloped. Drive the dumbbells up and slightly inward at the top. Don't go too heavy — this is about feeling the upper chest stretch and contract.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 12, suggestedWeight: 75 },
          { setNumber: 2, plannedReps: 12, suggestedWeight: 75 },
          { setNumber: 3, plannedReps: 12, suggestedWeight: 75 },
        ],
      },
      {
        name: 'Weighted Dips',
        setType: 'drop',
        description: "This is a DROP SET. Start heavy with a weight belt, do 4 reps, then immediately strip some weight and do 4 more, then go bodyweight for a burnout of 10. Lean your torso slightly forward to emphasize chest over triceps. Control the descent — no bouncing at the bottom.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 4, suggestedWeight: 90, setType: 'drop' },
          { setNumber: 2, plannedReps: 4, suggestedWeight: 45, setType: 'drop' },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 0, setType: 'drop' },
        ],
      },
      {
        name: 'Cable Tricep Pushdowns',
        setType: 'straight',
        description: "PYRAMID SET — start light and high reps, increase weight while dropping reps, then come back down. This hits the triceps across multiple rep ranges: endurance, strength, and hypertrophy in one extended set. Keep your elbows pinned to your sides and squeeze the lockout.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 12, suggestedWeight: 40 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 50 },
          { setNumber: 3, plannedReps: 8, suggestedWeight: 60 },
          { setNumber: 4, plannedReps: 10, suggestedWeight: 50 },
          { setNumber: 5, plannedReps: 12, suggestedWeight: 40 },
        ],
      },
      {
        name: 'Cable Tricep Kickbacks',
        setType: 'straight',
        description: "Burnout finisher for the triceps. Use a low cable or single handle. Hinge at the hips slightly, extend your arm fully behind you, and squeeze hard at the top. These are light and high-rep — chase the burn, don't worry about weight.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 15, suggestedWeight: 20 },
          { setNumber: 2, plannedReps: 15, suggestedWeight: 20 },
          { setNumber: 3, plannedReps: 15, suggestedWeight: 20 },
        ],
      },
      {
        name: 'Hammer Strength Shoulder Press',
        setType: 'straight',
        description: "Machine shoulder press to finish. After all the pressing work, your stabilizers are fatigued — the machine lets you safely push your delts to failure without worrying about balance. Press explosively, lower with control.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 10, suggestedWeight: 90 },
          { setNumber: 2, plannedReps: 10, suggestedWeight: 90 },
          { setNumber: 3, plannedReps: 10, suggestedWeight: 90 },
        ],
      },
      {
        name: 'Max Push-Ups',
        setType: 'straight',
        description: "Final burnout — go to absolute failure on push-ups. Your chest, triceps, and shoulders are all pre-fatigued, so even bodyweight will be a challenge. This is about mental toughness as much as muscle. Log your total reps.",
        videoUrl: null,
        sets: [
          { setNumber: 1, plannedReps: 0, suggestedWeight: 0 },
          { setNumber: 2, plannedReps: 0, suggestedWeight: 0 },
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
  const [selectedWeek, setSelectedWeek] = useState(null); // null = week list, 1-12 = week detail
  const [selectedDay, setSelectedDay] = useState(null); // null = day list, workout key like 'chest'
  const [currentIdx, setCurrentIdx] = useState(-1); // -1 = overview, 0+ = exercise index
  const [entries, setEntries] = useState({});
  const [completedSets, setCompletedSets] = useState(new Set());
  const containerRef = useRef(null);

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
                      {ex.setType !== 'straight' && ` · ${ex.setType.replace('_', ' ')}`}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCurrentIdx(0)}
                style={{
                  width: '100%', padding: '16px', borderRadius: '14px', border: 'none', marginTop: '16px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9), rgba(249,115,22,0.9))',
                  color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(239,68,68,0.3)',
                }}
                className="active:scale-[0.98] transition-all"
              >
                Start Guided Workout
              </button>
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
    <div className="min-h-screen bg-black pb-32" ref={containerRef}>
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

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #ef4444, #f97316)' }}
          />
        </div>
      </div>

      <div className="px-4">
        {/* Exercise name */}
        <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
          Exercise {currentIdx + 1}
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
          {exercise.name}
        </h2>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '16px', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {exercise.sets.length} sets · {exercise.setType?.replace('_', ' ') || 'straight'}
        </div>

        {/* Video */}
        {exercise.videoUrl && (
          <div style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <video
              src={exercise.videoUrl}
              className="w-full aspect-video object-cover"
              controls
              playsInline
              preload="metadata"
              controlsList="nodownload"
            />
          </div>
        )}

        {/* Description card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '14px',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.5)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
            How to Perform
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
            {exercise.description}
          </p>
        </div>

        {/* Sets */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
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
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
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
              onClick={() => navigate('/')}
              className="flex-[2] py-4 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.9), rgba(16,185,129,0.9))',
                color: 'white',
                boxShadow: '0 0 16px rgba(34,197,94,0.3)',
              }}
            >
              Complete Workout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
