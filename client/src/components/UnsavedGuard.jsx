import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useFocusTrap from '../hooks/useFocusTrap';

/**
 * useUnsavedGuard — intercepts navigation when there are unsaved changes.
 * Catches: back button (popstate), browser refresh (beforeunload), and in-app navigation (guardedNavigate).
 */
export function useUnsavedGuard({ isDirty, onSave, saveLabel = 'Save' }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const unsavedTrapRef = useFocusTrap(showModal);
  const navigate = useNavigate();
  const location = useLocation();
  const isDirtyRef = useRef(isDirty);
  const pushedStateRef = useRef(false);
  const pushCountRef = useRef(0); // track how many extra history entries we've added
  const showModalRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { showModalRef.current = showModal; }, [showModal]);

  // Intercept browser back/forward and refresh
  useEffect(() => {
    if (!isDirty) {
      // Pop any extra history entries we pushed while dirty
      if (pushedStateRef.current && pushCountRef.current > 0) {
        window.history.go(-pushCountRef.current);
      }
      pushedStateRef.current = false;
      pushCountRef.current = 0;
      return;
    }

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = () => {
      if (isDirtyRef.current) {
        if (showModalRef.current) {
          // Modal already open, just prevent navigation
          window.history.pushState(null, '', location.pathname);
          return;
        }
        // Re-push so we stay on the page
        window.history.pushState(null, '', location.pathname);
        pushCountRef.current++;
        setPendingPath('__back__');
        setShowModal(true);
      }
    };

    // Push one extra history entry so back button triggers popstate instead of leaving
    if (!pushedStateRef.current) {
      window.history.pushState(null, '', location.pathname);
      pushedStateRef.current = true;
      pushCountRef.current = 1;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty, location.pathname]);

  const guardedNavigate = useCallback((pathOrFn) => {
    if (isDirtyRef.current) {
      setPendingPath(() => pathOrFn);
      setSaveError('');
      setShowModal(true);
    } else if (typeof pathOrFn === 'function') {
      pathOrFn();
    } else {
      navigate(pathOrFn);
    }
  }, [navigate]);

  async function handleSave() {
    if (!onSave || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSave();
      // Save succeeded — now navigate away
      isDirtyRef.current = false;
      setSaving(false);
      setShowModal(false);
      if (pendingPath === '__back__') {
        window.history.go(-(pushCountRef.current + 1));
      } else if (typeof pendingPath === 'function') {
        window.history.go(-(pushCountRef.current + 1));
      } else if (pendingPath) {
        navigate(pendingPath, { replace: true });
      }
      setPendingPath(null);
      pushCountRef.current = 0;
    } catch (err) {
      setSaveError(err?.message || 'Save failed. Please try again.');
      setSaving(false);
    }
  }

  function handleLeave() {
    setShowModal(false);
    setSaveError('');

    // Disable the guard so popstate/navigation doesn't re-trigger
    isDirtyRef.current = false;

    if (pendingPath === '__back__') {
      // Go back past all the extra entries we pushed, plus the original page
      window.history.go(-(pushCountRef.current + 1));
    } else if (typeof pendingPath === 'function') {
      // For in-app back buttons using navigate(-1), go back past pushed entries
      window.history.go(-(pushCountRef.current + 1));
    } else if (pendingPath) {
      navigate(pendingPath, { replace: true });
    }
    setPendingPath(null);
    pushCountRef.current = 0;
  }

  function handleStay() {
    setShowModal(false);
    setPendingPath(null);
    setSaveError('');
    setSaving(false);
  }

  // Nike-style modal: dark gradient panel, sharp 2px corners, red top
  // accent stripe + ambient red spotlight in the corner. Mirrors the
  // Begin Program / Workout Summary share sheet treatment used elsewhere.
  const UnsavedModal = showModal ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-5"
      onClick={handleStay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-guard-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={unsavedTrapRef}
        className="relative w-full max-w-xs overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative p-5">
          <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
            Heads Up
          </p>
          <h3 id="unsaved-guard-title" className="text-[22px] font-black text-white tracking-tight mb-2" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
            UNSAVED CHANGES
          </h3>
          <p className="text-[13px] text-white/65 leading-relaxed mb-5">
            Would you like to save your data before leaving?
          </p>
          {saveError && (
            <div
              className="px-4 py-3 mb-4 text-[12px]"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: '2px',
                color: 'rgba(254,202,202,0.95)',
              }}
            >
              {saveError}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {onSave && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full text-[11px] font-bold uppercase active:scale-[0.97] transition-all text-white py-3 disabled:opacity-50"
                style={{
                  letterSpacing: '0.2em',
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                {saving ? 'Saving…' : saveLabel}
              </button>
            )}
            <button
              onClick={handleLeave}
              disabled={saving}
              className="w-full text-[11px] font-bold uppercase active:scale-[0.97] transition-all py-3 disabled:opacity-50"
              style={{
                letterSpacing: '0.2em',
                borderRadius: '2px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.5)',
                color: 'rgba(239,68,68,0.95)',
              }}
            >
              Leave Without Saving
            </button>
            <button
              onClick={handleStay}
              disabled={saving}
              className="w-full text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 py-2 active:opacity-70 transition-all"
            >
              Stay on Page
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return { guardedNavigate, UnsavedModal };
}
