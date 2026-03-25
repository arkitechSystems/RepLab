import { createContext, useContext, useState, useCallback } from 'react';

const TutorialContext = createContext(null);

const STORAGE_KEY = 'wf-tutorial-state';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const initialState = {
  active: false,
  path: null,       // 'browse' | 'create'
  phase: null,      // '1a' | '1b' | '2' | '3'
  stepIndex: 0,
  completed: false,
};

export function TutorialProvider({ children }) {
  const [state, setState] = useState(() => loadState() || initialState);

  const update = useCallback((changes) => {
    setState((prev) => {
      const next = { ...prev, ...changes };
      saveState(next);
      return next;
    });
  }, []);

  const startTutorial = useCallback((path) => {
    const next = {
      active: true,
      path,
      phase: path === 'browse' ? '1a' : path === 'create' ? '1b' : null,
      stepIndex: 0,
      completed: false,
    };
    saveState(next);
    setState(next);
  }, []);

  const advanceTutorial = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, stepIndex: prev.stepIndex + 1 };
      saveState(next);
      return next;
    });
  }, []);

  const goToStepIndex = useCallback((index) => {
    setState((prev) => {
      const next = { ...prev, stepIndex: index };
      saveState(next);
      return next;
    });
  }, []);

  const skipTutorial = useCallback(() => {
    const next = { ...initialState, completed: true };
    saveState(next);
    setState(next);
  }, []);

  const completeTutorialAction = useCallback((actionName) => {
    // This will be checked by the Tutorial component
    // Dispatch a custom event so Tutorial can listen
    window.dispatchEvent(new CustomEvent('tutorial-action', { detail: actionName }));
  }, []);

  const resetTutorial = useCallback(() => {
    saveState(initialState);
    setState(initialState);
  }, []);

  return (
    <TutorialContext.Provider value={{
      tutorial: state,
      startTutorial,
      advanceTutorial,
      goToStepIndex,
      skipTutorial,
      completeTutorialAction,
      resetTutorial,
      updateTutorial: update,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
