import { useEffect, useRef, useState } from 'react';
import { setRetryHandler } from '../api';

// App-wide "Couldn't reach RepLab" prompt. api() gives up on a request after
// its time limit (or a network failure) and asks this prompt whether to try
// again: Retry re-sends every request that's waiting on it, Cancel lets them
// fail with the same message so each screen shows its normal error.
export default function ConnectionRetryPrompt() {
  const [message, setMessage] = useState(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    setRetryHandler((msg) => new Promise((resolve) => {
      resolveRef.current = resolve;
      setMessage(msg);
    }));
    return () => setRetryHandler(null);
  }, []);

  function answer(retry) {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setMessage(null);
    resolve?.(retry);
  }

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="conn-retry-title"
      aria-describedby="conn-retry-msg"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
        }}
      >
        <div style={{ padding: '20px 20px 12px' }}>
          <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}>
            Connection
          </p>
          <h3 id="conn-retry-title" className="text-xl font-black text-white leading-tight" style={{ letterSpacing: '-0.01em' }}>
            Taking too long
          </h3>
          <p id="conn-retry-msg" className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
        <div style={{ padding: '8px 20px 20px', display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => answer(false)}
            className="flex-1 py-3 bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all"
            style={{ borderRadius: 2 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            autoFocus
            className="flex-1 py-3 btn-gradient text-sm font-semibold text-white active:scale-[0.98] transition-all"
            style={{ borderRadius: 2 }}
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
