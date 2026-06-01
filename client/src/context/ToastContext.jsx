import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Lightweight global toast. Renders a single pill top-center, portal'd to
// document.body so it escapes every stacking context. Auto-dismisses after
// `ms` (default 3000). Replaces native window.alert() across the app —
// alert() reads as a debug build to Apple App Review.

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, kind = 'info', ms = 3000) => {
    if (!message) return;
    setToast({ message: String(message), kind });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && createPortal(
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl pointer-events-none max-w-[90vw] text-center"
          style={{
            top: 'calc(env(safe-area-inset-top) + 16px)',
            background: toast.kind === 'error' ? 'rgba(220,38,38,0.95)' : 'rgba(255,255,255,0.95)',
            color: toast.kind === 'error' ? 'white' : 'black',
          }}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {toast.message}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Defensive fallback so a component rendered outside the provider (e.g.
  // an error boundary above the tree) doesn't hard-crash on showToast().
  // In dev we still flag the misuse; in production it silently no-ops.
  if (!ctx) {
    return (msg) => { if (import.meta.env.DEV) console.warn('useToast outside provider:', msg); };
  }
  return ctx;
}
