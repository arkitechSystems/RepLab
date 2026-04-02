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

// Build a unique key for each exercise card. The first occurrence of a name
// keeps the plain name (backward-compatible with saved sessions). Subsequent
// duplicates get "::1", "::2", etc.
function exKey(exercises, exerciseOrName, idx) {
  const name = typeof exerciseOrName === 'string' ? exerciseOrName : exerciseOrName.name;
  let occurrence = 0;
  for (let i = 0; i < idx; i++) {
    if (!exercises[i].isSectionHeader && exercises[i].name === name) occurrence++;
  }
  return occurrence > 0 ? `${name}::${occurrence}` : name;
}

// Extract the original exercise name from a key (strips "::N" suffix)
function exNameFromKey(key) {
  const sep = key.lastIndexOf('::');
  return sep >= 0 ? key.slice(0, sep) : key;
}

// Find the template exercise index whose computed key matches
function findExIdx(exercises, key) {
  for (let i = 0; i < exercises.length; i++) {
    if (!exercises[i].isSectionHeader && exKey(exercises, exercises[i], i) === key) return i;
  }
  return -1;
}

export default function WorkoutSession() {
  const { templateId, date } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tutorialMode = templateId === 'tutorial';
  const tutorialTemplate = location.state?.tutorialTemplate || null;
  const { exercises: allExercisesFromDB, createCustom } = useExercises();
  const [template, setTemplate] = useState(null);
  const [programName, setProgramName] = useState('');
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
  const [showBeginPrompt, setShowBeginPrompt] = useState(false);
  const [showAllDemos, setShowAllDemos] = useState(false);
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
      for (let exIdx = 0; exIdx < tutorialTemplate.exercises.length; exIdx++) {
        const ex = tutorialTemplate.exercises[exIdx];
        if (ex.isSectionHeader) continue;
        const key = exKey(tutorialTemplate.exercises, ex, exIdx);
        initial[key] = ex.sets.map((s) => ({
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
        // Fetch PBs, schedule, last session entries, and programs in parallel
        // Fetch schedule for a small window around the current date (for day nav arrows)
        const schedFrom = format(subDays(parseISO(date), 7), 'yyyy-MM-dd');
        const schedTo = format(addDays(parseISO(date), 7), 'yyyy-MM-dd');
        const [pbList, scheduleData, lastEntries, programs] = await Promise.all([
          api(`/pbs?templateId=${templateId}`),
          api(`/schedule?from=${schedFrom}&to=${schedTo}`),
          api(`/sessions/last-entries/${templateId}`).catch(() => ({})),
          api('/programs').catch(() => []),
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
            for (let exIdx = 0; exIdx < tmpl.exercises.length; exIdx++) {
              const ex = tmpl.exercises[exIdx];
              if (ex.isSectionHeader) continue;
              const key = exKey(tmpl.exercises, ex, exIdx);
              initial[key] = ex.sets.map((s) => ({
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

        // Look up program name
        const tmplList = await api('/templates').catch(() => []);
        const tmplInfo = tmplList.find(t => t.id === Number(templateId));
        if (tmplInfo?.programId && programs.length > 0) {
          const prog = programs.find(p => p.id === tmplInfo.programId);
          if (prog) setProgramName(prog.name);
        }

        // Restore entries from session_entries
        const saved = {};
        const restoredCompleted = new Set();
        const savedByExercise = new Map();
        for (const entry of (session.entries || [])) {
          if (!savedByExercise.has(entry.exerciseName)) savedByExercise.set(entry.exerciseName, []);
          savedByExercise.get(entry.exerciseName).push(entry);
        }

        // Track how many sets we've consumed for each exercise name
        const consumedSets = {};
        for (let exIdx = 0; exIdx < wd.exercises.length; exIdx++) {
          const ex = wd.exercises[exIdx];
          if (ex.isSectionHeader) continue;
          const key = exKey(wd.exercises, ex, exIdx);
          const allSaved = savedByExercise.get(ex.name) || [];
          // Sort once (only on first encounter)
          if (!consumedSets[ex.name] && allSaved.length > 0) {
            allSaved.sort((a, b) => a.setNumber - b.setNumber);
          }
          const consumed = consumedSets[ex.name] || 0;
          const setCount = ex.sets.length;
          const mySaved = allSaved.slice(consumed, consumed + setCount);
          consumedSets[ex.name] = consumed + setCount;

          if (mySaved.length > 0) {
            saved[key] = mySaved.map((s, i) => {
              if (s.isCompleted) restoredCompleted.add(`${key}-${i}`);
              const wdSet = ex.sets?.[i];
              const setType = wdSet?.setType || ex.setType || 'straight';
              return { weight: s.weight ?? '', reps: s.reps || '', setType };
            });
          } else {
            saved[key] = ex.sets.map((s) => ({
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

    // Find the exercise whose computed key matches
    let exercise = null;
    for (let i = 0; i < template.exercises.length; i++) {
      const e = template.exercises[i];
      if (!e.isSectionHeader && exKey(template.exercises, e, i) === exerciseName) { exercise = e; break; }
    }
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

  function handleAddSet(exerciseKey, afterIdx) {
    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => {
      const tIdx = findExIdx(prev.exercises, exerciseKey);
      if (tIdx < 0) return prev;
      const updated = { ...prev, exercises: prev.exercises.map((ex, i) => {
        if (i !== tIdx) return ex;
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
      const exEntries = prev[exerciseKey] || [];
      const refEntry = exEntries[afterIdx ?? exEntries.length - 1];
      const newEntry = { weight: refEntry?.weight ?? '', reps: '' };
      const insertAt = afterIdx !== undefined ? afterIdx + 1 : exEntries.length;
      return {
        ...prev,
        [exerciseKey]: [...exEntries.slice(0, insertAt), newEntry, ...exEntries.slice(insertAt)],
      };
    });
    // Shift completed sets and auto-filled after insertion point
    if (afterIdx !== undefined) {
      const shiftKeys = (prevSet) => {
        const next = new Set();
        for (const key of prevSet) {
          const [name, idxStr] = key.split(/-(?=\d+$)/);
          const i = Number(idxStr);
          if (name !== exerciseKey) {
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

  function handleDeleteSet(exerciseKey, setIdx) {
    // Snapshot before deleting
    const tIdx = findExIdx(template.exercises, exerciseKey);
    if (tIdx < 0) return;
    const exercise = template.exercises[tIdx];
    if (exercise.sets.length <= 1) return;
    const deletedSetData = exercise.sets[setIdx];
    const deletedEntry = (entries[exerciseKey] || [])[setIdx];
    const wasCompleted = completedSets.has(`${exerciseKey}-${setIdx}`);
    const wasAutoFilled = autoFilled.has(`${exerciseKey}-${setIdx}`);
    const baseName = exNameFromKey(exerciseKey);

    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => {
      const ti = findExIdx(prev.exercises, exerciseKey);
      return {
        ...prev,
        exercises: prev.exercises.map((ex, i) => {
          if (i !== ti || ex.sets.length <= 1) return ex;
          const newSets = ex.sets.filter((_, j) => j !== setIdx)
            .map((s, j) => ({ ...s, setNumber: j + 1 }));
          return { ...ex, sets: newSets };
        }),
      };
    });
    setEntries((prev) => {
      const exEntries = prev[exerciseKey] || [];
      return {
        ...prev,
        [exerciseKey]: exEntries.filter((_, i) => i !== setIdx),
      };
    });
    setCompletedSets((prev) => {
      const next = new Set();
      for (const key of prev) {
        const [name, idxStr] = key.split(/-(?=\d+$)/);
        const i = Number(idxStr);
        if (name !== exerciseKey) {
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
        if (name !== exerciseKey) {
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
      exerciseName: exerciseKey,
      message: `Removed set ${setIdx + 1} from ${baseName}`,
      undoFn: () => {
        setPersisted(false);
        structureSaveNeeded.current = true;
        setTemplate((prev) => {
          const ti = findExIdx(prev.exercises, exerciseKey);
          return {
            ...prev,
            exercises: prev.exercises.map((ex, i) => {
              if (i !== ti) return ex;
              const newSets = [...ex.sets];
              newSets.splice(setIdx, 0, { ...deletedSetData, setNumber: setIdx + 1 });
              return { ...ex, sets: newSets.map((s, j) => ({ ...s, setNumber: j + 1 })) };
            }),
          };
        });
        setEntries((prev) => {
          const exEntries = [...(prev[exerciseKey] || [])];
          exEntries.splice(setIdx, 0, deletedEntry || { weight: '', reps: '' });
          return { ...prev, [exerciseKey]: exEntries };
        });
        setCompletedSets((prev) => {
          const next = new Set();
          for (const key of prev) {
            const [name, idxStr] = key.split(/-(?=\d+$)/);
            const i = Number(idxStr);
            if (name !== exerciseKey) {
              next.add(key);
            } else if (i < setIdx) {
              next.add(key);
            } else {
              next.add(`${name}-${i + 1}`);
            }
          }
          if (wasCompleted) next.add(`${exerciseKey}-${setIdx}`);
          return next;
        });
        setAutoFilled((prev) => {
          const next = new Set();
          for (const key of prev) {
            const [name, idxStr] = key.split(/-(?=\d+$)/);
            const i = Number(idxStr);
            if (name !== exerciseKey) {
              next.add(key);
            } else if (i < setIdx) {
              next.add(key);
            } else {
              next.add(`${name}-${i + 1}`);
            }
          }
          if (wasAutoFilled) next.add(`${exerciseKey}-${setIdx}`);
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
    const newExercise = {
      name: exerciseName,
      sets: [{ setNumber: 1, plannedReps: 10, suggestedWeight: 0 }],
    };
    // Compute the new exercises list to determine the correct unique key
    const newExercises = [...template.exercises];
    const insertIdx = afterIndex !== undefined ? afterIndex + 1 : newExercises.length;
    newExercises.splice(insertIdx, 0, newExercise);
    const newKey = exKey(newExercises, exerciseName, insertIdx);

    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      exercises.splice(insertIdx, 0, newExercise);
      return { ...prev, exercises };
    });
    setEntries((prev) => ({
      ...prev,
      [newKey]: [{ weight: '', reps: '' }],
    }));
    setShowAddExercise(false);
    // Mark that we want to scroll to this exercise after render
    scrollToExercise.current = insertIdx;
  }

  const exerciseRefs = useRef({});
  const scrollToExercise = useRef(null);

  function handleDeleteExercise(exerciseKey) {
    // Snapshot before deleting
    const exerciseIdx = findExIdx(template.exercises, exerciseKey);
    if (exerciseIdx < 0) return;
    const exerciseData = template.exercises[exerciseIdx];
    const exerciseEntries = entries[exerciseKey];
    const exerciseCompletedKeys = [...completedSets].filter((k) => k.startsWith(exerciseKey + '-'));
    const exerciseAutoFilledKeys = [...autoFilled].filter((k) => k.startsWith(exerciseKey + '-'));
    const baseName = exNameFromKey(exerciseKey);

    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => {
      const ti = findExIdx(prev.exercises, exerciseKey);
      return {
        ...prev,
        exercises: prev.exercises.filter((_, i) => i !== ti),
      };
    });
    setEntries((prev) => {
      const updated = { ...prev };
      delete updated[exerciseKey];
      return updated;
    });
    setCompletedSets((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(exerciseKey + '-')) next.add(key);
      }
      return next;
    });
    setAutoFilled((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(exerciseKey + '-')) next.add(key);
      }
      return next;
    });

    setUndoToast({
      type: 'exercise',
      exerciseName: exerciseKey,
      exerciseIndex: exerciseIdx,
      message: `Deleted ${baseName}`,
      undoFn: () => {
        setPersisted(false);
        structureSaveNeeded.current = true;
        setTemplate((prev) => {
          const exercises = [...prev.exercises];
          exercises.splice(exerciseIdx, 0, exerciseData);
          return { ...prev, exercises };
        });
        if (exerciseEntries) {
          setEntries((prev) => ({ ...prev, [exerciseKey]: exerciseEntries }));
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
    const movingKey = exKey(template.exercises, template.exercises[fromIdx], fromIdx);
    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      const [moved] = exercises.splice(fromIdx, 1);
      exercises.splice(toIdx, 0, moved);
      return { ...prev, exercises };
    });
    // Scroll to the moved card after React re-renders
    setTimeout(() => {
      const el = exerciseRefs.current[movingKey];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function handleNoteChange(exerciseName, value) {
    setPersisted(false);
    setNotes((prev) => ({ ...prev, [exerciseName]: value }));
  }

  function performSwap(oldKey, newName) {
    setPersisted(false);
    structureSaveNeeded.current = true;

    // Compute everything from current template snapshot before any state updates
    const currentExercises = template.exercises;
    const tIdx = findExIdx(currentExercises, oldKey);
    if (tIdx < 0) return; // Safety: exercise not found
    const oldExercise = currentExercises[tIdx];
    const numSets = oldExercise?.sets?.length || 0;

    // Compute the new key from the post-swap exercise list
    const newExercises = currentExercises.map((ex, i) => i === tIdx ? { ...ex, name: newName } : ex);
    const newKey = exKey(newExercises, newName, tIdx);

    // Update template: replace name and clear plannedReps/suggestedWeight
    setTemplate((prev) => {
      const ti = findExIdx(prev.exercises, oldKey);
      if (ti < 0) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex, i) =>
          i === ti
            ? {
                ...ex,
                name: newName,
                sets: ex.sets.map((s) => ({ ...s, plannedReps: '', suggestedWeight: 0 })),
              }
            : ex
        ),
      };
    });

    // Set blank entries for the new exercise
    setEntries((prev) => {
      const updated = { ...prev };
      delete updated[oldKey];
      updated[newKey] = Array.from({ length: numSets }, () => ({ weight: '', reps: '' }));
      return updated;
    });

    // Clear notes for old exercise
    setNotes((prev) => {
      const updated = { ...prev };
      delete updated[oldKey];
      return updated;
    });

    // Remove completedSets for old exercise
    setCompletedSets((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(oldKey + '-')) next.add(key);
      }
      return next;
    });

    // Remove autoFilled for old exercise
    setAutoFilled((prev) => {
      const next = new Set();
      for (const key of prev) {
        if (!key.startsWith(oldKey + '-')) next.add(key);
      }
      return next;
    });
  }

  function handleSwapExercise(oldKey, newName) {
    // Check if old exercise has any data worth preserving
    const oldEntries = entries[oldKey] || [];
    const hasEntryData = oldEntries.some(
      (e) => (e.weight && Number(e.weight) > 0) || (e.reps && Number(e.reps) > 0)
    );
    const hasCompletedSets = [...completedSets].some((key) => key.startsWith(oldKey + '-'));

    if (hasEntryData || hasCompletedSets) {
      // Show confirmation modal
      setPendingSwap({ oldName: oldKey, newName });
    } else {
      // No data to lose, swap directly
      performSwap(oldKey, newName);
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
          for (let exIdx = 0; exIdx < template.exercises.length; exIdx++) {
            const ex = template.exercises[exIdx];
            if (ex.isSectionHeader) continue;
            const eKey = exKey(template.exercises, ex, exIdx);
            filled[eKey] = ex.sets.map((s) => {
              const planned = s.plannedReps || 0;
              const goalWt = Number(s.suggestedWeight) || 0;
              const idx = variIdx++ % repVariations.length;
              const actualReps = Math.max(0, planned + repVariations[idx]);
              const actualWeight = Math.max(0, goalWt + weightVariations[idx]);
              return {
                weight: actualWeight ?? '',
                reps: actualReps,
                setType: s.setType || ex.setType || 'straight',
              };
            });
          }
          setEntries(filled);
          const allKeys = new Set();
          template.exercises.forEach((ex, exIdx) => {
            if (ex.isSectionHeader) return;
            const eKey = exKey(template.exercises, ex, exIdx);
            ex.sets.forEach((_, i) => allKeys.add(`${eKey}-${i}`));
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

  function handleToggleComplete(exerciseKey, setIdx) {
    setPersisted(false);
    const key = `${exerciseKey}-${setIdx}`;
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
        const exEntries = entries[exerciseKey] || [];
        const thisEntry = exEntries[setIdx];
        const w = thisEntry?.weight;
        const r = thisEntry?.reps;
        if ((w !== '' && w !== undefined) || (r !== '' && r !== undefined)) {
          let exercise = null;
          for (let i = 0; i < template.exercises.length; i++) {
            if (!template.exercises[i].isSectionHeader && exKey(template.exercises, template.exercises[i], i) === exerciseKey) { exercise = template.exercises[i]; break; }
          }
          if (exercise) {
            setEntries((prev) => {
              const updated = { ...prev };
              updated[exerciseKey] = [...(updated[exerciseKey] || [])];
              const newAutoFilled = new Set(autoFilled);
              for (let i = setIdx + 1; i < exercise.sets.length; i++) {
                const laterKey = `${exerciseKey}-${i}`;
                if (!latestCompleted.has(laterKey)) {
                  const current = updated[exerciseKey][i] || {};
                  const currentWeight = current.weight;
                  const currentReps = current.reps;
                  const isCurrentAutoFilled = autoFilled.has(laterKey);
                  const weightEmpty = currentWeight === '' || currentWeight === undefined;
                  const repsEmpty = currentReps === '' || currentReps === undefined;
                  if (weightEmpty || repsEmpty || isCurrentAutoFilled) {
                    updated[exerciseKey][i] = {
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

    for (let exIdx = 0; exIdx < template.exercises.length; exIdx++) {
      const ex = template.exercises[exIdx];
      if (ex.isSectionHeader) continue;
      const eKey = exKey(template.exercises, ex, exIdx);
      const exEntries = entries[eKey] || [];
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
      for (let exIdx = 0; exIdx < template.exercises.length; exIdx++) {
        const ex = template.exercises[exIdx];
        if (ex.isSectionHeader) continue;
        const eKey = exKey(template.exercises, ex, exIdx);
        const exEntries = entries[eKey] || [];
        ex.sets.forEach((set, idx) => {
          const k = `${eKey}-${idx}`;
          const isAutoOnly = autoFilled.has(k) && !completedSets.has(k);
          allEntries.push({
            exerciseName: ex.name, // use original name for server
            setNumber: set.setNumber,
            weight: isAutoOnly ? 0 : (exEntries[idx]?.weight || 0),
            reps: isAutoOnly ? 0 : (exEntries[idx]?.reps || 0),
            isCompleted: completedSets.has(k),
            setType: exEntries[idx]?.setType || set.setType || ex.setType || 'straight',
          });
        });
      }

      // Save the full workout structure as an independent copy
      const workoutData = {
        name: template.name,
        exercises: template.exercises.map((ex, exIdx) => {
          if (ex.isSectionHeader) return { name: ex.name, isSectionHeader: true, sectionNotes: ex.sectionNotes || '', sets: [] };
          const eKey = exKey(template.exercises, ex, exIdx);
          return {
            name: ex.name,
            setType: entries[eKey]?.find(e => e?.setType)?.setType || ex.setType || 'straight',
            sets: ex.sets.map((s, i) => {
              const entry = entries[eKey]?.[i];
              return {
                setNumber: s.setNumber,
                plannedReps: s.plannedReps ?? 10,
                suggestedWeight: (entry?.weight !== '' && entry?.weight != null) ? entry.weight : (s.suggestedWeight || 0),
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
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    const entry = schedule.find(s => s.date === dateStr);
    if (entry && entry.templateId) {
      setDayNavDisabled(true);
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
  const prevDateStr = prevDate ? format(prevDate, 'yyyy-MM-dd') : null;
  const nextDateStr = nextDate ? format(nextDate, 'yyyy-MM-dd') : null;
  const prevScheduled = prevDateStr && schedule ? schedule.find(s => s.date === prevDateStr) : null;
  const nextScheduled = nextDateStr && schedule ? schedule.find(s => s.date === nextDateStr) : null;
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

  const totalVolume = template.exercises.reduce((vol, ex, exIdx) => {
    if (ex.isSectionHeader) return vol;
    const eKey = exKey(template.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
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
              Substituting this exercise will remove your saved sets for {exNameFromKey(pendingSwap.oldName)}. This cannot be undone.
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

      {/* Status Banner + View Summary */}
      {isCompleted && (
        <div className="px-4 mb-3 space-y-2">
          <button
            onClick={() => setShowSummary(true)}
            className="w-full rounded-xl bg-wf-red/10 border border-wf-red/20 px-4 py-3 flex items-center justify-between active:bg-wf-red/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-wf-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className="text-sm text-wf-red font-semibold">View Workout Summary</span>
            </div>
            <svg className="w-4 h-4 text-wf-red/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-400 font-semibold">Workout Complete</span>
            </div>
            <p className="text-xs text-green-400/50 ml-7">Scroll down and tap Undo Completion to edit.</p>
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
        {template.exercises.map((exercise, idx) => {
          const eKey = exercise.isSectionHeader ? null : exKey(template.exercises, exercise, idx);
          // Wrapper: ExerciseCard passes exercise.name as first arg; replace with the unique key
          const wrapCb = (fn) => fn ? (_name, ...args) => fn(eKey, ...args) : undefined;
          return (
          <div key={exercise.isSectionHeader ? `section-${idx}` : eKey}>
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
          <div ref={(el) => { exerciseRefs.current[eKey] = el; if (el && scrollToExercise.current === idx) { scrollToExercise.current = null; setTimeout(() => { const target = el.getBoundingClientRect().top + window.scrollY; const start = window.scrollY; const dist = target - start; const duration = 600; let t0 = null; function step(ts) { if (!t0) t0 = ts; const p = Math.min((ts - t0) / duration, 1); const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; window.scrollTo(0, start + dist * ease); if (p < 1) requestAnimationFrame(step); } requestAnimationFrame(step); }, 50); } }} className="fade-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <ExerciseCard
              exercise={exercise}
              exerciseKey={eKey}
              entries={entries[eKey]}
              pbs={pbs}
              readOnly={structureLocked}
              inputsLocked={inputsLocked}
              onLockedTap={inputsLocked ? () => setShowBeginPrompt(true) : undefined}
              onChange={inputsLocked ? undefined : wrapCb(handleChange)}
              onBlur={inputsLocked ? undefined : wrapCb(handleBlur)}
              completedSets={completedSets}
              autoFilled={autoFilled}
              onToggleComplete={inputsLocked ? undefined : wrapCb(handleToggleComplete)}
              onAddSet={structureLocked ? undefined : wrapCb(handleAddSet)}
              onDeleteSet={structureLocked ? undefined : wrapCb(handleDeleteSet)}
              onSwapExercise={structureLocked ? undefined : (_oldName, newName) => handleSwapExercise(eKey, newName)}
              onAddExercise={structureLocked ? undefined : (name) => handleAddExercise(name, idx)}
              onDeleteExercise={structureLocked ? undefined : () => handleDeleteExercise(eKey)}
              onMoveUp={structureLocked ? undefined : (idx > 0 ? () => handleMoveExercise(idx, idx - 1) : undefined)}
              onMoveDown={structureLocked ? undefined : (idx < template.exercises.length - 1 ? () => handleMoveExercise(idx, idx + 1) : undefined)}
              note={notes[eKey] || ''}
              onNoteChange={inputsLocked ? undefined : (_name, value) => handleNoteChange(eKey, value)}
              weightSuggestion={inputsLocked ? undefined : weightSuggestions[exercise.name]}
              onApplySuggestion={inputsLocked ? undefined : (_exName, weight) => {
                setEntries(prev => {
                  const updated = { ...prev };
                  updated[eKey] = (updated[eKey] || []).map(e => ({ ...e, weight }));
                  return updated;
                });
                setWeightSuggestions(prev => { const next = { ...prev }; delete next[exercise.name]; return next; });
              }}
              allWorkoutExercises={template.exercises.map(e => e.name)}
              lastEntries={lastSession[exercise.name]}
              forceShowDemo={showAllDemos}
              dataTutorial={tutorialMode && idx === 1 ? 'exercise-header' : undefined}
            />
            {/* Inline undo toast for deleted set — show below this exercise */}
            {undoToast && undoToast.type === 'set' && undoToast.exerciseName === eKey && (
              <UndoToast
                message={undoToast.message}
                onUndo={() => { undoToast.undoFn(); setUndoToast(null); }}
                onExpire={() => setUndoToast(null)}
              />
            )}
          </div>
          )}
          {/* Undo toast after last exercise for exercise deletion at end */}
          {/* Begin Workout prompt popup */}
      {showBeginPrompt && idx === 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-5" onClick={() => setShowBeginPrompt(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-wf-red/15 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">{isCompleted ? 'Scroll down and tap Undo Completion to edit.' : 'Click Begin Workout to start logging sets.'}</h3>
            </div>
            <button
              onClick={() => setShowBeginPrompt(false)}
              className="w-full btn-gradient text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {undoToast && undoToast.type === 'exercise' && undoToast.exerciseIndex >= template.exercises.length && idx === template.exercises.length - 1 && (
            <UndoToast
              message={undoToast.message}
              onUndo={() => { undoToast.undoFn(); setUndoToast(null); }}
              onExpire={() => setUndoToast(null)}
            />
          )}
          </div>
        );
        })}

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
          programName={programName}
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

function WorkoutSummary({ template, programName, entries, completedSets, elapsed, formatTime, onClose }) {
  const canvasRef = useRef(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareImage, setShareImage] = useState(null);
  const [generatingImage, setGeneratingImage] = useState(false);

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
  const totalVolume = template.exercises.reduce((vol, ex, exIdx) => {
    if (ex.isSectionHeader) return vol;
    const eKey = exKey(template.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
    return vol + exEntries.reduce((sum, e) => {
      const w = Number(e.weight) || 0;
      const r = Number(e.reps) || 0;
      return sum + (w > 0 ? w * r : 0);
    }, 0);
  }, 0);

  const [expandedSummary, setExpandedSummary] = useState(new Set());

  // Per-exercise data with per-set volume breakdown (goal volume vs actual volume)
  const exerciseStats = template.exercises.reduce((acc, ex, exIdx) => {
    if (ex.isSectionHeader) return acc;
    const eKey = exKey(template.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
    const setStats = ex.sets.map((set, idx) => {
      const goalWeight = Number(set.suggestedWeight) || 0;
      const goalReps = set.plannedReps || 0;
      const goalVolume = goalWeight > 0 ? goalWeight * goalReps : 0;
      const actualWeight = Number(exEntries[idx]?.weight) || 0;
      const actualReps = Number(exEntries[idx]?.reps) || 0;
      const actualVolume = actualWeight > 0 ? actualWeight * actualReps : 0;
      const setType = exEntries[idx]?.setType || set.setType || ex.setType || 'straight';
      const hitGoal = goalReps > 0 ? actualReps >= goalReps : true;
      return { setNumber: set.setNumber, goalVolume, actualVolume, goalReps, actualReps, goalWeight, actualWeight, setType, hitGoal };
    });
    const totalGoalVol = setStats.reduce((s, ss) => s + ss.goalVolume, 0);
    const totalActualVol = setStats.reduce((s, ss) => s + ss.actualVolume, 0);
    acc.push({ name: ex.name, eKey, setStats, totalGoalVol, totalActualVol });
    return acc;
  }, []);

  const totalGoalVolume = exerciseStats.reduce((s, ex) => s + ex.totalGoalVol, 0);

  // Helper: draw rounded rectangle (fallback for browsers without ctx.roundRect)
  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Helper: wrap text to fit within maxWidth, returns array of lines
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // Generate shareable workout summary image using HTML Canvas
  async function generateSummaryImage() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = 1080;
    const padding = 60;
    const contentWidth = W - padding * 2;
    const font = 'system-ui, -apple-system, "Segoe UI", sans-serif';

    // --- Pre-calculate height ---
    let y = 0;
    y += padding; // top padding
    y += 50; // logo
    y += 20; // spacing after logo
    if (programName) y += 36; // program name
    y += 50; // workout name (base)
    // Measure workout name wrap
    ctx.canvas.width = W;
    ctx.font = `bold 44px ${font}`;
    const nameLines = wrapText(ctx, template.name, contentWidth);
    if (nameLines.length > 1) y += (nameLines.length - 1) * 52;
    y += 40; // "Workout Complete" subtitle
    y += 50; // spacing before stats
    y += 120; // stats boxes
    y += 50; // spacing after stats

    // Exercise section height
    template.exercises.forEach((ex, exIdx) => {
      if (ex.isSectionHeader) {
        y += 60; // section header
        return;
      }
      y += 50; // exercise name
      const eKey = exKey(template.exercises, ex, exIdx);
      const exEntries = entries[eKey] || [];
      y += ex.sets.length * 38; // each set row
      y += 24; // spacing after exercise
    });

    y += 30; // spacing before footer
    y += 60; // date line
    y += 40; // footer text
    y += padding; // bottom padding

    canvas.width = W;
    canvas.height = y;

    // --- Background ---
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#0a0a0a');
    grad.addColorStop(0.5, '#0f0f0f');
    grad.addColorStop(1, '#111111');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, canvas.height);

    // Subtle red glow at top
    const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.6);
    glow.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, canvas.height / 3);

    // Subtle border
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, canvas.height - 2);

    let curY = padding;

    // --- Logo: "WILL" in white, "FIT" in red ---
    ctx.font = `900 46px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const willW = ctx.measureText('WILL').width;
    const fitW = ctx.measureText('FIT').width;
    const totalLogoW = willW + fitW + 4;
    const logoStartX = W / 2 - totalLogoW / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('WILL', logoStartX, curY + 25);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('FIT', logoStartX + willW + 4, curY + 25);
    curY += 50;

    // Thin separator line
    curY += 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, curY);
    ctx.lineTo(W - padding, curY);
    ctx.stroke();
    curY += 20;

    // --- Program name ---
    if (programName) {
      ctx.font = `500 24px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(programName, W / 2, curY + 14);
      curY += 36;
    }

    // --- Workout name (wrapped) ---
    ctx.font = `bold 44px ${font}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    nameLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, curY + 30 + i * 52);
    });
    curY += 30 + nameLines.length * 52 - 20;

    // --- "Workout Complete" subtitle ---
    ctx.font = `600 22px ${font}`;
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.fillText('Workout Complete  \u2713', W / 2, curY + 20);
    curY += 50;

    // --- Stats boxes (3 columns) ---
    const boxGap = 20;
    const boxW = (contentWidth - boxGap * 2) / 3;
    const boxH = 100;
    const boxRadius = 16;
    const statsData = [
      { label: 'TIME', value: formatTime(elapsed) },
      { label: 'SETS', value: `${completedSets.size}/${totalSets}` },
      { label: 'VOLUME', value: `${totalVolume.toLocaleString()} lbs` },
    ];
    statsData.forEach((stat, i) => {
      const bx = padding + i * (boxW + boxGap);
      const by = curY;
      // Box background
      drawRoundRect(ctx, bx, by, boxW, boxH, boxRadius);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Label
      ctx.font = `600 16px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(stat.label, bx + boxW / 2, by + 36);
      // Value
      ctx.font = `800 28px ${font}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stat.value, bx + boxW / 2, by + 72);
    });
    curY += boxH + 50;

    // --- Exercise list ---
    ctx.textAlign = 'left';
    template.exercises.forEach((ex, exIdx) => {
      if (ex.isSectionHeader) {
        // Section header with red left accent
        ctx.fillStyle = '#ef4444';
        drawRoundRect(ctx, padding, curY + 8, 4, 32, 2);
        ctx.fill();
        ctx.font = `700 20px ${font}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(ex.name.toUpperCase(), padding + 16, curY + 30);
        curY += 60;
        return;
      }

      // Exercise name
      ctx.font = `bold 28px ${font}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ex.name, padding, curY + 30);
      curY += 50;

      // Set rows
      const eKey = exKey(template.exercises, ex, exIdx);
      const exEntries = entries[eKey] || [];
      ex.sets.forEach((set, idx) => {
        const e = exEntries[idx];
        const actualWeight = Number(e?.weight) || 0;
        const actualReps = Number(e?.reps) || 0;
        const goalReps = set.plannedReps || 0;
        const weightStr = actualWeight === -1 ? 'BW' : `${actualWeight} lbs`;
        const hitGoal = goalReps > 0 ? actualReps >= goalReps : true;

        // Set number
        ctx.font = `600 22px ${font}`;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(`${idx + 1}`, padding + 8, curY + 24);

        // Weight x Reps
        ctx.font = `500 22px ${font}`;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(`${weightStr}  \u00D7  ${actualReps} reps`, padding + 50, curY + 24);

        // Goal indicator
        if (goalReps > 0) {
          const goalText = `${actualReps}/${goalReps}`;
          ctx.textAlign = 'right';
          ctx.font = `700 20px ${font}`;
          ctx.fillStyle = hitGoal ? '#22c55e' : '#ef4444';
          ctx.fillText(goalText + (hitGoal ? '  \u2713' : '  \u2717'), W - padding, curY + 24);
          ctx.textAlign = 'left';
        }

        curY += 38;
      });

      curY += 24;
    });

    // --- Footer separator ---
    curY += 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, curY);
    ctx.lineTo(W - padding, curY);
    ctx.stroke();
    curY += 30;

    // --- Date ---
    ctx.font = `500 20px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), W / 2, curY + 14);
    curY += 40;

    // --- "Logged with RepLab" ---
    ctx.font = `600 20px ${font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('Logged with RepLab', W / 2, curY + 14);

    return canvas.toDataURL('image/png');
  }

  function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  async function openShareMenu() {
    setShowShareMenu(true);
    if (!shareImage) {
      setGeneratingImage(true);
      try {
        const img = await generateSummaryImage();
        setShareImage(img);
      } catch (err) {
        console.error('Failed to generate share image:', err);
      }
      setGeneratingImage(false);
    }
  }

  async function handleShareImage() {
    if (!shareImage) return;
    try {
      const blob = dataURLtoBlob(shareImage);
      const file = new File([blob], 'workout-summary.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: 'Check out my workout!' });
      } else {
        // Fallback: download
        handleSaveImage();
      }
    } catch {}
  }

  async function handleSaveImage() {
    if (!shareImage) return;
    try {
      const blob = dataURLtoBlob(shareImage);
      const file = new File([blob], 'workout-summary.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {}
    // Fallback: file download on desktop
    const link = document.createElement('a');
    link.download = 'workout-summary.png';
    link.href = shareImage;
    link.click();
  }

  async function handleShareText() {
    const lines = [];
    if (programName) lines.push(programName);
    lines.push(`${template.name} \u2014 Workout Complete!`);
    lines.push(`Time: ${formatTime(elapsed)} | Sets: ${completedSets.size}/${totalSets} | Volume: ${totalVolume.toLocaleString()} lbs`);
    lines.push('');
    template.exercises.forEach((ex, exIdx) => {
      if (ex.isSectionHeader) {
        lines.push(`\u2014 ${ex.name} \u2014`);
        if (ex.sectionNotes) lines.push(`  ${ex.sectionNotes}`);
        return;
      }
      const eKey = exKey(template.exercises, ex, exIdx);
      const exEntries = entries[eKey] || [];
      lines.push(ex.name);
      if (ex.exerciseDescription) lines.push(`  Note: ${ex.exerciseDescription}`);
      ex.sets.forEach((set, idx) => {
        const e = exEntries[idx];
        const w = Number(e?.weight) === -1 ? 'BW' : `${Number(e?.weight) || 0} lbs`;
        const goalReps = set.plannedReps || 0;
        const actualReps = Number(e?.reps) || 0;
        const hit = goalReps > 0 && actualReps >= goalReps;
        lines.push(`  Set ${idx + 1}: ${w} \u00D7 ${actualReps} reps${goalReps ? ` (goal: ${goalReps})` : ''}${hit ? ' \u2713' : ''}`);
      });
      lines.push('');
    });
    lines.push('Logged with RepLab');
    const text = lines.join('\n');
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); alert('Copied to clipboard!'); } catch {}
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Content */}
      <div className="relative z-20 flex-1 overflow-y-auto safe-top safe-bottom">
        <div className="px-5 pt-4 pb-24 max-w-lg mx-auto">
          {/* Top bar: close + share */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={openShareMenu}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all"
              title="Share workout summary"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </button>
          </div>

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
              const isExpanded = expandedSummary.has(ex.eKey);
              return (
              <div key={ex.eKey} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSummary(prev => {
                    const next = new Set(prev);
                    if (next.has(ex.eKey)) next.delete(ex.eKey); else next.add(ex.eKey);
                    return next;
                  })}
                  className="w-full text-left px-4 py-3 active:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-white truncate">{ex.name}</span>
                      <svg className={`w-3.5 h-3.5 text-wf-gray-500 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                    <span className={`text-xs tabular-nums shrink-0 font-semibold ${volColor}`}>
                      {volSign}{volDiff.toLocaleString()} lbs
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {ex.setStats.map((ss) => {
                      const maxRatio = 1.25;
                      const ratio = ss.goalVolume > 0 ? ss.actualVolume / ss.goalVolume : 0;
                      const barPct = Math.min(100, (ratio / maxRatio) * 100);
                      const tickPos = (1 / maxRatio) * 100;
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
                </button>
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-2 bg-white/[0.02]">
                    {/* Column headers */}
                    <div className="flex items-center text-[9px] text-wf-gray-500 uppercase tracking-widest font-semibold">
                      <span className="w-8">Set</span>
                      <span className="w-10">Type</span>
                      <span className="flex-1 text-center">Weight</span>
                      <span className="w-16 text-center">Goal</span>
                      <span className="w-16 text-center">Actual</span>
                      <span className="w-6" />
                    </div>
                    {ex.setStats.map((ss) => {
                      const typeLabel = ss.setType === 'warm_up' ? 'WU' : ss.setType === 'touch_up' ? 'TU' : ss.setType === 'drop' ? 'DS' : ss.setType === 'rest_pause' ? 'RP' : ss.setType === 'superset' ? 'SS' : ss.setType === 'alternating' ? 'Alt' : ss.setType === 'giant' ? 'Gia' : ss.setType === 'pre_exhaust' ? 'PrEx' : 'REG';
                      const isWarmup = ss.setType === 'warm_up' || ss.setType === 'touch_up';
                      return (
                        <div key={ss.setNumber} className="flex items-center py-1.5">
                          <span className="w-8 text-xs text-wf-gray-500 font-bold tabular-nums">{ss.setNumber}</span>
                          <span className={`w-10 text-[10px] font-bold ${isWarmup ? 'text-yellow-400' : 'text-wf-gray-400'}`}>{typeLabel}</span>
                          <span className="flex-1 text-center text-xs text-white font-semibold tabular-nums">
                            {ss.actualWeight === -1 ? 'BW' : ss.actualWeight > 0 ? `${ss.actualWeight}` : ss.goalWeight > 0 ? `${ss.goalWeight}` : '—'}
                          </span>
                          <span className="w-16 text-center text-xs text-wf-gray-500 tabular-nums">{ss.goalReps || '—'}</span>
                          <span className={`w-16 text-center text-xs font-bold tabular-nums ${ss.hitGoal ? 'text-green-400' : 'text-red-400'}`}>{ss.actualReps || '—'}</span>
                          <span className="w-6 text-center">
                            {ss.hitGoal ? (
                              <svg className="w-3.5 h-3.5 text-green-400 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : ss.actualReps > 0 ? (
                              <svg className="w-3.5 h-3.5 text-red-400 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
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

      {/* Share menu bottom sheet */}
      {showShareMenu && (
        <div className="fixed inset-0 z-[70] flex flex-col" onClick={() => setShowShareMenu(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative flex-1 flex flex-col mt-12 bg-wf-gray-900 rounded-t-2xl shadow-2xl animate-drop-down overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="shrink-0 pt-3 pb-2 px-5">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
              <h3 className="text-lg font-black text-white">Share Workout</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-24">

            {/* Image preview */}
            {generatingImage && (
              <div className="mb-4 rounded-xl border border-white/10 p-8 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span className="text-sm text-wf-gray-400 ml-3">Generating image...</span>
              </div>
            )}
            {shareImage && !generatingImage && (
              <div className="mb-4 rounded-xl overflow-hidden border border-white/10">
                <img src={shareImage} alt="Workout summary" className="w-full" />
              </div>
            )}

            <div className="space-y-2">
              {/* Share Image */}
              <button onClick={handleShareImage} disabled={!shareImage} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors disabled:opacity-40">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-white block">Share Image</span>
                  <span className="text-xs text-wf-gray-500">Share via Instagram, Messages, etc.</span>
                </div>
              </button>

              {/* Save to Camera Roll */}
              <button onClick={handleSaveImage} disabled={!shareImage} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors disabled:opacity-40">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-white block">Save to Camera Roll</span>
                  <span className="text-xs text-wf-gray-500">Download image to your device</span>
                </div>
              </button>

              {/* Share as Text */}
              <button onClick={handleShareText} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 active:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-white block">Share as Text</span>
                  <span className="text-xs text-wf-gray-500">Copy or share text summary</span>
                </div>
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
