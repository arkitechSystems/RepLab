import useFocusTrap from '../hooks/useFocusTrap';

// "It looks like you missed a workout" prompt, shown on the Workouts page and
// the Calendar when GET /schedule/missed returns unresolved misses (see
// server/missedWorkouts.js). State + handlers live in
// hooks/useMissedWorkoutsPrompt.js.
//
// Props:
//   open     — boolean
//   missed   — [{ date, templateId, templateName }], earliest first
//   busy     — true while a Resume/Skip request is in flight
//   error    — optional error string to show under the buttons
//   onResume — () => void; brings missed[0] to today, pushes the rest back
//   onSkip   — () => void; leaves the schedule alone, stops asking
//   onClose  — () => void; backdrop / X. Never blocks: a Start-triggered
//              prompt continues into the tapped workout. Asks again next time.
//
// Styling matches ConfirmOverwriteModal (dark sheet, red accent).
export default function MissedWorkoutsModal({ open, missed = [], busy = false, error = '', onResume, onSkip, onClose }) {
  const trapRef = useFocusTrap(open);
  if (!open || missed.length === 0) return null;

  const count = missed.length;
  const resumeName = missed[0].templateName || 'your last scheduled workout';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="missed-workouts-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        ref={trapRef}
        className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-wf-gray-400 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-5 pt-5 pb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>

          <p
            className="text-[10px] uppercase font-bold text-center mb-1"
            style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}
          >
            {count === 1 ? 'Missed Workout' : `${count} Missed Workouts`}
          </p>
          <h3 id="missed-workouts-title" className="text-lg font-bold text-white text-center">
            {count === 1 ? 'It looks like you missed a workout' : 'It looks like you missed some workouts'}
          </h3>
          <p className="mt-3 text-sm text-wf-gray-400 text-center">
            Would you like to resume your last scheduled workout,{' '}
            <span className="text-white font-semibold">{resumeName}</span>, or skip{' '}
            {count === 1 ? 'it' : 'them'}?
          </p>
          <ul className="mt-4 space-y-2 text-xs text-wf-gray-400">
            <li className="flex gap-2">
              <span className="text-red-400 shrink-0">•</span>
              <span>
                <span className="text-white font-semibold">Resume</span> moves {resumeName} to today and
                pushes the rest of your schedule back to match.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-400 shrink-0">•</span>
              <span>
                <span className="text-white font-semibold">Skip</span> keeps your upcoming schedule exactly
                as it is.
              </span>
            </li>
          </ul>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onSkip}
            disabled={busy}
            className={`flex-1 py-3 rounded-xl bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all ${busy ? 'opacity-40' : ''}`}
          >
            Skip
          </button>
          <button
            onClick={onResume}
            disabled={busy}
            className={`flex-1 py-3 rounded-xl bg-red-500 text-sm font-semibold text-white active:scale-[0.98] transition-all ${busy ? 'opacity-40' : ''}`}
          >
            Resume
          </button>
        </div>
        {error && <p className="px-5 pb-4 -mt-2 text-xs text-red-400 text-center">{error}</p>}
      </div>
    </div>
  );
}
