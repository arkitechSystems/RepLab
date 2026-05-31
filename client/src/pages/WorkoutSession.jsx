import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format, isToday, addDays, subDays } from 'date-fns';
import { api } from '../api';
import ExerciseCard from '../components/ExerciseCard';
import { useExercises } from '../hooks/useExercises';
import RestDayCard from '../components/RestDayCard';
import StickyHeader from '../components/StickyHeader';
import { useUnsavedGuard } from '../components/UnsavedGuard';
import PBCelebration from '../components/PBCelebration';
import BodyHeatmap from '../components/BodyHeatmap';
import { buildMuscleAllocation } from '../utils/muscleAllocation';
import UndoToast from '../components/UndoToast';
import LoadingSpinnerOverlay from '../components/LoadingSpinnerOverlay';
import { iosFocusRef } from '../utils/iosFocus';
import { getWeightSuggestion } from '../utils/weightSuggestion';
import { calculateOneRMSuggestion } from '../utils/oneRepMaxSuggestion';
import { beepCountdown, beepRestEnd, initAudio } from '../utils/sounds';
import { track } from '../utils/analytics';
import AddCardioModal from '../components/AddCardioModal';
import CardioCard from '../components/CardioCard';
import SupersetPickerModal from '../components/SupersetPickerModal';
import useFocusTrap from '../hooks/useFocusTrap';
import { BibleVerseOverlay } from './BibleVerses';
import { pickNextVerse } from '../utils/versePicker';
import { friendlyError } from '../utils/errors';

// Parse a 'YYYY-MM-DD' string as a LOCAL date (not UTC). parseISO('2026-04-24')
// returns midnight UTC, which is the wrong calendar day for any user with a
// negative UTC offset near midnight — they'd see "today's" workout flagged as
// tomorrow's. Constructing via the year/month/day constructor keeps everything
// in the user's local timezone, matching how date-fns isToday() and format()
// already think about dates.
function parseDateLocal(yyyymmdd) {
  if (!yyyymmdd || typeof yyyymmdd !== 'string') return new Date(NaN);
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

// Build a unique key for each exercise card. The first occurrence of a name
// keeps the plain name (backward-compatible with saved sessions). Subsequent
// duplicates get "::1", "::2", etc.
export function exKey(exercises, exerciseOrName, idx) {
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
  const { exercises: allExercisesFromDB, muscleGroups: allMuscleGroups, createCustom } = useExercises();
  const [template, setTemplate] = useState(null);
  const [programName, setProgramName] = useState('');
  // Cardio-acceleration programs (Stoppani) render a dropdown + 60s timer
  // between each pair of sets. Off unless the program opts in.
  const [cardioEnabled, setCardioEnabled] = useState(false);
  // Keyed by `${exerciseKey}-${setIdx}`, where setIdx is the 0-based index of
  // the set that PRECEDES the cardio slot. Auto-filled forward within the
  // same exercise on change. Persisted inside workout_data on auto-save.
  const [cardioSelections, setCardioSelections] = useState({});
  const [pbs, setPbs] = useState({});
  // All-time PR rows for the user (across every template) — feeds the
  // per-exercise PR popup so users can see their top historical lifts during
  // a session. Each row: { exercise_name, best_weight, best_reps, achieved_at }.
  const [allTimePRs, setAllTimePRs] = useState([]);
  // exerciseName whose PR modal is currently open, or null when closed.
  const [prModalExercise, setPrModalExercise] = useState(null);
  const prModalTrapRef = useFocusTrap(!!prModalExercise);
  const [prModalSort, setPrModalSort] = useState('weight');
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
  const addExerciseTrapRef = useFocusTrap(showAddExercise);
  const [addExerciseSearch, setAddExerciseSearch] = useState('');
  // Active body-part filter in the Add Exercise modal. 'all' shows every
  // muscle group; setting to a specific name (e.g. 'Triceps') narrows both
  // the search results and the browse-by-muscle view to that group only.
  const [addExerciseMuscleFilter, setAddExerciseMuscleFilter] = useState('all');
  // Cardio entries are persisted to the server immediately on add (linked to
  // the session's DB id) so they survive a refresh during a long workout.
  const [sessionId, setSessionId] = useState(null);
  const [cardioEntries, setCardioEntries] = useState([]);
  const [showAddCardio, setShowAddCardio] = useState(false);
  // In-session section header creation. Headers are organizational dividers
  // that group exercises (e.g. "Superset A", "Warmup", "Main Lifts"). They
  // append to the end of template.exercises and the user reorders via the
  // existing move/swap controls. Long-press on the resulting card opens the
  // edit/delete modal (sectionEditing state).
  const [showAddSection, setShowAddSection] = useState(false);
  const [addSectionName, setAddSectionName] = useState('');
  const addSectionTrapRef = useFocusTrap(showAddSection);
  // Superset/circuit label picker. null = closed; { exerciseKey } = open for
  // that card. State lives at the session level (not on the card) because
  // applying a label mutates template.exercises + entries, and the parent
  // owns both.
  const [supersetPicker, setSupersetPicker] = useState(null);
  const [autoFilled, setAutoFilled] = useState(new Set()); // tracks predicted entries
  // Tracks per-field user edits so autofill never clobbers a value the user
  // explicitly typed. Keys are `${exerciseKey}-${setIdx}:${field}` where field
  // is 'weight' or 'reps'. Once marked, a field is permanently protected from
  // forward-propagation until the set/exercise is removed or the user clears
  // it deliberately by typing again (handleChange re-marks the new value).
  const [userEdited, setUserEdited] = useState(new Set());
  // Refs that always mirror the latest completedSets / autoFilled / userEdited.
  // handleBlur can fire after a set was just marked complete (focus loss races
  // completion); reading state via these refs avoids the stale-closure overwrite
  // where auto-fill clobbers a freshly-completed or freshly-typed set.
  const completedSetsRef = useRef(new Set());
  const autoFilledRef = useRef(new Set());
  const userEditedRef = useRef(new Set());
  const [isCompleted, setIsCompleted] = useState(false);
  const [weightSuggestions, setWeightSuggestions] = useState({});
  const [lastSession, setLastSession] = useState({});
  // Per-session goal overrides — keyed by exerciseKey, value is an array
  // of { weight, reps } indexed by set position. Populated only when the
  // user manually edits a Goal Weight / Goal Reps cell mid-session; the
  // default render path reads from lastSession (last completed session)
  // and falls back to lastSession's set-0 entry for sets beyond the
  // previous count. Overrides are NOT persisted to the template — the
  // next session's autofill comes from the actual entries logged this
  // session, not from these aspirational overrides.
  const [goalOverrides, setGoalOverrides] = useState({});
  const [timerStarted, setTimerStarted] = useState(false);
  const [showBeginPrompt, setShowBeginPrompt] = useState(false);
  const beginPromptTrapRef = useFocusTrap(showBeginPrompt);
  const [showPrebeginSummary, setShowPrebeginSummary] = useState(false);
  const prebeginSummaryTrapRef = useFocusTrap(showPrebeginSummary);
  // Index of the exercise whose set-by-set breakdown is currently expanded
  // in the View Summary accordion, or null when collapsed. Resets to null
  // whenever the modal closes so reopening starts in a clean state.
  const [expandedOverviewExIdx, setExpandedOverviewExIdx] = useState(null);
  const [showAllDemos, setShowAllDemos] = useState(false);
  const [timerHidden, setTimerHidden] = useState(false);
  const [timerFloating, setTimerFloating] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 16, y: 80 });
  const [restFloating, setRestFloating] = useState(false);
  const [restFloatPos, setRestFloatPos] = useState({ x: 16, y: 140 });
  const [showSummary, setShowSummary] = useState(false);
  // Lightweight in-app toast: { message, kind: 'info' | 'error' } | null.
  // Replaces window.alert() — those read like a debug build to App Review.
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  // Inline validation message under Mark Complete (e.g. "Log at least one set").
  // Distinct from toast so it sits exactly where the failing action is.
  const [completeError, setCompleteError] = useState('');
  const completeErrorTimerRef = useRef(null);
  function showToast(message, kind = 'info', ms = 3000) {
    setToast({ message, kind });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }
  function showCompleteError(message, ms = 4000) {
    setCompleteError(message);
    if (completeErrorTimerRef.current) clearTimeout(completeErrorTimerRef.current);
    completeErrorTimerRef.current = setTimeout(() => setCompleteError(''), ms);
  }
  const [pendingVerse, setPendingVerse] = useState(null); // set when this completion hits a 7-workout milestone
  const [showDateConfirm, setShowDateConfirm] = useState(false);
  const dateConfirmTrapRef = useFocusTrap(showDateConfirm);
  const [tutorialTip, setTutorialTip] = useState(null); // tutorial workout tooltips
  const [tutorialReady, setTutorialReady] = useState(false); // true once element is scrolled + measured
  const tutorialRectRef = useRef(null); // cached rect for current tip target
  const [pendingSwap, setPendingSwap] = useState(null); // { oldName, newName }
  const pendingSwapTrapRef = useFocusTrap(!!pendingSwap);
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
  // Manual ±15s offset folded into the wall-clock countdown calc each tick.
  // Reset on each startRestTimer(); mutated by adjustRest().
  const restAdjustRef = useRef(0);
  // "Up Next" context for the popped-out (floating) rest timer card. Captured
  // when handleToggleComplete fires startRestTimer so the card can show
  // "Set N · <Exercise Name>" without having to re-derive next-set from
  // template + completedSets on every render. null = either not running or
  // last set of last exercise (no next).
  const [restContext, setRestContext] = useState(null);
  const REST_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
  // Initial state for the timer-pin/lock and goal-display toggles is sourced
  // from Profile → App Settings (the user's chosen defaults). In-session
  // changes write to the same keys so the most recent preference is what the
  // next session inherits. localStorage keys (shared with Profile.jsx):
  //   wf-default-pin-workout-timer
  //   wf-default-pin-rest-timer
  //   wf-default-show-goal-weight
  //   wf-default-show-goal-reps
  // Full-screen mode default — Profile → Preferences sets `wf-default-fullscreen-mode`.
  // When ON, opening a session auto-opens the first exercise full-screen.
  // The in-session gear popover writes to the same key so per-session changes
  // persist as the new default.
  const [fullScreenDefault, setFullScreenDefault] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-fullscreen-mode')) ?? false; } catch { return false; }
  });
  // Active full-screen state: null = not in full-screen, number = which
  // template.exercises index is shown (always a non-section exercise).
  const [fullScreenIdx, setFullScreenIdx] = useState(null);
  const [pinWorkoutTimer, setPinWorkoutTimer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-pin-workout-timer')) ?? false; } catch { return false; }
  });
  const [pinRestTimer, setPinRestTimer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-pin-rest-timer')) ?? true; } catch { return true; }
  });
  const [undoToast, setUndoToast] = useState(null); // { message, undoFn }
  const [showGoalWeight, setShowGoalWeight] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-show-goal-weight')) ?? false; } catch { return false; }
  });
  const [showGoalReps, setShowGoalReps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wf-default-show-goal-reps')) ?? false; } catch { return false; }
  });
  const [showSetType, setShowSetType] = useState(() => {
    try { return JSON.parse(localStorage.getItem('replab_show_set_type')) ?? false; } catch { return false; }
  });
  // 'light' (default, #e8e8e8 card) or 'dark' (transparent — page bg shows through).
  // Persisted so the next session inherits the user's choice.
  const [cardTheme, setCardTheme] = useState(() => {
    try { return localStorage.getItem('wf-default-card-theme') || 'light'; } catch { return 'light'; }
  });
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const [sessionMenuPos, setSessionMenuPos] = useState({ top: 64, right: 16 });
  // Long-press-to-edit on section headers. `sectionEditing` is null when the
  // modal is closed; otherwise { idx, name, notes } — `idx` is the position
  // inside template.exercises (stable while the modal is open since the user
  // can't reorder concurrently). `sectionDeleteConfirming` is a two-step
  // delete guard so a single mistap can't drop a section.
  const [sectionEditing, setSectionEditing] = useState(null);
  const [sectionDeleteConfirming, setSectionDeleteConfirming] = useState(false);
  const sectionLongPressTimerRef = useRef(null);
  const autoSaveRef = useRef(null);
  const autoSaveNeeded = useRef(false);
  const structureSaveRef = useRef(null);
  const structureSaveNeeded = useRef(false);
  const savingRef = useRef(false);
  // Promise of the currently-in-flight handleSave, if any. Callers that race
  // each other (e.g. autosave debounce vs. Mark Complete tapping within 500ms)
  // can await this instead of getting a thrown "Save already in progress".
  const inFlightSaveRef = useRef(null);
  // Always points at the latest handleSave so debounced timeouts read fresh
  // closure state (entries/notes) even if the autosave was scheduled before
  // the user's most recent typing.
  const handleSaveRef = useRef(null);
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
      'exit-workout': '[data-tutorial="exit-workout"]',
      timer: '[data-tutorial="workout-timer"]',
      rest: '[data-tutorial="rest-timer"]',
      'exercise-card': '[data-tutorial="exercise-card"]',
      'exercise-name': '[data-tutorial="exercise-name"]',
      'exercise-header': '[data-tutorial="move-buttons"]',
      'swap-exercise': '[data-tutorial="swap-button"]',
      'demo-button': '[data-tutorial="demo-button"]',
      'prs-button': '[data-tutorial="prs-button"]',
      'add-delete-exercise': '[data-tutorial="add-delete-buttons"]',
      'set-controls': '[data-tutorial="set-controls"]',
      'set-row': '[data-tutorial="set-row"]',
      'set-type': '[data-tutorial="set-row"]',
      'plate-calc': '[data-tutorial="plate-calc"]',
      'full-screen': '[data-tutorial="full-screen"]',
      'session-settings': '[data-tutorial="session-settings"]',
      'exercise-notes': '[data-tutorial="exercise-notes"]',
      'mark-complete': '[data-tutorial="mark-complete"]',
    };
    const selector = targetMap[tutorialTip];
    if (!selector) return;

    let attempts = 0;
    let cancelled = false;
    // After ~6s of trying, the target element clearly isn't going to mount —
    // bail out and dismiss the tip rather than leaving the user stuck under
    // a translucent overlay with no exit affordance.
    function giveUp() {
      if (!cancelled) setTutorialTip(null);
    }
    function tryFind() {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (!el || el.offsetWidth === 0) {
        if (attempts < 30) { attempts++; setTimeout(tryFind, 200); }
        else giveUp();
        return;
      }
      // If the element is inside a sticky header, scroll to page top so the header
      // is in its expanded (non-collapsed) state — otherwise the measured rect drifts.
      const isInStickyHeader = !!el.closest('.sticky-header');
      if (isInStickyHeader) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Give the sticky header time to fully expand before measuring
        setTimeout(() => {
          if (cancelled) return;
          const freshRect = el.getBoundingClientRect();
          if (freshRect.width === 0 || freshRect.height === 0) {
            if (attempts < 30) { attempts++; setTimeout(tryFind, 200); }
            else giveUp();
            return;
          }
          tutorialRectRef.current = freshRect;
          setTutorialReady(true);
        }, 300);
        return;
      } else {
        // For tall elements (like exercise cards) or exercise-card sub-elements,
        // scroll so the top is visible just below the sticky header rather than
        // centering (which can cause the tooltip to overlap the spotlight).
        const elRect = el.getBoundingClientRect();
        const exerciseCardSteps = ['exercise-name', 'exercise-header', 'swap-exercise', 'demo-button', 'prs-button', 'add-delete-exercise', 'set-controls', 'set-row', 'set-type', 'plate-calc', 'full-screen', 'exercise-notes'];
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
            else giveUp();
            return;
          }
          tutorialRectRef.current = measured;
          setTutorialReady(true);
        });
      });
    }
    // Delay initial attempt to let React paint
    setTimeout(tryFind, 100);
    return () => { cancelled = true; };
  }, [tutorialTip]);

  // Keep ref in sync with state
  useEffect(() => { restDurationRef.current = restDuration; }, [restDuration]);
  useEffect(() => { completedSetsRef.current = completedSets; }, [completedSets]);
  useEffect(() => { autoFilledRef.current = autoFilled; }, [autoFilled]);
  useEffect(() => { userEditedRef.current = userEdited; }, [userEdited]);
  // No deps — runs every render so a debounced timeout that fires after typing
  // (which doesn't re-trigger the autosave effect) still reaches the latest
  // handleSave, with fresh `entries`/`notes`/`pbs` in its closure.
  useEffect(() => { handleSaveRef.current = handleSave; });

  // Measure the session-menu anchor once on open instead of on every render.
  // The popover is transient and dismissed by backdrop tap, so a stale rect
  // due to scroll mid-popover is not a real concern.
  useEffect(() => {
    if (!showSessionMenu) return;
    const btn = document.querySelector('[data-fs-gear="1"]')
      || document.querySelector('[data-tutorial="session-settings"]');
    if (!btn) { setSessionMenuPos({ top: 64, right: 16 }); return; }
    const r = btn.getBoundingClientRect();
    setSessionMenuPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }, [showSessionMenu]);

  // Auto-save after checkmark toggle (debounced 1.5s) — skip in tutorial mode
  useEffect(() => {
    if (tutorialMode) return;
    if (!autoSaveNeeded.current) return;
    autoSaveNeeded.current = false;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (!savingRef.current && template && !template.isRest) {
        handleSaveRef.current?.().catch((err) => { if (import.meta.env.DEV) console.error(err); });
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
        handleSaveRef.current?.().catch((err) => { if (import.meta.env.DEV) console.error(err); });
      }
    }, 1500);
    return () => { if (structureSaveRef.current) clearTimeout(structureSaveRef.current); };
  }, [template]);

  const MAX_TIMER_SECS = 14400; // 4 hours
  const timerStorageKey = `wf-timer-${templateId}-${date}`;

  const clearTimerStorage = useCallback(() => {
    try { localStorage.removeItem(timerStorageKey); } catch (_) {}
  }, [timerStorageKey]);

  // ─────────────────────────────────────────────────────────────────────────
  // Offline-safe in-session backup (survives tab crash, nav-away, lost signal)
  // ─────────────────────────────────────────────────────────────────────────
  // One key per session; parsed on mount to purge stale (>7d) keys.
  const SESSION_BACKUP_PREFIX = 'replab:session:';
  const sessionBackupKey = `${SESSION_BACKUP_PREFIX}${templateId}:${date}`;
  const sessionBackupDebounceRef = useRef(null);
  const sessionRestoredRef = useRef(false); // true once restore pass has run
  const suppressBackupRef = useRef(false); // suppress writes during initial load / restore

  const clearSessionBackup = useCallback(() => {
    try { localStorage.removeItem(sessionBackupKey); } catch (_) {}
  }, [sessionBackupKey]);

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
    track('workout_session_started', {
      templateId: Number(templateId) || undefined,
      date,
      source: 'standard',
    });
  }, [timerStarted, timerStorageKey, runTimerInterval, templateId, date]);

  const handleBeginWorkout = useCallback(() => {
    if (tutorialMode) {
      setTutorialTip(null);
      startTimer();
      setTimeout(() => setTutorialTip('exit-workout'), 600);
      return;
    }
    const sessionDate = parseDateLocal(date);
    if (!isToday(sessionDate)) {
      setShowDateConfirm(true);
    } else {
      startTimer();
    }
  }, [date, startTimer, tutorialMode]);

  // Guard so the rest-end audio/vibration fires exactly once per countdown.
  // Prevents double-firing if the user rapidly pauses/resumes, restarts,
  // or otherwise re-triggers a state change while restRemaining is already 0.
  const restEndFiredRef = useRef(false);

  function startRestTimer() {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    initAudio(); // ensure audio context is ready (iOS)
    restEndFiredRef.current = false; // new countdown → arm the one-shot cue
    restAdjustRef.current = 0;       // reset manual ±15s offset
    const duration = restDurationRef.current;
    const startedAt = Date.now();
    setRestRemaining(duration);
    // Recompute remaining from wall-clock each tick so iOS background-suspend
    // can't desync the display. `lastTick` lets us suppress countdown beeps
    // when the timer jumps multiple seconds in one interval (e.g. after a
    // background suspend — the beep would be too late anyway).
    let lastTick = duration;
    restTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, duration + restAdjustRef.current - Math.floor((Date.now() - startedAt) / 1000));
      setRestRemaining(remaining);
      if (lastTick === remaining + 1 && (lastTick === 4 || lastTick === 3 || lastTick === 2)) {
        beepCountdown();
      }
      lastTick = remaining;
      if (remaining <= 0) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
        if (!restEndFiredRef.current) {
          restEndFiredRef.current = true;
          beepRestEnd(); // gentle two-beep (880 Hz → 1320 Hz)
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
      }
    }, 1000);
  }

  function stopRestTimer() {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = null;
    restEndFiredRef.current = false;
    setRestRemaining(null);
    setRestContext(null);
  }

  // Add or remove seconds from the in-flight rest countdown. Updates the
  // wall-clock offset ref (so the next tick reflects the change) AND the
  // displayed value (so the UI updates immediately without waiting for the
  // next interval fire). Clamped at 0 — user can't subtract past the end.
  function adjustRest(delta) {
    restAdjustRef.current += delta;
    setRestRemaining((r) => Math.max(0, (r ?? 0) + delta));
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (sessionBackupDebounceRef.current) clearTimeout(sessionBackupDebounceRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Mount-time: purge stale session backups (>7 days) and attempt restore.
  // Tutorial mode has no real session, so we skip it.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tutorialMode) return;
    if (sessionRestoredRef.current) return;
    // Suppress the backup-write effect until we've had a chance to restore.
    suppressBackupRef.current = true;

    // 1. Storage hygiene — purge keys older than 7 days.
    try {
      const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const stale = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(SESSION_BACKUP_PREFIX)) continue;
        // Key shape: replab:session:{templateId}:{YYYY-MM-DD}
        const parts = k.slice(SESSION_BACKUP_PREFIX.length).split(':');
        const dateStr = parts[1];
        if (!dateStr) continue;
        const t = Date.parse(dateStr);
        if (!Number.isFinite(t) || t < cutoffMs) stale.push(k);
      }
      for (const k of stale) {
        try { localStorage.removeItem(k); } catch (_) {}
      }
    } catch (_) { /* Safari private mode, etc. */ }

    // 2. Attempt restore for THIS session (only if still active).
    let restored = null;
    try {
      const raw = localStorage.getItem(sessionBackupKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !parsed.submitted) {
          restored = parsed;
        }
      }
    } catch (_) { /* malformed json or storage disabled */ }

    if (restored) {
      // Apply silently — don't alarm the user. Individual fields are
      // optional so partial backups are safe.
      try {
        if (restored.entries && typeof restored.entries === 'object') {
          setEntries(restored.entries);
        }
        if (Array.isArray(restored.completedSets)) {
          setCompletedSets(new Set(restored.completedSets));
        }
        if (restored.notes && typeof restored.notes === 'object') {
          setNotes(restored.notes);
        }
        if (Array.isArray(restored.autoFilled)) {
          setAutoFilled(new Set(restored.autoFilled));
        }
        if (Array.isArray(restored.userEdited)) {
          setUserEdited(new Set(restored.userEdited));
        }
        if (typeof restored.timerStarted === 'boolean') {
          setTimerStarted(restored.timerStarted);
        }
        if (Number.isFinite(restored.elapsed)) {
          setElapsed(restored.elapsed);
        }
        if (Number.isFinite(restored.restDuration)) {
          setRestDuration(restored.restDuration);
          restDurationRef.current = restored.restDuration;
        }
        // Restore silently — per spec, the user shouldn't know anything
        // went wrong. (A "Restored from earlier" toast would require a new
        // non-undoable toast type in UndoToast, which is out of scope.)
      } catch (_) { /* best-effort */ }
    }

    sessionRestoredRef.current = true;
    // Release the write-suppression on the next tick so the initial server
    // load (which also calls setEntries, etc.) can settle first — the server
    // load should take precedence when it arrives, and its setState calls
    // will then be captured by the backup effect normally.
    const t = setTimeout(() => { suppressBackupRef.current = false; }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, date, tutorialMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Debounced backup: persist live state to localStorage so a tab crash /
  // navigation / dropped signal doesn't lose logged sets. ~200ms debounce.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tutorialMode) return;
    if (!sessionRestoredRef.current) return; // wait until restore pass ran
    if (suppressBackupRef.current) return;
    if (isCompleted) return; // completed sessions are server-persisted

    if (sessionBackupDebounceRef.current) {
      clearTimeout(sessionBackupDebounceRef.current);
    }
    sessionBackupDebounceRef.current = setTimeout(() => {
      try {
        const payload = {
          entries,
          completedSets: Array.from(completedSets),
          notes,
          autoFilled: Array.from(autoFilled),
          userEdited: Array.from(userEdited),
          timerStarted,
          elapsed,
          restDuration,
          restRemaining, // transient but useful if we restore mid-rest
          updatedAt: Date.now(),
          submitted: false,
        };
        localStorage.setItem(sessionBackupKey, JSON.stringify(payload));
      } catch (_) { /* Safari private mode / quota exceeded */ }
    }, 200);

    return () => {
      if (sessionBackupDebounceRef.current) {
        clearTimeout(sessionBackupDebounceRef.current);
      }
    };
  }, [
    entries,
    completedSets,
    notes,
    autoFilled,
    userEdited,
    timerStarted,
    elapsed,
    restDuration,
    restRemaining,
    isCompleted,
    tutorialMode,
    sessionBackupKey,
  ]);

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

    // Race-condition guard: when the user rapidly switches sessions, the in-flight
    // fetches from the previous templateId/date can resolve AFTER the new session
    // is loaded, mixing data across templates. The cleanup at the end of this
    // useEffect flips `cancelled = true`; after each await we bail before any
    // further setState, so stale data never lands on the new session.
    let cancelled = false;

    // Step 1: Ensure a session copy exists (creates one from template if needed)
    // Step 2: Load everything from the session — never from the template directly
    async function loadSession() {
      try {
        // Fetch PBs, schedule, last session entries, and programs in parallel
        // Fetch schedule for a small window around the current date (for day nav arrows)
        const schedFrom = format(subDays(parseDateLocal(date), 7), 'yyyy-MM-dd');
        const schedTo = format(addDays(parseDateLocal(date), 7), 'yyyy-MM-dd');
        const [pbList, scheduleData, lastEntries, programs, userMetrics, allPRsList] = await Promise.all([
          api(`/pbs?templateId=${templateId}`),
          api(`/schedule?from=${schedFrom}&to=${schedTo}`),
          api(`/sessions/last-entries/${templateId}`).catch((err) => {
            if (import.meta.env.DEV) console.warn('Failed to load last-session entries; weight suggestions may be stale:', err);
            return {};
          }),
          api('/programs').catch((err) => {
            if (import.meta.env.DEV) console.warn('Failed to load programs:', err);
            return [];
          }),
          // 1RM maxes — used to auto-fill %1RM-prescribed suggested weights
          // (see applyOneRMSuggestions below). Missing metrics = no-op.
          api('/metrics').catch(() => ({})),
          // All-time PRs across every template — drives the per-exercise PR
          // popup. Non-blocking for the page render path; defaults to [] on
          // failure so the rest of the session loads cleanly.
          api('/pbs/all-by-muscle').catch(() => []),
        ]);
        if (cancelled) return;
        setLastSession(lastEntries || {});

        // Client-side overlay: when an exercise's description prescribes a %
        // of a tracked 1RM (bench/squat/deadlift) and the user has that max
        // stored, replace the empty suggestedWeight with the computed value.
        // Only fills in blanks — pre-set weights (from history or manual
        // template entries) are left untouched so we don't clobber intent.
        function applyOneRMSuggestions(exercises) {
          if (!exercises) return exercises;
          return exercises.map((ex) => {
            if (ex.isSectionHeader || !ex.sets) return ex;
            const computed = calculateOneRMSuggestion({
              exerciseName: ex.name,
              description: ex.exerciseDescription,
              metrics: userMetrics,
            });
            if (!computed) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => (
                Number(s.suggestedWeight) > 0 ? s : { ...s, suggestedWeight: computed }
              )),
            };
          });
        }
        const pbMap = {};
        for (const pb of pbList) {
          if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
          pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
        }
        setPbs(pbMap);
        setAllTimePRs(allPRsList || []);
        setSchedule(scheduleData);

        // Check for existing session
        let session = await api(`/sessions/by-template/${templateId}/${date}`);
        if (cancelled) return;

        // If no session exists, initialize one from the template (creates independent copy)
        if (!session || !session.workoutData) {
          session = await api('/sessions/initialize', {
            method: 'POST',
            body: JSON.stringify({ templateId: Number(templateId), date }),
          });
          if (cancelled) return;
        }

        // Capture the session id so cardio entries can link to it. Also fetch
        // any cardio already logged against this session (e.g. user navigated
        // away mid-workout and came back).
        if (session?.id) {
          setSessionId(session.id);
          api(`/cardio?session_id=${session.id}`)
            .then((rows) => { if (!cancelled && Array.isArray(rows)) setCardioEntries(rows); })
            .catch(() => {});
        }

        // If still no workout data (shouldn't happen, but safety net)
        if (!session?.workoutData?.exercises) {
          // Fallback: load template directly (legacy behavior)
          const templates = await api('/templates');
          if (cancelled) return;
          const tmpl = templates.find((t) => t.id === Number(templateId));
          if (tmpl) {
            const enrichedTmpl = { ...tmpl, exercises: applyOneRMSuggestions(tmpl.exercises) };
            setTemplate(enrichedTmpl);
            if (enrichedTmpl.isRest) return;
            const initial = {};
            for (let exIdx = 0; exIdx < enrichedTmpl.exercises.length; exIdx++) {
              const ex = enrichedTmpl.exercises[exIdx];
              if (ex.isSectionHeader) continue;
              const key = exKey(enrichedTmpl.exercises, ex, exIdx);
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
          exercises: applyOneRMSuggestions(wd.exercises),
        };
        setTemplate(sessionTemplate);

        // Look up program name
        const tmplList = await api('/templates').catch(() => []);
        if (cancelled) return;
        const tmplInfo = tmplList.find(t => t.id === Number(templateId));
        if (tmplInfo?.programId && programs.length > 0) {
          const prog = programs.find(p => p.id === tmplInfo.programId);
          if (prog) {
            setProgramName(prog.name);
            setCardioEnabled(!!prog.cardioAccelerationEnabled);
          }
        }

        // Restore cardio selections from workout_data if present.
        if (wd && typeof wd === 'object' && wd.cardioSelections && typeof wd.cardioSelections === 'object') {
          setCardioSelections(wd.cardioSelections);
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
        if (session.completed) {
          setIsCompleted(true);
          // Deeplink from Workouts page's "Workout Completed" CTA — open the
          // summary modal immediately so the user sees the post-workout view
          // on first paint instead of an extra "View Summary" tap.
          if (location.search.includes('summary=1')) setShowSummary(true);
        }
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
        if (cancelled) return;
        if (err.name !== 'AbortError') setLoadError('Failed to load workout — check your connection');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDayNavDisabled(false);
        }
      }
    }

    loadSession();
    return () => { cancelled = true; };
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

  // Auto-open full-screen on first template load when the user has the
  // Profile default ON. We track first-open with a ref so subsequent
  // template updates (e.g. swap/delete) don't re-trigger.
  const fullScreenAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (fullScreenAutoOpenedRef.current) return;
    if (!template || template.isRest) return;
    if (!fullScreenDefault) { fullScreenAutoOpenedRef.current = true; return; }
    // Pick the first non-section exercise index. If a rest day or all-section
    // template somehow loads here, skip (no card to render).
    const firstIdx = template.exercises.findIndex(e => !e.isSectionHeader);
    // Empty shell (e.g. /sessions/start-empty before the user adds anything):
    // leave the ref unset so the auto-open fires once the first real exercise
    // is added. Otherwise an empty start would permanently disable auto-open
    // for this session even after exercises appear.
    if (firstIdx < 0) return;
    setFullScreenIdx(firstIdx);
    fullScreenAutoOpenedRef.current = true;
  }, [template, fullScreenDefault]);

  // Auto-pop the rest timer to the bottom-left of the viewport every time
  // the user enters full-screen mode (null → non-null transition on
  // fullScreenIdx). Re-pops on each fresh entry — exit full-screen, dock
  // the timer, come back into full-screen — the popped card returns at the
  // bottom-left. Navigating between exercises within full-screen (number →
  // number) does NOT re-fire, so the user's mid-session drag/dock choices
  // are still respected as long as they stay in full-screen.
  const prevFullScreenIdxRef = useRef(null);
  useEffect(() => {
    const wasOutside = prevFullScreenIdxRef.current === null;
    prevFullScreenIdxRef.current = fullScreenIdx;
    if (fullScreenIdx === null) return;   // exit full-screen — nothing to do
    if (!wasOutside) return;              // intra-FS navigation (number → number) — leave the timer alone
    setRestFloating(true);
    // Bottom-left: x=16 left margin, y = viewport height - approx card
    // height (~170px includes the rounded card + outer red glow ring) -
    // 16px bottom margin. window.innerHeight is fine here — the effect
    // only fires in the browser after fullScreenIdx changes.
    const cardH = 170;
    const margin = 16;
    setRestFloatPos({ x: margin, y: Math.max(80, window.innerHeight - cardH - margin) });
  }, [fullScreenIdx]);

  // If the currently-displayed full-screen exercise gets deleted (or its idx
  // goes out of bounds for any reason), auto-exit full-screen back to scroll.
  useEffect(() => {
    if (fullScreenIdx === null || !template) return;
    const ex = template.exercises[fullScreenIdx];
    if (!ex || ex.isSectionHeader) {
      setFullScreenIdx(null);
    }
  }, [template, fullScreenIdx]);

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
    // And mark the specific field as user-edited so future autofill from
    // earlier sets won't clobber it. Only weight/reps are autofill targets;
    // setType doesn't propagate so we don't need to track it.
    if (field === 'weight' || field === 'reps') {
      setUserEdited((prev) => {
        const next = new Set(prev);
        next.add(`${exerciseName}-${setIdx}:${field}`);
        return next;
      });
    }
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

    // Read completedSets from a ref so we see the LATEST value, not the
    // closure-captured one from when handleBlur was scheduled. Prevents the
    // race where a set marked complete just before blur fires would still
    // be auto-overwritten.
    const completedNow = completedSetsRef.current;

    // Cascade rule: every later set in this exercise is overwritten with
    // the value that was just entered, except for sets the user has
    // explicitly completed (those are locked-in results we never clobber).
    // This means editing set 1 fills sets 2..N; later editing set 4 fills
    // sets 5..N with the new value while leaving 2..3 alone.
    // Skip any later set whose THIS field was previously user-edited — that
    // value is locked-in by the user, not eligible for forward propagation.
    const userEditedNow = userEditedRef.current;
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseName] = [...(updated[exerciseName] || [])];
      for (let i = setIdx + 1; i < exercise.sets.length; i++) {
        const key = `${exerciseName}-${i}`;
        if (completedNow.has(key)) continue;
        if (userEditedNow.has(`${key}:${field}`)) continue;
        updated[exerciseName][i] = {
          ...updated[exerciseName][i],
          [field]: value,
        };
      }
      return updated;
    });

    setAutoFilled((prev) => {
      const next = new Set(prev);
      for (let i = setIdx + 1; i < exercise.sets.length; i++) {
        const key = `${exerciseName}-${i}`;
        if (completedNow.has(key)) continue;
        // Only flag as autofilled if we actually wrote — i.e., not a
        // user-edited skip for this field.
        if (userEditedNow.has(`${key}:${field}`)) continue;
        next.add(key);
      }
      return next;
    });
  }

  // Goal Weight / Goal Reps cell edit handler — writes to goalOverrides
  // (per-session aspirational target) without touching the template or
  // the actual entries. The cell render reads override first, falling back
  // to lastSession[exerciseName][setIdx] (positional match), then to
  // lastSession[exerciseName][0] (first-set fallback for extra sets), then
  // to blank if no prior session for the exercise exists.
  function handleGoalChange(exerciseKey, setIdx, field, value) {
    setGoalOverrides((prev) => {
      const next = { ...prev };
      const list = (next[exerciseKey] || []).slice();
      while (list.length <= setIdx) list.push(undefined);
      list[setIdx] = {
        ...(list[setIdx] || {}),
        [field]: value === '' ? '' : value,
      };
      next[exerciseKey] = list;
      return next;
    });
  }

  // Plate-calculator "Apply" button — writes the calculated weight to the
  // first non-completed set on the exercise, then cascades the value forward
  // to subsequent non-completed AND non-user-edited sets. Mirrors the cascade
  // logic in handleBlur but operates atomically (a single setEntries call) so
  // the timing race between handleChange and handleBlur doesn't apply. The
  // first non-completed set gets marked user-edited (so future autofill from
  // an earlier set won't clobber it), and the cascaded sets get marked
  // autoFilled so the UI can visually distinguish predicted values.
  function handleApplyCalculatedWeight(exerciseKey, weight) {
    if (!template) return;
    let exercise = null;
    for (let i = 0; i < template.exercises.length; i++) {
      const e = template.exercises[i];
      if (!e.isSectionHeader && exKey(template.exercises, e, i) === exerciseKey) { exercise = e; break; }
    }
    if (!exercise) return;
    const setCount = exercise.sets?.length || 0;
    if (setCount === 0) return;

    const completedNow = completedSetsRef.current;
    const userEditedNow = userEditedRef.current;

    // First non-completed set is the write target; everything after that
    // which isn't completed AND hasn't been user-edited gets the cascade.
    let firstUncompleted = -1;
    for (let i = 0; i < setCount; i++) {
      if (!completedNow.has(`${exerciseKey}-${i}`)) { firstUncompleted = i; break; }
    }
    if (firstUncompleted < 0) return; // every set already completed — no-op

    setPersisted(false);
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseKey] = [...(updated[exerciseKey] || [])];
      updated[exerciseKey][firstUncompleted] = {
        ...updated[exerciseKey][firstUncompleted],
        weight,
      };
      for (let i = firstUncompleted + 1; i < setCount; i++) {
        const key = `${exerciseKey}-${i}`;
        if (completedNow.has(key)) continue;
        if (userEditedNow.has(`${key}:weight`)) continue;
        updated[exerciseKey][i] = {
          ...updated[exerciseKey][i],
          weight,
        };
      }
      return updated;
    });

    setAutoFilled((prev) => {
      const next = new Set(prev);
      // The first uncompleted set is now an explicit apply — clear any
      // stale autoFilled flag on it.
      next.delete(`${exerciseKey}-${firstUncompleted}`);
      for (let i = firstUncompleted + 1; i < setCount; i++) {
        const key = `${exerciseKey}-${i}`;
        if (completedNow.has(key)) continue;
        if (userEditedNow.has(`${key}:weight`)) continue;
        next.add(key);
      }
      return next;
    });

    setUserEdited((prev) => {
      const next = new Set(prev);
      next.add(`${exerciseKey}-${firstUncompleted}:weight`);
      return next;
    });

    autoSaveNeeded.current = true;
  }

  function handleAddSet(exerciseKey, afterIdx) {
    setPersisted(false);
    structureSaveNeeded.current = true;
    // Cards designated as a superset default new sets to setType='superset'.
    // Read from current template state — supersetLabel isn't being mutated
    // in this handler, so the outer closure value is current.
    const tIdxOuter = findExIdx(template?.exercises || [], exerciseKey);
    const isSupersetCard = tIdxOuter >= 0 && !!template.exercises[tIdxOuter].supersetLabel;
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
      if (isSupersetCard) newEntry.setType = 'superset';
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

  // Insert a section-header row at the END of the exercises list. Users
  // typically tap "Add Section Header" first, then add the exercises that
  // belong under it — those exercises also append at the end (or after a
  // specific card via the inline + button), so the resulting flow is
  // header → exercise → exercise. Drag-reorder is available for repositioning.
  function handleAddSectionHeader() {
    const name = addSectionName.trim();
    if (!name) return;
    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { name, isSectionHeader: true, sectionNotes: '', sets: [] },
      ],
    }));
    setAddSectionName('');
    setShowAddSection(false);
  }

  // Confirm handler from the two-wheel picker. Writes the label onto the
  // exercise object AND flips every UNLOGGED entry's setType to 'superset'.
  // Already-completed sets are left at whatever the user picked for them —
  // those are durable history. The setType change is per-entry (not on
  // exercise.setType) so the historical-fallback chain in ExerciseCard
  // line 554 doesn't retroactively re-label completed sets.
  function handleSetSupersetLabel(targetKey, label) {
    if (!targetKey || !label) return;
    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => {
      if (!prev) return prev;
      const tIdx = findExIdx(prev.exercises, targetKey);
      if (tIdx < 0) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex, i) => i === tIdx ? { ...ex, supersetLabel: label } : ex),
      };
    });
    setEntries((prev) => {
      const cur = prev[targetKey];
      if (!cur || cur.length === 0) return prev;
      const next = cur.map((entry, idx) => {
        const key = `${targetKey}-${idx}`;
        if (completedSets.has(key)) return entry; // leave logged sets alone
        return { ...(entry || {}), setType: 'superset' };
      });
      return { ...prev, [targetKey]: next };
    });
  }

  // Clear handler — wipe the label only. Setting an entry's setType back to
  // 'straight' would erase a user's manual pick (e.g. they had this row as
  // 'drop' already), so we leave the per-entry setTypes alone.
  function handleClearSupersetLabel(targetKey) {
    if (!targetKey) return;
    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => {
      if (!prev) return prev;
      const tIdx = findExIdx(prev.exercises, targetKey);
      if (tIdx < 0) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex, i) => {
          if (i !== tIdx) return ex;
          const { supersetLabel: _drop, ...rest } = ex;
          return rest;
        }),
      };
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
    // If the user added the exercise while in full-screen mode, switch the
    // overlay to show the newly-created card so they can start logging it
    // immediately instead of being left on the previous exercise.
    if (fullScreenIdx !== null) setFullScreenIdx(insertIdx);
  }

  const exerciseRefs = useRef({});
  const scrollToExercise = useRef(null);

  // Persist a new cardio entry to the server, then append to local state so
  // the card appears under the Add Cardio button without a refetch. Throws
  // on failure so the modal can surface the error to the user.
  async function handleSaveCardio(payload) {
    if (!sessionId) throw new Error('Session not ready yet — try again in a moment.');
    const created = await api('/cardio', {
      method: 'POST',
      body: JSON.stringify({ ...payload, session_id: sessionId }),
    });
    setCardioEntries((prev) => [...prev, created]);
    setShowAddCardio(false);
  }

  async function handleDeleteCardio(id) {
    // Optimistic removal — re-add the entry on failure (rare).
    const before = cardioEntries;
    setCardioEntries((prev) => prev.filter((c) => c.id !== id));
    try {
      await api(`/cardio/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete cardio entry', err);
      setCardioEntries(before);
    }
  }

  // Save edits made in the section-edit modal (rename + notes). Section
  // headers have no entries/completedSets/autoFilled to migrate, so this
  // is a single template-mutation.
  function handleSaveSection(idx, name, notes) {
    const trimmedName = name.trim();
    if (!trimmedName) return; // ignore empty saves; modal also gates this
    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => {
        if (i !== idx || !ex.isSectionHeader) return ex;
        const next = { ...ex, name: trimmedName };
        const trimmedNotes = notes.trim();
        if (trimmedNotes) next.sectionNotes = trimmedNotes;
        else delete next.sectionNotes;
        return next;
      }),
    }));
    setSectionEditing(null);
    setSectionDeleteConfirming(false);
  }

  // Drop a section header from the template. No entries to clean up.
  function handleDeleteSection(idx) {
    setPersisted(false);
    structureSaveNeeded.current = true;
    setTemplate((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== idx),
    }));
    setSectionEditing(null);
    setSectionDeleteConfirming(false);
  }

  function handleDeleteExercise(exerciseKey) {
    // Snapshot before deleting
    const exerciseIdx = findExIdx(template.exercises, exerciseKey);
    if (exerciseIdx < 0) return;
    // If we're full-screen viewing the exercise being deleted, auto-exit.
    // (Indices shift on delete; without this, full-screen would silently
    // jump to the next exercise.)
    if (fullScreenIdx === exerciseIdx) {
      setFullScreenIdx(null);
    } else if (fullScreenIdx !== null && exerciseIdx < fullScreenIdx) {
      // Deletion before us — slide our index back by one so we stay on
      // the same exercise.
      setFullScreenIdx(fullScreenIdx - 1);
    }
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

  // Reorder sets WITHIN an exercise. Triggered by drag-and-drop on the set
  // rows in ExerciseCard (long-press → drag activation via @dnd-kit).
  // All four parallel structures need to shuffle together so logged data
  // stays attached to the right row:
  //   • template.exercises[i].sets — the set definitions (renumbered 1..N)
  //   • entries[exerciseKey]       — the per-set weight/reps/setType the user entered
  //   • completedSets              — `${eKey}-${idx}` markers
  //   • autoFilled                 — `${eKey}-${idx}` markers
  // For the shared index-shifting logic, every "from→to" reorder shifts a
  // contiguous range of indices by ±1 between fromIdx and toIdx; everything
  // outside that range keeps its index.
  function handleReorderSets(exerciseKey, fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    setPersisted(false);
    structureSaveNeeded.current = true;

    const tIdx = findExIdx(template.exercises, exerciseKey);
    if (tIdx < 0) return;

    setTemplate((prev) => {
      const exercises = [...prev.exercises];
      const sets = [...exercises[tIdx].sets];
      const [moved] = sets.splice(fromIdx, 1);
      sets.splice(toIdx, 0, moved);
      const renumbered = sets.map((s, i) => ({ ...s, setNumber: i + 1 }));
      exercises[tIdx] = { ...exercises[tIdx], sets: renumbered };
      return { ...prev, exercises };
    });

    setEntries((prev) => {
      const arr = prev[exerciseKey];
      if (!Array.isArray(arr)) return prev;
      const next = [...arr];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...prev, [exerciseKey]: next };
    });

    const remapIdx = (idx) => {
      if (idx === fromIdx) return toIdx;
      if (fromIdx < toIdx && idx > fromIdx && idx <= toIdx) return idx - 1;
      if (fromIdx > toIdx && idx >= toIdx && idx < fromIdx) return idx + 1;
      return idx;
    };
    const remapSetForExercise = (keySet) => {
      const next = new Set();
      const prefix = exerciseKey + '-';
      for (const key of keySet) {
        if (key.startsWith(prefix)) {
          const idx = Number(key.slice(prefix.length));
          if (Number.isFinite(idx)) {
            next.add(`${prefix}${remapIdx(idx)}`);
            continue;
          }
        }
        next.add(key);
      }
      return next;
    };
    setCompletedSets((prev) => remapSetForExercise(prev));
    setAutoFilled((prev) => remapSetForExercise(prev));
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
    const oldExercise = { ...currentExercises[tIdx], sets: currentExercises[tIdx].sets.map(s => ({ ...s })) };
    const numSets = oldExercise?.sets?.length || 0;
    const oldEntries = entries[oldKey] ? [...entries[oldKey]] : null;
    const oldNote = notes[oldKey] || '';
    const oldCompletedKeys = [...completedSets].filter((k) => k.startsWith(oldKey + '-'));
    const oldAutoFilledKeys = [...autoFilled].filter((k) => k.startsWith(oldKey + '-'));
    const oldName = exNameFromKey(oldKey);

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

    // Show undo toast
    setUndoToast({
      type: 'exercise',
      exerciseName: newKey,
      exerciseIndex: tIdx,
      message: `Swapped ${oldName} → ${newName}`,
      undoFn: () => {
        setPersisted(false);
        structureSaveNeeded.current = true;
        // Restore old exercise in template
        setTemplate((prev) => {
          const ti = findExIdx(prev.exercises, newKey);
          if (ti < 0) return prev;
          return {
            ...prev,
            exercises: prev.exercises.map((ex, i) => i === ti ? oldExercise : ex),
          };
        });
        // Restore old entries
        setEntries((prev) => {
          const updated = { ...prev };
          delete updated[newKey];
          if (oldEntries) updated[oldKey] = oldEntries;
          return updated;
        });
        // Restore notes
        if (oldNote) {
          setNotes((prev) => ({ ...prev, [oldKey]: oldNote }));
        }
        // Restore completedSets
        setCompletedSets((prev) => {
          const next = new Set(prev);
          oldCompletedKeys.forEach((k) => next.add(k));
          return next;
        });
        // Restore autoFilled
        setAutoFilled((prev) => {
          const next = new Set(prev);
          oldAutoFilledKeys.forEach((k) => next.add(k));
          return next;
        });
      },
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
          const repVariations = [0, 1, 2, 0, 1, 0, 1, 0, 2, 1, 0, 1];
          const weightVariations = [0, 5, 10, 0, 5, 5, 0, 10, 10, 0, 5, 0];
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
      // Require at least one set with data (weight > 0, weight = -1 for BW, or reps > 0)
      if (newCompleted) {
        const hasData = Object.values(entries).some((sets) =>
          sets.some((s) => Number(s.weight) > 0 || Number(s.weight) === -1 || Number(s.reps) > 0)
        );
        if (!hasData) {
          showCompleteError('Log at least one set before completing your workout.');
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
        clearSessionBackup();
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        setShowSummary(true);
        track('workout_session_completed', {
          templateId: Number(templateId) || undefined,
          date,
          elapsedSeconds: elapsed,
          source: 'standard',
        });
        // Every-5th-workout Bible verse. Opt-out via Profile > App Settings.
        // Kicked off in parallel — we don't need to block the summary on it.
        if (localStorage.getItem('wf-bible-verses') !== 'off') {
          api('/sessions/completed')
            .then((completed) => {
              const count = Array.isArray(completed) ? completed.length : 0;
              if (count > 0 && count % 5 === 0) {
                const { verse } = pickNextVerse();
                setPendingVerse(verse);
              }
            })
            .catch(() => { /* silent — no verse is fine */ });
        }
      }
    } catch (err) {
      showToast(friendlyError(err, "Couldn't update your workout. Try again in a moment."), 'error');
    }
  }

  // Cardio-acceleration auto-fill: picking a cardio option at set-slot N
  // (between set N and set N+1) applies to all later slots for the same
  // exercise. Earlier slots and other exercises are left alone.
  function handleCardioChange(exerciseKey, setIdx, value) {
    if (!template) return;
    const ex = template.exercises.find((e, i) =>
      !e.isSectionHeader && exKey(template.exercises, e, i) === exerciseKey
    );
    const setCount = ex?.sets?.length || 0;
    setCardioSelections((prev) => {
      const next = { ...prev };
      for (let i = setIdx; i < setCount - 1; i++) {
        next[`${exerciseKey}-${i}`] = value;
      }
      return next;
    });
    autoSaveNeeded.current = true;
  }

  function handleToggleComplete(exerciseKey, setIdx) {
    // Blur any focused input so the browser doesn't scroll it back into view on re-render
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur();
    }
    setPersisted(false);
    const key = `${exerciseKey}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
        startTimer();
        // Cardio-acceleration programs run their own 60s between-set timer
        // via the CardioAccelerationCard; don't spin up the generic rest
        // timer on top of it.
        if (!cardioEnabled) {
          startRestTimer();
          // Capture "Up Next" context for the floating rest timer card:
          // if there's another set on the same exercise, that's next;
          // otherwise the first set of the next non-section exercise.
          // null when we just completed the last set of the last exercise.
          if (template) {
            const exerciseIdx = template.exercises.findIndex(
              (e, i) => !e.isSectionHeader && exKey(template.exercises, e, i) === exerciseKey
            );
            const ex = exerciseIdx >= 0 ? template.exercises[exerciseIdx] : null;
            const setCount = ex?.sets?.length || 0;
            if (ex && setIdx + 1 < setCount) {
              setRestContext({ exerciseName: ex.name, nextSetNumber: setIdx + 2 });
            } else if (ex) {
              let nextEx = null;
              for (let j = exerciseIdx + 1; j < template.exercises.length; j++) {
                if (!template.exercises[j].isSectionHeader) { nextEx = template.exercises[j]; break; }
              }
              setRestContext(nextEx ? { exerciseName: nextEx.name, nextSetNumber: 1 } : null);
            } else {
              setRestContext(null);
            }
          }
        }
      }
      return next;
    });

    // Trigger debounced auto-save
    autoSaveNeeded.current = true;

    // When completing a set, auto-fill subsequent uncompleted sets for this
    // exercise. `completedSets` here is the pre-toggle closure value — the
    // setCompletedSets updater above hasn't committed yet — so we use it
    // both to detect completion direction and for the per-later-set check.
    if (!completedSets.has(key)) {
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
          // Per-field user-edit guard: never propagate over a weight or
          // reps value the user typed manually. Read from the ref so we
          // see the freshest marks even if a typed-then-completed sequence
          // landed in the same tick.
          const userEditedNow = userEditedRef.current;
          setEntries((prev) => {
            const updated = { ...prev };
            updated[exerciseKey] = [...(updated[exerciseKey] || [])];
            const newAutoFilled = new Set(autoFilled);
            for (let i = setIdx + 1; i < exercise.sets.length; i++) {
              const laterKey = `${exerciseKey}-${i}`;
              if (!completedSets.has(laterKey)) {
                  const current = updated[exerciseKey][i] || {};
                  const currentWeight = current.weight;
                  const currentReps = current.reps;
                  const isCurrentAutoFilled = autoFilled.has(laterKey);
                  const weightEmpty = currentWeight === '' || currentWeight === undefined;
                  const repsEmpty = currentReps === '' || currentReps === undefined;
                  const weightUserEdited = userEditedNow.has(`${laterKey}:weight`);
                  const repsUserEdited = userEditedNow.has(`${laterKey}:reps`);

                  // Decide per-field whether to overwrite. A field is eligible
                  // when (empty || the set was autofilled before) AND the user
                  // hasn't typed into it.
                  const overwriteWeight =
                    !weightUserEdited &&
                    (weightEmpty || isCurrentAutoFilled) &&
                    w !== '' && w !== undefined;
                  const overwriteReps =
                    !repsUserEdited &&
                    (repsEmpty || isCurrentAutoFilled) &&
                    r !== '' && r !== undefined;

                  if (overwriteWeight || overwriteReps) {
                    updated[exerciseKey][i] = {
                      ...current,
                      weight: overwriteWeight ? w : current.weight,
                      reps: overwriteReps ? r : current.reps,
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
  }

  async function handleShare() {
    if (!template) return;

    const lines = [`${template.name} — ${format(parseDateLocal(date), 'EEEE, MMM d')}\n`];

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

    const totalSets = template.exercises.filter(e => !e.isSectionHeader).reduce((s, e) => s + e.sets.length, 0);
    lines.push(totalSets > 0 ? `${completedSets.size}/${totalSets} sets completed` : 'Workout in progress');

    const text = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: `${template.name} Workout`, text });
      } catch (err) {
        if (err.name !== 'AbortError' && import.meta.env.DEV) console.error(err);
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Workout copied to clipboard.');
    }
  }

  async function handleSave() {
    if (tutorialMode) { setPersisted(true); setSaved(true); setTimeout(() => setSaved(false), 2000); return; }
    if (!template || template.isRest) return;
    // A save is already in flight — await it instead of throwing. Lets
    // handleMarkComplete safely `await handleSave()` even if the autosave
    // debounce just fired.
    if (savingRef.current && inFlightSaveRef.current) return inFlightSaveRef.current;

    setSaving(true);
    savingRef.current = true;
    const savePromise = (async () => {
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

      // Nothing to POST — happens when the template momentarily has zero
      // non-section exercises (mid-undo of "delete last exercise") or when
      // start-empty is opened with no exercises yet. The server returns 400
      // here, which would surface as a scary toast despite there being
      // nothing wrong; bail cleanly instead.
      if (allEntries.length === 0) return;

      // Save the full workout structure as an independent copy
      const workoutData = {
        name: template.name,
        exercises: template.exercises.map((ex, exIdx) => {
          if (ex.isSectionHeader) return { name: ex.name, isSectionHeader: true, sectionNotes: ex.sectionNotes || '', sets: [] };
          const eKey = exKey(template.exercises, ex, exIdx);
          return {
            name: ex.name,
            setType: entries[eKey]?.find(e => e?.setType)?.setType || ex.setType || 'straight',
            // Preserve superset/circuit grouping across save → reload. workout_data
            // is JSONB so the server retains arbitrary fields; only the client's
            // explicit-field map here would drop it.
            ...(ex.supersetLabel ? { supersetLabel: ex.supersetLabel } : {}),
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
        cardioSelections: cardioEnabled ? cardioSelections : undefined,
      };

      // In-session save (autosave + the manual Save button below) is by
      // definition editing the same session that WorkoutSession.loadSession
      // already loaded for this user. Always pass confirmOverwrite: true so
      // the server's overwrite-protection contract doesn't pop a 409 mid-
      // workout. The protection is meant for cold-open paths (Calendar copy,
      // a fresh "Start Workout" tap on a logged date) — not for users
      // actively logging sets.
      const saveResp = await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          templateId: Number(templateId),
          date,
          entries: allEntries,
          notes,
          workoutData,
          confirmOverwrite: true,
        }),
      });
      // Server returns an error envelope if the write failed; treat that as a save failure.
      if (saveResp && saveResp.error) {
        throw new Error(saveResp.error);
      }

      // Save succeeded on the server — the local offline backup is no longer
      // needed. Mark it submitted first (so a late restore pass won't pick it
      // back up) then remove it.
      try {
        localStorage.setItem(sessionBackupKey, JSON.stringify({ submitted: true, updatedAt: Date.now() }));
      } catch (_) {}
      clearSessionBackup();

      // Post-save: refresh PBs and detect improvements. Best-effort — if this fails
      // the session IS saved, so log the failure but don't alarm the user with
      // "Failed to save".
      try {
        const pbList = await api(`/pbs?templateId=${templateId}`);
        const pbMap = {};
        for (const pb of pbList) {
          if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
          pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
        }
        // Capture scroll position right before setPbs (user may have scrolled during API call)
        const pbsScrollY = window.scrollY;
        setPbs(pbMap);
        requestAnimationFrame(() => {
          window.scrollTo(0, pbsScrollY);
          requestAnimationFrame(() => window.scrollTo(0, pbsScrollY));
        });

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
      } catch (postSaveErr) {
        if (import.meta.env.DEV) console.warn('Post-save PB refresh failed (session was saved):', postSaveErr);
      }

      // Auto-save any custom exercises not in the library
      const knownNames = new Set(allExercisesFromDB.map(e => e.name.toLowerCase()));
      for (const ex of template.exercises) {
        if (ex.isSectionHeader) continue;
        if (!knownNames.has(ex.name.toLowerCase())) {
          createCustom(ex.name, 'Other').catch(() => {});
        }
      }

      // Capture scroll position right before final state updates
      const finalScrollY = window.scrollY;
      setPersisted(true);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
      requestAnimationFrame(() => {
        window.scrollTo(0, finalScrollY);
        requestAnimationFrame(() => window.scrollTo(0, finalScrollY));
      });
     } catch (err) {
      showToast(friendlyError(err, "Couldn't save your workout. Your progress is still here — try again in a moment."), 'error', 5000);
     } finally {
      setSaving(false);
      savingRef.current = false;
      inFlightSaveRef.current = null;
     }
    })();
    inFlightSaveRef.current = savePromise;
    return savePromise;
  }

  // Dirty if any entry has user-typed weight or reps
  const hasEntryData = Object.values(entries).some((exEntries) =>
    exEntries.some((e) => (e.weight !== '' && e.weight !== undefined) || (e.reps !== '' && e.reps !== undefined))
  );
  const sessionDirty = hasEntryData && !persisted;
  // inputsLocked: weight/reps/notes are NOT editable. Only blocks once the
  // session is completed; pre-Begin Workout, users can pre-fill planned values.
  // completionLocked: the green checkmark is gated by Begin Workout — pressing
  // it pre-Begin shows the popup instead of marking the set complete.
  const inputsLocked = isCompleted;
  const completionLocked = !timerStarted || isCompleted;
  const structureLocked = isCompleted; // exercise/set editing allowed before Begin Workout
  const { guardedNavigate, UnsavedModal } = useUnsavedGuard({
    isDirty: sessionDirty,
    onSave: handleSave,
    saveLabel: 'Save Workout',
  });

  // Navigate to adjacent day's workout (uses schedule to find templateId for that day)
  const [dayNavDisabled, setDayNavDisabled] = useState(false);
  // Reset nav lock when route params change (component reused, not remounted)
  useEffect(() => { setDayNavDisabled(false); }, [templateId, date]);
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
        <LoadingSpinnerOverlay />
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

  const displayDate = date ? format(parseDateLocal(date), 'EEE, MMM d') : '';

  const prevDate = date ? subDays(parseDateLocal(date), 1) : null;
  const nextDate = date ? addDays(parseDateLocal(date), 1) : null;
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
        <StickyHeader title={template.name.toUpperCase()} titleStyle={{ fontSize: '26.4px' }} subtitle={displayDate} />
        <RestDayCard />
      </div>
    );
  }

  const totalSets = template.exercises.filter(ex => !ex.isSectionHeader).reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  const completedCount = completedSets.size;
  const progressPct = totalSets > 0 ? Math.round((completedCount / totalSets) * 100) : 0;

  // Full-screen mode helpers. We navigate among non-section exercises only
  // (section headers don't render an ExerciseCard). `fsList` is the ordered
  // list of template.exercises indices that are real exercises.
  const fsList = template.exercises
    .map((e, i) => (e.isSectionHeader ? -1 : i))
    .filter(i => i >= 0);
  const fsPos = fullScreenIdx === null ? -1 : fsList.indexOf(fullScreenIdx);
  const fsTotal = fsList.length;
  const fsHasPrev = fsPos > 0;
  const fsHasNext = fsPos >= 0 && fsPos < fsTotal - 1;
  const fsExercise = fullScreenIdx === null ? null : template.exercises[fullScreenIdx];
  const fsKey = fsExercise && !fsExercise.isSectionHeader
    ? exKey(template.exercises, fsExercise, fullScreenIdx)
    : null;
  // Workout is "all sets complete" the moment every set across every
  // non-section exercise lands in completedSets. Used to trigger the
  // animated red-and-white liquid pulse on the full-screen ✕ button so
  // the user knows they're done and can exit to finalize.
  const allSetsComplete = totalSets > 0 && completedCount === totalSets;

  function exitFullScreen() {
    const idx = fullScreenIdx;
    setFullScreenIdx(null);
    // Scroll the underlying view to the last-shown exercise after the
    // overlay unmounts and the regular cards repaint.
    if (idx !== null) {
      const ex = template.exercises[idx];
      if (ex && !ex.isSectionHeader) {
        const key = exKey(template.exercises, ex, idx);
        setTimeout(() => {
          const el = exerciseRefs.current[key];
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }

  // completed sets only — planned/pre-filled values are excluded so the
  // session-level "Total Volume" tile reflects work actually done, not typed.
  const totalVolume = template.exercises.reduce((vol, ex, exIdx) => {
    if (ex.isSectionHeader) return vol;
    const eKey = exKey(template.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
    return vol + exEntries.reduce((sum, e, i) => {
      if (!completedSets.has(`${eKey}-${i}`)) return sum;
      const w = Number(e.weight) || 0;
      const r = Number(e.reps) || 0;
      return sum + (w > 0 ? w * r : 0);
    }, 0);
  }, 0);

  // Styling for the three control chips in the floating rest timer card
  // (−15s, +15s, Skip). Skip overrides background/border/color inline.
  const restChipStyle = {
    padding: '7px 11px',
    borderRadius: 100,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
  };

  return (
    <div className={`pb-24${cardTheme === 'dark' ? ' wf-dark-cards' : ''}`}>
      <h1 className="sr-only">REPLAB Workout Session</h1>
      {/* In-app toast (replaces window.alert calls for save/update failures
          and clipboard/share confirmations). Portaled so it sits above any
          card or sticky header without forcing layout shifts in the page. */}
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
      {/* Full-screen mode overlay — portaled to document.body so it escapes
          every stacking context on the page (sticky header, floating timers,
          card-theme background). The top bar reuses the same elapsed/rest
          state as the regular header (no duplicated interval logic), and
          the ExerciseCard below is the SAME component used in the scroll
          view, just unconstrained to fill the available space. */}
      {fullScreenIdx !== null && fsExercise && !fsExercise.isSectionHeader && createPortal(
        <div
          className="fixed inset-0 z-[90] flex flex-col"
          style={{ background: cardTheme === 'dark' ? '#e8e8e8' : '#0a0a0a' }}
          role="dialog"
          aria-modal="true"
          aria-label="Exercise full-screen mode"
        >
          {/* Top bar: [←] Exercise N of M [→]  workout · rest  [⚙] [✕] */}
          <div
            className="shrink-0 px-3 py-2 flex items-center gap-2"
            style={{
              background: 'linear-gradient(180deg, rgba(10,10,10,0.98) 0%, rgba(10,10,10,0.92) 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              paddingTop: 'max(8px, env(safe-area-inset-top))',
            }}
          >
            {/* Prev arrow (hidden on first) */}
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              {fsHasPrev && (
                <button
                  onClick={() => setFullScreenIdx(fsList[fsPos - 1])}
                  aria-label="Previous exercise"
                  className="relative w-8 h-8 rounded-full flex items-center justify-center text-wf-red bg-wf-red/10 border border-wf-red/30 active:scale-90 transition-all before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
              )}
            </div>
            {/* Exercise N of M — center-ish */}
            <div className="flex-1 min-w-0 text-center">
              <span className="text-[11px] uppercase font-bold text-wf-red tracking-wider" style={{ letterSpacing: '0.15em' }}>
                Exercise {fsPos + 1} of {fsTotal}
              </span>
            </div>
            {/* Next arrow (hidden on last) */}
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              {fsHasNext && (
                <button
                  onClick={() => setFullScreenIdx(fsList[fsPos + 1])}
                  aria-label="Next exercise"
                  className="relative w-8 h-8 rounded-full flex items-center justify-center text-wf-red bg-wf-red/10 border border-wf-red/30 active:scale-90 transition-all before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
            {/* Workout · Rest timers — reuse the SAME elapsed/restRemaining
                state ticking in the regular header; no duplicated intervals. */}
            <div className="shrink-0 flex items-center gap-2 px-2 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-[11px] font-light text-white/90 tabular-nums" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                {formatTime(elapsed)}
              </span>
              <span className="text-[10px] text-white/30">·</span>
              <span
                className="text-[11px] font-light tabular-nums"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.5px',
                  color: restRemaining !== null && restRemaining <= 0
                    ? 'rgba(34,197,94,0.95)'
                    : restRemaining !== null
                      ? 'rgba(239,68,68,0.95)'
                      : 'rgba(255,255,255,0.45)',
                }}
              >
                {restRemaining !== null ? formatTime(Math.max(0, restRemaining)) : '--:--'}
              </span>
            </div>
            {/* Settings gear — opens the same in-session popover the regular
                view uses (the popover renders at the gear's
                data-tutorial="session-settings" anchor, which is in the
                StickyHeader; toggling state is enough). */}
            <button
              data-fs-gear="1"
              onClick={() => setShowSessionMenu(v => !v)}
              aria-label="Session settings"
              className="relative w-8 h-8 rounded-full flex items-center justify-center text-white/80 active:bg-white/10 active:scale-90 transition-all shrink-0 before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {/* Exit ✕ — when every set has been marked complete, swap to
                the .btn-liquid-pulse class to draw the user's eye toward
                finishing the workout. */}
            <button
              onClick={exitFullScreen}
              aria-label="Exit full-screen"
              className={`relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px] ${allSetsComplete ? 'btn-liquid-pulse' : 'text-white/80 active:bg-white/10 active:scale-90 transition-all'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Card area — flex-1 so it fills all remaining height below the
              top bar; the card inside gets fullScreen={true} which drops its
              rounded corners + bottom margin and stretches to fill, so the
              card visually covers the whole viewport even with only 2 sets. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ExerciseCard
              fullScreen={true}
              exercise={fsExercise}
              exerciseKey={fsKey}
              entries={entries[fsKey]}
              pbs={pbs}
              readOnly={structureLocked}
              inputsLocked={inputsLocked}
              onShowPRs={(name) => { setPrModalSort('weight'); setPrModalExercise(name); }}
              onLockedTap={inputsLocked ? () => setShowBeginPrompt(true) : undefined}
              onChange={inputsLocked ? undefined : ((_n, ...args) => handleChange(fsKey, ...args))}
              onBlur={inputsLocked ? undefined : ((_n, ...args) => handleBlur(fsKey, ...args))}
              completedSets={completedSets}
              autoFilled={autoFilled}
              onToggleComplete={completionLocked ? () => setShowBeginPrompt(true) : ((_n, ...args) => handleToggleComplete(fsKey, ...args))}
              onAddSet={structureLocked ? undefined : ((_n, ...args) => handleAddSet(fsKey, ...args))}
              onDeleteSet={structureLocked ? undefined : ((_n, ...args) => handleDeleteSet(fsKey, ...args))}
              onReorderSets={structureLocked ? undefined : (fromIdx, toIdx) => handleReorderSets(fsKey, fromIdx, toIdx)}
              onSwapExercise={structureLocked ? undefined : (_oldName, newName) => handleSwapExercise(fsKey, newName)}
              onAddExercise={structureLocked ? undefined : (name) => handleAddExercise(name, fullScreenIdx)}
              onDeleteExercise={structureLocked ? undefined : () => handleDeleteExercise(fsKey)}
              note={notes[fsKey] || ''}
              onNoteChange={inputsLocked ? undefined : (_name, value) => handleNoteChange(fsKey, value)}
              weightSuggestion={inputsLocked ? undefined : weightSuggestions[fsExercise.name]}
              onApplySuggestion={inputsLocked ? undefined : (_exName, weight) => {
                setEntries(prev => {
                  const updated = { ...prev };
                  updated[fsKey] = (updated[fsKey] || []).map((e, i) => {
                    const k = `${fsKey}-${i}`;
                    if (completedSets.has(k)) return e;
                    return { ...e, weight };
                  });
                  return updated;
                });
                setWeightSuggestions(prev => { const next = { ...prev }; delete next[fsExercise.name]; return next; });
              }}
              onApplyCalculatedWeight={inputsLocked ? undefined : ((_n, weight) => handleApplyCalculatedWeight(fsKey, weight))}
              goalOverrides={goalOverrides[fsKey]}
              onGoalChange={inputsLocked ? undefined : ((_n, setIdx, field, value) => handleGoalChange(fsKey, setIdx, field, value))}
              allWorkoutExercises={template.exercises.map(e => e.name)}
              lastEntries={lastSession[fsExercise.name]}
              forceShowDemo={showAllDemos}
              showGoalWeight={tutorialMode ? true : showGoalWeight}
              showGoalReps={tutorialMode ? true : showGoalReps}
              showSetType={tutorialMode ? true : showSetType}
              exerciseNumber={fsPos + 1}
              cardioEnabled={cardioEnabled}
              cardioSelections={cardioSelections}
              onCardioChange={((_n, ...args) => handleCardioChange(fsKey, ...args))}
              cardTheme={cardTheme}
              onOpenSupersetPicker={structureLocked ? undefined : (key) => setSupersetPicker({ exerciseKey: key })}
              /* No onEnterFullScreen here — already in full-screen mode.
                  Hides the viewfinder button on the card so the user doesn't
                  see a no-op control. */
            />
          </div>
        </div>,
        document.body
      )}
      {/* Dark-card mode swaps the page bg to the same gray (#e8e8e8) that
          light-mode cards use, so the surface and the cards trade places.
          Fixed + pointer-events-none + z-index: -1 so it sits behind every
          piece of normal-flow content on this page (buttons, panels, etc.)
          without intercepting taps. zIndex: 0 here was the previous value,
          which painted the overlay ABOVE static-flow elements and hid the
          Add Exercise / Add Cardio / Total Volume / Mark Complete buttons.
          The wf-dark-cards class on the root scopes overrides for sticky-
          header chrome and exercise name text color (see index.css). */}
      {cardTheme === 'dark' && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: '#e8e8e8', zIndex: -1 }}
          aria-hidden="true"
        />
      )}
      {/* PB Celebration */}
      {newPBs && (
        <PBCelebration
          prs={newPBs}
          onDismiss={() => setNewPBs(null)}
        />
      )}

      {UnsavedModal}
      {showDateConfirm && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-5"
          onClick={() => setShowDateConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-date-confirm-title"
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            ref={dateConfirmTrapRef}
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ws-date-confirm-title" className="text-base font-bold text-white text-center mb-1">Different Date</h3>
            <p className="text-wf-gray-400 text-sm text-center mb-5">
              This workout is scheduled for {format(parseDateLocal(date), 'MMMM d, yyyy')}. Are you sure you want to start it now?
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
        </div>,
        document.body
      )}

      {pendingSwap && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-5"
          onClick={() => setPendingSwap(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-pending-swap-title"
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            ref={pendingSwapTrapRef}
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ws-pending-swap-title" className="text-base font-bold text-white text-center mb-1">Substitute Exercise</h3>
            <p className="text-wf-gray-400 text-sm text-center mb-5">
              Substituting this exercise will remove your saved sets for {exNameFromKey(pendingSwap.oldName)}. You can undo this.
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
        </div>,
        document.body
      )}
      {/* Back button + Day navigation arrows */}
      <div className="px-4 pt-6 flex items-center justify-between">
        <button data-tutorial="exit-workout" onClick={() => tutorialMode ? navigate('/app') : guardedNavigate(() => navigate(-1))} className="flex items-center gap-1 text-[11px] uppercase font-bold mb-2 active:opacity-70" style={{ color: 'rgba(239,68,68,0.9)', letterSpacing: '0.2em' }}>
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
              aria-label="Previous day"
              className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px] ${hasPrev && !dayNavDisabled ? 'bg-white/10 text-white' : 'bg-white/5 text-wf-gray-600 cursor-default opacity-50'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-xs text-wf-gray-400 font-medium min-w-[60px] text-center">{displayDate.split(',')[0]}</span>
            <button
              onClick={() => hasNext && !dayNavDisabled && navigateToDay(nextDate)}
              disabled={!hasNext || dayNavDisabled}
              aria-label="Next day"
              className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px] ${hasNext && !dayNavDisabled ? 'bg-white/10 text-white' : 'bg-white/5 text-wf-gray-600 cursor-default opacity-50'}`}
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
        title={template.name.toUpperCase()}
        titleStyle={{ fontSize: '26.4px' }}
        titleCentered
        subtitle={`${displayDate}${template.description ? ` · ${template.description}` : ''}`}
        bottomContent={(collapsed) =>
          <div className="mt-2 space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-wf-gray-400 font-medium">Progress</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-wf-gray-400 font-medium tabular-nums">
                    {completedCount}/{totalSets} sets
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: 'rgba(239,68,68,0.9)' }}>
                    {progressPct}%
                  </span>
                </div>
              </div>
              <div className="h-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '2px' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.6))', borderRadius: '2px' }}
                />
              </div>
            </div>
            {!timerStarted ? (
              <>
                <button
                  data-tutorial="begin-workout-btn"
                  onClick={handleBeginWorkout}
                  className="active:scale-[0.98] transition-all w-full mt-1"
                  style={{
                    padding: '14px', borderRadius: '2px', border: 'none',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
                    color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    letterSpacing: '0.25em', textTransform: 'uppercase',
                    boxShadow: '0 4px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  Begin Workout
                </button>
                <button
                  onClick={() => setShowPrebeginSummary(true)}
                  className="active:scale-[0.97] transition-all w-full mt-2"
                  style={{
                    padding: '12px', borderRadius: '2px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.85)', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                    letterSpacing: '0.25em', textTransform: 'uppercase',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  View Summary
                </button>
              </>
            ) : (
              <div className="mt-2">
                <div
                  data-tutorial="workout-timer"
                  className={`overflow-hidden relative transition-all duration-300 ${collapsed && !pinWorkoutTimer ? 'hidden' : ''}`}
                  style={{
                    borderRadius: '2px',
                    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Top accent bar — light gray fading right (matches weekly calendar day cards, distinguishes from red progress bar) */}
                  <div style={{ height: '3px', background: 'linear-gradient(90deg, #9ca3af, #9ca3af80, transparent)' }} />
                  <div className="relative px-4 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.7)' }} />
                      <span className="text-[10px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.8)', letterSpacing: '0.3em' }}>Workout</span>
                      <span style={{ fontSize: '22px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{formatTime(elapsed)}</span>
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
                      onClick={() => setPinWorkoutTimer((p) => {
                        const v = !p;
                        try { localStorage.setItem('wf-default-pin-workout-timer', JSON.stringify(v)); } catch {}
                        return v;
                      })}
                      aria-label={pinWorkoutTimer ? 'Unlock timer' : 'Lock timer'}
                      className="w-6 h-6 flex items-center justify-center active:scale-90 transition-all"
                      style={{ color: pinWorkoutTimer ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.4)' }}
                    >
                      {pinWorkoutTimer ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      )}
                    </button>
                    </div>
                  </div>
                </div>
                <div
                  data-tutorial="rest-timer"
                  className={`overflow-hidden relative transition-all duration-300 mt-1.5 ${collapsed && !pinRestTimer ? 'hidden' : ''}`}
                  style={{
                    borderRadius: '2px',
                    background: 'linear-gradient(160deg, #1a1a1a 0%, #111111 100%)',
                    // Green inset ring + soft green glow when rest has finished
                    boxShadow: restRemaining !== null && restRemaining <= 0
                      ? '0 8px 24px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 0 1px rgba(34,197,94,0.5)'
                      : '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Progress bar at top — visible only while counting down (Nike style: subtle track, red gradient fill) */}
                  {restRemaining !== null && restRemaining > 0 && (
                    <div className="h-[2px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="h-full transition-all duration-1000 ease-linear"
                        style={{
                          width: `${(restRemaining / restDuration) * 100}%`,
                          background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.6))',
                        }}
                      />
                    </div>
                  )}
                  <div className="relative px-4 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: restRemaining !== null && restRemaining > 0 ? '#ef4444'
                            : restRemaining !== null && restRemaining <= 0 ? '#22c55e'
                            : '#333',
                          boxShadow: restRemaining !== null && restRemaining > 0 ? '0 0 8px rgba(239,68,68,0.7)'
                            : restRemaining !== null && restRemaining <= 0 ? '0 0 8px rgba(34,197,94,0.8)'
                            : 'none',
                        }}
                      />
                      <span className="text-[10px] uppercase font-light" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.3em' }}>Rest</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {restRemaining !== null && restRemaining > 0 ? (
                        <>
                          <span style={{ fontSize: '18px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>{formatTime(restRemaining)}</span>
                          {/* Skip button — stops rest + brings dropdown back */}
                          <button
                            onClick={stopRestTimer}
                            className="active:scale-[0.95] transition-all"
                            style={{
                              padding: '4px 10px', borderRadius: '2px',
                              fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
                              textTransform: 'uppercase',
                              border: '1px solid rgba(255,255,255,0.12)',
                              background: 'rgba(255,255,255,0.04)',
                              color: 'rgba(255,255,255,0.55)',
                              cursor: 'pointer',
                            }}
                          >
                            Skip
                          </button>
                        </>
                      ) : restRemaining !== null && restRemaining <= 0 ? (
                        <>
                          {/* Rest complete — GO badge + Dismiss */}
                          <span
                            style={{
                              padding: '4px 14px', borderRadius: '2px',
                              fontSize: '14px', fontWeight: 800, letterSpacing: '0.25em',
                              textTransform: 'uppercase',
                              border: '1px solid rgba(34,197,94,0.5)',
                              background: 'rgba(34,197,94,0.15)',
                              color: 'rgba(34,197,94,0.95)',
                              textShadow: '0 0 10px rgba(34,197,94,0.5)',
                            }}
                          >
                            Go
                          </span>
                          <button
                            onClick={stopRestTimer}
                            className="active:scale-[0.95] transition-all"
                            style={{
                              padding: '4px 10px', borderRadius: '2px',
                              fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
                              textTransform: 'uppercase',
                              border: '1px solid rgba(255,255,255,0.12)',
                              background: 'rgba(255,255,255,0.04)',
                              color: 'rgba(255,255,255,0.55)',
                              cursor: 'pointer',
                            }}
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {/* Nike-style duration dropdown — 15s to 3min in 15s increments */}
                          <select
                            value={restDuration}
                            onChange={(e) => {
                              const s = Number(e.target.value);
                              setRestDuration(s);
                              restDurationRef.current = s;
                            }}
                            className="active:scale-[0.95] transition-all"
                            style={{
                              padding: '4px 22px 4px 10px', borderRadius: '2px',
                              fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
                              textTransform: 'uppercase',
                              border: '1px solid rgba(239,68,68,0.4)',
                              background: 'rgba(239,68,68,0.12)',
                              color: 'rgba(239,68,68,0.9)',
                              cursor: 'pointer',
                              outline: 'none',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                              backgroundImage: 'linear-gradient(45deg, transparent 50%, rgba(239,68,68,0.9) 50%), linear-gradient(135deg, rgba(239,68,68,0.9) 50%, transparent 50%)',
                              backgroundPosition: 'calc(100% - 10px) 50%, calc(100% - 6px) 50%',
                              backgroundSize: '4px 4px, 4px 4px',
                              backgroundRepeat: 'no-repeat',
                            }}
                          >
                            {REST_OPTIONS.map((s) => (
                              <option key={s} value={s} className="bg-wf-gray-900">
                                {s >= 60 ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : `${s}s`}
                              </option>
                            ))}
                          </select>
                          {/* Start button */}
                          <button
                            onClick={startRestTimer}
                            className="active:scale-[0.95] transition-all"
                            style={{
                              padding: '4px 12px', borderRadius: '2px',
                              fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
                              textTransform: 'uppercase', border: 'none',
                              background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
                              color: 'white',
                              boxShadow: '0 2px 8px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                              cursor: 'pointer',
                            }}
                          >
                            Start
                          </button>
                        </div>
                      )}
                      {/* Pop-out */}
                      <button onClick={() => setRestFloating(true)} aria-label="Pop out rest timer" className="w-6 h-6 flex items-center justify-center active:scale-90 transition-all" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5H1v14h18v-6M15 3h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      {/* Lock toggle */}
                      <button onClick={() => setPinRestTimer((p) => { const v = !p; try { localStorage.setItem('wf-default-pin-rest-timer', JSON.stringify(v)); } catch {} return v; })} aria-label={pinRestTimer ? 'Unlock rest timer' : 'Lock rest timer'} className="w-6 h-6 flex items-center justify-center active:scale-90 transition-all" style={{ color: pinRestTimer ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.4)' }}>
                        {pinRestTimer ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      >
        {/* Settings gear — sits in the header row on the same line as the date */}
        <div className="relative shrink-0">
          <button
            data-tutorial="session-settings"
            onClick={() => setShowSessionMenu(!showSessionMenu)}
            aria-label="Session settings"
            className="relative w-[35px] h-[35px] rounded-full flex items-center justify-center text-wf-gray-400 active:bg-white/10 transition-colors before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]"
          >
            <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showSessionMenu && createPortal(
            <>
              {/* Backdrop + menu portaled to body so they escape the
                  .sticky-header (z-30) stacking context — otherwise the
                  floating workout/rest timers (fixed z-50 in body's context)
                  would sit on top of the menu. Position the menu off the
                  gear's bounding rect since we're no longer the gear's
                  positioned ancestor. */}
              <div className="fixed inset-0 z-[95]" onClick={() => setShowSessionMenu(false)} />
              <div
                className="fixed z-[96] w-52 rounded-xl bg-wf-gray-900 border border-white/10 shadow-2xl overflow-hidden"
                style={sessionMenuPos}
              >
                <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[9px] text-wf-gray-500 uppercase tracking-wider font-semibold">Display</span>
                  <button
                    onClick={() => setShowSessionMenu(false)}
                    aria-label="Close display settings"
                    className="w-5 h-5 rounded-full flex items-center justify-center text-wf-gray-500 active:bg-white/10 active:scale-90 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => { const v = !showGoalWeight; setShowGoalWeight(v); try { localStorage.setItem('wf-default-show-goal-weight', JSON.stringify(v)); } catch {} }}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-sm text-white active:bg-white/5 transition-colors"
                >
                  <span>Goal Weight</span>
                  <div className={`w-[37px] h-[23px] rounded-full transition-colors ${showGoalWeight ? 'bg-wf-red' : 'bg-wf-gray-600'}`}>
                    <div className={`w-[19px] h-[19px] rounded-full bg-white mt-0.5 transition-transform ${showGoalWeight ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <button
                  onClick={() => { const v = !showGoalReps; setShowGoalReps(v); try { localStorage.setItem('wf-default-show-goal-reps', JSON.stringify(v)); } catch {} }}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-sm text-white active:bg-white/5 transition-colors"
                >
                  <span>Goal Reps</span>
                  <div className={`w-[37px] h-[23px] rounded-full transition-colors ${showGoalReps ? 'bg-wf-red' : 'bg-wf-gray-600'}`}>
                    <div className={`w-[19px] h-[19px] rounded-full bg-white mt-0.5 transition-transform ${showGoalReps ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <button
                  onClick={() => { const v = !showSetType; setShowSetType(v); try { localStorage.setItem('replab_show_set_type', JSON.stringify(v)); } catch {} }}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-sm text-white active:bg-white/5 transition-colors"
                >
                  <span>Set Type</span>
                  <div className={`w-[37px] h-[23px] rounded-full transition-colors ${showSetType ? 'bg-wf-red' : 'bg-wf-gray-600'}`}>
                    <div className={`w-[19px] h-[19px] rounded-full bg-white mt-0.5 transition-transform ${showSetType ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                {/* Light/Dark card-theme toggle — switches the exercise-card
                    background between the light (#e8e8e8) and dark (transparent
                    over page bg) treatments. Off = light, on = dark. */}
                <button
                  onClick={() => {
                    const v = cardTheme === 'dark' ? 'light' : 'dark';
                    setCardTheme(v);
                    try { localStorage.setItem('wf-default-card-theme', v); } catch {}
                  }}
                  className="w-full px-3 py-2.5 flex items-center justify-between text-sm text-white active:bg-white/5 transition-colors border-t border-white/5"
                >
                  <span>{cardTheme === 'dark' ? 'Light Cards' : 'Dark Cards'}</span>
                  <div className={`w-[37px] h-[23px] rounded-full transition-colors ${cardTheme === 'dark' ? 'bg-wf-red' : 'bg-wf-gray-600'}`}>
                    <div className={`w-[19px] h-[19px] rounded-full bg-white mt-0.5 transition-transform ${cardTheme === 'dark' ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      </StickyHeader>

      {/* Status Banner + View Summary — Nike panels with their own opaque
          black-gradient backgrounds so they stay legible in both light-card
          and dark-card modes (the previous translucent red/10 + green/10
          tints washed out when the page bg flipped to light gray). */}
      {isCompleted && (
        <div className="px-4 mb-3 space-y-2">
          <button
            onClick={() => setShowSummary(true)}
            className="w-full px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              borderLeft: '3px solid #ef4444',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(239,68,68,0.10) 100%)',
                borderRadius: '2px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(239,68,68,0.20)',
              }}>
                <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <span className="text-[13px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>
                View Workout Summary
              </span>
            </div>
            <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <div
            className="px-4 py-3"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              borderLeft: '3px solid #22c55e',
            }}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.10) 100%)',
                borderRadius: '2px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(34,197,94,0.20)',
              }}>
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-[13px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>
                Workout Complete
              </span>
            </div>
            <p className="text-[11px] text-white/40 font-light mt-0.5 ml-12 leading-relaxed">
              Scroll down and tap Undo Completion to edit.
            </p>
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
        {(() => { let visibleIdx = 0; return template.exercises.map((exercise, idx) => {
          if (!exercise.isSectionHeader) visibleIdx++;
          const exerciseNumber = visibleIdx;
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
            <div className="fade-slide-up mb-3 mt-2" style={{ animationDelay: `${idx * 60}ms` }}>
              {/* Long-press (500ms, cancelled on lift/move) opens the
                  edit-or-delete modal. Movement during press cancels so
                  scroll gestures don't trigger an edit. Read-only when
                  structureLocked (completed sessions). */}
              <div
                className="overflow-hidden"
                style={{
                  borderRadius: '2px',
                  background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                  position: 'relative',
                  cursor: structureLocked ? 'default' : 'pointer',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
                onPointerDown={structureLocked ? undefined : () => {
                  sectionLongPressTimerRef.current = setTimeout(() => {
                    setSectionEditing({ idx, name: exercise.name, notes: exercise.sectionNotes || '' });
                    setSectionDeleteConfirming(false);
                  }, 500);
                }}
                onPointerUp={() => { if (sectionLongPressTimerRef.current) { clearTimeout(sectionLongPressTimerRef.current); sectionLongPressTimerRef.current = null; } }}
                onPointerMove={() => { if (sectionLongPressTimerRef.current) { clearTimeout(sectionLongPressTimerRef.current); sectionLongPressTimerRef.current = null; } }}
                onPointerCancel={() => { if (sectionLongPressTimerRef.current) { clearTimeout(sectionLongPressTimerRef.current); sectionLongPressTimerRef.current = null; } }}
                onPointerLeave={() => { if (sectionLongPressTimerRef.current) { clearTimeout(sectionLongPressTimerRef.current); sectionLongPressTimerRef.current = null; } }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* Red top accent bar */}
                <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4), transparent)' }} />
                {/* Ambient red spotlight */}
                <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

                <div className="relative px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.7)', letterSpacing: '0.3em' }}>Section</span>
                    <span className="text-[16px] font-black text-white uppercase tracking-tight" style={{ fontFamily: 'system-ui' }}>{exercise.name}</span>
                  </div>
                  {exercise.sectionNotes && (
                    <p className="text-[11px] font-light mt-2" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{exercise.sectionNotes}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
          <div ref={(el) => { exerciseRefs.current[eKey] = el; if (el && scrollToExercise.current === idx) { scrollToExercise.current = null; setTimeout(() => { const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2); const start = window.scrollY; const dist = target - start; const duration = 600; let t0 = null; function step(ts) { if (!t0) t0 = ts; const p = Math.min((ts - t0) / duration, 1); const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; window.scrollTo(0, start + dist * ease); if (p < 1) requestAnimationFrame(step); } requestAnimationFrame(step); }, 50); } }} className="fade-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
            <ExerciseCard
              exercise={exercise}
              exerciseKey={eKey}
              entries={entries[eKey]}
              pbs={pbs}
              readOnly={structureLocked}
              inputsLocked={inputsLocked}
              onShowPRs={(name) => { setPrModalSort('weight'); setPrModalExercise(name); }}
              onLockedTap={inputsLocked ? () => setShowBeginPrompt(true) : undefined}
              onChange={inputsLocked ? undefined : wrapCb(handleChange)}
              onBlur={inputsLocked ? undefined : wrapCb(handleBlur)}
              completedSets={completedSets}
              autoFilled={autoFilled}
              onToggleComplete={completionLocked ? () => setShowBeginPrompt(true) : wrapCb(handleToggleComplete)}
              onAddSet={structureLocked ? undefined : wrapCb(handleAddSet)}
              onDeleteSet={structureLocked ? undefined : wrapCb(handleDeleteSet)}
              onReorderSets={structureLocked ? undefined : (fromIdx, toIdx) => handleReorderSets(eKey, fromIdx, toIdx)}
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
                  updated[eKey] = (updated[eKey] || []).map((e, i) => {
                    const k = `${eKey}-${i}`;
                    // Skip sets that are already completed
                    if (completedSets.has(k)) return e;
                    return { ...e, weight };
                  });
                  return updated;
                });
                setWeightSuggestions(prev => { const next = { ...prev }; delete next[exercise.name]; return next; });
              }}
              onApplyCalculatedWeight={inputsLocked ? undefined : ((_n, weight) => handleApplyCalculatedWeight(eKey, weight))}
              goalOverrides={goalOverrides[eKey]}
              onGoalChange={inputsLocked ? undefined : ((_n, setIdx, field, value) => handleGoalChange(eKey, setIdx, field, value))}
              allWorkoutExercises={template.exercises.map(e => e.name)}
              lastEntries={lastSession[exercise.name]}
              forceShowDemo={showAllDemos}
              dataTutorial={tutorialMode && idx === 1 ? 'exercise-header' : undefined}
              showGoalWeight={tutorialMode ? true : showGoalWeight}
              showGoalReps={tutorialMode ? true : showGoalReps}
              showSetType={tutorialMode ? true : showSetType}
              exerciseNumber={exerciseNumber}
              cardioEnabled={cardioEnabled}
              cardioSelections={cardioSelections}
              onCardioChange={wrapCb(handleCardioChange)}
              cardTheme={cardTheme}
              onEnterFullScreen={() => setFullScreenIdx(idx)}
              onOpenSupersetPicker={structureLocked ? undefined : (key) => setSupersetPicker({ exerciseKey: key })}
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
          {/* Begin Workout prompt popup — Nike style: eyebrow + display title,
              red accent stripe, ambient red spotlight, sharp 2px corners. */}
      {showBeginPrompt && idx === 0 && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center pt-24 px-5"
          onClick={() => setShowBeginPrompt(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-begin-prompt-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            ref={beginPromptTrapRef}
            className="relative w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
            <div
              className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }}
            />

            <div className="relative px-6 pt-6 pb-2">
              <p className="text-[10px] text-white/30 uppercase font-light" style={{ letterSpacing: '0.3em' }}>
                {isCompleted ? 'Session Complete' : 'Heads Up'}
              </p>
              <h2
                id="ws-begin-prompt-title"
                className="text-[26px] font-black text-white tracking-tight mt-1 uppercase"
                style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}
              >
                {isCompleted ? 'Edit Locked' : 'Start Logging Sets'}
              </h2>
            </div>

            <div className="relative px-6 pb-5 pt-3">
              <p className="text-[13px] text-white/55 leading-relaxed">
                {isCompleted
                  ? 'Scroll down and tap Undo Completion to edit this session.'
                  : (
                    <>
                      Tap <span className="text-white font-semibold">Begin Workout</span> to start your session timer and unlock set completion.
                    </>
                  )}
              </p>
            </div>

            <div className="relative px-4 pb-4 space-y-2">
              {/* Primary CTA: Begin Workout — fires handleBeginWorkout and
                  closes the prompt in one tap (was previously a two-step
                  flow where "Got It" closed the prompt without starting,
                  then the user had to find the Begin Workout button on the
                  card header). Secondary slot is Cancel. For the
                  isCompleted case there's no session to begin, so a single
                  "Got It" ack button suffices. */}
              {!isCompleted ? (
                <>
                  <button
                    onClick={() => {
                      setShowBeginPrompt(false);
                      handleBeginWorkout();
                    }}
                    className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all"
                    style={{
                      letterSpacing: '0.15em',
                      fontSize: '11px',
                      padding: '14px',
                      borderRadius: '2px',
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                    }}
                  >
                    Begin Workout
                  </button>
                  <button
                    onClick={() => setShowBeginPrompt(false)}
                    className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all border border-white/15 hover:border-white/30"
                    style={{
                      letterSpacing: '0.15em',
                      fontSize: '11px',
                      padding: '14px',
                      borderRadius: '2px',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowBeginPrompt(false)}
                  className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all"
                  style={{
                    letterSpacing: '0.15em',
                    fontSize: '11px',
                    padding: '14px',
                    borderRadius: '2px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  Got It
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Section header edit modal — opened by long-press on a section
          header. Lets the user rename, edit notes, or delete the section.
          Delete is two-step (tap → "Tap again to confirm" → tap → delete)
          so a single mistap can't drop a section. Tap outside closes; tap
          inside doesn't (e.stopPropagation on the inner panel). */}
      {sectionEditing && idx === 0 && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-5"
          onClick={() => { setSectionEditing(null); setSectionDeleteConfirming(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-section-edit-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
            <div
              className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }}
            />

            <div className="relative px-6 pt-6 pb-2">
              <p className="text-[10px] text-white/30 uppercase font-light" style={{ letterSpacing: '0.3em' }}>
                Section
              </p>
              <h2
                id="ws-section-edit-title"
                className="text-[22px] font-black text-white tracking-tight mt-1 uppercase"
                style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}
              >
                Edit Section
              </h2>
            </div>

            <div className="relative px-5 pb-3 pt-4 space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.22em' }}>
                  Name
                </p>
                <input
                  type="text"
                  value={sectionEditing.name}
                  onChange={(e) => setSectionEditing((prev) => ({ ...prev, name: e.target.value }))}
                  autoFocus
                  className="w-full text-white placeholder:text-white/30 text-sm bg-transparent focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '2px',
                    padding: '12px 14px',
                  }}
                />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.22em' }}>
                  Notes
                </p>
                <textarea
                  value={sectionEditing.notes}
                  onChange={(e) => setSectionEditing((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional"
                  rows={3}
                  className="w-full text-white placeholder:text-white/30 text-sm bg-transparent focus:outline-none resize-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '2px',
                    padding: '12px 14px',
                  }}
                />
              </div>
            </div>

            <div className="relative px-4 pb-4 space-y-2">
              {/* Move Up / Move Down — reorder the section within the
                  exercises array. Move Down is bounded by the last
                  exercise index so the section can never end up after the
                  Add Exercise button (which lives outside the array).
                  Each tap updates sectionEditing.idx so subsequent moves
                  step through the list while the modal stays open.
                  Movement triggers structureSaveNeeded via handleMoveExercise. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const from = sectionEditing.idx;
                    const to = from - 1;
                    if (to < 0) return;
                    handleMoveExercise(from, to);
                    setSectionEditing((prev) => ({ ...prev, idx: to }));
                  }}
                  disabled={sectionEditing.idx === 0}
                  aria-label="Move section up"
                  className="font-bold uppercase active:scale-[0.98] transition-all border border-white/15 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    letterSpacing: '0.15em',
                    fontSize: '11px',
                    padding: '14px',
                    borderRadius: '2px',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                  Move Up
                </button>
                <button
                  onClick={() => {
                    const from = sectionEditing.idx;
                    const to = from + 1;
                    if (to >= template.exercises.length) return;
                    handleMoveExercise(from, to);
                    setSectionEditing((prev) => ({ ...prev, idx: to }));
                  }}
                  disabled={sectionEditing.idx >= template.exercises.length - 1}
                  aria-label="Move section down"
                  className="font-bold uppercase active:scale-[0.98] transition-all border border-white/15 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    letterSpacing: '0.15em',
                    fontSize: '11px',
                    padding: '14px',
                    borderRadius: '2px',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  Move Down
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => handleSaveSection(sectionEditing.idx, sectionEditing.name, sectionEditing.notes)}
                disabled={!sectionEditing.name.trim()}
                className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                Save
              </button>
              <button
                onClick={() => { setSectionEditing(null); setSectionDeleteConfirming(false); }}
                className="w-full font-bold uppercase active:scale-[0.98] transition-all border border-white/15 hover:border-white/30"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (sectionDeleteConfirming) {
                    handleDeleteSection(sectionEditing.idx);
                  } else {
                    setSectionDeleteConfirming(true);
                  }
                }}
                className="w-full font-bold uppercase active:scale-[0.98] transition-all"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  background: sectionDeleteConfirming ? 'rgba(239,68,68,0.18)' : 'transparent',
                  border: '1px solid rgba(239,68,68,0.45)',
                  color: '#fca5a5',
                }}
              >
                {sectionDeleteConfirming ? 'Tap Again to Confirm Delete' : 'Delete Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-exercise PR popup — opened from the PRs button at the top of
          each exercise card. Mirrors the Personal Records list on the home
          page (sticky header, Weight/Volume toggle, ranked rows). Scoped
          to a single exercise and capped at top 10 lifts so users can
          quickly reference previous bests mid-session. */}
      {prModalExercise && idx === 0 && (() => {
        const byVolume = prModalSort === 'volume';
        const lifts = (allTimePRs || [])
          .filter((r) => (r.exercise_name || '').toLowerCase() === prModalExercise.toLowerCase())
          .map((r) => {
            const w = Number(r.best_weight) || 0;
            const reps = Number(r.best_reps) || 0;
            return { weight: w, reps, volume: w * reps, achievedAt: r.achieved_at };
          })
          .sort((a, b) => {
            const primary = byVolume ? b.volume - a.volume : (b.weight - a.weight || b.reps - a.reps);
            // Stable tiebreak on achievedAt (newest first) so rows with identical
            // (weight, reps) don't swap positions on re-render.
            return primary || (new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
          })
          .slice(0, 10);
        // Portal to document.body so the modal can sit above the full-screen
        // overlay (also portaled to body at z-90). Without the portal it
        // renders inside the React tree, which gets stacked below the body-
        // level overlay regardless of z-index.
        return createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center px-4"
            onClick={() => setPrModalExercise(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ws-pr-modal-title"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              ref={prModalTrapRef}
              className="relative w-full max-w-md max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
              style={{
                borderRadius: '20px',
                overflow: 'hidden',
                background: '#111',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {/* Sticky header — matches the home-page Personal Records card */}
              <div
                style={{
                  padding: '17px 20px 12px',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: '12px',
                  background: '#111',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="min-w-0">
                  <p style={{
                    fontSize: '9px', color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600,
                    margin: 0,
                  }}>
                    Personal Records
                  </p>
                  <h3 id="ws-pr-modal-title" className="text-white font-bold text-[15px] mt-1 truncate">{prModalExercise}</h3>
                </div>
                <button
                  onClick={() => setPrModalExercise(null)}
                  aria-label="Close"
                  className="shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sort toggle */}
              <div style={{
                padding: '10px 20px',
                background: '#111',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '100px',
                  padding: '2px',
                  gap: '2px',
                }}>
                  {['weight', 'volume'].map((mode) => {
                    const active = prModalSort === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setPrModalSort(mode)}
                        style={{
                          flex: 1, padding: '6px 0', borderRadius: '100px',
                          fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em',
                          textTransform: 'uppercase', cursor: 'pointer',
                          border: 'none', transition: 'all 0.18s ease',
                          background: active ? 'rgba(239,68,68,0.9)' : 'transparent',
                          color: active ? 'white' : 'rgba(255,255,255,0.45)',
                          boxShadow: active ? '0 2px 8px rgba(239,68,68,0.3)' : 'none',
                        }}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable list — top 10 best lifts */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {lifts.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                      No personal records yet for this exercise.
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
                      Complete a set with weight and reps to start tracking PRs.
                    </p>
                  </div>
                ) : (
                  lifts.map((lift, i) => (
                    <div
                      key={`${lift.weight}-${lift.reps}-${i}`}
                      style={{
                        padding: '12px 20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: i < lifts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 800,
                          color: i === 0 ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.2)',
                          letterSpacing: '1px',
                          width: '22px', textAlign: 'center',
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{
                          fontSize: '13px', color: 'rgba(255,255,255,0.9)',
                          fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {lift.weight} lbs × {lift.reps}
                          {byVolume && (
                            <span style={{ color: 'rgba(239,68,68,0.7)', marginLeft: '8px', fontWeight: 700 }}>
                              = {lift.volume.toLocaleString()}
                            </span>
                          )}
                        </span>
                      </div>
                      {lift.achievedAt && (
                        <span style={{
                          fontSize: '10px', color: 'rgba(255,255,255,0.3)',
                          letterSpacing: '1px', textTransform: 'uppercase',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {new Date(lift.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Pre-Begin Workout Summary — condensed list of exercise name + set
          count so users can scan the session without scrolling through
          every card. Only shown before Begin Workout (set-count is the
          stable-pre-session view; mid-session users care about live
          progress, not structure). */}
      {showPrebeginSummary && idx === 0 && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
          onClick={() => { setShowPrebeginSummary(false); setExpandedOverviewExIdx(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-prebegin-summary-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            ref={prebeginSummaryTrapRef}
            className="relative w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
            <div
              className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }}
            />

            <div className="relative px-6 pt-6 pb-3 shrink-0">
              <p className="text-[10px] text-white/30 uppercase font-light" style={{ letterSpacing: '0.3em' }}>
                Workout Overview
              </p>
              <h2
                id="ws-prebegin-summary-title"
                className="text-[22px] font-black text-white tracking-tight mt-1 uppercase"
                style={{ fontFamily: 'system-ui', lineHeight: '1' }}
              >
                {template.name || 'Today’s Workout'}
              </h2>
            </div>

            <div className="relative flex-1 overflow-y-auto px-6 pb-2 border-t border-white/5">
              {template.exercises.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-white/40">No exercises yet.</p>
              ) : (
                template.exercises.map((ex, exIdx) => {
                  if (ex.isSectionHeader) {
                    return (
                      <div key={exIdx} className="pt-4 pb-2 border-b border-white/5">
                        <p className="text-[10px] uppercase font-bold" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.25em' }}>
                          {ex.name}
                        </p>
                      </div>
                    );
                  }
                  const isExpanded = expandedOverviewExIdx === exIdx;
                  return (
                    <div key={exIdx} className="border-b border-white/5">
                      <button
                        type="button"
                        onClick={() => setExpandedOverviewExIdx(isExpanded ? null : exIdx)}
                        aria-expanded={isExpanded}
                        className="w-full py-3 flex items-center justify-between text-left active:bg-white/5 transition-colors"
                      >
                        <span className="text-[14px] text-white font-semibold flex-1 truncate pr-3">
                          {ex.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-white/50 font-bold whitespace-nowrap" style={{ letterSpacing: '0.1em' }}>
                            {ex.sets.length} {ex.sets.length === 1 ? 'set' : 'sets'}
                          </span>
                          <svg
                            className="w-4 h-4 transition-transform"
                            style={{ color: '#ef4444', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="pb-3 pl-1">
                          {ex.sets.map((s, sIdx) => {
                            const reps = s.plannedReps != null ? s.plannedReps : '—';
                            const weight = Number(s.suggestedWeight) || 0;
                            return (
                              <div
                                key={sIdx}
                                className="py-1 flex items-baseline gap-3"
                                style={{ color: 'rgba(239,68,68,0.9)' }}
                              >
                                <span
                                  className="text-[10px] font-bold uppercase opacity-70 shrink-0"
                                  style={{ letterSpacing: '0.15em', minWidth: '46px' }}
                                >
                                  Set {sIdx + 1}
                                </span>
                                <span className="text-[12px] font-semibold tabular-nums">
                                  {reps} {reps === 1 ? 'rep' : 'reps'}{weight > 0 ? ` × ${weight} lbs` : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="relative px-4 pt-3 pb-4 shrink-0">
              <button
                onClick={() => { setShowPrebeginSummary(false); setExpandedOverviewExIdx(null); }}
                className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {undoToast && undoToast.type === 'exercise' && undoToast.exerciseIndex >= template.exercises.length && idx === template.exercises.length - 1 && (
            <div className="fixed bottom-32 left-4 right-4 z-50">
              <UndoToast
                message={undoToast.message}
                onUndo={() => { undoToast.undoFn(); setUndoToast(null); }}
                onExpire={() => setUndoToast(null)}
              />
            </div>
          )}
          </div>
        );
        }); })()}

        {/* Add Exercise Button */}
        {!structureLocked && (
          <button
            onClick={() => { setShowAddExercise(true); setAddExerciseSearch(''); setAddExerciseMuscleFilter('all'); }}
            className="w-full border border-dashed rounded-xl py-3.5 text-sm font-medium active:border-wf-red active:text-wf-red transition-colors flex items-center justify-center gap-2 mb-3"
            style={cardTheme === 'dark' ? {
              borderColor: 'rgba(0,0,0,0.45)',
              color: 'rgba(0,0,0,0.80)',
            } : {
              borderColor: 'rgba(255,255,255,0.40)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Exercise
          </button>
        )}

        {/* Add Section Header Button — sits between Add Exercise and Add
            Cardio. Section headers are organizational dividers used to
            group exercises (supersets, warmup, main lifts). Neutral
            border + label so it visually reads as "structural" rather
            than action-y like Exercise (red on press) or Cardio (cyan). */}
        {!structureLocked && (
          <button
            onClick={() => { setShowAddSection(true); setAddSectionName(''); }}
            className="w-full border border-dashed rounded-xl py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-3"
            style={cardTheme === 'dark' ? {
              borderColor: 'rgba(0,0,0,0.30)',
              color: 'rgba(0,0,0,0.60)',
            } : {
              borderColor: 'rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
            </svg>
            Add Section Header
          </button>
        )}

        {/* Cardio section — saved entries render here, Add Cardio button at
            the bottom. Hidden during read-only mode (e.g., reviewing a
            completed session) since the user shouldn't be modifying it. */}
        {!structureLocked && (
          <>
            {cardioEntries.length > 0 && (
              <div className="mt-1">
                <div className="text-[10px] uppercase tracking-widest text-cyan-300/60 font-semibold mb-2 px-1">Cardio</div>
                {cardioEntries.map((c) => (
                  <CardioCard
                    key={c.id}
                    entry={c}
                    onDelete={() => handleDeleteCardio(c.id)}
                  />
                ))}
              </div>
            )}
            <button
              onClick={() => setShowAddCardio(true)}
              disabled={!sessionId}
              className="w-full border border-dashed rounded-xl py-3.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
              style={cardTheme === 'dark' ? {
                borderColor: 'rgba(8,145,178,0.75)',
                color: 'rgba(8,116,144,0.95)',
              } : {
                borderColor: 'rgba(6,182,212,0.6)',
                color: 'rgba(103,232,249,0.95)',
              }}
              title={sessionId ? 'Add a cardio session' : 'Loading…'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Add Cardio
            </button>
          </>
        )}

      </div>

      <AddCardioModal
        open={showAddCardio}
        onClose={() => setShowAddCardio(false)}
        onSave={handleSaveCardio}
      />

      {/* Superset/circuit label picker — opened by tapping an exercise name.
          Modal owns the two wheels; confirm/clear callbacks mutate
          template.exercises and entries here in the parent. usedLabels
          excludes the current card so re-opening your own picker doesn't
          flag your own label as a conflict. */}
      <SupersetPickerModal
        open={!!supersetPicker}
        initialLabel={(() => {
          if (!supersetPicker || !template) return '';
          const idx = findExIdx(template.exercises, supersetPicker.exerciseKey);
          return idx >= 0 ? (template.exercises[idx].supersetLabel || '') : '';
        })()}
        usedLabels={(() => {
          if (!supersetPicker || !template?.exercises) return [];
          const currentKey = supersetPicker.exerciseKey;
          const out = [];
          template.exercises.forEach((ex, i) => {
            if (ex.isSectionHeader || !ex.supersetLabel) return;
            const key = exKey(template.exercises, ex, i);
            if (key === currentKey) return; // exclude self
            out.push({ label: ex.supersetLabel, exerciseName: ex.name });
          });
          return out;
        })()}
        onConfirm={(label) => {
          if (supersetPicker) handleSetSupersetLabel(supersetPicker.exerciseKey, label);
        }}
        onClear={() => {
          if (supersetPicker) handleClearSupersetLabel(supersetPicker.exerciseKey);
        }}
        onClose={() => setSupersetPicker(null)}
      />

      {/* Add Section Header Modal — single text input + Save/Cancel. Submits
          on Enter so users can flow keyboard-only. Focus trap wraps the
          panel so Tab cycles within it. */}
      {showAddSection && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24"
          onClick={() => setShowAddSection(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-add-section-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            ref={addSectionTrapRef}
            className="relative w-full max-w-sm overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 id="ws-add-section-title" className="text-lg font-bold text-white">Add Section Header</h3>
                <button
                  onClick={() => setShowAddSection(false)}
                  aria-label="Close"
                  className="text-wf-gray-400 active:opacity-70"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-white/40 font-light mb-3 leading-relaxed">
                Section headers group the exercises that follow them. Useful for supersets, warmups, or main-lift blocks. Long-press the header later to rename or delete it.
              </p>
              <input
                type="text"
                aria-label="Section name"
                value={addSectionName}
                onChange={(e) => setAddSectionName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && addSectionName.trim()) handleAddSectionHeader(); }}
                placeholder="e.g. Superset A, Warmup, Main Lifts"
                autoFocus
                ref={iosFocusRef}
                className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
              />
            </div>
            <div className="px-4 pb-4 pt-2 space-y-2 border-t border-white/5">
              <button
                onClick={handleAddSectionHeader}
                disabled={!addSectionName.trim()}
                className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                Add Section
              </button>
              <button
                onClick={() => setShowAddSection(false)}
                className="w-full font-bold uppercase active:scale-[0.98] transition-all border border-white/15"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise Modal */}
      {showAddExercise && (() => {
        const allExercises = allExercisesFromDB;
        // Duplicate exercise names are explicitly allowed in a session —
        // the data layer disambiguates with exKey() (`Bench Press::1`,
        // etc.) so two Bench Press cards can co-exist with independent
        // sets. The Add Exercise modal previously filtered out anything
        // already in the workout, blocking common cases like supersets
        // and second-attempt entries. `seen` still de-dupes the library
        // listing itself (custom + library can collide on name).
        const q = addExerciseSearch.toLowerCase();
        const muscleFilter = addExerciseMuscleFilter;
        const matchesMuscleFilter = (ex) => muscleFilter === 'all' || ex.muscle === muscleFilter;
        const seen = new Set();
        const muscleScoped = allExercises.filter(matchesMuscleFilter);
        const filtered = q
          ? muscleScoped.filter((ex) => {
              if (seen.has(ex.name)) return false;
              seen.add(ex.name);
              return ex.name.toLowerCase().includes(q);
            })
          : [];
        // Group by muscle for browsing when no search
        const muscleGroups = {};
        if (!q) {
          for (const ex of muscleScoped) {
            if (seen.has(ex.name)) continue;
            seen.add(ex.name);
            if (!muscleGroups[ex.muscle]) muscleGroups[ex.muscle] = [];
            muscleGroups[ex.muscle].push(ex);
          }
        }
        // Pills derived from the hook's muscleGroups list, with "All" first.
        // Falls back to deriving from the loaded exercises if the hook
        // hasn't populated yet (defensive — useExercises sometimes races).
        const muscleList = allMuscleGroups && allMuscleGroups.length > 0
          ? allMuscleGroups
          : Array.from(new Set(allExercises.map((ex) => ex.muscle).filter(Boolean))).sort();
        return (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20"
            onClick={() => setShowAddExercise(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ws-add-exercise-title"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              ref={addExerciseTrapRef}
              className="relative w-full max-w-lg bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl max-h-[75vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 id="ws-add-exercise-title" className="text-lg font-bold text-white">Add Exercise</h3>
                  <button onClick={() => setShowAddExercise(false)} aria-label="Close" className="text-wf-gray-400 active:opacity-70">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="search"
                  aria-label="Search exercises"
                  value={addExerciseSearch}
                  onChange={(e) => setAddExerciseSearch(e.target.value)}
                  placeholder="Search exercises or type a custom name..."
                  ref={iosFocusRef}
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
                />
                {/* Body-part filter pills — same interaction pattern as the
                    Browse Workout Library at /workouts, scoped to muscle
                    groups loaded from the exercises API. Horizontal scroll
                    so the list never blows out the modal width. */}
                <div className="-mx-5 mt-3 px-5 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {[{ value: 'all', label: 'All' }, ...muscleList.map((m) => ({ value: m, label: m }))].map((f) => {
                    const isActive = addExerciseMuscleFilter === f.value;
                    return (
                      <button
                        key={f.value}
                        onClick={() => setAddExerciseMuscleFilter(f.value)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.97] ${
                          isActive
                            ? 'bg-wf-red text-white'
                            : 'bg-white/5 text-white/60 border border-white/10 hover:text-white hover:border-white/25'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
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
                {/* Browse by muscle when no search. No per-muscle cap —
                    the modal body scrolls so the user can see every
                    exercise grouped under each muscle. */}
                {!q && Object.entries(muscleGroups).map(([muscle, exercises]) => (
                  <div key={muscle} className="mb-4">
                    <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 font-semibold mb-2 px-1">{muscle}</p>
                    <div className="space-y-0.5">
                      {exercises.map((ex) => (
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

      {/* Total Volume — Nike "Your Stats" style */}
      {totalVolume > 0 && (
        <div className="px-4 mt-4 mb-2">
          <div
            className="text-center py-3 px-2"
            style={{
              background: 'linear-gradient(145deg, #2f2f2f 0%, #1f1f1f 100%)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '2px',
            }}
          >
            <div className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>
              {totalVolume.toLocaleString()}<span className="text-[12px] font-light text-white/30"> LBS</span>
            </div>
            <div className="text-[8px] text-white/25 uppercase tracking-[0.25em] font-light mt-1">Total Volume</div>
          </div>
        </div>
      )}

      {/* Mark Complete — Nike style */}
      {timerStarted && (
        <div className="px-4 mb-24" data-tutorial="mark-complete">
          <button
            onClick={handleMarkComplete}
            className="active:scale-[0.98] transition-all w-full"
            style={isCompleted ? {
              padding: '16px', borderRadius: '2px',
              border: cardTheme === 'dark' ? '1px solid rgba(0,0,0,0.30)' : '1px solid rgba(255,255,255,0.30)',
              background: cardTheme === 'dark' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)',
              color: cardTheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.25em', textTransform: 'uppercase',
            } : {
              padding: '16px', borderRadius: '2px', border: 'none',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
              color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.25em', textTransform: 'uppercase',
              boxShadow: '0 4px 20px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {isCompleted ? 'Undo Completion' : `Mark Complete — ${completedCount}/${totalSets} Sets`}
          </button>
          {/* Inline validation message (e.g. "Log at least one set"). Sits
              right under Mark Complete so the feedback is anchored to the
              failing action — much friendlier than a blocking alert. */}
          {completeError && (
            <div
              className="mt-3 px-3 py-2 rounded-lg text-sm font-medium bg-wf-red/15 text-wf-red border border-wf-red/30 text-center"
              role="alert"
              aria-live="polite"
            >
              {completeError}
            </div>
          )}
        </div>
      )}

      {/* Workout Summary */}
      {showSummary && (
        <WorkoutSummary
          template={template}
          programName={programName}
          entries={entries}
          completedSets={completedSets}
          elapsed={tutorialMode ? 2717 : elapsed}
          formatTime={formatTime}
          sessionDate={date}
          onViewWorkout={() => setShowSummary(false)}
          onClose={() => {
            setShowSummary(false);
            // If this was a 7th-workout milestone, let the verse overlay take
            // over instead of navigating away. Navigation happens on its close.
            if (pendingVerse) return;
            // Deeplinked from the Workouts-page "Workout Completed" CTA →
            // return to /app where the user came from. Default destination
            // (Calendar) only applies to the "just completed a workout" flow.
            const cameFromCardDeeplink = location.search.includes('summary=1');
            // Tutorial workout finishes back at the Workouts hub (/app), not
            // the marketing landing (/). The landing is for unauthenticated
            // visitors; a user who just walked through the tutorial is
            // signed in and should land where their workouts live.
            navigate(tutorialMode ? '/app' : (cameFromCardDeeplink ? '/app' : '/calendar'));
          }}
        />
      )}

      {/* Bible verse overlay — shown after summary on every 5th completed workout */}
      {pendingVerse && !showSummary && (
        <BibleVerseOverlay
          verse={pendingVerse}
          onClose={() => {
            setPendingVerse(null);
            navigate(tutorialMode ? '/app' : '/calendar');
          }}
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
              aria-label="Close timer"
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Rest Timer — popped-out card with a circular SVG progress
          ring around the countdown, an "Up Next" line (Set N · Exercise
          Name from restContext), and a −15s / +15s / Skip control row.
          Idle state (restRemaining === null) keeps the duration dropdown +
          Start Rest button so the user can fire a fresh rest without
          un-floating. Draggable via the outer touch handlers. */}
      {restFloating && timerStarted && (
        <div
          className="fixed z-50 touch-none"
          style={{ left: restFloatPos.x, top: restFloatPos.y }}
          onTouchStart={handleRestFloatTouchStart}
          onTouchMove={handleRestFloatTouchMove}
          onTouchEnd={handleRestFloatTouchEnd}
        >
          {/* Unified card layout — ring is always visible. Inside the ring:
              active countdown shows the formatted time; idle (no rest yet)
              and done (timer hit 0) both show the duration dropdown so the
              user can pick a new rest length and tap Start Rest. Right
              column adapts: active shows Up Next + ±15s/Skip chips; idle/
              done shows a Ready eyebrow + single Start Rest CTA chip. */}
          {(() => {
            const total = restDuration || 1;
            const isActive = restRemaining !== null && restRemaining > 0;
            const pct = isActive ? Math.max(0, Math.min(1, restRemaining / total)) : 0;
            const R = 36, C = 2 * Math.PI * R;
            return (
              <div
                className="rounded-[22px] p-[18px] shadow-2xl backdrop-blur-xl flex items-center gap-4"
                style={{
                  background: 'rgba(20,18,16,0.96)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  boxShadow: '0 0 0 4px rgba(239,68,68,0.06), 0 14px 36px rgba(0,0,0,0.7)',
                  minWidth: 280,
                }}
              >
                {/* progress ring — track + progress arc (arc hidden when idle) */}
                <div className="relative shrink-0" style={{ width: 84, height: 84 }}>
                  <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                    {isActive ? (
                      <circle
                        cx="42" cy="42" r={R} fill="none" stroke="#ef4444" strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
                        style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))', transition: 'stroke-dashoffset 1s linear' }}
                      />
                    ) : (
                      // Static full red outline when no countdown is active —
                      // visually anchors the idle/done card to the same shape
                      // as the active state instead of leaving the ring as a
                      // bare track.
                      <circle
                        cx="42" cy="42" r={R} fill="none" stroke="#ef4444" strokeWidth="6"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' }}
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isActive ? (
                      <>
                        <span className="text-white font-mono-stat tabular-nums" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
                          {formatTime(restRemaining)}
                        </span>
                        <span className="uppercase font-semibold" style={{ fontSize: 8, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Rest</span>
                      </>
                    ) : (
                      <>
                        {/* Duration dropdown — sits inside the ring in place
                            of the countdown text. Native <select> styled to
                            be transparent so only the option label and a
                            small caret read against the dark card; tap
                            opens the system picker. touch-auto + the
                            stopPropagation handler keep the drag-to-move
                            handler on the outer wrapper from swallowing the
                            tap. */}
                        <select
                          value={restDuration}
                          onChange={(e) => { const s = Number(e.target.value); setRestDuration(s); restDurationRef.current = s; }}
                          onTouchStart={(e) => e.stopPropagation()}
                          aria-label="Rest duration"
                          className="touch-auto"
                          style={{
                            background: 'transparent', border: 'none', color: '#fff',
                            textAlign: 'center', textAlignLast: 'center',
                            fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1,
                            outline: 'none', cursor: 'pointer', padding: 0,
                            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                            fontVariantNumeric: 'tabular-nums',
                            width: 60,
                            fontFamily: 'inherit',
                          }}
                        >
                          {REST_OPTIONS.map((s) => (
                            <option key={s} value={s} className="bg-wf-gray-900">{s >= 60 ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : `${s}s`}</option>
                          ))}
                        </select>
                        <span className="uppercase font-semibold" style={{ fontSize: 8, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Rest</span>
                      </>
                    )}
                  </div>
                </div>

                {/* right column */}
                <div className="flex-1 min-w-0">
                  <div className="uppercase font-semibold" style={{ fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.45)' }}>
                    {isActive || restContext ? 'Up Next' : 'Ready'}
                  </div>
                  <div className="text-white" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.012em', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {restContext
                      ? `Set ${restContext.nextSetNumber} · ${restContext.exerciseName}`
                      : (isActive ? 'Final set complete' : 'Set duration to start')}
                  </div>
                  <div className="flex gap-1.5" style={{ marginTop: 10 }}>
                    {isActive ? (
                      <>
                        <button onClick={() => adjustRest(-15)} className="active:scale-95 transition-transform" style={restChipStyle}>− 15s</button>
                        <button onClick={() => adjustRest(15)} className="active:scale-95 transition-transform" style={restChipStyle}>+ 15s</button>
                        <button onClick={stopRestTimer} className="active:scale-95 transition-transform" style={{ ...restChipStyle, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>Skip</button>
                      </>
                    ) : (
                      <button onClick={startRestTimer} className="active:scale-95 transition-transform" style={{ ...restChipStyle, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>Start Rest</button>
                    )}
                  </div>
                </div>

                {/* close (un-float) */}
                <button
                  onClick={() => setRestFloating(false)}
                  aria-label="Dock rest timer"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 shrink-0 self-start"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })()}
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
          'exit-workout': {
            target: '[data-tutorial="exit-workout"]',
            title: 'Leaving Mid-Workout',
            description: <>Need to step away? Your sets save automatically. You can come back to this workout anytime from the <span className="text-white font-semibold">Calendar</span> tab — no progress lost.</>,
            prev: null, // begin-workout was a tap-through interactive step
            next: 'timer',
            position: 'below',
          },
          timer: {
            target: '[data-tutorial="workout-timer"]',
            title: 'Workout Timer',
            description: <>This timer tracks your total workout time. To the far right, use the <span className="text-white font-semibold">pop-out</span> button to float the timer on screen as you scroll, or the <span className="text-white font-semibold">lock toggle</span> to keep the timer visible as you scroll down.</>,
            prev: 'exit-workout',
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
            next: 'exercise-name',
            position: 'below-anchor',
            tooltipAnchor: '[data-tutorial="set-row"]',
          },
          'exercise-name': {
            target: '[data-tutorial="exercise-name"]',
            title: 'Group Into Supersets',
            description: <>Tap the <span className="text-white font-semibold">exercise name</span> to group it with others in a superset. Two wheels appear — pick a <span className="text-white font-semibold">letter (A–G)</span> for the group and a <span className="text-white font-semibold">number (1–7)</span> for the order within that group. So <span className="text-white font-semibold">A1</span> and <span className="text-white font-semibold">A2</span> are paired, <span className="text-white font-semibold">B1</span> and <span className="text-white font-semibold">B2</span> are paired, and so on. Each label can only be used once per workout.</>,
            prev: 'exercise-card',
            next: 'exercise-header',
            position: 'below',
          },
          'exercise-header': {
            target: '[data-tutorial="move-buttons"]',
            title: 'Reorder Exercises',
            description: <>Use the <span className="text-white font-semibold">up</span> and <span className="text-white font-semibold">down arrows</span> to move this exercise higher or lower in your workout order.</>,
            prev: 'exercise-name',
            next: 'swap-exercise',
            position: 'below',
          },
          'swap-exercise': {
            target: '[data-tutorial="swap-button"]',
            title: 'Swap Exercise',
            description: <>Tap this button to <span className="text-white font-semibold">substitute</span> the current exercise with a different one. You can search the exercise library or type a custom exercise name.</>,
            prev: 'exercise-header',
            next: 'demo-button',
            position: 'below',
          },
          'demo-button': {
            target: '[data-tutorial="demo-button"]',
            title: 'Watch the Movement',
            description: <>Not sure on form? Tap <span className="text-white font-semibold">Demo</span> in the card header to play the exercise video right inside the card.</>,
            prev: 'swap-exercise',
            next: 'prs-button',
            position: 'below',
          },
          'prs-button': {
            target: '[data-tutorial="prs-button"]',
            title: 'See Your PRs',
            description: <>Tap the <span className="text-white font-semibold">PRs</span> badge to view your personal records for this exercise — top weight at every rep count.</>,
            prev: 'demo-button',
            next: 'add-delete-exercise',
            position: 'below',
          },
          'add-delete-exercise': {
            target: '[data-tutorial="add-delete-buttons"]',
            title: 'Add & Remove Exercises',
            description: <>The <span className="text-white font-semibold">plus button</span> adds a new exercise below this one. The <span className="text-white font-semibold">X button</span> removes this exercise from the workout entirely.</>,
            prev: 'prs-button',
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
            description: <>Each row is one set. The <span className="text-white font-semibold">circle on the left</span> marks the set as complete. <span className="text-white font-semibold">Type</span> shows the set type (warm-up, regular, drop set, etc.) — tap to change it. <span className="text-white font-semibold">Goal Wt</span> shows the target weight. <span className="text-white font-semibold">Actual Wt</span> is where you enter the weight used. <span className="text-white font-semibold">Goal Reps</span> shows the target reps. <span className="text-white font-semibold">Actual Reps</span> is where you enter the reps you completed.</>,
            prev: 'set-controls',
            next: 'set-type',
            position: 'below',
          },
          'set-type': {
            target: '[data-tutorial="set-row"]',
            title: 'Mark Warm-Up & Drop Sets',
            description: <>Tap the <span className="text-white font-semibold">Type</span> cell on any set to mark it as warm-up, drop set, or to failure. Warm-up sets don't count toward PRs.</>,
            prev: 'set-row',
            next: 'plate-calc',
            position: 'below',
          },
          'plate-calc': {
            target: '[data-tutorial="plate-calc"]',
            title: 'Plate Calculator',
            description: <>Not sure how to load the bar? The <span className="text-white font-semibold">PC button</span> in the card header opens a plate calculator that shows exactly which plates to put on each side. You can also <span className="text-white font-semibold">long-press any weight input</span> on a set row to open the same calculator pre-filled with that set's weight.</>,
            prev: 'set-type',
            next: 'full-screen',
            position: 'below',
          },
          'full-screen': {
            target: '[data-tutorial="full-screen"]',
            title: 'Full-Screen Mode',
            description: <>Tap the <span className="text-white font-semibold">viewfinder icon</span> to make this exercise fill the screen. Use the <span className="text-white font-semibold">← / → arrows</span> in the top bar to move between exercises, and tap <span className="text-white font-semibold">✕</span> to exit. Want this on by default? Turn it on in <span className="text-white font-semibold">Profile → Preferences → Full-Screen Mode</span>.</>,
            prev: 'plate-calc',
            next: 'session-settings',
            position: 'below',
          },
          'session-settings': {
            target: '[data-tutorial="session-settings"]',
            title: 'Display Settings',
            description: <>Tap the <span className="text-white font-semibold">gear icon</span> to customize your workout view. You can toggle <span className="text-white font-semibold">Goal Weight / Reps</span> columns on or off, and show or hide the <span className="text-white font-semibold">Set Type</span> column to keep your layout clean.</>,
            prev: 'full-screen',
            next: 'exercise-notes',
            position: 'below',
          },
          'exercise-notes': {
            target: '[data-tutorial="exercise-notes"]',
            title: 'Exercise Notes',
            description: <>Tap here to add notes for this exercise — things like form cues, how the set felt, or adjustments for next time.</>,
            prev: 'session-settings',
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
                  onClick={() => { setTutorialTip(null); navigate('/app'); }}
                  className="text-sm font-semibold text-white/70 bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors py-2 px-5 rounded-xl border border-white/10"
                >
                  {/* Only the actual last tip (mark-complete) shows
                      "Complete Tutorial"; every other step — including the
                      interactive begin-workout opener that has no next — is
                      a bail-out and should say "Skip tutorial". */}
                  {tutorialTip === 'mark-complete' ? 'Complete Tutorial' : 'Skip tutorial'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

export function WorkoutSummary({ template, programName, entries, completedSets, elapsed, formatTime, onClose, sessionDate, onViewWorkout }) {
  const navigate = useNavigate();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareImage, setShareImage] = useState(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  // Local toast for share/copy confirmation — keeps the summary screen flow
  // intact (window.alert pauses the whole page and reads like a debug build).
  const [summaryToast, setSummaryToast] = useState('');
  const summaryToastTimerRef = useRef(null);
  function showSummaryToast(message, ms = 3000) {
    setSummaryToast(message);
    if (summaryToastTimerRef.current) clearTimeout(summaryToastTimerRef.current);
    summaryToastTimerRef.current = setTimeout(() => setSummaryToast(''), ms);
  }

  // Append " program" after the program name unless the name already ends in
  // "program" (case-insensitive) — guards against e.g. "Will's Hypertrophy
  // Program" rendering as "...Program program".
  const programLabel = programName
    ? (/\bprogram\s*$/i.test(programName) ? programName : `${programName} program`)
    : '';

  async function saveAsTemplate() {
    if (savingTemplate || savedAsTemplate) return;
    setSavingTemplate(true);
    try {
      const today = new Date();
      const dateLabel = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const name = `${template.name} - ${dateLabel}`;
      const exercises = template.exercises.filter(ex => !ex.isSectionHeader).map((ex, exIdx) => {
        const eKey = exKey(template.exercises, ex, exIdx);
        const exEntries = entries[eKey] || [];
        return {
          name: ex.name,
          setType: ex.setType || 'straight',
          sets: ex.sets.map((set, idx) => ({
            reps: Number(exEntries[idx]?.reps) || set.plannedReps || 10,
            weight: Number(exEntries[idx]?.weight) || Number(set.suggestedWeight) || 0,
          })),
        };
      });
      await api('/templates', {
        method: 'POST',
        body: JSON.stringify({ name, description: '', exercises }),
      });
      setSavedAsTemplate(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to save template:', err);
    } finally {
      setSavingTemplate(false);
    }
  }


  // Stats
  const realExercises = template.exercises.filter(ex => !ex.isSectionHeader);
  const totalSets = realExercises.reduce((s, ex) => s + ex.sets.length, 0);
  // completed sets only — planned/pre-filled values are excluded so the
  // post-workout summary stats + share image reflect actual work done.
  const totalVolume = template.exercises.reduce((vol, ex, exIdx) => {
    if (ex.isSectionHeader) return vol;
    const eKey = exKey(template.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
    return vol + exEntries.reduce((sum, e, i) => {
      if (!completedSets.has(`${eKey}-${i}`)) return sum;
      const w = Number(e.weight) || 0;
      const r = Number(e.reps) || 0;
      return sum + (w > 0 ? w * r : 0);
    }, 0);
  }, 0);

  const [expandedSummary, setExpandedSummary] = useState(new Set());

  // PR lookup — fetch this template's personal bests on mount so we can
  // tag the matching set rows in the breakdown with a yellow "PR" badge.
  // Server returns {exercise_name, best_weight, best_reps, ...} per row;
  // we key into a Set by "name::weight::reps" so per-set lookup is O(1).
  // Empty-start sessions don't have a template.id yet → skip the fetch.
  const [prKeys, setPrKeys] = useState(null);
  useEffect(() => {
    if (!template?.id) return;
    let cancelled = false;
    api(`/pbs?templateId=${template.id}`).then((data) => {
      if (cancelled) return;
      const keys = new Set();
      for (const pr of data || []) {
        const w = Number(pr.best_weight);
        const r = Number(pr.best_reps);
        if (!Number.isFinite(w) || !Number.isFinite(r)) continue;
        keys.add(`${String(pr.exercise_name).toLowerCase()}::${w}::${r}`);
      }
      setPrKeys(keys);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [template?.id]);
  function isPRSet(exerciseName, weight, reps) {
    if (!prKeys || weight <= 0 || reps <= 0) return false;
    return prKeys.has(`${String(exerciseName).toLowerCase()}::${Number(weight)}::${Number(reps)}`);
  }

  // Per-exercise data with per-set volume breakdown (goal volume vs actual volume).
  // actualVolume / actualWeight / actualReps reflect completed sets only —
  // planned/pre-filled values are zeroed out so the breakdown's "actual" column
  // represents work done, not typed.
  const exerciseStats = template.exercises.reduce((acc, ex, exIdx) => {
    if (ex.isSectionHeader) return acc;
    const eKey = exKey(template.exercises, ex, exIdx);
    const exEntries = entries[eKey] || [];
    const setStats = ex.sets.map((set, idx) => {
      const goalWeight = Number(set.suggestedWeight) || 0;
      const goalReps = set.plannedReps || 0;
      const goalVolume = goalWeight > 0 ? goalWeight * goalReps : 0;
      const isSetCompleted = completedSets.has(`${eKey}-${idx}`);
      const actualWeight = isSetCompleted ? (Number(exEntries[idx]?.weight) || 0) : 0;
      const actualReps = isSetCompleted ? (Number(exEntries[idx]?.reps) || 0) : 0;
      const actualVolume = actualWeight > 0 ? actualWeight * actualReps : 0;
      const setType = exEntries[idx]?.setType || set.setType || ex.setType || 'straight';
      const hitGoal = goalReps > 0 ? actualReps >= goalReps : true;
      return { setNumber: set.setNumber, goalVolume, actualVolume, goalReps, actualReps, goalWeight, actualWeight, setType, hitGoal, completed: isSetCompleted };
    });
    const totalGoalVol = setStats.reduce((s, ss) => s + ss.goalVolume, 0);
    const totalActualVol = setStats.reduce((s, ss) => s + ss.actualVolume, 0);
    acc.push({ name: ex.name, eKey, setStats, totalGoalVol, totalActualVol });
    return acc;
  }, []);

  const totalGoalVolume = exerciseStats.reduce((s, ex) => s + ex.totalGoalVol, 0);

  // Per-muscle work share for the segmented ring + body heatmap.
  const muscleAllocation = buildMuscleAllocation({
    exercises: template.exercises,
    entries,
    completedSets,
    exKey,
  });

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

  // Cache the logo across multiple shares — mirrors the loadLogo pattern
  // in client/src/utils/prShare.js so the workout-summary card can adopt
  // the same visual language (image logo top-right, no wordmark text).
  const _logoRef = useRef(null);
  function loadLogo() {
    if (_logoRef.current) return _logoRef.current;
    _logoRef.current = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/RepLabLogo2.jpg';
    });
    return _logoRef.current;
  }

  // Generate shareable workout summary image. Modeled after the PR share
  // card (client/src/utils/prShare.js): deep gradient base, red glow blob
  // top-right + orange glow bottom-left, subtle diagonal hatch, big red
  // eyebrow, REPLAB logo image top-right, oversized display numerics for
  // the 2-tile stats, thin red underline + date footer. Workout-specific
  // additions: program label + exercise breakdown with PR badges.
  async function generateSummaryImage() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = 1080;
    const padding = 80; // bumped from 60 to match the PR card's outer margin
    const contentWidth = W - padding * 2;
    const font = 'system-ui, -apple-system, "Segoe UI", sans-serif';

    // --- Pre-calculate height ---
    // Measure the workout name early so we know how many lines it'll wrap.
    ctx.canvas.width = W;
    ctx.font = `900 72px ${font}`;
    const nameLines = wrapText(ctx, template.name.toUpperCase(), contentWidth);

    let y = padding;
    y += 120; // top: eyebrow + logo row (logo ~110 tall sits to the right of the eyebrow)
    y += 50;  // spacing after eyebrow row
    if (programLabel) y += 50; // program label line
    y += nameLines.length * 82; // workout name lines
    y += 70;  // spacing before stats
    y += 200; // stats tile height
    y += 70;  // spacing after stats

    // Exercise section height — condensed to a single line per exercise
    // (no per-set breakdown on the share image; full detail lives in the
    // in-app summary screen and in the text caption).
    template.exercises.forEach((ex) => {
      if (ex.isSectionHeader) {
        y += 60; // section header
        return;
      }
      y += 60; // one condensed line per exercise (name + set count)
    });

    y += 60; // spacing before red line
    y += 70; // date row
    y += padding;

    canvas.width = W;
    canvas.height = y;

    // --- Background: clean black-to-gray vertical gradient. Removed the
    //     red + orange glow blobs and diagonal hatch that previously sat on
    //     top so the background reads as actual gray rather than a colored
    //     wash. ---
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#000000');
    bg.addColorStop(0.5, '#1a1a1a');
    bg.addColorStop(1, '#2e2e2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, canvas.height);

    let curY = padding;

    // --- Eyebrow "WORKOUT COMPLETE" (red, big) + REPLAB logo image
    //     top-right. Mirrors the PR card's "PERSONAL RECORD" eyebrow
    //     treatment so the two share images feel like siblings. ---
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.font = `700 60px ${font}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('WORKOUT COMPLETE', padding, curY);

    const logo = await loadLogo();
    const logoSize = 110;
    if (logo) {
      ctx.drawImage(logo, W - padding - logoSize, curY - 10, logoSize, logoSize);
    } else {
      // Text fallback so the corner isn't empty when the image 404s.
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `900 28px ${font}`;
      ctx.textAlign = 'right';
      ctx.fillText('REPLAB', W - padding, curY + 16);
      ctx.textAlign = 'left';
    }
    curY += 120;
    curY += 50;

    // --- Program label (small, dim, uppercase) ---
    if (programLabel) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = `600 28px ${font}`;
      ctx.textAlign = 'left';
      ctx.fillText(programLabel.toUpperCase(), padding, curY);
      curY += 50;
    }

    // --- Workout name (heavy display, uppercase, wrapped, left-aligned
    //     so it occupies the same column as the eyebrow above). ---
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 72px ${font}`;
    ctx.textAlign = 'left';
    nameLines.forEach((line, i) => {
      ctx.fillText(line, padding, curY + i * 82);
    });
    curY += nameLines.length * 82;
    curY += 70;

    // --- Stats boxes (2 columns) — mirrors the in-app 2-tile summary:
    //     Total Volume (green stripe) on the left, Total Sets (red stripe)
    //     on the right. Each tile gets a colored top accent stripe to
    //     match the modal's Nike-style panels.
    const boxGap = 28;
    const boxW = (contentWidth - boxGap) / 2;
    const boxH = 200;
    const boxRadius = 4;
    const statsData = [
      { label: 'TOTAL VOLUME', value: `${totalVolume.toLocaleString()} lbs`, stripe: '#22c55e' },
      { label: 'TOTAL SETS',   value: `${completedSets.size}/${totalSets}`,   stripe: '#ef4444' },
    ];
    statsData.forEach((stat, i) => {
      const bx = padding + i * (boxW + boxGap);
      const by = curY;
      // Translucent panel — bg blob shows through (matches PR card vibe
      // where blobs glow through transparent surfaces).
      drawRoundRect(ctx, bx, by, boxW, boxH, boxRadius);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Top accent stripe — colored band running across the tile's top edge.
      ctx.fillStyle = stat.stripe;
      drawRoundRect(ctx, bx, by, boxW, 6, 2);
      ctx.fill();
      // Label — large, colored to match its stripe.
      ctx.font = `700 26px ${font}`;
      ctx.fillStyle = stat.stripe;
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, bx + 32, by + 58);
      // Value — heavy display number, white, left-aligned. Auto-shrinks
      // to fit the tile width so huge volume numbers don't bleed out.
      ctx.fillStyle = '#ffffff';
      let valueFontPx = 88;
      const maxValueWidth = boxW - 64;
      do {
        ctx.font = `900 ${valueFontPx}px ${font}`;
        if (ctx.measureText(stat.value).width <= maxValueWidth) break;
        valueFontPx -= 6;
      } while (valueFontPx > 52);
      ctx.fillText(stat.value, bx + 32, by + 110);
    });
    curY += boxH + 70;

    // --- Exercise list ---
    ctx.textAlign = 'left';
    template.exercises.forEach((ex, exIdx) => {
      if (ex.isSectionHeader) {
        // Section header with red left accent
        ctx.fillStyle = '#ef4444';
        drawRoundRect(ctx, padding, curY + 8, 4, 36, 2);
        ctx.fill();
        ctx.font = `700 22px ${font}`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(ex.name.toUpperCase(), padding + 18, curY + 32);
        curY += 60;
        return;
      }

      // Condensed: bold name + lighter "N sets" suffix on a single line.
      // Per-set detail (type, PR, weight x reps) moved off the share image
      // to keep it scannable in feeds; the in-app summary still shows it.
      const setCount = ex.sets?.length || 0;
      const setsLabel = setCount === 1 ? 'set' : 'sets';
      const namePart = `${ex.name}, `;
      ctx.font = `900 34px ${font}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(namePart, padding, curY + 36);
      const _nameW = ctx.measureText(namePart).width;
      ctx.font = `500 30px ${font}`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`${setCount} ${setsLabel}`, padding + _nameW, curY + 38);
      curY += 60;

    });

    // --- Footer: short red underline + date — mirrors the PR card's
    //     bottom treatment exactly (140-wide red line then the date in
    //     dim white, left-aligned at the same column as the eyebrow). ---
    curY += 20;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(padding, curY);
    ctx.lineTo(padding + 140, curY);
    ctx.stroke();
    curY += 30;

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `500 30px ${font}`;
    ctx.textAlign = 'left';
    ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), padding, curY);

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
        if (import.meta.env.DEV) console.error('Failed to generate share image:', err);
        showSummaryToast("Couldn't make an image — try Share as Text below.");
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
    if (programLabel) lines.push(programLabel);
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
    lines.push('Logged with REPLAB');
    const text = lines.join('\n');
    if (navigator.share) {
      try { await navigator.share({ text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); showSummaryToast('Copied to clipboard.'); } catch {}
    }
  }

  // Portal to <body> so the modal escapes the Layout's <main> stacking
  // context (which sits at z-10 and traps the avatar/header bar above
  // anything inside it). Without this, scrolling up could let the share
  // button slide behind the top avatar.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" />
      {/* Local toast (share/copy confirmation). Positioned over the backdrop. */}
      {summaryToast && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-white/95 text-black text-sm font-semibold shadow-lg pointer-events-none"
          style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
          role="status"
          aria-live="polite"
        >
          {summaryToast}
        </div>
      )}

      {/* Content */}
      <div className="relative z-20 flex-1 overflow-y-auto safe-top safe-bottom">
        <div className="px-5 pt-4 pb-24 max-w-lg mx-auto">
          {/* Top bar: close + share */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              aria-label="Close"
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

          {/* Header — Nike style */}
          <div className="mb-8">
            <p className="text-[10px] uppercase font-bold mb-3" style={{ color: '#ef4444', letterSpacing: '0.4em' }}>
              Workout Complete
            </p>
            <h2
              className="text-white font-black tracking-tight"
              style={{
                fontFamily: 'system-ui',
                fontSize: 'clamp(34px, 9.35vw, 74.8px)',
                lineHeight: '0.85',
                letterSpacing: '-0.03em',
              }}
            >
              {template.name.toUpperCase()}
            </h2>
            {programLabel && (
              <p className="text-[10px] uppercase font-bold text-white/40 mt-3" style={{ letterSpacing: '0.3em' }}>
                {programLabel}
              </p>
            )}
          </div>

          {/* Stats Grid — Nike style: dark gradient panel + colored top
              accent stripe + tiny labels + heavy display numerics */}
          {(() => {
            const panel = {
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              position: 'relative',
              overflow: 'hidden',
            };
            const stripe = (color) => ({
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: `linear-gradient(90deg, ${color}, ${color}40 60%, transparent)`,
            });
            // Two-tile summary: Total Volume + Total Sets.
            const stats = [
              { label: 'Total Volume', color: '#22c55e', main: totalVolume.toLocaleString(), suffix: ' lbs' },
              { label: 'Total Sets',   color: '#ef4444', main: String(completedSets.size),   suffix: ` / ${totalSets}` },
            ];
            return (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {stats.map((s) => (
                  <div key={s.label} className="px-4 py-4" style={panel}>
                    <div style={stripe(s.color)} />
                    <p className="text-[9px] uppercase font-bold mt-1 mb-2" style={{ color: s.color, letterSpacing: '0.25em' }}>
                      {s.label}
                    </p>
                    <p
                      className="font-black text-white tabular-nums"
                      style={{ fontFamily: 'system-ui', fontSize: '28px', lineHeight: '1', letterSpacing: '-0.02em' }}
                    >
                      {s.main}
                      {s.suffix && (
                        <span className="text-xs font-semibold text-white/40">{s.suffix}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Body Parts Worked — segmented ring + legend, then anatomical
              figures. DISABLED pre-launch (2026-05-01) — code preserved
              for future redesign. Re-enable by removing the `false &&`. */}
          {false && muscleAllocation.length > 0 && (
            <div className="mb-6 px-4 py-5 rounded-sm" style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}>
              <p className="text-[10px] uppercase font-bold mb-4" style={{ color: '#ef4444', letterSpacing: '0.3em' }}>
                Body Parts Worked
              </p>
              {(() => {
                const r = 56;
                const c = 2 * Math.PI * r;
                let cumulative = 0;
                return (
                  <div className="flex items-center gap-5">
                    <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
                      {/* Track */}
                      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
                      {/* Segments */}
                      <g transform="rotate(-90 70 70)">
                        {muscleAllocation.map((seg) => {
                          const dash = c * seg.share;
                          const offset = -c * cumulative;
                          cumulative += seg.share;
                          return (
                            <circle
                              key={seg.muscle}
                              cx="70"
                              cy="70"
                              r={r}
                              fill="none"
                              stroke={seg.color}
                              strokeWidth="14"
                              strokeDasharray={`${dash} ${c - dash}`}
                              strokeDashoffset={offset}
                              style={{ filter: `drop-shadow(0 0 6px ${seg.color}80)` }}
                            />
                          );
                        })}
                      </g>
                    </svg>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {muscleAllocation.map((seg) => (
                        <div key={seg.muscle} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color, boxShadow: `0 0 6px ${seg.color}` }} />
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: seg.color, letterSpacing: '0.12em' }}>
                            {seg.muscle}
                          </span>
                          <span className="ml-auto text-sm font-black text-white tabular-nums">
                            {Math.round(seg.share * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="mt-5 pt-5 border-t border-white/5">
                <BodyHeatmap allocation={muscleAllocation} />
              </div>
            </div>
          )}

          {/* Exercise Breakdown — neutral revamp. We intentionally keep all
              the goal/hit/volume logic computed in `exerciseStats` (hitGoal,
              goalVolume, actualVolume, etc.) so it's available when we wire
              up program-mode visualizations later; we just don't *render*
              the green/red/yellow comparison bars and badges right now,
              because new users don't have goal weights/reps yet and the
              colors read as failure for sessions that were always meant
              to be freestyle. Show what the user actually lifted, period. */}
          <div className="space-y-2">
            <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mb-1">Exercise Breakdown</p>
            {exerciseStats.map((ex) => {
              const isExpanded = expandedSummary.has(ex.eKey);
              return (
              <div key={ex.eKey} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSummary(prev => {
                    const next = new Set(prev);
                    if (next.has(ex.eKey)) next.delete(ex.eKey); else next.add(ex.eKey);
                    return next;
                  })}
                  className="w-full text-left px-4 py-3 active:bg-white/5 transition-colors flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-medium text-white truncate flex-1 min-w-0">{ex.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-wf-red font-semibold tabular-nums">
                      {ex.setStats.length} {ex.setStats.length === 1 ? 'set' : 'sets'}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-wf-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-1 bg-white/[0.02]">
                    {ex.setStats.map((ss) => {
                      const typeLabel = ss.setType === 'warm_up' ? 'WU' : ss.setType === 'touch_up' ? 'TU' : ss.setType === 'drop' ? 'DS' : ss.setType === 'rest_pause' ? 'RP' : ss.setType === 'superset' ? 'SS' : ss.setType === 'alternating' ? 'Alt' : ss.setType === 'pre_exhaust' ? 'PrEx' : 'REG';
                      // Yellow on warm-up labels is a type indicator (not a
                      // hit/miss signal), so it stays — the colors removed
                      // were only the goal-comparison ones.
                      const isWarmup = ss.setType === 'warm_up' || ss.setType === 'touch_up';
                      const weightStr = ss.actualWeight === -1 ? 'BW' : ss.actualWeight > 0 ? `${ss.actualWeight} lbs` : null;
                      const repsStr = ss.actualReps > 0 ? `${ss.actualReps} ${ss.actualReps === 1 ? 'rep' : 'reps'}` : null;
                      const lifted = ss.completed && repsStr
                        ? (weightStr ? `${weightStr} × ${repsStr}` : repsStr)
                        : '—';
                      // PR detection: set's weight/reps match a row in the
                      // template's personal_bests fetched on mount. Yellow
                      // beats red on PR rows; otherwise the lifted text is
                      // red for visual hierarchy with the exercise header.
                      const isPR = ss.completed && isPRSet(ex.name, ss.actualWeight, ss.actualReps);
                      return (
                        <div key={ss.setNumber} className="flex items-center py-1.5">
                          <span className="w-8 text-xs text-wf-gray-500 font-bold tabular-nums">{ss.setNumber}</span>
                          <span className={`w-12 text-[10px] font-bold ${isWarmup ? 'text-yellow-400' : 'text-wf-gray-400'}`}>{typeLabel}</span>
                          <span className="flex-1 text-center text-[10px] font-black tracking-[0.2em] uppercase text-yellow-400">
                            {isPR ? 'PR' : ''}
                          </span>
                          <span className={`text-right text-sm font-semibold tabular-nums ${isPR ? 'text-yellow-400' : 'text-wf-red'}`}>
                            {lifted}
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

          {/* Action buttons — placed at the bottom of the scrollable summary
              so they don't block the per-exercise breakdown. Quick-exit lives
              in the X at the top-left of the modal. Save as Template mirrors
              the "+ Create Workout" button on the My Workouts card. */}
          <div className="pt-6 space-y-3">
            <button
              onClick={saveAsTemplate}
              disabled={savingTemplate || savedAsTemplate}
              className="w-full active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase whitespace-nowrap py-3 disabled:opacity-70"
              style={{
                letterSpacing: '0.15em',
                borderRadius: '2px',
                background: savedAsTemplate
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.85) 0%, rgba(22,163,74,0.85) 100%)'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                boxShadow: savedAsTemplate
                  ? '0 4px 14px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {savedAsTemplate ? '✓ Saved to My Workouts' : savingTemplate ? 'Saving…' : '+ Save as Template'}
            </button>
            {template.id && sessionDate && (
              <button
                onClick={() => {
                  // When the summary is shown as a modal over the live WorkoutSession
                  // (we're already at /session/:templateId/:date), navigate is a no-op
                  // and the modal stays open. The parent passes onViewWorkout in that
                  // case so we can just close the summary. From the standalone
                  // /summary/:id route there's no onViewWorkout — fall through to a
                  // real navigate.
                  if (onViewWorkout) {
                    onViewWorkout();
                  } else {
                    navigate(`/session/${template.id}/${sessionDate}`);
                  }
                }}
                className="w-full active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase whitespace-nowrap py-3"
                style={{
                  letterSpacing: '0.15em',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                View Workout
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full bg-black text-wf-gray-400 border border-wf-gray-600 font-bold py-3.5 rounded-xl text-base active:scale-[0.98] transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Share menu bottom sheet — Nike style: black gradient panel with
          colored top stripe, eyebrow + heavy display title, and square
          (2px corner) icon blocks instead of glass pills. */}
      {showShareMenu && (() => {
        const NIKE_PANEL = {
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.5), 0 -4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        };
        const ROW = (color) => ({
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '2px',
          borderLeft: `3px solid ${color}`,
        });
        const ICON_BLOCK = (color) => ({
          background: `linear-gradient(135deg, ${color}30 0%, ${color}15 100%)`,
          borderRadius: '2px',
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 12px ${color}25`,
        });
        const ACCENT = {
          image: '#ef4444',  // red — share image
          save:  '#22c55e',  // green — save / download
          text:  '#a855f7',  // purple — share as text
        };
        return (
          <div className="fixed inset-0 z-[70] flex flex-col" onClick={() => setShowShareMenu(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative flex-1 flex flex-col mt-12 animate-drop-down overflow-hidden"
              style={{ ...NIKE_PANEL, borderTopLeftRadius: '2px', borderTopRightRadius: '2px' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Red accent stripe — matches the Begin Program / summary cards */}
              <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[300px] h-[300px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="shrink-0 pt-4 pb-3 px-6 relative">
                {/* Drag handle */}
                <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-4" />
                {/* X close button — top-right; tapping the backdrop also
                    closes, but the explicit X is what users reach for. */}
                <button
                  onClick={() => setShowShareMenu(false)}
                  aria-label="Close share menu"
                  className="absolute top-3 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/60 active:text-white active:bg-white/10 active:scale-90 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
                  Share
                </p>
                <h3 className="text-[26px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                  WORKOUT SUMMARY
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-24 relative">
                {/* Image preview */}
                {generatingImage && (
                  <div className="mb-5 p-8 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span className="text-xs uppercase tracking-[0.25em] text-white/50 ml-3 font-bold">Generating image…</span>
                  </div>
                )}
                {shareImage && !generatingImage && (
                  <div className="mb-5 overflow-hidden" style={{ borderRadius: '2px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <img src={shareImage} alt="Workout summary" className="w-full block" />
                  </div>
                )}

                {/* Tiny section eyebrow */}
                <p className="text-[9px] uppercase font-bold mb-3 pt-1" style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.3em' }}>
                  Choose a destination
                </p>

                <div className="space-y-2">
                  {/* Share Image */}
                  <button
                    onClick={handleShareImage}
                    disabled={!shareImage}
                    className="w-full flex items-center gap-3.5 p-3 active:scale-[0.98] active:bg-white/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={ROW(ACCENT.image)}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0" style={ICON_BLOCK(ACCENT.image)}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-[13px] font-bold uppercase text-white block" style={{ letterSpacing: '0.1em' }}>Share Image</span>
                      <span className="text-[11px] text-white/40 font-light mt-0.5 block">Send via Instagram, Messages, etc.</span>
                    </div>
                    <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>

                  {/* Save to Camera Roll */}
                  <button
                    onClick={handleSaveImage}
                    disabled={!shareImage}
                    className="w-full flex items-center gap-3.5 p-3 active:scale-[0.98] active:bg-white/[0.06] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={ROW(ACCENT.save)}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0" style={ICON_BLOCK(ACCENT.save)}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-[13px] font-bold uppercase text-white block" style={{ letterSpacing: '0.1em' }}>Save to Camera Roll</span>
                      <span className="text-[11px] text-white/40 font-light mt-0.5 block">Download image to your device</span>
                    </div>
                    <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>

                  {/* Share as Text */}
                  <button
                    onClick={handleShareText}
                    className="w-full flex items-center gap-3.5 p-3 active:scale-[0.98] active:bg-white/[0.06] transition-all"
                    style={ROW(ACCENT.text)}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0" style={ICON_BLOCK(ACCENT.text)}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#a855f7" strokeWidth={1.7}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-[13px] font-bold uppercase text-white block" style={{ letterSpacing: '0.1em' }}>Share as Text</span>
                      <span className="text-[11px] text-white/40 font-light mt-0.5 block">Copy or share text summary</span>
                    </div>
                    <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>,
    document.body
  );
}
