import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const GOALS = [
  { value: 'muscle_growth', label: 'Build Muscle', icon: '💪', desc: 'Hypertrophy focused' },
  { value: 'strength', label: 'Get Stronger', icon: '🏋️', desc: 'Heavy compound lifts' },
  { value: 'fat_loss', label: 'Lose Fat', icon: '🔥', desc: 'High intensity, supersets' },
  { value: 'endurance', label: 'Endurance', icon: '🏃', desc: 'Higher reps, shorter rest' },
  { value: 'general', label: 'General Fitness', icon: '⚡', desc: 'Balanced approach' },
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

  return (
    <div className="min-h-screen bg-black px-4 pt-6 pb-24 safe-top safe-bottom">
      {/* Back button */}
      <button onClick={() => step === 0 ? navigate(-1) : setStep(Math.max(0, step - 1))} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        {step === 0 ? 'Back' : 'Previous'}
      </button>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${
            i === step ? 'w-8 bg-wf-red' :
            i < step ? 'w-4 bg-wf-red/40' :
            'w-4 bg-white/10'
          }`} />
        ))}
      </div>

      {/* Step 0: Goal */}
      {step === 0 && (
        <div className="fade-slide-up">
          <h1 className="text-2xl font-black text-white mb-2">What's your goal?</h1>
          <p className="text-wf-gray-400 text-sm mb-6">We'll tailor the workout to match</p>
          <div className="space-y-3">
            {GOALS.map(g => (
              <button
                key={g.value}
                onClick={() => { setGoal(g.value); setStep(1); }}
                className={`w-full text-left glass-card rounded-xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all ${
                  goal === g.value ? '!border-wf-red' : ''
                }`}
              >
                <span className="text-2xl">{g.icon}</span>
                <div>
                  <h3 className="text-base font-semibold text-white">{g.label}</h3>
                  <p className="text-xs text-wf-gray-500">{g.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Experience */}
      {step === 1 && (
        <div className="fade-slide-up">
          <h1 className="text-2xl font-black text-white mb-2">Experience level?</h1>
          <p className="text-wf-gray-400 text-sm mb-6">This adjusts weight and complexity</p>
          <div className="space-y-3">
            {EXPERIENCE.map(e => (
              <button
                key={e.value}
                onClick={() => { setExperience(e.value); setStep(2); }}
                className={`w-full text-left glass-card rounded-xl p-4 active:scale-[0.98] transition-all ${
                  experience === e.value ? '!border-wf-red' : ''
                }`}
              >
                <h3 className="text-base font-semibold text-white">{e.label}</h3>
                <p className="text-xs text-wf-gray-500">{e.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="fade-slide-up">
          <h1 className="text-2xl font-black text-white mb-2">Customize</h1>
          <p className="text-wf-gray-400 text-sm mb-6">Fine-tune your workout</p>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Equipment */}
          <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-2 block">Equipment</label>
          <div className="flex gap-2 flex-wrap mb-5">
            {EQUIPMENT.map(e => (
              <button
                key={e.value}
                onClick={() => setEquipment(e.value)}
                className={`text-xs font-medium px-3 py-2 rounded-full transition-all ${
                  equipment === e.value
                    ? 'bg-wf-red text-white'
                    : 'bg-white/5 text-wf-gray-400 border border-white/10'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>

          {/* Duration */}
          <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-2 block">Duration</label>
          <div className="flex gap-2 flex-wrap mb-5">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`text-xs font-medium px-3 py-2 rounded-full transition-all ${
                  duration === d.value
                    ? 'bg-wf-red text-white'
                    : 'bg-white/5 text-wf-gray-400 border border-white/10'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Muscle Groups */}
          <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-2 block">Target Muscles</label>
          <div className="flex gap-2 flex-wrap mb-5">
            {MUSCLE_GROUPS.map(m => (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                className={`text-xs font-medium px-3 py-2 rounded-full transition-all ${
                  selectedMuscles.includes(m)
                    ? 'bg-wf-red text-white'
                    : 'bg-white/5 text-wf-gray-400 border border-white/10'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Notes */}
          <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-2 block">Additional Notes <span className="text-wf-gray-600">(optional)</span></label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. bad knees, focus on upper chest, no deadlifts"
            className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none mb-6"
          />

          <button
            onClick={handleGenerate}
            className="w-full btn-gradient text-white font-semibold py-4 rounded-xl text-base active:scale-[0.98] transition-all"
          >
            Generate My Workout
          </button>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 3 && (
        <div className="flex flex-col items-center justify-center py-20 fade-slide-up">
          <div className="w-16 h-16 rounded-full bg-wf-red/15 flex items-center justify-center mb-6 animate-pulse">
            <svg className="w-8 h-8 text-wf-red animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Creating your workout...</h2>
          <p className="text-wf-gray-400 text-sm">AI is designing the perfect routine for you</p>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 4 && workout && (
        <div className="fade-slide-up">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-xs text-wf-red font-semibold uppercase tracking-wider">AI Generated</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-1">{workout.name}</h1>
          {workout.description && (
            <p className="text-wf-gray-400 text-sm mb-4">{workout.description}</p>
          )}
          <p className="text-wf-gray-500 text-xs mb-6">
            {workout.exercises.length} exercises · {workout.exercises.reduce((s, e) => s + e.sets.length, 0)} total sets
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Exercise cards */}
          <div className="space-y-3 mb-6">
            {workout.exercises.map((ex, idx) => (
              <div key={idx} className="glass-card rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <h3 className="text-base font-semibold text-white">{ex.name}</h3>
                  {ex.setType && ex.setType !== 'straight' && (
                    <span className="text-[10px] text-wf-red font-semibold uppercase">{ex.setType} set</span>
                  )}
                </div>
                <div className="px-4 py-2">
                  <div className="flex items-center gap-2 py-1 mb-1">
                    <span className="w-10 text-[9px] uppercase tracking-widest text-wf-gray-600">Set</span>
                    <span className="flex-1 text-[9px] uppercase tracking-widest text-wf-gray-600 text-center">Weight</span>
                    <span className="flex-1 text-[9px] uppercase tracking-widest text-wf-gray-600 text-center">Reps</span>
                  </div>
                  {ex.sets.map((set, si) => (
                    <div key={si} className="flex items-center gap-2 py-1.5 border-t border-white/5">
                      <span className="w-10 text-sm text-wf-gray-500">{si + 1}</span>
                      <span className="flex-1 text-sm text-wf-gray-400 text-center font-mono-stat">
                        {set.weight > 0 ? `${set.weight} lbs` : '—'}
                      </span>
                      <span className="flex-1 text-sm text-wf-gray-400 text-center font-mono-stat">{set.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Edit input */}
          <div className="glass-card rounded-xl p-3 mb-6">
            <label className="text-[10px] text-wf-gray-500 uppercase tracking-wider mb-2 block">Refine this workout</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editInput}
                onChange={(e) => setEditInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                placeholder="e.g. Make barbell curls a drop set, add 2 sets to bench press..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-wf-gray-600 focus:outline-none focus:border-wf-red/50"
                disabled={editing}
              />
              <button
                onClick={handleEdit}
                disabled={editing || !editInput.trim()}
                className="shrink-0 bg-wf-red/20 text-wf-red font-semibold px-4 py-2.5 rounded-lg text-sm active:scale-[0.98] transition-all disabled:opacity-40"
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

          <div className="flex gap-3">
            <button
              onClick={() => { setWorkout(null); setStep(2); setEditInput(''); }}
              className="flex-1 glass-card text-white font-semibold py-4 rounded-xl text-sm active:scale-[0.98] transition-all"
            >
              Regenerate
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 btn-gradient text-white font-semibold py-4 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Workout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
