// "Start Empty Workout" name prompt. Shared by the Calendar day editor and
// the Workouts page "Log as you go" button so both look and behave the same.
// Pure UI: the parent owns the name/saving/error state and does the
// /sessions/start-empty call in onConfirm.
export default function StartEmptyWorkoutModal({ name, onNameChange, saving, error, onCancel, onConfirm }) {
  const canConfirm = !saving && !!name.trim();
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      onClick={() => !saving && onCancel()}
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
            className="text-xl font-black text-white leading-tight"
            style={{ letterSpacing: '-0.01em' }}
          >
            Start Empty Workout
          </h3>
          <p className="text-sm text-wf-gray-400 mt-2">
            Saved to your <span className="text-white font-medium">My Workouts</span> program.
          </p>
          {/* 16px so iOS Safari doesn't auto-zoom on focus. */}
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus
            className="w-full mt-4 glass-input rounded-md px-3 py-2.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
            placeholder="Workout name"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canConfirm) onConfirm();
            }}
          />
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className={`flex-1 py-3 bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all ${saving ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ borderRadius: '2px' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex-1 py-3 btn-gradient text-sm font-semibold text-white active:scale-[0.98] transition-all ${!canConfirm ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ borderRadius: '2px' }}
          >
            {saving ? 'Creating...' : 'Confirm'}
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
