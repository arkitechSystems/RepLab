import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO, isToday, addDays, subDays } from 'date-fns';
import { api } from '../api';
import ExerciseCard from '../components/ExerciseCard';
import { useExercises } from '../hooks/useExercises';
import RestDayCard from '../components/RestDayCard';
import StickyHeader from '../components/StickyHeader';
import { useUnsavedGuard } from '../components/UnsavedGuard';
import PBCelebration from '../components/PBCelebration';
import UndoToast from '../components/UndoToast';
import { iosFocusRef } from '../utils/iosFocus';
import { getWeightSuggestion } from '../utils/weightSuggestion';
import { beepCountdown, beepComplete, initAudio } from '../utils/sounds';

export default function WorkoutSession() {
  const { templateId, date } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tutorialMode = templateId === 'tutorial';
  const tutorialTemplate = location.state?.tutorialTemplate || null;
  const { exercises: allExercisesFromDB, createCustom } = useExercises();
  const [template, setTemplate] = useState(null);
  const [pbs, setPbs] = useState({});
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const [completedSets, setCompletedSets] = useState(new Set());
  const [newPBs, setNewPBs] = useState(null);
  const [notes, setNotes] = useState({});
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addExerciseSearch, setAddExerciseSearch] = useState('');
  const [autoFilled, setAutoFilled] = useState(new Set()); // tracks predicted entries
  const [isCompleted, setIsCompleted] = useState(false);
  const [weightSuggestions, setWeightSuggestions] = useState({});
  const [lastSession, setLastSession] = useState({});
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  const [timerFloating, setTimerFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 16, y: 80 });
  const [restFloating, setRestFloating] = useState(false);
  const [restFloatPos, setRestFloatPos] = useState({ x: 16, y: 140 });
  const [showSummary, setShowSummary] = useState(false);
  const [showDateConfirm, setShowDateConfirm] = useState(false);
  const [tutorialTip, setTutorialTip] = useState(null); // tutorial workout tooltips
  const [tutorialReady, setTutorialReady] = useState(false); // true once element is scrolled + measured
  const tutorialRectRef = useRef(null); // cached rect for current tip target
  const [pendingSwap, setPendingSwap] = useState(null); // { oldName, newName }
  const [schedule, setSchedule] = useState(null); // day-of-week → templateId map for nav arrows
  const dragRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  // Rest timer
  const [restDuration, setRestDuration] = useState(90); // seconds
  const restDurationRef = useRef(restDuration); // ref so interval always reads current value
  const [restRemaining, setRestRemaining] = useState(null); // null = not running
  const restTimerRef = useRef(null);
  const REST_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
  const [pinWorkoutTimer, setPinWorkoutTimer] = useState(true);
  const [pinRestTimer, setPinRestTimer] = useState(true);
  const [undoToast, setUndoToast] = useState(null); // { message, undoFn }
  const autoSaveRef = useRef(null);
  const autoSaveNeeded = useRef(false);
  const structureSaveRef = useRef(null);
  const structureSaveNeeded = useRef(false);
  const savingRef = useRef(false);
  const savedTimerRef = useRef(null);

  // Block scrolling when tutorial tip is active (native listener for non-passive)
  const tutorialOverlayRef = useRef(null);
  useEffect(() => {
    if (!tutorialTip) return;
    const el = tutorialOverlayRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('wheel', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      el.removeEventListener('wheel', prevent);
      el.removeEventListener('touchmove', prevent);
    };
  }, [tutorialTip, tutorialReady]);

  // Pre-scroll and measure tutorial tip target
  useEffect(() => {
    if (!tutorialTip) { setTutorialReady(false); tutorialRectRef.current = null; return; }
    setTutorialReady(false);
    tutorialRectRef.current = null;

    const targetMap = {
      'begin-workout': '[data-tutorial="begin-workout-btn"]',
      timer: '[data-tutorial="workout-timer"]',
      rest: '[data-tutorial="rest-timer"]',
      'exercise-card': '[data-tutorial="exercise-card"]',
      'exercise-header': '[data-tutorial="move-buttons"]',
      'swap-exercise': '[data-tutorial="swap-button"]',
      'add-delete-exercise': '[data-tutorial="add-delete-buttons"]',
      'set-controls': '[data-tutorial="set-controls"]',
      'set-row': '[data-tutorial="set-row"]',
      'exercise-notes': '[data-tutorial="exercise-notes"]',
      'mark-complete': '[data-tutorial="mark-complete"]',
    };
    const selector = targetMap[tutorialTip];
    if (!selector) return;

    let attempts = 0;
    let cancelled = false;
    function tryFind() {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (!el || el.offsetWidth === 0) {
        if (attempts < 30) { attempts++; console.log('[Tutorial] Attempt', attempts, '- element not found or zero width for:', selector); setTimeout(tryFind, 200); }
        return;
      }
      console.log('[Tutorial] Found element:', selector, 'rect:', el.getBoundingClientRect());
      // If the element is inside a sticky header, scroll to page top so the header
      // is in its expanded (non-collapsed) state — otherwise the measured rect drifts.
      const isInStickyHeader = !!el.closest('.sticky-header');
      if (isInStickyHeader) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        // For tall elements (like exercise cards) or exercise-card sub-elements,
        // scroll so the top is visible just below the sticky header rather than
        // centering (which can cause the tooltip to overlap the spotlight).
        const elRect = el.getBoundingClientRect();
        const exerciseCardSteps = ['exercise-header', 'swap-exercise', 'add-delete-exercise', 'set-controls', 'set-row', 'exercise-notes'];
        const isExerciseCardStep = exerciseCardSteps.includes(tutorialTip);
        if (tutorialTip === 'exercise-card') {
          // Scroll the exercise card header to the very top of the viewport
          const scrollTarget = window.scrollY + elRect.top;
          window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'instant' });
        } else if (elRect.height > window.innerHeight * 0.3 || isExerciseCardStep) {
          const stickyHeader = document.querySelector('.sticky-header');
          const headerHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 0;
          const scrollTarget = window.scrollY + elRect.top - headerHeight - 16;
          window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'instant' });
        } else {
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      }
      // Measure after scroll + two animation frames
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          const measured = el.getBoundingClientRect();
          if (measured.width === 0 || measured.height === 0) {
            if (attempts < 30) { attempts++; setTimeout(tryFind, 200); }
            return;
          }
          console.log('[Tutorial] Measured rect:', measured);
          tutorialRectRef.current = measured;
          setTutorialReady(true);
        });
      });
    }
    // Delay initial attempt to let React paint
    console.log('[Tutorial] Looking for:', selector, 'tip:', tutorialTip);
    setTimeout(tryFind, 100);
    return () => { cancelled = true; };
  }, [tutorialTip]);

  // Keep ref in sync with state
  useEffect(() => { restDurationRef.current = restDuration; }, [restDuration]);

  // Auto-save after checkmark toggle (debounced 1.5s) — skip in tutorial mode
  useEffect(() => {
    if (tutorialMode) return;
    if (!autoSaveNeeded.current) return;
    autoSaveNeeded.current = false;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (!savingRef.current && template && !template.isRest) {
        handleSave().catch(console.error);
      }
    }, 500);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [completedSets]);

  // Auto-save after structural changes (exercise/set add/delete/swap/move) — debounced 1.5s
  useEffect(() => {
    if (tutorialMode) return;
    if (!structureSaveNeeded.current) return;
    structureSaveNeeded.current = false;
    if (structureSaveRef.current) clearTimeout(structureSaveRef.current);
    structureSaveRef.current = setTimeout(() => {
      if (!savingRef.current && template && !template.isRest) {
        handleSave().catch(console.error);
      }
    }, 1500);
    return () => { if (structureSaveRef.current) clearTimeout(structureSaveRef.current); };
  }, [template]);

  const MAX_TIMER_SECS = 14400; // 4 hours
  const timerStorageKey = `wf-timer-${templateId}-${date}`;

  const clearTimerStorage = useCallback(() => {
    try { localStorage.removeItem(timerStorageKey); } catch (_) {}
  }, [timerStorageKey]);

  // Start (or resume) the interval that updates elapsed every second.
  // `origin` is the Date.now() timestamp when the workout originally began.
  const runTimerInterval = useCallback((origin) => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = origin;
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - origin) / 1000);
      if (secs >= MAX_TIMER_SECS) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setElapsed(MAX_TIMER_SECS);
        try { localStorage.removeItem(`wf-timer-${templateId}-${date}`); } catch (_) {}
      } else {
        setElapsed(secs);
      }
    }, 1000);
  }, [templateId, date]);

  const startTimer = useCallback(() => {
    if (timerStarted) return;
    const now = Date.now();
    try { localStorage.setItem(timerStorageKey, String(now)); } catch (_) {}
    setTimerStarted(true);
    setElapsed(0);
    runTimerInterval(now);
  }, [timerStarted, timerStorageKey, runTimerInterval]);

  const handleBeginWorkout = useCallback(() => {
    if (tutorialMode) {
      setTutorialTip(null);
      startTimer();
      setTimeout(() => setTutorialTip('timer'), 600);
      return;
    }
    const sessionDate = parseISO(date);
    if (!isToday(sessionDate)) {
      setShowDateConfirm(true);
    } else {
      startTimer();
    }
  }, [date, startTimer, tutorialMode]);

  function startRestTimer() {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    initAudio(); // ensure audio context is ready (iOS)
    const duration = restDurationRef.current;
    setRestRemaining(duration);
    restTimerRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(restTimerRef.current);
          restTimerRef.current = null;
          beepComplete(); // alarm sound when rest is over
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          return 0;
        }
        // Countdown beeps at 3, 2, 1
        if (prev === 4 || prev === 3 || prev === 2) {
          beepCountdown();
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopRestTimer() {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = null;
    setRestRemaining(null);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function formatTime(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function handleFloatTouchStart(e) {
    const touch = e.touches[0];
    dragRef.current = {
      startX: touch.clientX - floatPos.x,
      startY: touch.clientY - floatPos.y,
      moved: false,
    };
  }

  function handleFloatTouchMove(e) {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    dragRef.current.moved = true;
    const x = Math.max(0, Math.min(window.innerWidth - 140, touch.clientX - dragRef.current.startX));
    const y = Math.max(0, Math.min(window.innerHeight - 50, touch.clientY - dragRef.current.startY));
    setFloatPos({ x, y });
  }

  function handleFloatTouchEnd() {
    dragRef.current = null;
  }

  const restDragRef = useRef(null);
  function handleRestFloatTouchStart(e) {
    const touch = e.touches[0];
    restDragRef.current = {
      startX: touch.clientX - restFloatPos.x,
      startY: touch.clientY - restFloatPos.y,
      moved: false,
    };
  }
  function handleRestFloatTouchMove(e) {
    if (!restDragRef.current) return;
    const touch = e.touches[0];
    restDragRef.current.moved = true;
    const x = Math.max(0, Math.min(window.innerWidth - 180, touch.clientX - restDragRef.current.startX));
    const y = Math.max(0, Math.min(window.innerHeight - 50, touch.clientY - restDragRef.current.startY));
    setRestFloatPos({ x, y });
  }
  function handleRestFloatTouchEnd() {
    restDragRef.current = null;
  }

  useEffect(() => {
    // Tutorial mode: load from hardcoded template, no API calls
    if (tutorialMode) {
      if (!tutorialTemplate) {
        setLoadError('Tutorial template not found');
        setLoading(false);
        return;
      }
      setTemplate(tutorialTemplate);
      const initial = {};
      for (const ex of tutorialTemplate.exercises) {
        initial[ex.name] = ex.sets.map((s) => ({
          weight: s.suggestedWeight || '',
          reps: '',
          setType: s.setType || ex.setType || 'straight',
        }));
      }
      setEntries(initial);
      setLoading(false);
      setTimeout(() => setTutorialTip('begin-workout'), 500);
      return;
    }

    // Step 1: Ensure a session copy exists (creates one from template if needed)
    // Step 2: Load everything from the session — never from the template directly
    async function loadSession() {
      try {
        // Fetch PBs, schedule, and last session entries in parallel
        const [pbList, scheduleData, lastEntries] = await Promise.all([
          api(`/pbs?templateId=${templateId}`),
          api('/schedule'),
          api(`/sessions/last-entries/${templateId}`).catch(() => ({})),
        ]);
        setLastSession(lastEntries || {});
        const pbMap = {};
        for (const pb of pbList) {
          if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
          pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
        }
        setPbs(pbMap);
        setSchedule(scheduleData);

        // Check for existing session
        let session = await api(`/sessions/by-template/${templateId}/${date}`);

        // If no session exists, initialize one from the template (creates independent copy)
        if (!session || !session.workoutData) {
          session = await api('/sessions/initialize', {
            method: 'POST',
            body: JSON.stringify({ templateId: Number(templateId), date }),
          });
        }

        // If still no workout data (shouldn't happen, but safety net)
        if (!session?.workoutData?.exercises) {
          // Fallback: load template directly (legacy behavior)
          const templates = await api('/templates');
          const tmpl = templates.find((t) => t.id === Number(templateId));
          if (tmpl) {
            setTemplate(tmpl);
            if (tmpl.isRest) return;
            const initial = {};
            for (const ex of tmpl.exercises) {
              initial[ex.name] = ex.sets.map((s) => ({
                weight: s.suggestedWeight || '',
                reps: '',
                setType: s.setType || ex.setType || 'straight',
              }));
            }
            setEntries(initial);
          }
          return;
        }

        // Load from the session's independent workout_data copy
        const wd = session.workoutData;
        const sessionTemplate = {
          id: Number(templateId),
          name: wd.name || 'Workout',
          isRest: false,
          exercises: wd.exercises,
        };
        setTemplate(sessionTemplate);

        // Restore entries from session_entries
        const saved = {};
        const restoredCompleted = new Set();
        const savedByExercise = new Map();
        for (const entry of (session.entries || [])) {
          if (!savedByExercise.has(entry.exerciseName)) savedByExercise.set(entry.exerciseName, []);
          savedByExercise.get(entry.exerciseName).push(entry);
        }

        for (const ex of wd.exercises) {
          const savedSets = savedByExercise.get(ex.name);
          if (savedSets) {
            savedSets.sort((a, b) => a.setNumber - b.setNumber);
            saved[ex.name] = savedSets.map((s, i) => {
              if (s.isCompleted) restoredCompleted.add(`${ex.name}-${i}`);
              // Restore per-set setType from workoutData sets (falls back to exercise-level)
              const wdSet = ex.sets?.[i];
              const setType = wdSet?.setType || ex.setType || 'straight';
              return { weight: s.weight || '', reps: s.reps || '', setType };
            });
          } else {
            saved[ex.name] = ex.sets.map((s) => ({
              weight: s.suggestedWeight || '',
              reps: '',
              setType: s.setType || ex.setType || 'straight',
            }));
          }
        }

        setEntries(saved);
        setCompletedSets(restoredCompleted);
        if (session.notes) setNotes(session.notes);
        if (session.completed) setIsCompleted(true);
        // Check localStorage for a persisted timer for this session
        const storedStart = (() => {
          try { return localStorage.getItem(`wf-timer-${templateId}-${date}`); } catch (_) { return null; }
        })();

        if (storedStart && !session.completed) {
          const origin = Number(storedStart);
          const secsSinceStart = Math.floor((Date.now() - origin) / 1000);
          setPersisted(true);
          setTimerStarted(true);
          if (secsSinceStart >= MAX_TIMER_SECS) {
            // Timer expired while away — cap it
            setElapsed(MAX_TIMER_SECS);
            try { localStorage.removeItem(`wf-timer-${templateId}-${date}`); } catch (_) {}
          } else {
            setElapsed(secsSinceStart);
            runTimerInterval(origin);
          }
        } else if (session.entries?.some(e => e.weight > 0 || e.reps > 0)) {
          setPersisted(true);
          setTimerStarted(true);
          // No stored timer — session has data but timer origin is unknown.
          // For in-progress sessions, start a fresh timer from now.
          if (!session.completed) {
            const now = Date.now();
            try { localStorage.setItem(`wf-timer-${templateId}-${date}`, String(now)); } catch (_) {}
            runTimerInterval(now);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') setLoadError('Failed to load workout — check your connection');
      } finally {
        setLoading(false);
        setDayNavDisabled(false);
      }
    }

    loadSession();
  }, [templateId, date]);

  // Keep the old useEffect structure reference for the rest of the file
  // (exercise history fetch is handled separately below)
  const _loadComplete = !loading;
  void(_loadComplete); // suppress unused warning

  /* REMOVED: old template-based loading logic. Sessions now always load from
     their own workout_data copy, created via /sessions/initialize on first access.
     Templates are never consulted after the initial copy. */


  // Fetch exercise history for smart weight suggestions after template loads
  useEffect(() => {
    if (tutorialMode) return;
    if (!template || template.isRest) return;
    const realExercises = template.exercises.filter(e => !e.isSectionHeader);
    const exerciseNames = realExercises.map(e => e.name);
    if (exerciseNames.length === 0) return;

    api('/sessions/exercise-history', {
      method: 'POST',
      body: JSON.stringify({ exerciseNames, limit: 3 }),
    })
      .then(history => {
        const suggestions = {};
        for (const ex of realExercises) {
          const exHistory = history[ex.name];
          if (exHistory) {
            const goalReps = ex.sets[0]?.plannedReps || 10;
            const suggestion = getWeightSuggestion(exHistory, goalReps);
            if (suggestion) suggestions[ex.name] = suggestion;
          }
        }
        setWeightSuggestions(suggestions);
      })
      .catch(() => {}); // Non-fatal
  }, [template]);

  function handleChange(exerciseName, setIdx, field, value) {
    setPersisted(false);
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseName] = [...(updated[exerciseName] || [])];
      updated[exerciseName][setIdx] = {
        ...updated[exerciseName][setIdx],
        [field]: field === 'setType' ? value : (value === -1 ? -1 : value === '' ? '' : Math.max(0, Number(value))),
      };
      return updated;
    });
    // User manually edited this field, so it's no longer auto-filled
    setAutoFilled((prev) => {
      const next = new Set(prev);
      next.delete(`${exerciseName}-${setIdx}`);
      return next;
    });
  }

  function handleBlur(exerciseName, setIdx, field) {
    const exEntries = entries[exerciseName] || [];
    const value = exEntries[setIdx]?.[field];
    // Only auto-fill if the user actually entered a value
    if (value === '' || value === undefined || value === null) return;

    const exercise = template.exercises.find((e) => e.name === exerciseName);
    if (!exercise) return;

    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseName] = [...(updated[exerciseName] || [])];
      for (let i = setIdx + 1; i < exercise.sets.length; i++) {
        const key = `${exerciseName}-${i}`;
        // Only fill if the set is not completed and the field is empty or auto-filled
        if (!completedSets.has(key)) {
          const current = updated[exerciseName][i]?.[field];
          if (current === '' || current === undefined || current === null || autoFilled.has(key)) {
            updated[exerciseName][i] = {
              ...updated[exerciseName][i],
              [field]: value,
            };
          }
        }
      }
      return updated;
    });

    // Mark the auto-filled sets
    setAutoFilled((prev) => {
      const next = new Set(prev);
      for (let i = setIdx + 1; i < exercise.sets.length; i++) {
        const key = `${exerciseName}-${i}`;
        if (!completedSets.has(key)) {
          const current = exEntries[i]?.[field];
          if (current === '' || current === undefined || current === null || prev.has(key)) {
            next.add(key);
          }
        }
      }
      return next;
    });
  }

  function handleAddSet(exerciseName, afterIdx) {
    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => {
      const updated = { ...prev, exercises: prev.exercises.map((ex) => {
        if (ex.name !== exerciseName) return ex;
        const refSet = ex.sets[afterIdx ?? ex.sets.length - 1];
        const newSet = {
          setNumber: 0, // will be renumbered below
          plannedReps: refSet?.plannedReps ?? 10,
          suggestedWeight: refSet?.suggestedWeight ?? 0,
        };
        const insertAt = afterIdx !== undefined ? afterIdx + 1 : ex.sets.length;
        const newSets = [...ex.sets.slice(0, insertAt), newSet, ...ex.sets.slice(insertAt)]
          .map((s, i) => ({ ...s, setNumber: i + 1 }));
        return { ...ex, sets: newSets };
      })};
      return updated;
    });
    setEntries((prev) => {
      const exEntries = prev[exerciseName] || [];
      const refEntry = exEntries[afterIdx ?? exEntries.length - 1];
      const newEntry = { weight: refEntry?.weight ?? '', reps: '' };
      const insertAt = afterIdx !== undefined ? afterIdx + 1 : exEntries.length;
      return {
        ...prev,
        [exerciseName]: [...exEntries.slice(0, insertAt), newEntry, ...exEntries.slice(insertAt)],
      };
    });
    // Shift completed sets and auto-filled after insertion point
    if (afterIdx !== undefined) {
      const shiftKeys = (prevSet) => {
        const next = new Set();
        for (const key of prevSet) {
          const [name, idxStr] = key.split(/-(?=\d+$)/);
          const i = Number(idxStr);
          if (name !== exerciseName) {
            next.add(key);
          } else if (i <= afterIdx) {
            next.add(key);
          } else {
            next.add(`${name}-${i + 1}`);
          }
        }
        return next;
      };
      setCompletedSets(shiftKeys);
      setAutoFilled(shiftKeys);
    }
  }

  function handleDeleteSet(exerciseName, setIdx) {
    // Snapshot before deleting
    const exercise = template.exercises.find((ex) => ex.name === exerciseName);
    if (!exercise || exercise.sets.length <= 1) return;
    const deletedSetData = exercise.sets[setIdx];
    const deletedEntry = (entries[exerciseName] || [])[setIdx];
    const wasCompleted = completedSets.has(`${exerciseName}-${setIdx}`);
    const wasAutoFilled = autoFilled.has(`${exerciseName}-${setIdx}`);

    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => {
        if (ex.name !== exerciseName || ex.sets.length <= 1) return ex;
        const newSets = ex.sets.filter((_, i) => i !== setIdx)
          .map((s, i) => ({ ...s, setNumber: i + 1 }));
        return { ...ex, sets: newSets };
      }),
    }));
    setEntries((prev) => {
      const exEntries = prev[exerciseName] || [];
      return {
        ...prev,
        [exerciseName]: exEntries.filter((_, i) => i !== setIdx),
      };
    });
    setCompletedSets((prev) => {
      const next = new Set();
      for (const key of prev) {
        const [name, idxStr] = key.split(/-(?=\d+$)/);
        const i = Number(idxStr);
        if (name !== exerciseName) {
          next.add(key);
        } else if (i < setIdx) {
          next.add(key);
        } else if (i > setIdx) {
          next.add(`${name}-${i - 1}`);
        }
      }
      return next;
    });
    setAutoFilled((prev) => {
      const next = new Set();
      for (const key of prev) {
        const [name, idxStr] = key.split(/-(?=\d+$)/);
        const i = Number(idxStr);
        if (name !== exerciseName) {
          next.add(key);
        } else if (i < setIdx) {
          next.add(key);
        } else if (i > setIdx) {
          next.add(`${name}-${i - 1}`);
        }
      }
      return next;
    });

    setUndoToast({
      type: 'set',
      exerciseName,
      message: `Removed set ${setIdx + 1} from ${exerciseName}`,
      undoFn: () => {
        setPersisted(false);
        structureSaveNeeded.current = true;
        setTemplate((prev) => ({
          ...prev,
          exercises: prev.exercises.map((ex) => {
            if (ex.name !== exerciseName) return ex;
            const newSets = [...ex.sets];
            newSets.splice(setIdx, 0, { ...deletedSetData, setNumber: setIdx + 1 });
            return { ...ex, sets: newSets.map((s, i) => ({ ...s, setNumber: i + 1 })) };
          }),
        }));
        setEntries((prev) => {
          const exEntries = [...(prev[exerciseName] || [])];
          exEntries.splice(setIdx, 0, deletedEntry || { weight: '', reps: '' });
          return { ...prev, [exerciseName]: exEntries };
        });
        setCompletedSets((prev) => {
          const next = new Set();
          for (const key of prev) {
            const [name, idxStr] = key.split(/-(?=\d+$)/);
            const i = Number(idxStr);
            if (name !== exerciseName) {
              next.add(key);
            } else if (i < setIdx) {
              next.add(key);
            } else {
              next.add(`${name}-${i + 1}`);
            }
          }
          if (wasCompleted) next.add(`${exerciseName}-${setIdx}`);
          return next;
        });
        setAutoFilled((prev) => {
          const next = new Set();
          for (const key of prev) {
            const [name, idxStr] = key.split(/-(?=\d+$)/);
            const i = Number(idxStr);
            if (name !== exerciseName) {
              next.add(key);
            } else if (i < setIdx) {
              next.add(key);
            } else {
              next.add(`${name}-${i + 1}`);
            }
          }
          if (wasAutoFilled) next.add(`${exerciseName}-${setIdx}`);
          return next;
        });
      },
    });
  }

  function handleAddExercise(name, afterIndex) {
    if (!name?.trim()) return;
    setPersisted(false);
    structureSaveNeeded.current = true;
    const exerciseName = name.trim();
    // Don't add if exercise already exists
    if (template.exercises.some((ex) => ex.name === exerciseName)) return;
    const newExercise = {
      name: exerciseName,
      sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 0 }],
    };
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      if (afterIndex !== undefined) {
        exercises.splice(afterIndex + 1, 0, newExercise);
      } else {
        exercises.push(newExercise);
      }
      return { ...prev, exercises };
    });
    setEntries((prev) => ({
      ...prev,
      [exerciseName]: [{ weight: '', reps: '' }],
    }));
    setShowAddExercise(false);
  }

  const exerciseRefs = useRef({});

  function handleDeleteExercise(exerciseName) {
    // Snapshot before deleting
    const exerciseIdx = template.exercises.findIndex((ex) => ex.name === exerciseName);
    const exerciseData = template.exercises[exerciseIdx];
    const exerciseEntries = entries[exerciseName];
    const exerciseCompletedKeys = [...completedSets].filter((k) => k.startsWith(exerciseName + '-'));
    const exerciseAutoFilledKeys = [...autoFilled].filter((k) => k.startsWith(exerciseName + '-'));

    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((ex) => ex.name !== exerciseName),
    }));
    setEntries((prev) => {
      const updated = { ...prev };
      delete updated[exerciseName];
      return updated;
    });
    setCompletedSets((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(exerciseName + '-')) next.add(key);
      }
      return next;
    });
    setAutoFilled((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(exerciseName + '-')) next.add(key);
      }
      return next;
    });

    setUndoToast({
      type: 'exercise',
      exerciseName,
      exerciseIndex: exerciseIdx,
      message: `Deleted ${exerciseName}`,
      undoFn: () => {
        setPersisted(false);
        structureSaveNeeded.current = true;
        setTemplate((prev) => {
          const exercises = [...prev.exercises];
          exercises.splice(exerciseIdx, 0, exerciseData);
          return { ...prev, exercises };
        });
        if (exerciseEntries) {
          setEntries((prev) => ({ ...prev, [exerciseName]: exerciseEntries }));
        }
        setCompletedSets((prev) => {
          const next = new Set(prev);
          exerciseCompletedKeys.forEach((k) => next.add(k));
          return next;
        });
        setAutoFilled((prev) => {
          const next = new Set(prev);
          exerciseAutoFilledKeys.forEach((k) => next.add(k));
          return next;
        });
      },
    });
  }

  function handleMoveExercise(fromIdx, toIdx) {
    setPersisted(false);
    structureSaveNeeded.current = true;
    const movingName = template.exercises[fromIdx]?.name;
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      const [moved] = exercises.splice(fromIdx, 1);
      exercises.splice(toIdx, 0, moved);
      return { ...prev, exercises };
    });
    // Scroll to the moved card after React re-renders
    setTimeout(() => {
      const el = exerciseRefs.current[movingName];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function handleNoteChange(exerciseName, value) {
    setPersisted(false);
    setNotes((prev) => ({ ...prev, [exerciseName]: value }));
  }

  function performSwap(oldName, newName) {
    setPersisted(false);
    structureSaveNeeded.current = true;
    // Get the number of sets from the old exercise
    const oldExercise = template.exercises.find((ex) => ex.name === oldName);
    const numSets = oldExercise?.sets?.length || 0;

    // Update template: replace name and clear plannedReps/suggestedWeight
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.name === oldName
          ? {
              ...ex,
              name: newName,
              sets: ex.sets.map((s) => ({ ...s, plannedReps: '', suggestedWeight: 0 })),
            }
          : ex
      ),
    }));

    // Set blank entries for the new exercise
    setEntries((prev) => {
      const updated = { ...prev };
      delete updated[oldName];
      updated[newName] = Array.from({ length: numSets }, () => ({ weight: '', reps: '' }));
      return updated;
    });

    // Clear notes for old exercise
    setNotes((prev) => {
      const updated = { ...prev };
      delete updated[oldName];
      return updated;
    });

    // Remove completedSets for old exercise (don't remap)
    setCompletedSets((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(oldName + '-')) next.add(key);
      }
      return next;
    });

    // Remove autoFilled for old exercise
    setAutoFilled((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(oldName + '-')) next.add(key);
      }
      return next;
    });
  }

  function handleSwapExercise(oldName, newName) {
    // Check if old exercise has any data worth preserving
    const oldEntries = entries[oldName] || [];
    const hasEntryData = oldEntries.some(
      (e) => (e.weight && Number(e.weight) > 0) || (e.reps && Number(e.reps) > 0)
    );
    const hasCompletedSets = [...completedSets].some((key) => key.startsWith(oldName + '-'));

    if (hasEntryData || hasCompletedSets) {
      // Show confirmation modal
      setPendingSwap({ oldName, newName });
    } else {
      // No data to lose, swap directly
      performSwap(oldName, newName);
    }
  }

  async function handleMarkComplete() {
    const newCompleted = !isCompleted;
    try {
      if (tutorialMode) {
        if (newCompleted) {
          // Autofill entries with varied reps and weights so summary shows volume variance
          const repVariations = [0, 1, 2, -1, -2, 0, 1, -1, 2, -2, 0, 1];
          const weightVariations = [0, 5, 10, 0, -5, 5, 0, -10, 10, 0, 5, -5];
          let variIdx = 0;
          const filled = {};
          for (const ex of template.exercises) {
            filled[ex.name] = ex.sets.map((s) => {
              const planned = s.plannedReps || 0;
              const goalWt = Number(s.suggestedWeight) || 0;
              const idx = variIdx++ % repVariations.length;
              const actualReps = Math.max(0, planned + repVariations[idx]);
              const actualWeight = Math.max(0, goalWt + weightVariations[idx]);
              return {
                weight: actualWeight || '',
                reps: actualReps,
                setType: s.setType || ex.setType || 'straight',
              };
            });
          }
          setEntries(filled);
          const allKeys = new Set();
          template.exercises.forEach((ex) => {
            ex.sets.forEach((_, i) => allKeys.add(`${ex.name}-${i}`));
          });
          setCompletedSets(allKeys);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          stopRestTimer();
          clearTimerStorage();
          navigator.vibrate?.([40, 30, 80]);
          setTutorialTip(null);
        }
        setIsCompleted(newCompleted);
        if (newCompleted) {
          setShowSummary(true);
        }
        return;
      }
      // Require at least one set with weight > 0 or reps > 0
      if (newCompleted) {
        const hasData = Object.values(entries).some((sets) =>
          sets.some((s) => (Number(s.weight) > 0) || (Number(s.reps) > 0))
        );
        if (!hasData) {
          alert('Log at least one set before completing your workout');
          return;
        }
      }
      // Save the session first so users don't have to click save separately
      if (newCompleted) {
        await handleSave();
      }
      await api('/sessions/complete', {
        method: 'PUT',
        body: JSON.stringify({
          templateId: Number(templateId),
          date,
          completed: newCompleted,
        }),
      });
      setIsCompleted(newCompleted);
      if (newCompleted) {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        stopRestTimer();
        clearTimerStorage();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setShowSummary(true);
      }
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  }

  function handleToggleComplete(exerciseName, setIdx) {
    setPersisted(false);
    const key = `${exerciseName}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (navigator.vibrate) navigator.vibrate(15);
        startTimer();
        startRestTimer();
      }
      return next;
    });

    // Trigger debounced auto-save
    autoSaveNeeded.current = true;

    // When completing a set, auto-fill subsequent uncompleted sets for this exercise
    setCompletedSets((latestCompleted) => {
      const isCompleting = !latestCompleted.has(key);
      if (isCompleting) {
        const exEntries = entries[exerciseName] || [];
        const thisEntry = exEntries[setIdx];
        const w = thisEntry?.weight;
        const r = thisEntry?.reps;
        if ((w !== '' && w !== undefined) || (r !== '' && r !== undefined)) {
          const exercise = template.exercises.find((e) => e.name === exerciseName);
          if (exercise) {
            setEntries((prev) => {
              const updated = { ...prev };
              updated[exerciseName] = [...(updated[exerciseName] || [])];
              const newAutoFilled = new Set(autoFilled);
              for (let i = setIdx + 1; i < exercise.sets.length; i++) {
                const laterKey = `${exerciseName}-${i}`;
                if (!latestCompleted.has(laterKey)) {
                  const current = updated[exerciseName][i] || {};
                  const currentWeight = current.weight;
                  const currentReps = current.reps;
                  const isCurrentAutoFilled = autoFilled.has(laterKey);
                  const weightEmpty = currentWeight === '' || currentWeight === undefined;
                  const repsEmpty = currentReps === '' || currentReps === undefined;
                  if (weightEmpty || repsEmpty || isCurrentAutoFilled) {
                    updated[exerciseName][i] = {
                      ...current,
                      weight: w !== '' && w !== undefined ? w : current.weight,
                      reps: r !== '' && r !== undefined ? r : current.reps,
                    };
                    newAutoFilled.add(laterKey);
                  }
                }
              }
              setAutoFilled(newAutoFilled);
              return updated;
            });
          }
        }
      }
      return latestCompleted;
    });
  }

  async function handleShare() {
    if (!template) return;

    const lines = [`${template.name} — ${format(parseISO(date), 'EEEE, MMM d')}\n`];

    for (const ex of template.exercises) {
      if (ex.isSectionHeader) continue;
      const exEntries = entries[ex.name] || [];
      const setLines = [];
      ex.sets.forEach((set, idx) => {
        const e = exEntries[idx];
        const w = e?.weight || 0;
        const r = e?.reps || 0;
        if (w > 0 || w === -1 || r > 0) {
          setLines.push(`  Set ${set.setNumber}: ${w === -1 ? 'BW' : w + ' lbs'} x ${r}`);
        }
      });
      if (setLines.length > 0) {
        lines.push(ex.name);
        lines.push(...setLines);
        lines.push('');
      }
    }

    lines.push(`${completedSets.size}/${template.exercises.filter(e => !e.isSectionHeader).reduce((s, e) => s + e.sets.length, 0)} sets completed`);

    const text = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: `${template.name} Workout`, text });
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('Workout copied to clipboard!');
    }
  }

  async function handleSave() {
    if (tutorialMode) { setPersisted(true); setSaved(true); setTimeout(() => setSaved(false), 2000); return; }
    if (!template || template.isRest) return;
    if (saving) throw new Error('Save already in progress');

    setSaving(true);
    savingRef.current = true;
    try {
      // Snapshot current PBs before saving (deep copy since nested)
      const oldPbs = JSON.parse(JSON.stringify(pbs));

      const allEntries = [];
      for (const ex of template.exercises) {
        if (ex.isSectionHeader) continue;
        const exEntries = entries[ex.name] || [];
        ex.sets.forEach((set, idx) => {
          const key = `${ex.name}-${idx}`;
          const isAutoOnly = autoFilled.has(key) && !completedSets.has(key);
          allEntries.push({
            exerciseName: ex.name,
            setNumber: set.setNumber,
            weight: isAutoOnly ? 0 : (exEntries[idx]?.weight || 0),
            reps: isAutoOnly ? 0 : (exEntries[idx]?.reps || 0),
            isCompleted: completedSets.has(key),
            setType: exEntries[idx]?.setType || set.setType || ex.setType || 'straight',
          });
        });
      }

      // Save the full workout structure as an independent copy
      const workoutData = {
        name: template.name,
        exercises: template.exercises.map((ex) => {
          if (ex.isSectionHeader) return { name: ex.name, isSectionHeader: true, sectionNotes: ex.sectionNotes || '', sets: [] };
          return {
            name: ex.name,
            setType: entries[ex.name]?.find(e => e?.setType)?.setType || ex.setType || 'straight',
            sets: ex.sets.map((s, i) => {
              const entry = entries[ex.name]?.[i];
              return {
                setNumber: s.setNumber,
                plannedReps: s.plannedReps ?? 10,
                suggestedWeight: entry?.weight || s.suggestedWeight || 0,
                setType: entry?.setType || s.setType || ex.setType || 'straight',
              };
            }),
          };
        }),
      };

      await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          templateId: Number(templateId),
          date,
          entries: allEntries,
          notes,
          workoutData,
        }),
      });

      // Refresh PBs
      const pbList = await api(`/pbs?templateId=${templateId}`);
      const pbMap = {};
      for (const pb of pbList) {
        if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
        pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
      }
      setPbs(pbMap);

      // Compare old vs new PBs to detect improvements
      const improved = [];
      for (const [exerciseName, newWeights] of Object.entries(pbMap)) {
        const oldWeights = oldPbs[exerciseName] || {};
        for (const [weight, newReps] of Object.entries(newWeights)) {
          const oldReps = oldWeights[weight] || 0;
          if (newReps > oldReps) {
            improved.push({ name: exerciseName, weight: Number(weight), reps: newReps });
          }
        }
      }

      if (improved.length > 0) {
        setNewPBs(improved);
        navigator.vibrate?.([40, 30, 80]);
      }

      // Auto-save any custom exercises not in the library
      const knownNames = new Set(allExercisesFromDB.map(e => e.name.toLowerCase()));
      for (const ex of template.exercises) {
        if (ex.isSectionHeader) continue;
        if (!knownNames.has(ex.name.toLowerCase())) {
          createCustom(ex.name, 'Other').catch(() => {});
        }
      }

      setPersisted(true);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  // Dirty if any entry has user-typed weight or reps
  const hasEntryData = Object.values(entries).some((exEntries) =>
    exEntries.some((e) => (e.weight !== '' && e.weight !== undefined) || (e.reps !== '' && e.reps !== undefined))
  );
  const sessionDirty = hasEntryData && !persisted;
  const inputsLocked = !timerStarted || isCompleted;
  const structureLocked = isCompleted; // exercise/set editing allowed before Begin Workout
  const { guardedNavigate, UnsavedModal } = useUnsavedGuard({
    isDirty: sessionDirty,
    onSave: handleSave,
    saveLabel: 'Save Workout',
  });

  // Navigate to adjacent day's workout (uses schedule to find templateId for that day)
  const [dayNavDisabled, setDayNavDisabled] = useState(false);
  const navigateToDay = useCallback((targetDate) => {
    if (!schedule || dayNavDisabled) return;
    const dow = targetDate.getDay();
    const entry = schedule.find(s => s.dayOfWeek === dow);
    if (entry && entry.templateId) {
      setDayNavDisabled(true);
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      navigate(`/session/${entry.templateId}/${dateStr}`, { replace: true });
    }
  }, [schedule, navigate, dayNavDisabled]);

  if (loading) {
    return (
      <div className="px-4 pt-6">
        <div className="glass-card rounded-xl h-12 w-48 mb-4 animate-pulse bg-white/5" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card rounded-xl overflow-hidden mb-3 animate-pulse">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="h-5 w-40 rounded-lg bg-white/10" />
              <div className="flex gap-1">
                <div className="w-7 h-7 rounded-full bg-white/5" />
                <div className="w-7 h-7 rounded-full bg-white/5" />
              </div>
            </div>
            <div className="px-4 py-2 space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex gap-2">
                  <div className="h-8 flex-1 rounded-lg bg-white/5" />
                  <div className="h-8 flex-1 rounded-lg bg-white/5" />
                  <div className="h-8 flex-1 rounded-lg bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-red-400 mb-3">{loadError}</p>
        <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="px-4 pt-6 text-center text-wf-gray-400">
        <p>Template not found</p>
      </div>
    );
  }

  const displayDate = date ? format(parseISO(date), 'EEEE, MMM d') : '';

  const prevDate = date ? subDays(parseISO(date), 1) : null;
  const nextDate = date ? addDays(parseISO(date), 1) : null;
  const prevScheduled = prevDate && schedule ? schedule.find(s => s.dayOfWeek === prevDate.getDay()) : null;
  const nextScheduled = nextDate && schedule ? schedule.find(s => s.dayOfWeek === nextDate.getDay()) : null;
  const hasPrev = prevScheduled && prevScheduled.templateId;
  const hasNext = nextScheduled && nextScheduled.templateId;

  if (template.isRest) {
    return (
      <div>
        <div className="px-4 pt-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-2 active:opacity-70">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>
        <StickyHeader title={template.name} subtitle={displayDate} />
        <RestDayCard />
      </div>
    );
  }

  const totalSets = template.exercises.filter(ex => !ex.isSectionHeader).reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedCount = completedSets.size;
  const progressPct = totalSets > 0 ? Math.round((completedCount / totalSets) * 100) : 0;

  const totalVolume = template.exercises.filter(ex => !ex.isSectionHeader).reduce((vol, ex) => {
    const exEntries = entries[ex.name] || [];
    return vol + exEntries.reduce((sum, e) => {
      const w = Number(e.weight) || 0;
      const r = Number(e.reps) || 0;
      return sum + (w > 0 ? w * r : 0);
    }, 0);
  }, 0);

  return (
    <div className="pb-24">
      {/* PB Celebration */}
      {newPBs && (
        <PBCelebration
          prs={newPBs}
          onDismiss={() => setNewPBs(null)}
        />
      )}

      {UnsavedModal}
      {showDateConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5" onClick={() => setShowDateConfirm(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white text-center mb-1">Different Date</h3>
            <p className="text-wf-gray-400 text-sm text-center mb-5">
              This workout is scheduled for {format(parseISO(date), 'MMMM d, yyyy')}. Are you sure you want to start it now?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowDateConfirm(false); startTimer(); }}
                className="w-full btn-gradient text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Start Anyway
              </button>
              <button
                onClick={() => setShowDateConfirm(false)}
                className="w-full text-wf-gray-400 font-medium py-2 text-sm active:opacity-70 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingSwap && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5" onClick={() => setPendingSwap(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white text-center mb-1">Substitute Exercise</h3>
            <p className="text-wf-gray-400 text-sm text-center mb-5">
              Substituting this exercise will remove your saved sets for {pendingSwap.oldName}. This cannot be undone.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { performSwap(pendingSwap.oldName, pendingSwap.newName); setPendingSwap(null); }}
                className="w-full btn-gradient text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Substitute
              </button>
              <button
                onClick={() => setPendingSwap(null)}
                className="w-full text-wf-gray-400 font-medium py-2 text-sm active:opacity-70 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Back button + Day navigation arrows */}
      <div className="px-4 pt-6 flex items-center justify-between">
        <button onClick={() => tutorialMode ? navigate('/') : guardedNavigate(() => navigate(-1))} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-2 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {tutorialMode ? 'Exit Tutorial' : 'Back'}
        </button>
        {!timerStarted && !tutorialMode && schedule && (
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => hasPrev && !dayNavDisabled && navigateToDay(prevDate)}
              disabled={!hasPrev || dayNavDisabled}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${hasPrev && !dayNavDisabled ? 'bg-white/10 text-white' : 'bg-white/5 text-wf-gray-600 cursor-default opacity-50'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-xs text-wf-gray-400 font-medium min-w-[60px] text-center">{displayDate.split(',')[0]}</span>
            <button
              onClick={() => hasNext && !dayNavDisabled && navigateToDay(nextDate)}
              disabled={!hasNext || dayNavDisabled}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${hasNext && !dayNavDisabled ? 'bg-white/10 text-white' : 'bg-white/5 text-wf-gray-600 cursor-default opacity-50'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Sticky Header with Progress Bar */}
      <StickyHeader
        title={`${template.name} — ${displayDate}`}
        subtitle={template.description || null}
        bottomContent={(collapsed) =>
          <div className="mt-2 space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-wf-gray-400 font-medium">Progress</span>
                <span className="text-xs text-wf-gray-400 font-medium tabular-nums">
                  {completedCount}/{totalSets} sets
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            {!timerStarted ? (
              <button
                data-tutorial="begin-workout-btn"
                onClick={handleBeginWorkout}
                className="w-full bg-wf-red/90 hover:bg-wf-red text-white text-xs font-semibold px-4 py-2 rounded-lg active:scale-[0.98] transition-all mt-1"
              >
                Begin Workout
              </button>
            ) : (
              <div className="mt-2">
                <div data-tutorial="workout-timer" className={`rounded-t-lg overflow-hidden transition-all duration-300 ${collapsed && !pinWorkoutTimer ? 'hidden' : ''} bg-black`}>
                  <div className="px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Workout Time</span>
                      <span className="bg-black/60 rounded-md px-2.5 py-1">
                        <span className="text-xl font-mono-stat font-bold text-white tracking-wider" style={{ letterSpacing: '2px' }}>{formatTime(elapsed)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTimerFloating(true)}
                      className="p-1.5 rounded-md text-wf-gray-500 active:scale-90 hover:text-white/70 transition-colors"
                      title="Pop out timer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPinWorkoutTimer(p => !p)}
                      className={`relative w-8 h-[18px] rounded-full transition-all duration-200 ${pinWorkoutTimer ? '' : 'bg-wf-gray-700'}`}
                      style={pinWorkoutTimer ? { background: 'linear-gradient(to right, rgba(239,68,68,0.8), rgba(239,68,68,0.3))' } : {}}
                      title={pinWorkoutTimer ? 'Unpin timer' : 'Pin timer'}
                    >
                      {pinWorkoutTimer && (
                        <svg className="absolute left-[3px] top-[3px] w-[12px] h-[12px] text-white/70" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
                        </svg>
                      )}
                      <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 ${pinWorkoutTimer ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                    </button>
                    </div>
                  </div>
                </div>
                <div data-tutorial="rest-timer" className={`rounded-b-lg overflow-hidden transition-all duration-300 ${collapsed && !pinRestTimer ? 'hidden' : ''} ${restRemaining !== null && restRemaining <= 0 ? 'border border-green-500/50' : ''} bg-black`}>
                  {restRemaining !== null && restRemaining > 0 && (
                    <div className="h-1 bg-white/5">
                      <div className="h-full bg-wf-red transition-all duration-1000 ease-linear" style={{ width: `${(restRemaining / restDuration) * 100}%` }} />
                    </div>
                  )}
                  <div className="px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {restRemaining !== null ? (
                        restRemaining <= 0 ? (
                          <>
                            <span className="bg-green-500/20 rounded-md px-3 py-1 border border-green-500/30">
                              <span className="text-lg font-mono-stat font-black text-green-400 tracking-wider" style={{ letterSpacing: '2px' }}>GO!</span>
                            </span>
                            <button onClick={stopRestTimer} className="text-xs text-wf-gray-500 px-2 py-1 rounded active:bg-white/10">Dismiss</button>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Rest</span>
                            <span className="bg-black/60 rounded-md px-2.5 py-1 border border-wf-red/30">
                              <span className="text-xl font-mono-stat font-black text-wf-red tracking-wider" style={{ letterSpacing: '2px' }}>{formatTime(restRemaining)}</span>
                            </span>
                            <button onClick={stopRestTimer} className="text-xs text-wf-gray-500 px-2 py-1 rounded active:bg-white/10">Skip</button>
                          </>
                        )
                      ) : (
                        <button onClick={startRestTimer} className="text-xs text-wf-red font-semibold px-3 py-1.5 rounded-lg bg-wf-red/10 active:bg-wf-red/20 transition-colors">
                          Start Rest
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={restDuration}
                        onChange={(e) => {
                          const newDuration = Number(e.target.value);
                          setRestDuration(newDuration);
                          if (restRemaining !== null && restRemaining > 0) {
                            restDurationRef.current = newDuration;
                            startRestTimer();
                          }
                        }}
                        className="text-xs font-semibold text-wf-gray-400 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                      >
                        {REST_OPTIONS.map((s) => (
                          <option key={s} value={s} className="bg-wf-gray-900">{s >= 60 ? `${Math.floor(s/60)}m` : `${s}s`}{s >= 60 && s % 60 ? ` ${s%60}s` : ''}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setRestFloating(true)}
                        className="p-1.5 rounded-md text-wf-gray-500 active:scale-90 hover:text-white/70 transition-colors"
                        title="Pop out rest timer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setPinRestTimer(p => !p)}
                        className={`relative w-8 h-[18px] rounded-full transition-all duration-200 ${pinRestTimer ? '' : 'bg-wf-gray-700'}`}
                        style={pinRestTimer ? { background: 'linear-gradient(to right, rgba(239,68,68,0.8), rgba(239,68,68,0.3))' } : {}}
                        title={pinRestTimer ? 'Unpin rest timer' : 'Pin rest timer'}
                      >
                        {pinRestTimer && (
                          <svg className="absolute left-[3px] top-[3px] w-[12px] h-[12px] text-white/70" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/>
                          </svg>
                        )}
                        <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-200 ${pinRestTimer ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      />

      {/* Status Banner */}
      {isCompleted && (
        <div className="px-4 mb-3">
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-green-400 font-semibold">Workout Complete</span>
            <span className="text-xs text-green-400/60 ml-auto">Tap "Undo Completion" to edit</span>
          </div>
        </div>
      )}

      {/* Tutorial banner */}
      {tutorialMode && (
        <div className="px-4 mb-3">
          <div className="glass-card rounded-xl p-3 border border-wf-cyan/20 bg-wf-cyan/5">
            <p className="text-xs text-wf-cyan leading-relaxed">
              This is a sample workout for the tutorial. Try tapping the checkmarks, entering weights and reps, and exploring the exercise cards. Nothing will be saved.
            </p>
          </div>
        </div>
      )}

      {/* Exercise Cards */}
      <div className="px-4">
        {template.exercises.map((exercise, idx) => (
          <div key={exercise.isSectionHeader ? `section-${idx}` : exercise.name}>
            {/* Inline undo toast for deleted exercise — show at this position */}
            {undoToast && undoToast.type === 'exercise' && undoToast.exerciseIndex === idx && (
              <UndoToast
                message={undoToast.message}
                onUndo={() => { undoToast.undoFn(); setUndoToast(null); }}
                onExpire={() => setUndoToast(null)}
              />
            )}
            {exercise.isSectionHeader ? (
            <div className="fade-slide-up mb-3" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="rounded-xl overflow-hidden border border-white/10 bg-gradient-to-r from-wf-red/10 via-transparent to-transparent">
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-1 h-6 rounded-full bg-wf-red shrink-0" />
                  <span className="text-[9px] text-wf-red uppercase tracking-widest font-bold shrink-0">Section</span>
                  <span className="text-sm font-black text-white uppercase tracking-wide">{exercise.name}</span>
                </div>
                {exercise.sectionNotes && (
                  <div className="px-4 pb-3 pl-8">
                    <div className="ml-0.5 pl-3 border-l border-white/10">
                      <p className="text-xs text-wf-gray-400 leading-relaxed">{exercise.sectionNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div ref={(el) => { exerciseRefs.current[exercise.name] = el; }} className="fade-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <ExerciseCard
              exercise={exercise}
              entries={entries[exercise.name]}
              pbs={pbs}
              readOnly={structureLocked}
              onChange={inputsLocked ? undefined : handleChange}
              onBlur={inputsLocked ? undefined : handleBlur}
              completedSets={completedSets}
              autoFilled={autoFilled}
              onToggleComplete={inputsLocked ? undefined : handleToggleComplete}
              onAddSet={structureLocked ? undefined : handleAddSet}
              onDeleteSet={structureLocked ? undefined : handleDeleteSet}
              onSwapExercise={structureLocked ? undefined : handleSwapExercise}
              onAddExercise={structureLocked ? undefined : (name) => handleAddExercise(name, idx)}
              onDeleteExercise={structureLocked ? undefined : () => handleDeleteExercise(exercise.name)}
              onMoveUp={structureLocked ? undefined : (idx > 0 ? () => handleMoveExercise(idx, idx - 1) : undefined)}
              onMoveDown={structureLocked ? undefined : (idx < template.exercises.length - 1 ? () => handleMoveExercise(idx, idx + 1) : undefined)}
              note={notes[exercise.name] || ''}
              onNoteChange={inputsLocked ? undefined : handleNoteChange}
              weightSuggestion={inputsLocked ? undefined : weightSuggestions[exercise.name]}
              onApplySuggestion={inputsLocked ? undefined : (exName, weight) => {
                setEntries(prev => {
                  const updated = { ...prev };
                  updated[exName] = (updated[exName] || []).map(e => ({ ...e, weight }));
                  return updated;
                });
                setWeightSuggestions(prev => { const next = { ...prev }; delete next[exName]; return next; });
              }}
              allWorkoutExercises={template.exercises.map(e => e.name)}
              lastEntries={lastSession[exercise.name]}
              dataTutorial={tutorialMode && idx === 1 ? 'exercise-header' : undefined}
            />
            {/* Inline undo toast for deleted set — show below this exercise */}
            {undoToast && undoToast.type === 'set' && undoToast.exerciseName === exercise.name && (
              <UndoToast
                message={undoToast.message}
                onUndo={() => { undoToast.undoFn(); setUndoToast(null); }}
                onExpire={() => setUndoToast(null)}
              />
            )}
          </div>
          )}
          {/* Undo toast after last exercise for exercise deletion at end */}
          {undoToast && undoToast.type === 'exercise' && undoToast.exerciseIndex >= template.exercises.length && idx === template.exercises.length - 1 && (
            <UndoToast
              message={undoToast.message}
              onUndo={() => { undoToast.undoFn(); setUndoToast(null); }}
              onExpire={() => setUndoToast(null)}
            />
          )}
          </div>
        ))}

        {/* Add Exercise Button */}
        {!structureLocked && (
          <button
            onClick={() => { setShowAddExercise(true); setAddExerciseSearch(''); }}
            className="w-full border border-dashed border-white/15 rounded-xl py-3.5 text-wf-gray-400 text-sm font-medium active:border-wf-red active:text-wf-red transition-colors flex items-center justify-center gap-2 mb-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Exercise
          </button>
        )}

        {/* Quick Add Buttons */}
        {!structureLocked && <div className="flex gap-2 mb-3">
          <button className="flex-1 glass-card rounded-xl py-3 text-wf-gray-400 text-xs font-semibold active:text-wf-red active:border-wf-red/30 transition-colors flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            Add Cardio
          </button>
          <button className="flex-1 glass-card rounded-xl py-3 text-wf-gray-400 text-xs font-semibold active:text-wf-red active:border-wf-red/30 transition-colors flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Add Abs
          </button>
          <button className="flex-1 glass-card rounded-xl py-3 text-wf-gray-400 text-xs font-semibold active:text-wf-red active:border-wf-red/30 transition-colors flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            </svg>
            Add a Warm Up
          </button>
        </div>}
      </div>

      {/* Add Exercise Modal */}
      {showAddExercise && (() => {
        const allExercises = allExercisesFromDB;
        const existingNames = new Set(template.exercises.map((ex) => ex.name));
        const q = addExerciseSearch.toLowerCase();
        const seen = new Set();
        const filtered = q
          ? allExercises.filter((ex) => {
              if (existingNames.has(ex.name) || seen.has(ex.name)) return false;
              seen.add(ex.name);
              return ex.name.toLowerCase().includes(q);
            }).slice(0, 12)
          : [];
        // Group by muscle for browsing when no search
        const muscleGroups = {};
        if (!q) {
          for (const ex of allExercises) {
            if (existingNames.has(ex.name) || seen.has(ex.name)) continue;
            seen.add(ex.name);
            if (!muscleGroups[ex.muscle]) muscleGroups[ex.muscle] = [];
            muscleGroups[ex.muscle].push(ex);
          }
        }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowAddExercise(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-lg bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl max-h-[75vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">Add Exercise</h3>
                  <button onClick={() => setShowAddExercise(false)} className="text-wf-gray-400 active:opacity-70">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={addExerciseSearch}
                  onChange={(e) => setAddExerciseSearch(e.target.value)}
                  placeholder="Search exercises or type a custom name..."
                  ref={iosFocusRef}
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
                />
              </div>
              <div className="overflow-y-auto flex-1 px-5 py-3">
                {/* Custom exercise option when typing */}
                {q && !allExercises.some((ex) => ex.name.toLowerCase() === q) && (
                  <>
                    <button
                      onClick={() => handleAddExercise(addExerciseSearch)}
                      className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-wf-red/10 active:bg-wf-red/20 active:scale-[0.98] transition-all mb-2"
                    >
                      <svg className="w-5 h-5 text-wf-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span className="text-sm text-white">Add "<span className="font-semibold">{addExerciseSearch}</span>"</span>
                    </button>
                    {filtered.length > 0 && <div className="border-t border-white/5 my-2" />}
                  </>
                )}
                {/* Search results */}
                {q && filtered.map((ex) => (
                  <button
                    key={ex.name}
                    onClick={() => handleAddExercise(ex.name)}
                    className="w-full text-left rounded-xl px-4 py-3 flex items-center justify-between active:bg-white/10 active:scale-[0.98] transition-all"
                  >
                    <span className="text-sm text-white">{ex.name}</span>
                    <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider ml-2 shrink-0">{ex.muscle}</span>
                  </button>
                ))}
                {/* Browse by muscle when no search */}
                {!q && Object.entries(muscleGroups).map(([muscle, exercises]) => (
                  <div key={muscle} className="mb-4">
                    <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 font-semibold mb-2 px-1">{muscle}</p>
                    <div className="space-y-0.5">
                      {exercises.slice(0, 6).map((ex) => (
                        <button
                          key={ex.name}
                          onClick={() => handleAddExercise(ex.name)}
                          className="w-full text-left rounded-lg px-4 py-2.5 text-sm text-white active:bg-white/10 transition-colors"
                        >
                          {ex.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Total Volume */}
      {totalVolume > 0 && (
        <div className="px-4 mt-4 mb-2">
          <div className="glass-card rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-wf-gray-400 font-medium">Total Volume</span>
            <span className="text-lg font-black text-white tabular-nums">
              {totalVolume.toLocaleString()} <span className="text-xs font-medium text-wf-gray-500">lbs</span>
            </span>
          </div>
        </div>
      )}

      {/* Mark Complete */}
      {timerStarted && (
        <div className="px-4 mb-24" data-tutorial="mark-complete">
          <button
            onClick={handleMarkComplete}
            className={`w-full font-semibold py-3.5 rounded-xl text-sm transition-all active:scale-[0.98] ${
              isCompleted
                ? 'glass-card !border-wf-gray-500 text-wf-gray-400'
                : 'bg-wf-red/90 hover:bg-wf-red text-white'
            }`}
          >
            {isCompleted ? 'Undo Completion' : 'Mark Complete'}
          </button>
        </div>
      )}

      {/* Save & Share Buttons - Fixed at bottom */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom z-40">
        <div className="flex gap-2">
          {/* Save button hidden — auto-save on check mark is fast enough
          <button
            onClick={handleSave}
            disabled={saving || !timerStarted}
            className={`flex-1 font-semibold py-4 rounded-xl text-base transition-all active:scale-[0.98] ${
              saved
                ? 'bg-green-600 text-white shadow-[0_4px_20px_rgba(22,163,74,0.3)]'
                : 'btn-gradient text-white'
            } disabled:opacity-50`}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Session'}
          </button>
          */}
          <button
            onClick={handleShare}
            className="flex-1 glass-card rounded-xl flex items-center justify-center py-4 text-wf-gray-400 hover:text-white transition-colors active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Workout Summary */}
      {showSummary && (
        <WorkoutSummary
          template={template}
          entries={entries}
          completedSets={completedSets}
          elapsed={tutorialMode ? 2717 : elapsed}
          formatTime={formatTime}
          onClose={() => { setShowSummary(false); navigate(tutorialMode ? '/' : '/calendar'); }}
        />
      )}

      {/* Floating Timer */}
      {/* Floating Workout Timer */}
      {timerFloating && timerStarted && (
        <div
          className="fixed z-50 touch-none"
          style={{ left: floatPos.x, top: floatPos.y }}
          onTouchStart={handleFloatTouchStart}
          onTouchMove={handleFloatTouchMove}
          onTouchEnd={handleFloatTouchEnd}
        >
          <div className="bg-wf-gray-900/95 rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-sm flex items-center gap-3">
            <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Workout Time</span>
            <span className="text-lg font-black text-white tabular-nums font-mono-stat">{formatTime(elapsed)}</span>
            <button
              onClick={() => setTimerFloating(false)}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Rest Timer */}
      {restFloating && timerStarted && (
        <div
          className="fixed z-50 touch-none"
          style={{ left: restFloatPos.x, top: restFloatPos.y }}
          onTouchStart={handleRestFloatTouchStart}
          onTouchMove={handleRestFloatTouchMove}
          onTouchEnd={handleRestFloatTouchEnd}
        >
          <div className={`rounded-2xl px-4 py-2.5 shadow-2xl backdrop-blur-sm flex items-center gap-3 ${restRemaining !== null && restRemaining <= 0 ? 'bg-green-900/95 border border-green-500/30' : 'bg-wf-gray-900/95'}`}>
            {restRemaining !== null ? (
              restRemaining <= 0 ? (
                <span className="text-lg font-mono-stat font-black text-green-400">GO!</span>
              ) : (
                <>
                  <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Rest</span>
                  <span className="text-lg font-black text-wf-red tabular-nums font-mono-stat">{formatTime(restRemaining)}</span>
                </>
              )
            ) : (
              <button onClick={startRestTimer} className="text-xs text-wf-red font-semibold px-3 py-1.5 rounded-lg bg-wf-red/10 active:bg-wf-red/20 transition-colors">
                Start Rest
              </button>
            )}
            <button
              onClick={() => setRestFloating(false)}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tutorial workout tip overlays */}
      {tutorialTip && (() => {
        const tips = {
          'begin-workout': {
            target: '[data-tutorial="begin-workout-btn"]',
            title: 'Begin Your Workout',
            description: <>Tap <span className="text-white font-semibold">Begin Workout</span> above to start your session. This kicks off the workout timer and unlocks all the exercise controls so you can log your sets.</>,
            prev: null,
            next: null,
            position: 'below',
            interactive: true, // allow clicking the actual button
          },
          timer: {
            target: '[data-tutorial="workout-timer"]',
            title: 'Workout Timer',
            description: <>This timer tracks your total workout time. To the far right, use the <span className="text-white font-semibold">pop-out</span> button to float the timer on screen as you scroll, or the <span className="text-white font-semibold">lock toggle</span> to keep the timer visible as you scroll down.</>,
            prev: null, // can't go back to begin-workout (already tapped)
            next: 'rest',
            position: 'below',
          },
          rest: {
            target: '[data-tutorial="rest-timer"]',
            title: 'Rest Timer',
            description: <>Tap <span className="text-white font-semibold">Start Rest</span> between sets to begin a countdown. Use the <span className="text-white font-semibold">dropdown</span> to set your rest duration (15s to 3 min). The <span className="text-white font-semibold">pop-out</span> button floats the timer as you scroll, and the <span className="text-white font-semibold">lock toggle</span> keeps it pinned when the header collapses. You'll hear an audio cue when rest is over.</>,
            prev: 'timer',
            next: 'exercise-card',
            position: 'below',
          },
          'exercise-card': {
            target: '[data-tutorial="exercise-card"]',
            title: 'Exercise Card',
            description: <>Each exercise in your workout has its own card. The card contains everything you need — the exercise name, set controls, your logged sets, and notes. Let's walk through each part.</>,
            prev: 'rest',
            next: 'exercise-header',
            position: 'below-anchor',
            tooltipAnchor: '[data-tutorial="set-row"]',
          },
          'exercise-header': {
            target: '[data-tutorial="move-buttons"]',
            title: 'Reorder Exercises',
            description: <>Use the <span className="text-white font-semibold">up</span> and <span className="text-white font-semibold">down arrows</span> to move this exercise higher or lower in your workout order.</>,
            prev: 'exercise-card',
            next: 'swap-exercise',
            position: 'below',
          },
          'swap-exercise': {
            target: '[data-tutorial="swap-button"]',
            title: 'Swap Exercise',
            description: <>Tap this button to <span className="text-white font-semibold">substitute</span> the current exercise with a different one. You can search the exercise library or type a custom exercise name.</>,
            prev: 'exercise-header',
            next: 'add-delete-exercise',
            position: 'below',
          },
          'add-delete-exercise': {
            target: '[data-tutorial="add-delete-buttons"]',
            title: 'Add & Remove Exercises',
            description: <>The <span className="text-white font-semibold">plus button</span> adds a new exercise below this one. The <span className="text-white font-semibold">X button</span> removes this exercise from the workout entirely. Tap the exercise name to view a demo video.</>,
            prev: 'swap-exercise',
            next: 'set-controls',
            position: 'below',
          },
          'set-controls': {
            target: '[data-tutorial="set-controls"]',
            title: 'Add & Remove Sets',
            description: <>Tap <span className="text-white font-semibold">Add Set</span> to add another set to this exercise. Tap <span className="text-white font-semibold">Remove</span> to delete the last set. Long-press any set row to delete a specific set.</>,
            prev: 'add-delete-exercise',
            next: 'set-row',
            position: 'below',
          },
          'set-row': {
            target: '[data-tutorial="set-row"]',
            title: 'Tracking a Set',
            description: <>Each row is one set. The <span className="text-white font-semibold">circle on the left</span> marks the set as complete. <span className="text-white font-semibold">Type</span> shows the set type (warm-up, regular, drop set, etc.) — tap to change it. <span className="text-white font-semibold">Weight</span> is where you enter the weight used. <span className="text-white font-semibold">Goal</span> shows the target reps. <span className="text-white font-semibold">Actual</span> is where you enter the reps you completed.</>,
            prev: 'set-controls',
            next: 'exercise-notes',
            position: 'below',
          },
          'exercise-notes': {
            target: '[data-tutorial="exercise-notes"]',
            title: 'Exercise Notes',
            description: <>Tap here to add notes for this exercise — things like form cues, how the set felt, or adjustments for next time.</>,
            prev: 'set-row',
            next: 'mark-complete',
            position: 'below',
          },
          'mark-complete': {
            target: '[data-tutorial="mark-complete"]',
            title: 'Complete Your Workout',
            description: <>When you're done, tap the <span className="text-white font-semibold">Mark Complete</span> button below to finish your workout. You'll see a summary of everything you logged — exercises, sets, reps, and total workout time.</>,
            prev: 'exercise-notes',
            next: null,
            position: 'above',
            interactive: true,
          },
        };
        const tip = tips[tutorialTip];
        if (!tip || !tutorialReady || !tutorialRectRef.current) return null;
        const r = tutorialRectRef.current;
        const pad = 8;
        return (
          <div ref={tutorialOverlayRef} className="fixed inset-0 z-[100]" style={{ pointerEvents: 'none' }}>
            {/* Click blocker with hole punched for interactive tips */}
            <div className="absolute inset-0" style={{
              pointerEvents: 'auto',
              touchAction: 'none',
              ...(tip.interactive ? {
                clipPath: `path(evenodd, 'M 0 0 L ${window.innerWidth} 0 L ${window.innerWidth} ${window.innerHeight} L 0 ${window.innerHeight} Z M ${r.left - pad} ${r.top - pad} L ${r.left - pad} ${r.top + r.height + pad} L ${r.left + r.width + pad} ${r.top + r.height + pad} L ${r.left + r.width + pad} ${r.top - pad} Z')`
              } : {}),
            }} />
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              <defs>
                <mask id="tutorial-tip-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect x={r.left - pad} y={r.top - pad} width={r.width + pad * 2} height={r.height + pad * 2} rx="12" fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#tutorial-tip-mask)" />
            </svg>
            <div
              className="absolute rounded-xl border-2 border-wf-cyan/60 shadow-[0_0_20px_rgba(0,200,255,0.15)]"
              style={{ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2, pointerEvents: 'none' }}
            />
            <div
              className="absolute w-[calc(100%-48px)] max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
              style={{
                ...(() => {
                  if (tip.position === 'fixed-bottom') {
                    return { bottom: 24, left: '50%', transform: 'translateX(-50%)' };
                  }
                  if (tip.position === 'below-anchor' && tip.tooltipAnchor) {
                    const anchor = document.querySelector(tip.tooltipAnchor);
                    if (anchor) {
                      const anchorRect = anchor.getBoundingClientRect();
                      return { top: anchorRect.bottom + 16, left: '50%', transform: 'translateX(-50%)' };
                    }
                  }
                  if (tip.position === 'above') {
                    return { bottom: window.innerHeight - r.top + pad + 16, left: '50%', transform: 'translateX(-50%)' };
                  }
                  return { top: r.bottom + pad + 16, left: '50%', transform: 'translateX(-50%)' };
                })(),
                pointerEvents: 'auto',
              }}
            >
              <h3 className="text-base font-bold text-white mb-1">{tip.title}</h3>
              <p className="text-sm text-wf-gray-400 leading-relaxed">{tip.description}</p>
              <div className="flex items-center justify-center gap-3 mt-4">
                {tip.prev && (
                  <button
                    onClick={() => setTutorialTip(tip.prev)}
                    className="text-sm font-semibold text-white/70 bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors py-2 px-5 rounded-xl border border-white/10"
                  >
                    Back
                  </button>
                )}
                {!tip.interactive && <button
                  onClick={() => setTutorialTip(tip.next)}
                  className="text-sm font-semibold text-white btn-gradient py-2 px-5 rounded-xl active:scale-[0.97] transition-transform"
                >
                  {tip.next ? 'Next' : 'Got it'}
                </button>}
                <button
                  onClick={() => { setTutorialTip(null); navigate('/'); }}
                  className="text-sm font-semibold text-white/70 bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors py-2 px-5 rounded-xl border border-white/10"
                >
                  Skip tutorial
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

function WorkoutSummary({ template, entries, completedSets, elapsed, formatTime, onClose }) {
  const canvasRef = useRef(null);

  // Confetti
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * -1,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: Math.random() * 3 + 2,
      vx: (Math.random() - 0.5) * 2,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    }));

    let frame;
    let fadeStart = null;
    const duration = 3500;

    function animate(ts) {
      if (!fadeStart) fadeStart = ts;
      const progress = ts - fadeStart;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const globalFade = progress > duration ? Math.max(0, 1 - (progress - duration) / 1000) : 1;

      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        p.vy += 0.04;
        p.opacity = globalFade;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (globalFade > 0) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Stats
  const realExercises = template.exercises.filter(ex => !ex.isSectionHeader);
  const totalSets = realExercises.reduce((s, ex) => s + ex.sets.length, 0);
  const totalVolume = realExercises.reduce((vol, ex) => {
    const exEntries = entries[ex.name] || [];
    return vol + exEntries.reduce((sum, e) => {
      const w = Number(e.weight) || 0;
      const r = Number(e.reps) || 0;
      return sum + (w > 0 ? w * r : 0);
    }, 0);
  }, 0);

  // Per-exercise data with per-set volume breakdown (goal volume vs actual volume)
  const exerciseStats = realExercises.map((ex) => {
    const exEntries = entries[ex.name] || [];
    const setStats = ex.sets.map((set, idx) => {
      const goalWeight = Number(set.suggestedWeight) || 0;
      const goalReps = set.plannedReps || 0;
      const goalVolume = goalWeight > 0 ? goalWeight * goalReps : 0;
      const actualWeight = Number(exEntries[idx]?.weight) || 0;
      const actualReps = Number(exEntries[idx]?.reps) || 0;
      const actualVolume = actualWeight > 0 ? actualWeight * actualReps : 0;
      return { setNumber: set.setNumber, goalVolume, actualVolume, goalReps, actualReps, goalWeight, actualWeight };
    });
    const totalGoalVol = setStats.reduce((s, ss) => s + ss.goalVolume, 0);
    const totalActualVol = setStats.reduce((s, ss) => s + ss.actualVolume, 0);
    return { name: ex.name, setStats, totalGoalVol, totalActualVol };
  });

  const totalGoalVolume = exerciseStats.reduce((s, ex) => s + ex.totalGoalVol, 0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Content */}
      <div className="relative z-20 flex-1 overflow-y-auto safe-top safe-bottom">
        <div className="px-5 pt-4 pb-24 max-w-lg mx-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Workout Complete!</h2>
            <p className="text-wf-gray-400 text-sm">{template.name}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-wf-gray-500 uppercase tracking-wider mb-1">Time</p>
              <p className="text-lg font-black text-white tabular-nums">{formatTime(elapsed)}</p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-wf-gray-500 uppercase tracking-wider mb-1">Sets</p>
              <p className="text-lg font-black text-white tabular-nums">{completedSets.size}<span className="text-xs font-medium text-wf-gray-500">/{totalSets}</span></p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-wf-gray-500 uppercase tracking-wider mb-1">Actual Vol</p>
              <p className="text-lg font-black text-white tabular-nums">{totalVolume.toLocaleString()}<span className="text-xs font-medium text-wf-gray-500"> lbs</span></p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-wf-gray-500 uppercase tracking-wider mb-1">Goal Vol</p>
              <p className="text-lg font-black text-white tabular-nums">{totalGoalVolume.toLocaleString()}<span className="text-xs font-medium text-wf-gray-500"> lbs</span></p>
            </div>
          </div>

          {/* Exercise Breakdown */}
          <div className="space-y-2">
            <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mb-1">Exercise Breakdown</p>
            {exerciseStats.map((ex) => {
              const volDiff = ex.totalActualVol - ex.totalGoalVol;
              const volSign = volDiff > 0 ? '+' : '';
              const volColor = volDiff > 0 ? 'text-green-400' : volDiff === 0 ? 'text-yellow-400' : 'text-red-400';
              return (
              <div key={ex.name} className="glass-card rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-medium text-white truncate mr-2">{ex.name}</span>
                  <span className={`text-xs tabular-nums shrink-0 font-semibold ${volColor}`}>
                    {volSign}{volDiff.toLocaleString()} lbs
                  </span>
                </div>
                <div className="space-y-1.5">
                  {ex.setStats.map((ss) => {
                    const maxRatio = 1.25;
                    const ratio = ss.goalVolume > 0 ? ss.actualVolume / ss.goalVolume : 0;
                    const barPct = Math.min(100, (ratio / maxRatio) * 100);
                    const tickPos = (1 / maxRatio) * 100; // 80%
                    const barColor = ratio > 1 ? 'bg-green-500' : ratio === 1 ? 'bg-yellow-500' : 'bg-red-500';

                    return (
                      <div key={ss.setNumber} className="flex items-center gap-2">
                        <span className="text-[10px] text-wf-gray-500 w-5 shrink-0 text-right tabular-nums">{ss.setNumber}</span>
                        <div className="relative flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${barColor}`}
                            style={{ width: `${barPct}%` }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white/50"
                            style={{ left: `${tickPos}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-wf-gray-400 w-20 shrink-0 text-right tabular-nums">
                          {ss.actualVolume.toLocaleString()}/{ss.goalVolume.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Done button */}
      <div className="relative z-20 p-4 bg-gradient-to-t from-black via-black/95 to-transparent safe-bottom">
        <button
          onClick={onClose}
          className="w-full btn-gradient text-white font-bold py-4 rounded-xl text-base active:scale-[0.98] transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}
