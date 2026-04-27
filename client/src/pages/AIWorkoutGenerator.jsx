import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const GoalIcon = ({ name, className }) => {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'muscle_growth') {
    return (
      <svg {...common}>
        <path d="M3 12h2l1-2 2 4 2-6 2 8 2-5 2 3 2-2h3" />
      </svg>
    );
  }
  if (name === 'strength') {
    return (
      <svg {...common}>
        <line x1="3" y1="12" x2="21" y2="12" />
        <rect x="2" y="9" width="2" height="6" />
        <rect x="20" y="9" width="2" height="6" />
        <rect x="5" y="7" width="3" height="10" />
        <rect x="16" y="7" width="3" height="10" />
      </svg>
    );
  }
  if (name === 'fat_loss') {
    return (
      <svg {...common}>
        <path d="M12 3c1 4 5 5 5 10a5 5 0 11-10 0c0-3 2-4 2-7 1 1 2 1 3-3z" />
      </svg>
    );
  }
  if (name === 'endurance') {
    return (
      <svg {...common}>
        <circle cx="14" cy="5" r="1.6" />
        <path d="M7 21l3-7 3 2 2-4 4 4" />
        <path d="M5 13l3-3 3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
    </svg>
  );
};

const GOALS = [
  { value: 'muscle_growth', label: 'Build Muscle', icon: 'muscle_growth', desc: 'Hypertrophy focused' },
  { value: 'strength', label: 'Get Stronger', icon: 'strength', desc: 'Heavy compound lifts' },
  { value: 'fat_loss', label: 'Lose Fat', icon: 'fat_loss', desc: 'High intensity, supersets' },
  { value: 'endurance', label: 'Endurance', icon: 'endurance', desc: 'Higher reps, shorter rest' },
  { value: 'general', label: 'General Fitness', icon: 'general', desc: 'Balanced approach' },
];

const EXPERIENCE = [
  { value: 'beginner', label: 'Beginner', desc: '0-6 months' },
  { value: 'intermediate', label: 'Intermediate', desc: '6 months - 2 years' },
  { value: 'advanced', label: 'Advanced', desc: '2+ years' },
];

const EQUIPMENT = [
  { value: 'full_gym', label: 'Full Gym' },
  { value: 'dumbbells_only', label: 'Dumbbells Only' },
  { value: 'barbell_rack', label: 'Barbell & Rack' },
  { value: 'bodyweight', label: 'Bodyweight Only' },
  { value: 'home_gym', label: 'Home Gym' },
];

const DURATIONS = [
  { value: '20-30', label: '20-30 min' },
  { value: '30-45', label: '30-45 min' },
  { value: '45-60', label: '45-60 min' },
  { value: '60-90', label: '60-90 min' },
];

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Core', 'Full Body',
];

const PANEL_STYLE = {
  background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
  borderRadius: '2px',
  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
};
const ACCENT_STRIPE = { background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' };
const SPOTLIGHT = { background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' };
const EYEBROW_STYLE = { color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' };
const TITLE_STYLE = { fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' };
const STEP_STYLE = { color: 'rgba(255,255,255,0.45)', letterSpacing: '0.3em' };
const PRIMARY_RED = {
  letterSpacing: '0.2em',
  borderRadius: '2px',
  background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
};
const GHOST_BTN = {
  letterSpacing: '0.2em',
  borderRadius: '2px',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'transparent',
};

export default function AIWorkoutGenerator() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0: goal, 1: experience, 2: details, 3: generating, 4: preview
  const [goal, setGoal] = useState('');
  const [experience, setExperience] = useState('');
  const [equipment, setEquipment] = useState('full_gym');
  const [duration, setDuration] = useState('45-60');
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [workout, setWorkout] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [editing, setEditing] = useState(false);

  function toggleMuscle(m) {
    if (m === 'Full Body') {
      setSelectedMuscles(selectedMuscles.includes('Full Body') ? [] : ['Full Body']);
    } else {
      setSelectedMuscles(prev =>
        prev.filter(x => x !== 'Full Body').includes(m)
          ? prev.filter(x => x !== m)
          : [...prev.filter(x => x !== 'Full Body'), m]
      );
    }
  }

  async function handleGenerate() {
    setError('');
    setGenerating(true);
    setStep(3);
    try {
      const result = await api('/ai/generate-workout', {
        method: 'POST',
        body: JSON.stringify({
          goal: GOALS.find(g => g.value === goal)?.label || goal,
          experience,
          equipment: EQUIPMENT.find(e => e.value === equipment)?.label || equipment,
          duration,
          muscleGroups: selectedMuscles.join(', ') || 'Full body',
          notes: notes.trim() || undefined,
        }),
      });
      setWorkout(result);
      setStep(4);
    } catch (err) {
      setError(err.message);
      setStep(2); // go back to details
    } finally {
      setGenerating(false);
    }
  }

  async function handleEdit() {
    if (!editInput.trim() || !workout || editing) return;
    setEditing(true);
    setError('');
    try {
      const result = await api('/ai/edit-workout', {
        method: 'POST',
        body: JSON.stringify({
          workout,
          instruction: editInput.trim(),
        }),
      });
      setWorkout(result);
      setEditInput('');
    } catch (err) {
      setError(err.message || 'Failed to edit workout');
    } finally {
      setEditing(false);
    }
  }

  async function handleSave() {
    if (!workout) return;
    setSaving(true);
    try {
      // Find or create "My Workouts" program
      const programs = await api('/programs');
      let program = programs.find(p => p.name === 'My Workouts');
      if (!program) {
        program = await api('/programs', {
          method: 'POST',
          body: JSON.stringify({ name: 'My Workouts', description: 'Quick-created workouts' }),
        });
      }

      await api('/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: workout.name,
          description: workout.description || '',
          exercises: workout.exercises,
          programId: program.id,
        }),
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalSteps = 4;
  const stepNum = Math.min(step + 1, totalSteps);
  const stepLabel = `STEP ${String(stepNum).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}`;

  function PanelHeader({ eyebrow, title, subtitle, showStep = true, children }) {
    return (
      <div className="relative overflow-hidden mb-5" style={PANEL_STYLE}>
        <div className="h-[3px]" style={ACCENT_STRIPE} />
        <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={SPOTLIGHT} />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-[10px] uppercase font-light" style={EYEBROW_STYLE}>{eyebrow}</p>
            {showStep && step <= 2 && (
              <p className="text-[9px] uppercase font-light" style={STEP_STYLE}>{stepLabel}</p>
            )}
          </div>
          <h1 className="text-[28px] font-black text-white tracking-tight" style={TITLE_STYLE}>{title}</h1>
          {subtitle && <p className="text-sm text-wf-gray-400 mt-2 leading-relaxed">{subtitle}</p>}
          {children && <div className="mt-5 pt-4 border-t border-white/5">{children}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24 safe-top safe-bottom">
      {/* Back button */}
      <button
        onClick={() => step === 0 ? navigate(-1) : setStep(Math.max(0, step - 1))}
        className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors mb-5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {step === 0 ? 'Back' : 'Previous'}
      </button>

      {/* Progress bars — Nike sharp blocks */}
      <div className="flex items-center gap-1.5 mb-6">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-[3px] flex-1 transition-all"
            style={{
              borderRadius: '1px',
              background: i === step
                ? 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.7))'
                : i < step
                  ? 'rgba(239,68,68,0.35)'
                  : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>

      {/* Step 0: Goal */}
      {step === 0 && (
        <div className="fade-slide-up">
          <PanelHeader
            eyebrow="AI COACH"
            title="WHAT'S YOUR GOAL?"
            subtitle="We'll tailor every set, rep, and rest period to match."
          />
          <div className="space-y-2.5">
            {GOALS.map(g => {
              const active = goal === g.value;
              return (
                <button
                  key={g.value}
                  onClick={() => { setGoal(g.value); setStep(1); }}
                  className="w-full text-left relative overflow-hidden active:scale-[0.99] transition-all min-h-[64px]"
                  style={{
                    background: active
                      ? 'linear-gradient(160deg, rgba(239,68,68,0.10) 0%, rgba(20,20,20,0.95) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: active ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                  }}
                >
                  {active && <div className="h-[2px]" style={ACCENT_STRIPE} />}
                  <div className="flex items-center gap-4 px-4 py-4">
                    <div
                      className="w-11 h-11 flex items-center justify-center shrink-0"
                      style={{
                        borderRadius: '2px',
                        background: active
                          ? 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)'
                          : 'rgba(239,68,68,0.10)',
                        boxShadow: active ? '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                      }}
                    >
                      <GoalIcon name={g.icon} className={`w-5 h-5 ${active ? 'text-white' : 'text-wf-red'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[13px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>{g.label}</h3>
                      <p className="text-[11px] text-white/40 font-light mt-0.5">{g.desc}</p>
                    </div>
                    <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 1: Experience */}
      {step === 1 && (
        <div className="fade-slide-up">
          <PanelHeader
            eyebrow="AI COACH"
            title="EXPERIENCE LEVEL"
            subtitle="This adjusts weight recommendations and exercise complexity."
          />
          <div className="space-y-2.5">
            {EXPERIENCE.map(e => {
              const active = experience === e.value;
              return (
                <button
                  key={e.value}
                  onClick={() => { setExperience(e.value); setStep(2); }}
                  className="w-full text-left relative overflow-hidden active:scale-[0.99] transition-all min-h-[64px]"
                  style={{
                    background: active
                      ? 'linear-gradient(160deg, rgba(239,68,68,0.10) 0%, rgba(20,20,20,0.95) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: active ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                  }}
                >
                  {active && <div className="h-[2px]" style={ACCENT_STRIPE} />}
                  <div className="px-4 py-4">
                    <h3 className="text-[13px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>{e.label}</h3>
                    <p className="text-[11px] text-white/40 font-light mt-0.5">{e.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="fade-slide-up">
          <PanelHeader
            eyebrow="AI COACH"
            title="CUSTOMIZE"
            subtitle="Fine-tune the workout to your equipment and target."
          >
            {error && (
              <div className="px-4 py-3 text-red-300 text-sm" style={{ background: 'rgba(127,29,29,0.30)', border: '1px solid rgba(153,27,27,0.6)', borderRadius: '2px' }}>
                {error}
              </div>
            )}
          </PanelHeader>

          {/* Equipment */}
          <p className="text-[10px] uppercase font-bold mb-2.5" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>Equipment</p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {EQUIPMENT.map(e => {
              const active = equipment === e.value;
              return (
                <button
                  key={e.value}
                  onClick={() => setEquipment(e.value)}
                  className="relative overflow-hidden text-left min-h-[44px] active:scale-[0.98] transition-all"
                  style={{
                    background: active
                      ? 'linear-gradient(160deg, rgba(239,68,68,0.10) 0%, rgba(20,20,20,0.95) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: active ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                  }}
                >
                  {active && <div className="h-[2px]" style={ACCENT_STRIPE} />}
                  <div className="px-3 py-2.5">
                    <span className="text-[11px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>
                      {e.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Duration */}
          <p className="text-[10px] uppercase font-bold mb-2.5" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>Duration</p>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {DURATIONS.map(d => {
              const active = duration === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className="relative overflow-hidden text-left min-h-[44px] active:scale-[0.98] transition-all"
                  style={{
                    background: active
                      ? 'linear-gradient(160deg, rgba(239,68,68,0.10) 0%, rgba(20,20,20,0.95) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: active ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                  }}
                >
                  {active && <div className="h-[2px]" style={ACCENT_STRIPE} />}
                  <div className="px-3 py-2.5">
                    <span className="text-[11px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>
                      {d.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Muscle Groups */}
          <p className="text-[10px] uppercase font-bold mb-2.5" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>Target Muscles</p>
          <div className="flex gap-2 flex-wrap mb-6">
            {MUSCLE_GROUPS.map(m => {
              const active = selectedMuscles.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => toggleMuscle(m)}
                  className="min-h-[44px] px-4 active:scale-[0.97] transition-all"
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: active ? '1px solid rgba(239,68,68,0.7)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                    boxShadow: active ? '0 4px 14px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                    letterSpacing: '0.1em',
                  }}
                >
                  <span className="text-[11px] font-bold uppercase">{m}</span>
                </button>
              );
            })}
          </div>

          {/* Notes */}
          <p className="text-[10px] uppercase font-bold mb-2.5" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
            Additional Notes <span className="text-white/30 font-light normal-case" style={{ letterSpacing: '0' }}>(optional)</span>
          </p>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. bad knees, focus on upper chest, no deadlifts"
            className="w-full glass-input px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all mb-8"
            style={{ borderRadius: '2px' }}
          />

          <button
            onClick={handleGenerate}
            className="w-full text-white font-bold uppercase py-4 text-sm active:scale-[0.98] transition-transform"
            style={PRIMARY_RED}
          >
            Generate Workout
          </button>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 3 && (
        <div className="fade-slide-up">
          <div className="relative overflow-hidden" style={PANEL_STYLE}>
            <div className="h-[3px]" style={ACCENT_STRIPE} />
            <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={SPOTLIGHT} />
            <div className="relative p-6 flex flex-col items-center justify-center py-16">
              <div
                className="w-16 h-16 flex items-center justify-center mb-6 animate-pulse"
                style={{
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.15) 100%)',
                  border: '1px solid rgba(239,68,68,0.4)',
                }}
              >
                <svg className="w-7 h-7 text-wf-red animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <p className="text-[10px] uppercase font-light mb-1" style={EYEBROW_STYLE}>AI Coach</p>
              <h2 className="text-[22px] font-black text-white tracking-tight mb-2" style={TITLE_STYLE}>GENERATING...</h2>
              <p className="text-[12px] text-white/50 font-light text-center max-w-xs">
                Designing the perfect routine for you
              </p>

              <div className="w-full max-w-xs mt-8 space-y-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="h-3 animate-pulse"
                    style={{
                      borderRadius: '2px',
                      background: 'rgba(255,255,255,0.05)',
                      animationDelay: `${i * 0.15}s`,
                      width: i === 1 ? '85%' : i === 2 ? '70%' : '100%',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 4 && workout && (
        <div className="fade-slide-up">
          <div className="relative overflow-hidden mb-5" style={PANEL_STYLE}>
            <div className="h-[3px]" style={ACCENT_STRIPE} />
            <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={SPOTLIGHT} />
            <div className="relative p-6">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <p className="text-[10px] uppercase font-light" style={EYEBROW_STYLE}>AI Generated</p>
              </div>
              <h1 className="text-[28px] font-black text-white tracking-tight" style={TITLE_STYLE}>
                {(workout.name || 'WORKOUT').toUpperCase()}
              </h1>
              {workout.description && (
                <p className="text-sm text-wf-gray-400 mt-2 leading-relaxed">{workout.description}</p>
              )}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
                <div>
                  <p className="text-[9px] uppercase font-light" style={STEP_STYLE}>Exercises</p>
                  <p className="text-[18px] font-black text-white mt-0.5" style={TITLE_STYLE}>{workout.exercises.length}</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="text-[9px] uppercase font-light" style={STEP_STYLE}>Total Sets</p>
                  <p className="text-[18px] font-black text-white mt-0.5" style={TITLE_STYLE}>
                    {workout.exercises.reduce((s, e) => s + e.sets.length, 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 text-red-300 text-sm mb-4" style={{ background: 'rgba(127,29,29,0.30)', border: '1px solid rgba(153,27,27,0.6)', borderRadius: '2px' }}>
              {error}
            </div>
          )}

          {/* Exercise cards */}
          <p className="text-[10px] uppercase font-bold mb-3" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>Exercises</p>
          <div className="space-y-2.5 mb-6">
            {workout.exercises.map((ex, idx) => (
              <div
                key={idx}
                className="relative overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                  borderRadius: '2px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-light text-white/30" style={{ letterSpacing: '0.3em' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-[14px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.05em' }}>
                      {ex.name}
                    </h3>
                  </div>
                  {ex.setType && ex.setType !== 'straight' && (
                    <span className="inline-block mt-1.5 text-[9px] text-wf-red font-bold uppercase" style={{ letterSpacing: '0.2em' }}>
                      {ex.setType} Set
                    </span>
                  )}
                </div>
                <div className="px-4 py-2">
                  <div className="flex items-center gap-2 py-1 mb-1">
                    <span className="w-10 text-[9px] uppercase tracking-widest text-white/30">Set</span>
                    <span className="flex-1 text-[9px] uppercase tracking-widest text-white/30 text-center">Weight</span>
                    <span className="flex-1 text-[9px] uppercase tracking-widest text-white/30 text-center">Reps</span>
                  </div>
                  {ex.sets.map((set, si) => (
                    <div key={si} className="flex items-center gap-2 py-1.5 border-t border-white/5">
                      <span className="w-10 text-sm text-white/50 font-mono-stat">{si + 1}</span>
                      <span className="flex-1 text-sm text-white/80 text-center font-mono-stat">
                        {set.weight > 0 ? `${set.weight} lbs` : '—'}
                      </span>
                      <span className="flex-1 text-sm text-white/80 text-center font-mono-stat">{set.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Edit input */}
          <div className="relative overflow-hidden mb-6" style={PANEL_STYLE}>
            <div className="h-[3px]" style={ACCENT_STRIPE} />
            <div className="relative p-4">
              <p className="text-[10px] uppercase font-bold mb-2.5" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
                Refine Workout
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editInput}
                  onChange={(e) => setEditInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                  placeholder="e.g. Make barbell curls a drop set, add 2 sets to bench press..."
                  className="flex-1 px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-wf-red/50 transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                  }}
                  disabled={editing}
                />
                <button
                  onClick={handleEdit}
                  disabled={editing || !editInput.trim()}
                  className="shrink-0 px-4 py-2.5 active:scale-[0.95] transition-all disabled:opacity-40"
                  style={{
                    borderRadius: '2px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.20) 0%, rgba(220,38,38,0.20) 100%)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#ef4444',
                  }}
                >
                  {editing ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setWorkout(null); setStep(2); setEditInput(''); }}
              className="flex-1 text-white font-bold uppercase py-4 text-[11px] active:scale-[0.98] transition-transform"
              style={GHOST_BTN}
            >
              Regenerate
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-white font-bold uppercase py-4 text-[11px] active:scale-[0.98] transition-transform disabled:opacity-50"
              style={PRIMARY_RED}
            >
              {saving ? 'Saving...' : 'Save Workout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
