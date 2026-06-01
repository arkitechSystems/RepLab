import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Global async-confirm dialog. Drop-in replacement for window.confirm() —
// native confirm dialogs read as a debug build to Apple App Review and look
// out of place on iOS. The hook returns an async function that resolves to
// true (confirmed) or false (cancelled). Modal is portal'd to document.body
// so it escapes every stacking context; focus is moved to the destructive
// button on open; Escape / backdrop tap cancels.
//
// Usage:
//   const confirmDialog = useConfirm();
//   if (!(await confirmDialog({ message: 'Delete this workout?', danger: true }))) return;
//   await api(...);

const ConfirmContext = createContext(null);

const DEFAULT_TITLE_DANGER  = 'Are you sure?';
const DEFAULT_TITLE_NORMAL  = 'Confirm';
const DEFAULT_CONFIRM_LABEL = 'Confirm';
const DEFAULT_CANCEL_LABEL  = 'Cancel';

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  // Holds the resolve fn for the in-flight confirm() promise.
  const resolverRef = useRef(null);

  const confirm = useCallback((opts) => {
    // Accept either a string (message-only) or an options object.
    const config = typeof opts === 'string' ? { message: opts } : (opts || {});
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: config.title || (config.danger ? DEFAULT_TITLE_DANGER : DEFAULT_TITLE_NORMAL),
        message: config.message || '',
        confirmLabel: config.confirmLabel || DEFAULT_CONFIRM_LABEL,
        cancelLabel: config.cancelLabel || DEFAULT_CANCEL_LABEL,
        danger: !!config.danger,
      });
    });
  }, []);

  function close(value) {
    setState(null);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(value);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && createPortal(
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #1a1816 0%, #100f0d 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3">
              <h3 id="confirm-dialog-title" className="text-[16px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui' }}>
                {state.title}
              </h3>
              {state.message && (
                <p className="mt-2 text-[13px] text-white/70 leading-relaxed">{state.message}</p>
              )}
            </div>
            <div className="px-5 pb-5 pt-1 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="active:scale-[0.97] transition-all text-white/80 text-[11px] font-bold uppercase px-4 py-2.5"
                style={{
                  letterSpacing: '0.15em',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className="active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase px-4 py-2.5"
                style={{
                  letterSpacing: '0.15em',
                  borderRadius: '2px',
                  background: state.danger
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
                  boxShadow: state.danger
                    ? '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
                    : '0 4px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  // Defensive fallback: outside the provider, fall back to native confirm
  // so the call still works (with the debug-looking native dialog). In
  // practice the provider wraps the whole app, so this shouldn't fire.
  if (!ctx) {
    return (opts) => Promise.resolve(window.confirm(typeof opts === 'string' ? opts : (opts && opts.message) || ''));
  }
  return ctx;
}
