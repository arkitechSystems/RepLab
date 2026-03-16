import { useState, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * useUnsavedGuard — blocks ALL navigation (back button, nav tabs, links) when dirty.
 *
 * Uses React Router's useBlocker to intercept route changes, plus beforeunload for browser refresh/close.
 */
export function useUnsavedGuard({ isDirty, onSave, saveLabel = 'Save' }) {
  const [saving, setSaving] = useState(false);

  const blocker = useBlocker(isDirty);

  // Block browser refresh / close
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
      // If save navigates away itself, blocker resets. Otherwise proceed:
      if (blocker.state === 'blocked') blocker.proceed();
    } catch {
      setSaving(false);
    }
  }

  function handleLeave() {
    if (blocker.state === 'blocked') blocker.proceed();
  }

  function handleStay() {
    if (blocker.state === 'blocked') blocker.reset();
  }

  const UnsavedModal = blocker.state === 'blocked' ? (
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

  return { UnsavedModal };
}
