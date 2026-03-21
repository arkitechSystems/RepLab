import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * useUnsavedGuard — intercepts navigation when there are unsaved changes.
 * Catches: back button (popstate), browser refresh (beforeunload), and in-app navigation (guardedNavigate).
 */
export function useUnsavedGuard({ isDirty, onSave, saveLabel = 'Save' }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isDirtyRef = useRef(isDirty);
  const pushedStateRef = useRef(false);
  const pushCountRef = useRef(0); // track how many extra history entries we've added

  // Keep ref in sync
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Intercept browser back/forward and refresh
  useEffect(() => {
    if (!isDirty) {
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

  const UnsavedModal = showModal ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5" onClick={handleStay}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-white text-center mb-1">Unsaved Changes</h3>
        <p className="text-wf-gray-400 text-sm text-center mb-5">
          Would you like to save your data before leaving?
        </p>
        {saveError && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
            {saveError}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full btn-gradient text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : saveLabel}
            </button>
          )}
          <button
            onClick={handleLeave}
            disabled={saving}
            className="w-full glass-card text-wf-red font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Leave Without Saving
          </button>
          <button
            onClick={handleStay}
            disabled={saving}
            className="w-full text-wf-gray-400 font-medium py-2 text-sm active:opacity-70 transition-all"
          >
            Stay on Page
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { guardedNavigate, UnsavedModal };
}
