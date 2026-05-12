import { useEffect, useState } from 'react';
import useFocusTrap from '../hooks/useFocusTrap';

// Modal shown when POST /sessions returns a 409 with
// `{ code: 'OVERWRITE_REQUIRES_CONFIRMATION', ... }`. The user has explicitly
// asked to start a workout (or copy onto a date) that already has logged
// entries — we tell them exactly what's about to be destroyed and require an
// affirmative checkbox before enabling the destructive button.
//
// Props:
//   open       — boolean, whether the modal is visible
//   onConfirm  — () => void; called when the user clicks "Overwrite Workout"
//                with the checkbox checked. Caller is responsible for the
//                retry POST with confirmOverwrite: true.
//   onCancel   — () => void; called for backdrop tap, X button, or Cancel.
//   details    — the structured 409 payload:
//                  { sessionId, entriesCount, prCount, completedAt,
//                    exerciseNames: string[] }
//
// Styling matches the Profile.jsx delete-account modal and other Nike-style
// dark sheets in the app — no new CSS file needed, just the existing utility
// classes.
export default function ConfirmOverwriteModal({ open, onConfirm, onCancel, details }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const trapRef = useFocusTrap(open);

  // Reset the checkbox every time the modal opens so a previous "yes" doesn't
  // carry over to the next confirmation prompt.
  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open]);

  if (!open) return null;

  const entriesCount = details?.entriesCount ?? 0;
  const prCount = details?.prCount ?? 0;
  const exerciseNames = Array.isArray(details?.exerciseNames) ? details.exerciseNames : [];

  // Truncate to 3 + "..." for the body copy (spec).
  const namesPreview = (() => {
    if (exerciseNames.length === 0) return 'this workout';
    if (exerciseNames.length <= 3) return exerciseNames.join(', ');
    return `${exerciseNames.slice(0, 3).join(', ')}, ...`;
  })();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-overwrite-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        ref={trapRef}
        className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <p
            className="text-[10px] uppercase font-bold text-center mb-1"
            style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}
          >
            Overwrite Warning
          </p>
          <h3 id="confirm-overwrite-title" className="text-lg font-bold text-white text-center">
            This date already has a completed workout
          </h3>

          <ul className="mt-4 space-y-2 text-sm text-wf-gray-400">
            <li className="flex gap-2">
              <span className="text-red-400 shrink-0">•</span>
              <span>
                <span className="text-white font-semibold">{entriesCount}</span>{' '}
                {entriesCount === 1 ? 'set' : 'sets'} across{' '}
                <span className="text-white">{namesPreview}</span> will be permanently deleted
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 shrink-0">•</span>
              <span>
                <span className="text-white font-semibold">{prCount}</span> personal{' '}
                {prCount === 1 ? 'record' : 'records'} from this session will be removed
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 shrink-0">•</span>
              <span>
                Progressive-overload suggestions for these exercises will recalculate from your
                previous best
              </span>
            </li>
          </ul>

          <label className="mt-4 flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 accent-red-500"
            />
            <span className="text-xs text-wf-gray-400">
              I understand this cannot be undone
            </span>
          </label>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (acknowledged) onConfirm(); }}
            disabled={!acknowledged}
            className={`flex-1 py-3 rounded-xl bg-red-500 text-sm font-semibold text-white active:scale-[0.98] transition-all ${
              acknowledged ? '' : 'opacity-40 pointer-events-none'
            }`}
          >
            Overwrite Workout
          </button>
        </div>
      </div>
    </div>
  );
}
