import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CARDIO_OPTIONS, CARDIO_DURATION_SECONDS } from '../data/cardioOptions';

// Between-set cardio card for Stoppani-style programs. Shown between two
// adjacent sets of the same exercise when the program has
// cardio_acceleration_enabled=TRUE. Users pick a cardio movement via a
// searchable dropdown (separate trigger + panel-with-search-bar), start a
// 60s timer, and watch a progress bar drain. Selecting a movement
// propagates to all later slots of the same exercise (handled upstream).
export default function CardioAccelerationCard({ value, onChange, readOnly }) {
  const [remaining, setRemaining] = useState(null); // null = idle, 0 = done
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Anchor rect for the portal'd panel. Updated on scroll/resize so the
  // panel stays visually attached to its trigger as the page moves.
  const [anchorRect, setAnchorRect] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const intervalRef = useRef(null);

  // Close dropdown on any click/tap outside the trigger OR the portal'd panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (listRef.current && listRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // Keep the panel anchored as the page scrolls/resizes. capture:true so
  // scrolls inside any ancestor (the exercise card's overflow wrappers)
  // still propagate here.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Autofocus the panel's search input when the dropdown opens. Delayed a
  // tick so the input has actually mounted in the portal before we try.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Stop the timer if the component unmounts mid-countdown.
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const filtered = query
    ? CARDIO_OPTIONS.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : CARDIO_OPTIONS;

  const pickOption = (opt) => {
    onChange?.(opt);
    setQuery('');
    setOpen(false);
  };

  const startTimer = () => {
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

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRemaining(null);
  };

  const isRunning = remaining !== null && remaining > 0;
  const isDone = remaining === 0;
  const progress = isRunning ? remaining / CARDIO_DURATION_SECONDS : 0;

  return (
    <div className="px-3 py-2 bg-teal-500/5 border-y border-teal-500/15">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-teal-400 shrink-0">Cardio</span>

        {/* Trigger — button-styled to look like a select. Tapping opens the
            portal'd panel. No inline editing; all filtering happens inside
            the panel via its own search bar. */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !readOnly && setOpen((v) => !v)}
          disabled={readOnly}
          className="flex-1 min-w-0 h-8 rounded-md px-2 pr-7 border border-white/10 bg-transparent flex items-center relative text-left text-sm disabled:opacity-60"
        >
          <span className={`truncate ${value ? 'text-white' : 'text-black'}`}>
            {value || '(Choose Cardio)'}
          </span>
          <svg className={`absolute right-2 w-3 h-3 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Timer button — primary action, bright red when idle */}
        {!readOnly && (
          <button
            type="button"
            onClick={isRunning ? stopTimer : startTimer}
            className={`shrink-0 h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-wider tabular-nums transition-colors ${
              isRunning
                ? 'bg-teal-500/25 text-teal-200'
                : isDone
                ? 'bg-green-500/25 text-green-200'
                : 'bg-wf-red text-white active:bg-wf-red/80'
            }`}
          >
            {isRunning ? `${remaining}s` : isDone ? 'Reset' : 'Start 60s'}
          </button>
        )}
      </div>

      {/* Progress bar — visible while counting down or after completion */}
      {(isRunning || isDone) && (
        <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full ${isDone ? 'bg-green-500/60' : 'bg-gradient-to-r from-teal-500 to-teal-300'} transition-[width] duration-1000 ease-linear`}
            style={{ width: `${Math.max(isDone ? 100 : progress * 100, 0)}%` }}
          />
        </div>
      )}

      {/* Dropdown panel — portal'd to document.body so it clears the exercise
          card's overflow:hidden ancestors. Has its own sticky search bar at
          the top that filters the list below. */}
      {open && !readOnly && anchorRect && createPortal(
        <div
          ref={listRef}
          style={{
            position: 'fixed',
            top: anchorRect.bottom + 4,
            left: anchorRect.left,
            width: anchorRect.width,
            zIndex: 60,
          }}
          className="bg-wf-gray-900 border border-white/10 rounded-md shadow-xl flex flex-col max-h-72"
        >
          <div className="p-2 border-b border-white/10 bg-wf-gray-900">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cardio…"
              className="w-full bg-white/5 text-white text-sm rounded px-2 py-1.5 border border-white/10 focus:outline-none focus:border-teal-400/40 placeholder:text-white/40"
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-white/40">No matches</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickOption(opt); }}
                  onTouchStart={(e) => { e.preventDefault(); pickOption(opt); }}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    opt === value
                      ? 'bg-teal-500/20 text-teal-200'
                      : 'text-white hover:bg-white/5 active:bg-white/10'
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
