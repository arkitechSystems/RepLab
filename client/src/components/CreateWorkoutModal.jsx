import { useState } from 'react';
import { ownProgramChoices } from '../utils/createWorkout';

// "Create a Workout" prompt (Workouts create menu + Calendar day editor).
// Same look as StartEmptyWorkoutModal. Name is required and starts blank;
// description is optional; the program list is the user's own programs, and
// "no program" saves the workout to My Workouts. Confirm hands the values to
// the parent, which opens the session screen in create mode — nothing is
// saved until Create Workout is pressed there.
export default function CreateWorkoutModal({ programs, onCancel, onConfirm }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [programId, setProgramId] = useState('');
  const [error, setError] = useState('');
  const choices = ownProgramChoices(programs);
  const canConfirm = !!name.trim();

  function confirm() {
    if (!name.trim()) {
      setError('Please enter a workout name.');
      return;
    }
    onConfirm({ name: name.trim(), description: description.trim(), programId: programId ? Number(programId) : null });
  }

  const inputClass = 'w-full glass-input rounded-md px-3 py-2.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all';
  const labelClass = 'block text-[10px] uppercase font-bold mt-4 mb-1.5';
  const labelStyle = { color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workout-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '2px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <p
            className="text-[10px] uppercase font-bold mb-1"
            style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}
          >
            Name Your Workout
          </p>
          <h3
            id="create-workout-title"
            className="text-xl font-black text-white leading-tight"
            style={{ letterSpacing: '-0.01em' }}
          >
            Create a Workout
          </h3>
          <p className="text-sm text-wf-gray-400 mt-2">
            Add exercises, sets, weights and reps on the next screen. Your weights and reps become the workout&apos;s goals.
          </p>

          <label htmlFor="create-workout-name" className={labelClass} style={labelStyle}>Workout Name</label>
          {/* 16px text so iOS Safari doesn't auto-zoom on focus. */}
          <input
            id="create-workout-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
            autoFocus
            maxLength={200}
            className={inputClass}
            placeholder="e.g. Push Day"
            onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) confirm(); }}
          />

          <label htmlFor="create-workout-description" className={labelClass} style={labelStyle}>Description (optional)</label>
          <textarea
            id="create-workout-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={2000}
            className={`${inputClass} resize-none`}
            placeholder="What's this workout for?"
          />

          <label htmlFor="create-workout-program" className={labelClass} style={labelStyle}>Program</label>
          <select
            id="create-workout-program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className={`${inputClass} appearance-none`}
            style={{ colorScheme: 'dark' }}
          >
            <option value="">No program (My Workouts)</option>
            {choices.length === 0 ? (
              <option value="" disabled>No programs created yet</option>
            ) : (
              choices.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </select>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all"
            style={{ borderRadius: '2px' }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className={`flex-1 py-3 btn-gradient text-sm font-semibold text-white active:scale-[0.98] transition-all ${!canConfirm ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ borderRadius: '2px' }}
          >
            Confirm
          </button>
        </div>
        {error && (
          <div className="px-5 pb-4">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
