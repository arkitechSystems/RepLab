import { useState, useEffect, useCallback } from 'react';

/**
 * useUnsavedGuard — hook that shows a confirmation modal when navigating away with unsaved data.
 *
 * Returns:
 *   guardedNavigate(fn) — wrap your navigate calls with this
 *   UnsavedModal — render this JSX in your component
 */
export function useUnsavedGuard({ isDirty, onSave, saveLabel = 'Save' }) {
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [saving, setSaving] = useState(false);

  // Block browser back / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const guardedNavigate = useCallback((navigateFn) => {
    if (isDirty) {
      setPendingAction(() => navigateFn);
      setShowModal(true);
    } else {
      navigateFn();
    }
  }, [isDirty]);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
    } catch {
      setSaving(false);
      setShowModal(false);
    }
  }

  function handleLeave() {
    setShowModal(false);
    if (pendingAction) pendingAction();
  }

  function handleStay() {
    setShowModal(false);
    setPendingAction(null);
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
            className="w-full glass-card text-wf-red font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
          >
            Leave Without Saving
          </button>
          <button
            onClick={handleStay}
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
