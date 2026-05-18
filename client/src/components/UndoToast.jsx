import { useState, useEffect, useRef, useCallback } from 'react';

export default function UndoToast({ message, onUndo, onExpire, duration = 4000 }) {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startRef = useRef(Date.now());
  const onExpireRef = useRef(onExpire);
  const onUndoRef = useRef(onUndo);

  // Keep refs up to date without restarting the effect
  onExpireRef.current = onExpire;
  onUndoRef.current = onUndo;

  useEffect(() => {
    startRef.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        timerRef.current = requestAnimationFrame(animate);
      } else {
        onExpireRef.current();
      }
    };
    timerRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(timerRef.current);
  }, [duration]);

  const handleUndo = useCallback(() => {
    cancelAnimationFrame(timerRef.current);
    onUndoRef.current();
  }, []);

  return (
    <div role="status" aria-live="polite" className="my-2 rounded-xl overflow-hidden border border-white/10 bg-wf-gray-900/80 shadow-lg animate-slide-up">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="text-xs text-wf-gray-400 flex-1 min-w-0 truncate">{message}</p>
        <button
          onClick={handleUndo}
          className="text-xs font-bold text-wf-red px-3 py-1 rounded-lg bg-wf-red/10 active:bg-wf-red/20 transition-colors shrink-0"
        >
          Undo
        </button>
      </div>
      <div className="h-0.5 bg-white/5">
        <div className="h-full bg-wf-red transition-none" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
