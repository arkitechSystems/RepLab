import { useState } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';

// Pencil + "EDIT NAME" modal for renaming a workout from inside a session (and
// its summary screens). Visual twin of the Workouts-page rename button/modal
// (Workouts.jsx "Rename workout"). Renames are linked: the caller saves via
// PUT /templates/:id/name, so the new name shows in My Workouts, the
// Calendar and on every day that uses this workout.

export function RenamePencilButton({ onClick, label = 'Rename this workout', className = '', style }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 w-8 h-8 items-center justify-center align-middle active:scale-90 transition-all ${className}`}
      style={{ borderRadius: '2px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', ...style }}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
      </svg>
    </button>
  );
}

// `initialName` seeds the input; `onSave(name)` resolves on success and throws
// on failure (the caller handles optimistic update + rollback + toast).
export default function RenameWorkoutModal({ initialName, onSave, onClose }) {
  const [value, setValue] = useState(initialName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trapRef = useFocusTrap(true);

  async function submit() {
    const name = value.trim();
    if (!name || name === (initialName || '').trim()) { onClose(); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(name);
      onClose();
    } catch (err) {
      // Caller already rolled back its optimistic name; keep the modal open
      // so the user can retry.
      setError(err?.message || 'Could not rename workout. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // z-[110]: above the full-screen workout summary (z-[100]) it can open from.
  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center pt-24 px-5"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-rename-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={trapRef}
        className="relative w-full max-w-sm overflow-hidden animate-drop-down"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Rename</p>
              <h3 id="session-rename-title" className="text-[22px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>EDIT NAME</h3>
              <p className="text-[12px] text-white/40 mt-2">Changes the name everywhere this workout appears.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="w-7 h-7 flex items-center justify-center active:scale-90 transition-all shrink-0 disabled:opacity-40"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              maxLength={200}
              placeholder="Workout name"
              className="w-full text-white text-[16px] font-medium px-3.5 py-3 mb-4 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '2px' }}
            />
            {error && (
              <p role="alert" className="text-[12px] -mt-2 mb-3" style={{ color: 'rgba(239,68,68,0.9)' }}>{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 text-white/80 text-[11px] font-bold uppercase py-3 active:scale-[0.98] transition-all disabled:opacity-40"
                style={{ letterSpacing: '0.15em', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !value.trim()}
                className="flex-1 text-white text-[11px] font-bold uppercase py-3 active:scale-[0.98] transition-all disabled:opacity-40"
                style={{ letterSpacing: '0.15em', borderRadius: '2px', background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)', boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
