import { useState, useEffect, useRef } from 'react';

export default function UndoToast({ message, onUndo, onExpire, duration = 4000 }) {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        timerRef.current = requestAnimationFrame(animate);
      } else {
        onExpire();
      }
    };
    timerRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(timerRef.current);
  }, [duration, onExpire]);

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[70] flex justify-center animate-slide-up">
      <div className="w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-white flex-1 min-w-0 truncate">{message}</p>
          <button
            onClick={() => { cancelAnimationFrame(timerRef.current); onUndo(); }}
            className="text-sm font-bold text-wf-red px-3 py-1.5 rounded-lg bg-wf-red/10 active:bg-wf-red/20 transition-colors shrink-0"
          >
            Undo
          </button>
        </div>
        <div className="h-0.5 bg-white/5">
          <div className="h-full bg-wf-red transition-none" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
