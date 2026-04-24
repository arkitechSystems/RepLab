import { useEffect, useRef, useState } from 'react';
import { CARDIO_OPTIONS, CARDIO_DURATION_SECONDS } from '../data/cardioOptions';

// Between-set cardio card for Stoppani-style programs. Shown between two
// adjacent sets of the same exercise when the program has
// cardio_acceleration_enabled=TRUE. The user picks a cardio movement from a
// dropdown and can run a 60-second timer. Changes to `value` propagate up so
// the parent can auto-fill subsequent sets of the same exercise.
export default function CardioAccelerationCard({ value, onChange, readOnly }) {
  const [remaining, setRemaining] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const start = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRemaining(CARDIO_DURATION_SECONDS);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRemaining(null);
  };

  const isRunning = remaining !== null && remaining > 0;
  const isDone = remaining === 0;

  return (
    <div className="px-3 py-2 bg-teal-500/5 border-y border-teal-500/15">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-teal-400 shrink-0">Cardio</span>
        <div className="flex-1 min-w-0">
          <select
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={readOnly}
            className="w-full bg-transparent text-sm text-white rounded-md px-2 py-1.5 border border-white/10 focus:outline-none focus:border-teal-400/40 disabled:opacity-60"
          >
            {!value && <option value="" className="bg-wf-gray-900">Select cardio…</option>}
            {CARDIO_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-wf-gray-900 text-white">
                {opt}
              </option>
            ))}
          </select>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={isRunning ? stop : start}
            className={`shrink-0 h-8 px-3 rounded-md text-xs font-semibold tabular-nums transition-colors ${
              isRunning
                ? 'bg-teal-500/25 text-teal-200'
                : isDone
                ? 'bg-green-500/20 text-green-300'
                : 'bg-white/10 text-white active:bg-white/20'
            }`}
          >
            {isRunning ? `${remaining}s` : isDone ? 'Done' : `${CARDIO_DURATION_SECONDS}s`}
          </button>
        )}
      </div>
    </div>
  );
}
