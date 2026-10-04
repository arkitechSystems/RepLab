import { useState } from 'react';

// Post-completion "Save to My Workouts?" prompt for a changed library or
// shared workout. Step 1 asks Yes / No; Yes opens step 2, a name prompt
// pre-filled with `defaultName`. `onSave(name)` resolves on success and
// throws on failure (the error is shown and the prompt stays open).
export default function SaveCustomWorkoutModal({ defaultName, onSave, onClose }) {
  const [step, setStep] = useState('ask');
  const [name, setName] = useState(defaultName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    // Entry guard against double-tap / Enter-held before `saving` re-renders.
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a workout name.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(trimmed);
    } catch (err) {
      setError(err?.message || 'Could not save this workout. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-custom-title"
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
          <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}>
            My Workouts
          </p>
          <h3 id="save-custom-title" className="text-xl font-black text-white leading-tight" style={{ letterSpacing: '-0.01em' }}>
            {step === 'ask' ? 'Save this workout?' : 'Name your workout'}
          </h3>
          {step === 'ask' ? (
            <p className="text-sm text-wf-gray-400 mt-2">
              Would you like to save this as a custom workout to your <span className="text-white font-medium">My Workouts</span> page?
            </p>
          ) : (
            <>
              <p className="text-sm text-wf-gray-400 mt-2">
                Saved to your <span className="text-white font-medium">My Workouts</span> program with today's exercises and sets.
              </p>
              {/* 16px so iOS Safari doesn't auto-zoom on focus. */}
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={200}
                className="w-full mt-4 glass-input rounded-md px-3 py-2.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
                placeholder="Workout name"
                onKeyDown={(e) => { if (e.key === 'Enter') confirm(); }}
              />
            </>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`flex-1 py-3 bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all ${saving ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ borderRadius: '2px' }}
          >
            {step === 'ask' ? 'No' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={step === 'ask' ? () => setStep('name') : confirm}
            disabled={saving || (step === 'name' && !name.trim())}
            className={`flex-1 py-3 btn-gradient text-sm font-semibold text-white active:scale-[0.98] transition-all ${(saving || (step === 'name' && !name.trim())) ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ borderRadius: '2px' }}
          >
            {step === 'ask' ? 'Yes' : saving ? 'Saving...' : 'Save'}
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
