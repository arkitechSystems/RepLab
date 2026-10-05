import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getExerciseVideoId, getExerciseSearchUrl } from '../utils/exerciseVideos.js';
import { useExercises, getSubstitutesFromList } from '../hooks/useExercises.js';
import VideoPlayerModal from './VideoPlayerModal.jsx';
import PlateCalculatorModal from './PlateCalculatorModal.jsx';
import { plateCalcDefaults } from '../utils/plateCalcType';
import CardioAccelerationCard from './CardioAccelerationCard.jsx';
import { iosFocusRef } from '../utils/iosFocus.js';
import useFocusTrap from '../hooks/useFocusTrap.js';
import YouTubeSearchPrompt from './YouTubeSearchPrompt.jsx';
import { CARDIO_MUSCLE, machineFor, metricUnit, METRIC_LABEL, nextMetric, DEFAULT_CARDIO_METRIC, formatCardioSet } from '../utils/cardio.js';

function addToRecent(name) {
  try {
    const recent = JSON.parse(localStorage.getItem('replab_recent_exercises') || '[]');
    const updated = [name, ...recent.filter(n => n !== name)].slice(0, 20);
    localStorage.setItem('replab_recent_exercises', JSON.stringify(updated));
  } catch {}
}

function getRecent() {
  try { return JSON.parse(localStorage.getItem('replab_recent_exercises') || '[]'); } catch { return []; }
}

const SET_TYPES = [
  { value: 'warm_up',      short: 'WU',   label: 'Warm Up' },
  { value: 'touch_up',     short: 'TU',   label: 'Touch Up' },
  { value: 'straight',     short: 'REG',  label: 'Regular' },
  { value: 'drop',         short: 'DS',   label: 'Drop Set' },
  { value: 'rest_pause',   short: 'RP',   label: 'Rest Pause' },
  { value: 'superset',     short: 'SS',   label: 'Super Set' },
  { value: 'alternating',  short: 'Alt',  label: 'Alternating Set' },
  { value: 'pre_exhaust',  short: 'PrEx', label: 'Pre-Exhaust' },
];

function getSetTypeShort(value) {
  return SET_TYPES.find(t => t.value === value)?.short || 'REG';
}

export { SET_TYPES };

// Sortable wrapper for an individual set row. Apply listeners on the outer
// node so dnd-kit's TouchSensor (configured with a 500ms delay constraint
// in ExerciseCard below) owns long-press → drag activation. The inner row
// keeps its own onTouchStart/Move/End for swipe-to-delete and
// swipe-to-complete — the two activation conditions don't overlap:
//   • Drag: still touch + 500ms = long-press
//   • Swipe: > 15px horizontal motion before 500ms = sideways gesture
// `disabled` blocks drag activation entirely (used for completed sets,
// template/readOnly modes, and when the parent hasn't passed onReorderSets).
function SortableSetRow({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 30 : undefined,
    boxShadow: isDragging ? '0 18px 36px rgba(0,0,0,0.5)' : undefined,
    position: 'relative',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// "Active card" design tokens. Accent red matches the app's wf-red.
const XC_RED = '#ef4444';
const XC_GREEN = '#3ea868';
const XC_LINE = '1px solid rgba(var(--ink),0.06)';
const XC_IN = '1px solid rgba(var(--ink),0.08)';

// Card controls layout:
//   'menu' — PC / PRs / Demo plus a "⋯" menu holding the structure edits
//            (move, swap, superset, add / remove exercise); − Remove set and
//            + Add set sit under the last set.
//   'rows' — the previous layout: Add / Remove exercise in the tool rail and
//            a strip with Up / Down / Swap / SS | Remove Set / Add Set.
// The tutorial always uses 'rows' because its steps point at those buttons.
const CARD_CONTROLS_LAYOUT = 'menu';

// − Remove set / + Add set pills under the sets ('menu' layout).
function SetPill({ icon, label, tone, onClick, ariaLabel }) {
  const add = tone === 'add';
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="active:scale-95 transition-transform"
      style={{ height: 34, padding: '0 12px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 6,
        color: add ? XC_GREEN : XC_RED,
        background: add ? 'rgba(62,168,104,0.10)' : 'rgba(239,68,68,0.08)',
        border: '1px solid ' + (add ? 'rgba(62,168,104,0.4)' : 'rgba(239,68,68,0.35)') }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
      <span className="xc-mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{label}</span>
    </button>
  );
}

// "⋯" card menu. Portalled to <body> so the card's overflow-hidden can't clip
// it; opens below the button, or above it when there isn't room. Closes on an
// outside tap, Escape, scroll or resize. themeClass carries the card's
// --ink / --fg variables out of the card.
function CardMenu({ anchorRef, themeClass, items, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight || 0;
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 && r.top - 6 - h > 8 ? r.top - 6 - h : below;
    setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div className={themeClass}>
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: 'fixed', zIndex: 130, top: pos?.top ?? -9999, right: pos?.right ?? 0, minWidth: 210,
          padding: 6, borderRadius: 14, background: 'var(--card)', color: 'var(--fg)',
          border: '1px solid rgba(var(--ink),0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        {items.map((it, i) => (it.divider ? (
          <div key={`d${i}`} style={{ height: 1, margin: '5px 4px', background: 'rgba(var(--ink),0.08)' }} />
        ) : (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            onClick={(e) => { e.stopPropagation(); onClose(); it.onClick(); }}
            className="active:scale-[0.98] transition-transform"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 9,
              background: 'none', border: 'none', textAlign: 'left', fontSize: 14, fontWeight: 600,
              color: it.tone === 'del' ? XC_RED : 'var(--fg)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: it.tone === 'del' ? 1 : 0.7 }}>{it.icon}</svg>
            {it.label}
          </button>
        )))}
      </div>
    </div>,
    document.body
  );
}

// One button in the card-controls strip: icon tile with a tiny label
// underneath. Up / Down / Swap / SS are neutral; only Add is green
// (variant="green") and only Remove is red.
function CardControlButton({ label, ariaLabel, onClick, variant, dataTutorial, children }) {
  const tone = variant === 'green' ? 'add' : (variant === 'red' || label === 'Remove') ? 'del' : 'neutral';
  const c = tone === 'add' ? XC_GREEN : tone === 'del' ? XC_RED : 'rgba(var(--ink),0.75)';
  return (
    <button type="button" aria-label={ariaLabel} data-tutorial={dataTutorial} onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      className="active:scale-95 transition-transform"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, minWidth: 40 }}>
      <span style={{ width: 34, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c,
        background: tone === 'neutral' ? 'rgba(var(--ink),0.04)' : tone === 'add' ? 'rgba(62,168,104,0.10)' : 'rgba(239,68,68,0.10)',
        border: '1px solid ' + (tone === 'neutral' ? 'rgba(var(--ink),0.09)' : tone === 'add' ? 'rgba(62,168,104,0.35)' : 'rgba(239,68,68,0.35)') }}>
        {children}
      </span>
      <span className="xc-mono" style={{ fontSize: 7.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--ink),0.45)' }}>{label}</span>
    </button>
  );
}

// Header tool-rail button (PC / PRs / Demo). onClick, aria-label,
// data-tutorial and title pass through ...rest.
// tone 'add' / 'del' colours the Add / Remove exercise buttons.
function ToolBtn({ icon, label, on = false, tone, ...rest }) {
  const toned = tone === 'add' || tone === 'del';
  const tc = tone === 'add' ? XC_GREEN : XC_RED;
  return (
    <button type="button" {...rest} className="active:scale-95 transition-transform" style={{
      height: 32, padding: '0 7px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
      background: on ? 'rgba(239,68,68,0.14)' : toned ? (tone === 'add' ? 'rgba(62,168,104,0.10)' : 'rgba(239,68,68,0.10)') : 'rgba(var(--ink),0.04)',
      border: '1px solid ' + (on ? 'rgba(239,68,68,0.55)' : toned ? (tone === 'add' ? 'rgba(62,168,104,0.35)' : 'rgba(239,68,68,0.35)') : 'rgba(var(--ink),0.09)'),
      boxShadow: on ? '0 0 12px rgba(239,68,68,0.25)' : 'inset 0 1px 0 rgba(var(--ink),0.05)',
      color: on ? 'var(--fg)' : toned ? tc : 'rgba(var(--ink),0.8)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
      <span className="xc-mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
    </button>
  );
}

// Card shape inside a superset group: cards stack flush with no gap, with
// rounded corners only on the group's outer edges. The previous card's
// bottom border is the divider (middle/end cards drop their top border).
const SUPERSET_CARD_SHAPE = {
  only: 'rounded-[18px]',
  start: 'rounded-t-[18px]',
  middle: '',
  end: 'rounded-b-[18px]',
};

function ExerciseCard({ exercise, exerciseKey, entries, pbs, onChange, onBlur, readOnly, inputsLocked, onLockedTap, onCompletedSetTap, completedSets, autoFilled, onToggleComplete, onAddSet, onDeleteSet, onReorderSets, onSwapExercise, onAddExercise, onDeleteExercise, onMoveUp, onMoveDown, onShowPRs, note, onNoteChange, weightSuggestion, onApplySuggestion, onApplyCalculatedWeight, goalOverrides, onGoalChange, allWorkoutExercises, lastEntries, forceShowDemo, mode = 'session', dataTutorial, showGoalWeight = true, showGoalReps = true, showSetType = true, exerciseNumber, cardioEnabled = false, cardioSelections, onCardioChange, cardTheme = 'light', onEnterFullScreen, fullScreen = false, onOpenSupersetPicker, supersetPosition = null }) {
  // 'light' = #e8e8e8 card with dark text (default)
  // 'dark'  = transparent card, white text — page bg shows through
  // Card colour follows the page: the session's default black page gets
  // black cards; cardTheme 'dark' (historical name) puts the session on the
  // light #e8e8e8 page, so its cards are white.
  const blackCards = cardTheme !== 'dark';
  const isTemplate = mode === 'template';
  // Use exerciseKey (unique per card) for set-level keys; fall back to exercise.name
  const keyName = exerciseKey || exercise.name;
  const { exercises: allExercises } = useExercises();
  const dbExercise = allExercises.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
  // Per-template video override (template_exercises.video_url). YouTube URLs
  // are converted to bare IDs so the iframe renderer works; non-YouTube URLs
  // (e.g. mp4 paths) pass through as-is and render via <video src>.
  const overrideVideoUrl = exercise.videoUrl || '';
  const ytIdMatch = overrideVideoUrl
    ? overrideVideoUrl.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{6,})/)
    : null;
  const overrideVideoId = ytIdMatch ? ytIdMatch[1] : (overrideVideoUrl || null);
  const videoId = overrideVideoId || getExerciseVideoId(exercise.name, dbExercise?.videoId);
  // CDN-hosted demo videos (e.g. replab-videos.onrender.com) play inline
  // via <video src>. YouTube IDs open externally instead — the native
  // app's WebView doesn't run on a real http(s) origin, which YouTube's
  // embedded player requires, so an in-app iframe just errors out. This
  // is a placeholder until each exercise has its own CDN-hosted video.
  const isCdnVideo = !!videoId && (videoId.startsWith('http') || videoId.startsWith('/'));
  const [showVideo, setShowVideo] = useState(false);
  // Full-screen mode is positioned as a beginner-friendly view: when the
  // exercise has a linked demo video, the inline demo opens automatically so
  // the user sees the form video without hunting for the toggle. Regular
  // (scrolling) mode is for advanced users — demo stays collapsed by default.
  // The button still toggles per-exercise; on navigating to the next
  // exercise in full-screen, the effect below re-opens the demo.
  const [showDemoLocal, setShowDemoLocal] = useState(() => fullScreen && !!videoId);
  useEffect(() => {
    if (!fullScreen) return;
    setShowDemoLocal(!!videoId);
  }, [exerciseKey, fullScreen, videoId]);
  const showDemo = forceShowDemo || showDemoLocal;
  const [deleteIdx, setDeleteIdx] = useState(null);
  const deleteSetTrapRef = useFocusTrap(deleteIdx !== null);
  const [confirmDeleteLast, setConfirmDeleteLast] = useState(false);
  const confirmDeleteLastTrapRef = useFocusTrap(confirmDeleteLast);
  const [showSwap, setShowSwap] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  const [showAddBelow, setShowAddBelow] = useState(false);
  const addBelowRef = useRef(null);
  // When the inline "add exercise below" panel mounts, scroll the page so its
  // top edge sits at ~25% of viewport height (halfway between the top and the
  // vertical center). Without this, cards with many sets push the search bar
  // below the fold and new users can't see where to type. rAF defers the
  // measurement to after layout so getBoundingClientRect reads the real rect
  // rather than the pre-animation rect.
  useEffect(() => {
    if (!showAddBelow) return;
    const raf = requestAnimationFrame(() => {
      const el = addBelowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const targetTop = window.innerHeight * 0.25;
      const delta = rect.top - targetTop;
      if (Math.abs(delta) > 4) {
        window.scrollTo({ top: window.scrollY + delta, behavior: 'smooth' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [showAddBelow]);
  const [addBelowSearch, setAddBelowSearch] = useState('');
  // Index of the set whose weight input is currently driving the plate
  // calculator modal. null = modal closed. Set by long-press on a weight
  // input — in that case the modal pre-fills with the set's weight and
  // writes the chosen value back to that set on Use.
  const [plateCalcSetIdx, setPlateCalcSetIdx] = useState(null);
  // Separate "opened from the header ⚖ icon" flag. The header trigger
  // isn't tied to a specific set, so it pre-fills from the last weight
  // input the user focused (if any) and just closes on Use without
  // writing back. null = modal closed; true = open from header.
  const [plateCalcFromHeader, setPlateCalcFromHeader] = useState(false);
  const plateCalcLongPressRef = useRef(null);
  // Per-exercise-card plate-calculator memory, keyed by keyName. Each card
  // remembers the plate setup (weight/plates/bar/mode) it was last left with,
  // so reopening the calc for this exercise restores the user's real-world
  // load — they add or strip plates instead of rebuilding from the bare bar.
  // A freshly-switched card has no entry yet, so it opens at zero. Lives in a
  // ref because the modal unmounts on close (its own state can't survive), and
  // it's scoped to this card's lifetime (clears when the card unmounts at
  // session end). Both triggers (long-press + header ⚖) share this one slot.
  const plateCalcMemoryRef = useRef({});
  // Goal Weight / Goal Reps edit affordance — cells render as read-only
  // <div> displays by default (matching the original visual treatment,
  // dash shown as content not placeholder). Long-press (600ms, same
  // window as plate-calc) flips a single cell to a focused <input>
  // for editing; the input blurs back to display on focus loss. Key
  // format: `${setIdx}-weight` or `${setIdx}-reps`.
  const [editingGoalKey, setEditingGoalKey] = useState(null);
  const goalLongPressRef = useRef(null);
  function startGoalLongPress(setIdx, field) {
    if (!onGoalChange || readOnly || inputsLocked) return;
    if (goalLongPressRef.current) clearTimeout(goalLongPressRef.current);
    goalLongPressRef.current = setTimeout(() => {
      setEditingGoalKey(`${setIdx}-${field}`);
      goalLongPressRef.current = null;
    }, 600);
  }
  function cancelGoalLongPress() {
    if (goalLongPressRef.current) {
      clearTimeout(goalLongPressRef.current);
      goalLongPressRef.current = null;
    }
  }
  // Tracks the most recently focused set's weight input so the header
  // ⚖ icon can pre-fill the modal with the user's current row of focus.
  const lastFocusedSetIdxRef = useRef(null);

  const touchStartPos = useRef(null);
  const swipeRowRefs = useRef({});
  const swipeActive = useRef(false);

  // Sensors for set-row drag-and-drop. Touch uses a 500ms delay activation
  // so a quick tap (input focus) or short swipe (delete/complete) still
  // works — only a stationary long-press kicks off a drag. Mouse uses a
  // small distance constraint so a click doesn't accidentally start a drag.
  const sortableSensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleSetDragEnd = useCallback((event) => {
    if (!onReorderSets) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = Number(active.id);
    const toIdx = Number(over.id);
    if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
    onReorderSets(fromIdx, toIdx);
    navigator.vibrate?.(20);
  }, [onReorderSets]);

  // FLIP-style reorder animation. Each card tracks its layout position; when
  // it changes (because the user moved this card or an adjacent one), apply
  // an inverted transform and transition back to identity. The card the user
  // CLICKED also gets a brief lift effect (scale + shadow + raised z-index)
  // to make it visually clear which card moved vs. which was displaced. Same
  // mechanism animates inserts/deletes too — anything below shifts smoothly.
  const cardRef = useRef(null);
  const prevTopRef = useRef(null);
  const wasJustClickedRef = useRef(false);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const top = el.offsetTop;
    if (prevTopRef.current != null && prevTopRef.current !== top) {
      const dy = prevTopRef.current - top;
      const isClicked = wasJustClickedRef.current;
      wasJustClickedRef.current = false;

      el.style.transition = 'none';
      el.style.transform = isClicked ? `translateY(${dy}px) scale(1.03)` : `translateY(${dy}px)`;
      if (isClicked) {
        el.style.zIndex = '10';
        el.style.boxShadow = '0 16px 48px rgba(0,0,0,0.5)';
      }
      // Force reflow so the transition has something to interpolate FROM
      void el.offsetHeight;

      requestAnimationFrame(() => {
        el.style.transition = isClicked
          ? 'transform 320ms cubic-bezier(0.2, 0, 0, 1), box-shadow 320ms ease-out'
          : 'transform 280ms cubic-bezier(0.2, 0, 0, 1)';
        el.style.transform = '';
        if (isClicked) el.style.boxShadow = '';

        const onEnd = () => {
          el.style.transition = '';
          el.style.zIndex = '';
          el.removeEventListener('transitionend', onEnd);
        };
        el.addEventListener('transitionend', onEnd);
      });
    }
    prevTopRef.current = top;
  });

  const handleTouchStart = useCallback((idx, e) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY, idx };
    swipeActive.current = false;
    // Long-press is now owned by @dnd-kit's TouchSensor (it activates drag
    // after 500ms of stillness). Delete is still reachable via swipe-left.
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    const absDx = Math.abs(dx);

    // Activate swipe mode if horizontal movement dominates (session mode only)
    if (!isTemplate && absDx > 15 && absDx > dy * 1.5) {
      swipeActive.current = true;
    }

    if (swipeActive.current) {
      const clamped = Math.max(-100, Math.min(100, dx));
      const rowEl = swipeRowRefs.current[touchStartPos.current.idx];
      if (rowEl) {
        rowEl.style.transition = 'none';
        rowEl.style.transform = `translateX(${clamped}px)`;
      }
    }
  }, [isTemplate]);

  const handleTouchEnd = useCallback(() => {

    if (swipeActive.current && touchStartPos.current) {
      const idx = touchStartPos.current.idx;
      const rowEl = swipeRowRefs.current[idx];
      if (rowEl) {
        const currentX = parseFloat(rowEl.style.transform?.replace(/[^-\d.]/g, '') || '0');
        if (currentX > 60 && onToggleComplete) {
          onToggleComplete(keyName, idx);
        } else if (currentX < -60 && onDeleteSet) {
          onDeleteSet(keyName, idx);
        }
        rowEl.style.transition = 'transform 0.2s ease';
        rowEl.style.transform = 'translateX(0)';
      }
    }

    swipeActive.current = false;
    touchStartPos.current = null;
  }, [exercise.name, onToggleComplete, onDeleteSet]);

  // No demo video → confirm before leaving the app for a YouTube search.
  const [showYtSearchPrompt, setShowYtSearchPrompt] = useState(false);
  const closeYtSearchPrompt = useCallback(() => setShowYtSearchPrompt(false), []);
  const handleVideoClick = () => {
    if (videoId) {
      setShowVideo(true);
    } else {
      setShowYtSearchPrompt(true);
    }
  };

  // Card-level state for the "Active card" look. Sets checked off on this
  // card, the first unchecked set (the "active" row), and whether the card
  // still has work left (focused: red outline + shine).
  const doneCount = isTemplate ? 0 : exercise.sets.filter((_, i) => completedSets?.has(`${keyName}-${i}`)).length;
  const firstIncompleteIdx = isTemplate ? -1 : exercise.sets.findIndex((_, i) => !completedSets?.has(`${keyName}-${i}`));
  const isFocusedCard = firstIncompleteIdx !== -1;
  const muscleLabel = exercise.muscle || exercise.muscleGroup || dbExercise?.muscle || '';
  const lastFirst = lastEntries?.[0];
  const showLast = !isTemplate && !!lastFirst && (Number(lastFirst.weight) > 0 || lastFirst.weight === -1 || Number(lastFirst.reps) > 0 || Number(lastFirst.cardioValue) > 0);
  // Smart cardio: Conditioning exercises log the machine setting in the
  // first column and Time / Distance / Reps (chosen per set) in the second.
  // Template mode (Create / Edit Workout) keeps the normal layout.
  const cardioMode = !isTemplate && dbExercise?.muscle === CARDIO_MUSCLE;
  const cardioMachine = machineFor(exercise.name);
  const showFirstCol = !cardioMode || !cardioMachine.none;
  const lastText = !showLast ? ''
    : (lastFirst.cardioMetric
      ? formatCardioSet(exercise.name, lastFirst.weight, lastFirst.cardioMetric, lastFirst.cardioValue)
      : `${lastFirst.weight === -1 ? 'BW' : (lastFirst.weight ?? 0)}×${lastFirst.reps ?? 0}`);
  const menuLayout = CARD_CONTROLS_LAYOUT === 'menu' && !dataTutorial;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // Remove the last set — confirm first if it's already checked.
  const removeLastSet = () => {
    const lastIdx = exercise.sets.length - 1;
    const lastKey = `${keyName}-${lastIdx}`;
    if (completedSets?.has(lastKey)) {
      setConfirmDeleteLast(true);
    } else {
      onDeleteSet(exercise.name, lastIdx);
    }
  };
  const menuItems = [
    onMoveUp && { label: 'Move up', onClick: () => { wasJustClickedRef.current = true; onMoveUp(); }, icon: <path d="M4.5 15.75l7.5-7.5 7.5 7.5" /> },
    onMoveDown && { label: 'Move down', onClick: () => { wasJustClickedRef.current = true; onMoveDown(); }, icon: <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /> },
    onSwapExercise && { label: 'Swap exercise', onClick: () => { setShowSwap(true); setSwapSearch(''); }, icon: <path d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /> },
    onOpenSupersetPicker && !isTemplate && { label: exercise.supersetLabel ? `Superset ${exercise.supersetLabel}` : 'Add to superset', onClick: () => onOpenSupersetPicker(exerciseKey || exercise.name), icon: <path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /> },
    onAddExercise && { label: 'Add exercise below', onClick: () => { setShowAddBelow(true); setAddBelowSearch(''); }, icon: <path d="M12 4.5v15m7.5-7.5h-15" /> },
    onDeleteExercise && { divider: true },
    onDeleteExercise && { label: 'Remove exercise', tone: 'del', onClick: () => onDeleteExercise(), icon: <path d="M6 18L18 6M6 6l12 12" /> },
  ].filter(Boolean);
  const showMenuBtn = menuLayout && !readOnly && menuItems.some((it) => !it.divider);
  const showCheckCol = !isTemplate && !readOnly && !!onToggleComplete;
  const flushTop = supersetPosition === 'middle' || supersetPosition === 'end';

  return (
    <>
    <div ref={cardRef} data-tutorial={dataTutorial ? 'exercise-card' : undefined}
      className={`${blackCards ? 'xc-dark' : 'xc-light'}${fullScreen ? ' min-h-full' : ` overflow-hidden ${supersetPosition ? SUPERSET_CARD_SHAPE[supersetPosition] : 'mb-3'}`}`}
      style={{
        position: 'relative', borderRadius: supersetPosition ? undefined : 18,
        background: 'var(--card)', color: 'var(--fg)',
        border: isFocusedCard ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(var(--ink),0.07)',
        ...(flushTop ? { borderTop: 'none' } : {}),
        boxShadow: isFocusedCard ? 'var(--sh-focus)' : 'var(--sh)',
      }}>
      {isFocusedCard && <div className="xc-shine" aria-hidden="true" />}
      <div style={{ position: 'relative', zIndex: 2 }}>
      {/* Exercise Header — index tile, name, full-screen, then the tool
          rail (PC / PRs / Demo / Last). Sticky so it stays pinned while
          scrolling long set lists, especially in full-screen mode. */}
      <div data-tutorial={dataTutorial} className="sticky top-0 z-20" style={{ background: 'var(--card)' }}>
        <div style={{ padding: '13px 12px 11px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Index tile: the superset label (e.g. "A1") when set, otherwise the exercise number */}
          {(exercise.supersetLabel || exerciseNumber != null) && (
            <div className="xc-mono" style={{
              flex: '0 0 auto', width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
              color: exercise.supersetLabel ? 'var(--fg)' : 'rgba(var(--ink),0.6)',
              background: exercise.supersetLabel ? 'rgba(239,68,68,0.18)' : 'rgba(var(--ink),0.04)',
              border: '1px solid ' + (exercise.supersetLabel ? 'rgba(239,68,68,0.5)' : 'rgba(var(--ink),0.09)'),
            }}>{exercise.supersetLabel || String(exerciseNumber ?? '').padStart(2, '0')}</div>
          )}

          {/* Name block — tapping the name opens the superset picker */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {onOpenSupersetPicker && !readOnly && !isTemplate ? (
              <button
                type="button"
                data-tutorial={dataTutorial ? 'exercise-name' : undefined}
                onClick={(e) => { e.stopPropagation(); onOpenSupersetPicker(exerciseKey || exercise.name); }}
                aria-label={`Set superset group for ${exercise.name}`}
                className="superset-press-target active:opacity-70 transition-opacity"
                style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.012em', lineHeight: 1.2 }}
              >
                {exercise.name}
              </button>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.012em', lineHeight: 1.2 }}>{exercise.name}</div>
            )}
            <div className="xc-mono" style={{ fontSize: 8.5, letterSpacing: '0.2em', color: 'rgba(var(--ink),0.42)', textTransform: 'uppercase', marginTop: 4 }}>
              {muscleLabel ? `${muscleLabel} · ` : ''}{isTemplate ? `${exercise.sets.length} set${exercise.sets.length !== 1 ? 's' : ''}` : `${doneCount}/${exercise.sets.length} sets`}
              {showLast && (
                <span> · Last <span style={{ color: 'rgba(var(--ink),0.6)' }}>{lastText}</span></span>
              )}
            </div>
          </div>

          {/* Full-screen — hidden when the parent doesn't supply onEnterFullScreen */}
          {!isTemplate && onEnterFullScreen && (
            <button
              type="button"
              data-tutorial={dataTutorial ? 'full-screen' : undefined}
              onClick={(e) => { e.stopPropagation(); onEnterFullScreen(exerciseKey); }}
              aria-label={`Enter full-screen mode for ${exercise.name}`}
              title="Full-screen"
              className="active:scale-90 transition-transform"
              style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: 9, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--ink),0.04)', border: '1px solid rgba(var(--ink),0.09)', color: 'rgba(var(--ink),0.75)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            </button>
          )}
        </div>

        {/* Tool rail — PC / PRs / Demo, then Add / Remove exercise on the
            right. Template mode (Create / Edit Workout) shows only Add / Remove. */}
        {(!isTemplate || showMenuBtn || (!menuLayout && !readOnly && (onAddExercise || onDeleteExercise))) && (
          <div style={{ padding: '0 12px 12px', display: 'flex', gap: 5 }}>
            {!isTemplate && !readOnly && (
              <ToolBtn
                label="PC"
                data-tutorial={dataTutorial ? 'plate-calc' : undefined}
                onClick={(e) => { e.stopPropagation(); setPlateCalcFromHeader(true); }}
                aria-label={`Open plate calculator for ${exercise.name}`}
                title="Plate calculator"
                icon={<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.5" /><path d="M12 3.5v3M12 17.5v3" /></>}
              />
            )}
            {!isTemplate && onShowPRs && (
              <ToolBtn
                label="PRs"
                data-tutorial={dataTutorial ? 'prs-button' : undefined}
                onClick={(e) => { e.stopPropagation(); onShowPRs(exercise.name); }}
                aria-label={`View personal records for ${exercise.name}`}
                icon={<><path d="M7 4h10v3a5 5 0 01-10 0V4z" /><path d="M7 5H4.5v1A3 3 0 007 9M17 5h2.5v1A3 3 0 0117 9M12 12v3.5M9 20h6M10 20c0-1.3.7-2 2-2s2 .7 2 2" /></>}
              />
            )}
            {!isTemplate && (
              <ToolBtn
                label="Demo"
                on={showDemo}
                data-tutorial={dataTutorial ? 'demo-button' : undefined}
                onClick={(e) => { e.stopPropagation(); videoId ? setShowDemoLocal(!showDemoLocal) : handleVideoClick(); }}
                icon={<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />}
              />
            )}
            {showMenuBtn && (
              <>
                <button
                  ref={menuBtnRef}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                  aria-label={`More actions for ${exercise.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="active:scale-95 transition-transform"
                  style={{
                    marginLeft: 'auto', flexShrink: 0, width: 38, height: 32, borderRadius: 10, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: menuOpen ? 'rgba(var(--ink),0.10)' : 'rgba(var(--ink),0.04)',
                    border: '1px solid rgba(var(--ink),' + (menuOpen ? '0.18' : '0.09') + ')',
                    color: 'rgba(var(--ink),0.8)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                </button>
                {menuOpen && (
                  <CardMenu anchorRef={menuBtnRef} themeClass={blackCards ? 'xc-dark' : 'xc-light'} items={menuItems} onClose={closeMenu} />
                )}
              </>
            )}
            {!menuLayout && !readOnly && (onAddExercise || onDeleteExercise) && (
              <span data-tutorial={dataTutorial ? 'add-delete-buttons' : undefined} style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                {onAddExercise && (
                  <ToolBtn
                    label="Add"
                    tone="add"
                    aria-label="Add exercise below"
                    onClick={(e) => { e.stopPropagation(); setShowAddBelow(true); setAddBelowSearch(''); }}
                    icon={<path d="M12 4.5v15m7.5-7.5h-15" />}
                  />
                )}
                {onDeleteExercise && (
                  <ToolBtn
                    label="Remove"
                    tone="del"
                    aria-label="Delete exercise"
                    onClick={(e) => { e.stopPropagation(); onDeleteExercise(); }}
                    icon={<path d="M6 18L18 6M6 6l12 12" />}
                  />
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {showYtSearchPrompt && (
        <YouTubeSearchPrompt
          onConfirm={() => window.open(getExerciseSearchUrl(exercise.name), '_blank')}
          onClose={closeYtSearchPrompt}
        />
      )}

      {/* Inline Demo Section */}
      {showDemo && videoId && (
        <div style={{ margin: '0 12px 12px', borderRadius: 14, overflow: 'hidden', aspectRatio: '16 / 9', background: 'radial-gradient(120% 100% at 30% 0%, #26262a, #050506)', border: '1px solid rgba(255,255,255,0.10)' }}>
          {isCdnVideo ? (
            <video src={videoId} className="w-full h-full object-contain" controls playsInline preload="metadata" controlsList="nodownload" />
          ) : (
            // YouTube plays inline. In the native app it goes through the
            // /yt-embed shim on the real domain (the WebView's
            // capacitor://localhost origin gets YouTube error 153 when it
            // embeds directly — see server/index.js); the web app has a real
            // origin and embeds YouTube directly. Same as ExerciseDetail.jsx.
            <iframe
              src={Capacitor.isNativePlatform()
                ? `https://replab-fitness.com/yt-embed/${videoId}`
                : `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&autoplay=1&rel=0&modestbranding=1`}
              title={`${exercise.name} form video`}
              style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#000' }}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
      )}
      {/* Fallback if a YouTube video won't play inline */}
      {showDemo && videoId && !isCdnVideo && (
        <div style={{ margin: '-6px 12px 12px', textAlign: 'right' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank'); }}
            className="xc-mono active:opacity-70"
            style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--ink),0.45)' }}
          >
            Open in YouTube ↗
          </button>
        </div>
      )}

      {/* Exercise Description (from template) */}
      {exercise.exerciseDescription && (
        <div style={{ padding: '0 12px 12px' }}>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(var(--ink),0.6)', margin: 0 }}>{exercise.exerciseDescription}</p>
        </div>
      )}

      {/* Controls strip — Up / Down / Swap / SS | Remove Set / Add Set ('rows' layout) */}
      {!readOnly && !menuLayout && (
        <div style={{ margin: '0 12px', padding: '9px 6px 8px', borderRadius: 13, background: 'var(--strip)', border: XC_LINE, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Swap sits outside the move-buttons span so the tutorial's move
              highlight still covers only the arrows. */}
          <span style={{ display: 'flex', gap: 4 }}>
            <span data-tutorial={dataTutorial ? 'move-buttons' : undefined} style={{ display: 'flex', gap: 4 }}>
              {onMoveUp && (
                <CardControlButton label="Up" ariaLabel="Move exercise up" onClick={() => { wasJustClickedRef.current = true; onMoveUp(); }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                </CardControlButton>
              )}
              {onMoveDown && (
                <CardControlButton label="Down" ariaLabel="Move exercise down" onClick={() => { wasJustClickedRef.current = true; onMoveDown(); }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                </CardControlButton>
              )}
            </span>
            {onSwapExercise && (
              <CardControlButton label="Swap" ariaLabel="Swap exercise" dataTutorial={dataTutorial ? 'swap-button' : undefined} onClick={() => { setShowSwap(true); setSwapSearch(''); }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
              </CardControlButton>
            )}
            {/* SS — same picker as tapping the exercise name. Cards that share
                a superset letter are grouped together in the session. */}
            {onOpenSupersetPicker && !isTemplate && (
              <CardControlButton
                label="SS"
                ariaLabel={exercise.supersetLabel ? `Superset ${exercise.supersetLabel} — change` : `Add ${exercise.name} to a superset`}
                dataTutorial={dataTutorial ? 'superset-button' : undefined}
                onClick={() => onOpenSupersetPicker(exerciseKey || exercise.name)}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
              </CardControlButton>
            )}
          </span>
          {onAddSet && (
            <>
              <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(var(--ink),0.07)' }} />
              {/* Remove Set sits left of Add Set so Add Set stays anchored at
                  the right edge and repeated taps land in the same spot. */}
              <span data-tutorial={dataTutorial ? 'set-controls' : undefined} style={{ display: 'flex', gap: 10 }}>
                {onDeleteSet && exercise.sets.length > 1 && (
                  <CardControlButton
                    label="Remove Set"
                    ariaLabel="Remove last set"
                    variant="red"
                    onClick={() => {
                      const lastIdx = exercise.sets.length - 1;
                      const lastKey = `${keyName}-${lastIdx}`;
                      if (completedSets?.has(lastKey)) {
                        setConfirmDeleteLast(true);
                      } else {
                        onDeleteSet(exercise.name, lastIdx);
                      }
                    }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                  </CardControlButton>
                )}
                <CardControlButton label="Add Set" ariaLabel="Add set" variant="green" onClick={() => onAddSet(exercise.name)}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </CardControlButton>
              </span>
            </>
          )}
        </div>
      )}

      {/* Column headers — Goal Wt / Goal Reps get their own columns when
          those settings are on (session mode only). */}
      <div className="xc-mono" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 12px 6px', fontSize: 7.5, letterSpacing: '0.12em', color: 'rgba(var(--ink),0.35)', textTransform: 'uppercase', lineHeight: 1.25 }}>
        {showCheckCol && <span style={{ flex: '0 0 30px', textAlign: 'center' }}>✓</span>}
        <span style={{ flex: '0 0 34px', textAlign: 'center' }}>Set</span>
        {cardioMode ? (
          <>
            {showFirstCol && showGoalWeight && <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>Goal</span>}
            {showFirstCol && <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{cardioMachine.label}</span>}
            {showGoalReps && <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>Goal</span>}
            <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>Amount</span>
          </>
        ) : (
          <>
            {!isTemplate && showGoalWeight && <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>Goal Wt</span>}
            <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{!isTemplate && showGoalWeight ? 'Actual Wt' : 'Weight · lb'}</span>
            {!isTemplate && showGoalReps && <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>Goal Reps</span>}
            <span style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>{!isTemplate && showGoalReps ? 'Actual Reps' : 'Reps'}</span>
          </>
        )}
      </div>

      {/* Set Rows — wrapped in dnd-kit so long-press initiates a drag-to-
          reorder. Completed sets (and template/readOnly modes) are passed
          `disabled` so they're not draggable but still render in place. */}
      <DndContext sensors={sortableSensors} collisionDetection={closestCenter} onDragEnd={handleSetDragEnd}>
        <SortableContext items={exercise.sets.map((_, i) => i)} strategy={verticalListSortingStrategy}>
      <div>
        {exercise.sets.map((set, idx) => {
          const entry = entries?.[idx] || {};
          const setKey = `${keyName}-${idx}`;
          const isCompleted = !isTemplate && completedSets?.has(setKey);
          const isAutoFill = !isTemplate && autoFilled?.has(setKey) && !isCompleted;
          const isActive = !isTemplate && idx === firstIncompleteIdx;
          const isSwipeable = !isTemplate && !readOnly;
          // A checked set's weight, reps and set type are frozen so a PR can't
          // be changed by accident — uncheck the set to edit it.
          const setLocked = isCompleted && !!onToggleComplete;
          const setType = entry.setType || exercise.setType || 'straight';
          const typeChip = setType === 'straight'
            ? { text: 'STD', color: 'rgba(var(--ink),0.3)', bg: 'transparent', border: 'rgba(var(--ink),0.08)' }
            : setType === 'warm_up'
              ? { text: 'W', color: 'rgba(var(--ink),0.65)', bg: 'rgba(var(--ink),0.06)', border: 'rgba(var(--ink),0.14)' }
              : { text: getSetTypeShort(setType), color: XC_RED, bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' };
          // Row tint over an opaque base so the swipe actions stay hidden.
          const rowTint = isCompleted ? 'rgba(62,168,104,0.05)' : isActive ? 'rgba(239,68,68,0.045)' : 'transparent';
          const cellStyle = {
            flex: 1, minWidth: 0, height: 46, borderRadius: 11, position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            background: isCompleted ? 'rgba(var(--ink),0.02)' : 'var(--well)',
            border: isActive ? '1px solid rgba(var(--ink),0.22)' : XC_IN,
          };
          const inputStyle = {
            width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: 0, textAlign: 'center',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
            color: isCompleted ? 'rgba(var(--ink),0.55)' : isAutoFill ? 'rgba(var(--ink),0.4)' : 'var(--fg)',
            fontStyle: isAutoFill ? 'italic' : 'normal',
          };
          // Goal cells: a quieter well than the actual-value cells, with the
          // goal number in muted red (long-press to edit).
          const goalCellStyle = {
            ...cellStyle,
            background: 'rgba(var(--ink),0.025)',
            border: XC_LINE,
          };
          const goalLineStyle = {
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'rgba(239,68,68,0.65)',
            whiteSpace: 'nowrap',
          };
          const goalInputStyle = { ...inputStyle, fontSize: 15, color: 'rgba(239,68,68,0.85)', fontStyle: 'normal' };
          const fmtGoal = (v) => (v === '' || v === undefined || v === null ? '—' : (Number(v) === -1 ? 'BW' : v));
          const rowContent = (
            <div
              ref={!isTemplate ? (el) => { swipeRowRefs.current[idx] = el; } : undefined}
              data-tutorial={dataTutorial && idx === 0 ? 'set-row' : undefined}
              className="transition-colors duration-200"
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                // Divider drawn as an inset shadow over the opaque row background
                // (a translucent border would let the swipe panels show through).
                boxShadow: idx === 0 ? 'none' : 'inset 0 1px 0 rgba(var(--ink),0.06)',
                background: `linear-gradient(${rowTint}, ${rowTint}), var(--row)`,
              }}
              onTouchStart={isSwipeable ? (e) => handleTouchStart(idx, e) : undefined}
              onTouchEnd={isSwipeable ? handleTouchEnd : undefined}
              onTouchMove={isSwipeable ? handleTouchMove : undefined}
              onContextMenu={!readOnly && onDeleteSet ? (e) => { e.preventDefault(); setDeleteIdx(idx); } : undefined}
            >
              {isActive && (
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 2, background: XC_RED, boxShadow: '0 0 8px rgba(239,68,68,.8)' }} />
              )}
              {/* Lock on checked sets — uncheck to edit */}
              {isCompleted && setLocked && (
                <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: 4, right: 5, color: 'rgba(var(--ink),0.3)' }}>
                  <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
                </svg>
              )}

              {/* Checkmark — session mode only */}
              {showCheckCol && (
                <button
                  type="button"
                  onClick={() => onToggleComplete(exercise.name, idx)}
                  aria-label={isCompleted ? 'Mark set incomplete' : 'Mark set complete'}
                  className="transition-all duration-200"
                  style={{
                    flex: '0 0 30px', width: 30, height: 30, borderRadius: 9, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCompleted ? XC_GREEN : 'rgba(var(--ink),0.04)',
                    border: '1px solid ' + (isCompleted ? XC_GREEN : isActive ? 'rgba(239,68,68,0.5)' : 'rgba(var(--ink),0.10)'),
                    boxShadow: isCompleted ? '0 0 0 3px rgba(62,168,104,0.15)' : 'none',
                  }}
                >
                  {isCompleted && (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )}

              {/* Set number + set-type chip. The type picker is an invisible
                  <select> over the column; the chip shows the shorthand. */}
              <div style={{ flex: '0 0 34px', width: 34, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span className="xc-mono" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(var(--ink),0.75)', lineHeight: 1 }}>
                  {isTemplate ? idx + 1 : set.setNumber}
                </span>
                {showSetType && (
                  <>
                    <span className="xc-mono" style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1, padding: '2px 4px', borderRadius: 5, color: typeChip.color, background: typeChip.bg, border: '1px solid ' + typeChip.border, pointerEvents: 'none' }}>
                      {typeChip.text}
                    </span>
                    {!readOnly && (
                      <select
                        aria-label={`Set ${idx + 1} type`}
                        disabled={setLocked}
                        onPointerDown={setLocked && onCompletedSetTap ? (e) => { e.preventDefault(); onCompletedSetTap(); } : undefined}
                        value={setType}
                        onChange={(e) => onChange?.(exercise.name, idx, 'setType', e.target.value)}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, appearance: 'none', cursor: 'pointer' }}
                      >
                        {SET_TYPES.map(t => (
                          <option key={t.value} value={t.value} className="bg-wf-gray-900 text-white text-sm">
                            {t.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>

              {/* Goal weight cell (long-press to edit), then the weight cell.
                  Long-press (600ms) on the weight input opens
                  the plate calculator pre-filled with this set's weight;
                  movement during the press cancels so scrolling doesn't
                  trigger it. */}
              {!isTemplate && showGoalWeight && showFirstCol && (
              <div className="xc-cell" style={goalCellStyle}>
                {(() => {
                  const overrideWeight = goalOverrides?.[idx]?.weight;
                  const lastAt = lastEntries?.[idx]?.weight;
                  const lastFirstW = lastEntries?.[0]?.weight;
                  const displayValue = overrideWeight !== undefined
                    ? overrideWeight
                    : (lastAt !== undefined && lastAt !== null && lastAt !== ''
                      ? lastAt
                      : (idx >= (lastEntries?.length || 0) && lastFirstW !== undefined && lastFirstW !== null && lastFirstW !== '' ? lastFirstW : ''));
                  const editingThis = editingGoalKey === `${idx}-weight`;
                  const editable = !!onGoalChange && !readOnly && !inputsLocked;
                  return editingThis ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="9999"
                      aria-label={`Set ${idx + 1} goal weight`}
                      value={displayValue}
                      autoFocus
                      onChange={(e) => onGoalChange?.(exercise.name, idx, 'weight', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => setEditingGoalKey(null)}
                      className="xc-input"
                      style={goalInputStyle}
                    />
                  ) : (
                    <div
                      role={editable ? 'button' : undefined}
                      tabIndex={editable ? 0 : undefined}
                      aria-label={editable ? `Set ${idx + 1} goal weight (long-press to edit)` : undefined}
                      onPointerDown={editable ? () => startGoalLongPress(idx, 'weight') : undefined}
                      onPointerUp={editable ? cancelGoalLongPress : undefined}
                      onPointerLeave={editable ? cancelGoalLongPress : undefined}
                      onPointerMove={editable ? cancelGoalLongPress : undefined}
                      onPointerCancel={editable ? cancelGoalLongPress : undefined}
                      onContextMenu={editable ? (e) => e.preventDefault() : undefined}
                      className="xc-mono select-none"
                      style={{ ...goalLineStyle, cursor: editable ? 'pointer' : 'default' }}
                    >
                      {fmtGoal(displayValue)}
                    </div>
                  );
                })()}
              </div>
              )}
              {showFirstCol && (
              <div className="xc-cell" style={cellStyle}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="9999"
                  aria-label={cardioMode ? `Set ${idx + 1} ${cardioMachine.label}` : `Set ${idx + 1} weight`}
                  value={entry.weight ?? (isTemplate ? '' : set.suggestedWeight ?? '')}
                  placeholder="—"
                  onChange={(e) => onChange?.(exercise.name, idx, 'weight', e.target.value)}
                  onFocus={(e) => {
                    if (inputsLocked && onLockedTap) { e.target.blur(); onLockedTap(); return; }
                    if (setLocked) { e.target.blur(); onCompletedSetTap?.(); return; }
                    lastFocusedSetIdxRef.current = idx;
                    e.target.select();
                  }}
                  onBlur={() => onBlur?.(exercise.name, idx, 'weight')}
                  onPointerDown={(readOnly || inputsLocked || setLocked || cardioMode) ? undefined : () => {
                    plateCalcLongPressRef.current = setTimeout(() => {
                      setPlateCalcSetIdx(idx);
                    }, 600);
                  }}
                  onPointerUp={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onPointerMove={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onPointerCancel={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onPointerLeave={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onContextMenu={(e) => e.preventDefault()}
                  readOnly={readOnly || inputsLocked || setLocked}
                  className="xc-input disabled:opacity-50"
                  style={inputStyle}
                  disabled={readOnly}
                />
              </div>
              )}

              {/* Goal reps cell (long-press to edit). Cardio cards show last
                  session's value with its unit, read-only. */}
              {cardioMode && showGoalReps && (
                <div className="xc-cell" style={goalCellStyle}>
                  {(() => {
                    const last = lastEntries?.[idx] || (idx >= (lastEntries?.length || 0) ? lastEntries?.[0] : null);
                    const v = Number(last?.cardioValue);
                    return (
                      <div className="xc-mono select-none" style={{ ...goalLineStyle, fontSize: 12 }}>
                        {Number.isFinite(v) && v > 0 ? `${Math.round(v * 100) / 100} ${metricUnit(last.cardioMetric, exercise.name)}` : '—'}
                      </div>
                    );
                  })()}
                </div>
              )}
              {!isTemplate && !cardioMode && showGoalReps && (
              <div className="xc-cell" style={goalCellStyle}>
                {(() => {
                  const overrideReps = goalOverrides?.[idx]?.reps;
                  const lastAt = lastEntries?.[idx]?.reps;
                  const lastFirstR = lastEntries?.[0]?.reps;
                  const displayValue = overrideReps !== undefined
                    ? overrideReps
                    : (lastAt !== undefined && lastAt !== null && lastAt !== ''
                      ? lastAt
                      : (idx >= (lastEntries?.length || 0) && lastFirstR !== undefined && lastFirstR !== null && lastFirstR !== '' ? lastFirstR : ''));
                  const editingThis = editingGoalKey === `${idx}-reps`;
                  const editable = !!onGoalChange && !readOnly && !inputsLocked;
                  return editingThis ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max="9999"
                      aria-label={`Set ${idx + 1} goal reps`}
                      value={displayValue}
                      autoFocus
                      onChange={(e) => onGoalChange?.(exercise.name, idx, 'reps', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => setEditingGoalKey(null)}
                      className="xc-input"
                      style={goalInputStyle}
                    />
                  ) : (
                    <div
                      role={editable ? 'button' : undefined}
                      tabIndex={editable ? 0 : undefined}
                      aria-label={editable ? `Set ${idx + 1} goal reps (long-press to edit)` : undefined}
                      onPointerDown={editable ? () => startGoalLongPress(idx, 'reps') : undefined}
                      onPointerUp={editable ? cancelGoalLongPress : undefined}
                      onPointerLeave={editable ? cancelGoalLongPress : undefined}
                      onPointerMove={editable ? cancelGoalLongPress : undefined}
                      onPointerCancel={editable ? cancelGoalLongPress : undefined}
                      onContextMenu={editable ? (e) => e.preventDefault() : undefined}
                      className="xc-mono select-none"
                      style={{ ...goalLineStyle, cursor: editable ? 'pointer' : 'default' }}
                    >
                      {fmtGoal(displayValue)}
                    </div>
                  );
                })()}
              </div>
              )}

              {/* Reps cell */}
              <div className="xc-cell" style={cellStyle}>
                {isTemplate ? (
                  /* Template mode: editable Reps input */
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="9999"
                    aria-label={`Set ${idx + 1} reps`}
                    value={entry.reps ?? ''}
                    onChange={(e) => { const v = e.target.value; onChange?.(exercise.name, idx, 'reps', v === '' ? '' : Math.max(0, Number(v))); }}
                    onFocus={(e) => e.target.select()}
                    placeholder="—"
                    className="xc-input"
                    style={inputStyle}
                  />
                ) : cardioMode ? (
                  (() => {
                    // Per-set metric: tap the label to cycle Time → Dist →
                    // Reps. Later sets the user hasn't changed follow along.
                    const metric = entry.cardioMetric || DEFAULT_CARDIO_METRIC;
                    const unit = metricUnit(metric, exercise.name);
                    return (
                      <>
                        <button
                          type="button"
                          aria-label={`Set ${idx + 1}: logging ${METRIC_LABEL[metric]} — tap to change`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (inputsLocked && onLockedTap) { onLockedTap(); return; }
                            if (setLocked) { onCompletedSetTap?.(); return; }
                            if (readOnly) return;
                            const next = nextMetric(metric);
                            onChange?.(exercise.name, idx, 'cardioMetric', next);
                            onBlur?.(exercise.name, idx, 'cardioMetric', next);
                          }}
                          className="xc-mono"
                          style={{ background: 'none', border: 'none', padding: '0 4px', fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: XC_RED, lineHeight: 1, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {metric === 'reps' ? 'Reps' : unit} ▾
                        </button>
                        <input
                          type="number"
                          inputMode={metric === 'reps' ? 'numeric' : 'decimal'}
                          min="0"
                          max="99999"
                          step={metric === 'reps' ? '1' : '0.01'}
                          aria-label={`Set ${idx + 1} ${METRIC_LABEL[metric]} in ${unit}`}
                          value={entry.cardioValue ?? ''}
                          onChange={(e) => onChange?.(exercise.name, idx, 'cardioValue', e.target.value)}
                          onFocus={(e) => {
                            if (inputsLocked && onLockedTap) { e.target.blur(); onLockedTap(); return; }
                            if (setLocked) { e.target.blur(); onCompletedSetTap?.(); return; }
                            e.target.select();
                          }}
                          onBlur={() => onBlur?.(exercise.name, idx, 'cardioValue')}
                          readOnly={readOnly || inputsLocked || setLocked}
                          placeholder="—"
                          className="xc-input disabled:opacity-50"
                          style={{ ...inputStyle, fontSize: 16 }}
                          disabled={readOnly}
                        />
                      </>
                    );
                  })()
                ) : (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max="9999"
                      aria-label={`Set ${idx + 1} reps`}
                      value={entry.reps ?? ''}
                      onChange={(e) => { const v = e.target.value; onChange?.(exercise.name, idx, 'reps', v === '' ? '' : Math.max(0, Number(v))); }}
                      onFocus={(e) => {
                        if (inputsLocked && onLockedTap) { e.target.blur(); onLockedTap(); return; }
                        if (setLocked) { e.target.blur(); onCompletedSetTap?.(); return; }
                        e.target.select();
                      }}
                      onBlur={() => onBlur?.(exercise.name, idx, 'reps')}
                      readOnly={readOnly || inputsLocked || setLocked}
                      placeholder="—"
                      className="xc-input disabled:opacity-50"
                      style={inputStyle}
                      disabled={readOnly}
                    />
                  </>
                )}
              </div>
            </div>
          );

          // Between-set cardio card — only for cardio-acceleration programs,
          // session mode, and slots with a following set inside this exercise.
          const showCardio = cardioEnabled && !isTemplate && idx < exercise.sets.length - 1;
          const cardioSlotKey = `${keyName}-${idx}`;
          const cardioCard = showCardio ? (
            <CardioAccelerationCard
              value={cardioSelections?.[cardioSlotKey] || ''}
              onChange={(v) => onCardioChange?.(keyName, idx, v)}
              readOnly={readOnly}
            />
          ) : null;

          // Drag-to-reorder is disabled for completed sets (user shouldn't
          // be able to pick them up — see handleReorderSets in
          // WorkoutSession.jsx for the index-shift semantics for completed
          // sets that "slide" around an active drag) and any mode without a
          // reorder handler (template editing has its own UX, readOnly
          // mode is read-only).
          const dragDisabled = !onReorderSets || readOnly || isTemplate || isCompleted;
          // In session mode, wrap with swipe support. Action backgrounds
          // sit behind the row and are revealed as the row is dragged:
          //   • swipe right → green Complete (left edge)
          //   • swipe left  → red Delete (right edge)
          if (!isTemplate && !readOnly) {
            return (
              <SortableSetRow key={idx} id={idx} disabled={dragDisabled}>
                <div className="relative overflow-hidden">
                  {/* Green Complete — revealed when row is swiped right */}
                  <div
                    className="absolute top-[2px] bottom-[2px] left-0 flex items-center justify-start pl-5"
                    style={{ width: 100, background: '#22c55e', pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-0.5" style={{ color: '#fff' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Complete</span>
                    </div>
                  </div>
                  {/* Red Delete — revealed when row is swiped left */}
                  <div
                    className="absolute top-[2px] bottom-[2px] right-0 flex items-center justify-end pr-5"
                    style={{ width: 100, background: '#ef4444', pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-0.5" style={{ color: '#fff' }}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
                    </div>
                  </div>
                  {rowContent}
                </div>
                {cardioCard}
              </SortableSetRow>
            );
          }

          return (
            <SortableSetRow key={idx} id={idx} disabled={dragDisabled}>
              {rowContent}{cardioCard}
            </SortableSetRow>
          );
        })}
      </div>
        </SortableContext>
      </DndContext>

      {/* − Remove set / + Add set under the last set ('menu' layout). Add
          set stays on the right so repeated taps land in the same spot. */}
      {menuLayout && !readOnly && onAddSet && (
        <div data-tutorial={dataTutorial ? 'set-controls' : undefined} style={{ padding: '10px 12px', borderTop: XC_LINE, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {onDeleteSet && exercise.sets.length > 1 ? (
            <SetPill tone="del" label="Remove set" ariaLabel="Remove last set" onClick={removeLastSet} icon={<path d="M19.5 12h-15" />} />
          ) : <span />}
          <SetPill tone="add" label="Add set" ariaLabel="Add set" onClick={() => onAddSet(exercise.name)} icon={<path d="M12 4.5v15m7.5-7.5h-15" />} />
        </div>
      )}

      <div style={{ height: 10, borderTop: XC_LINE }} />

      {/* Program-provided note (xlsx column Q — "Failure / Workout Note").
          Static block above the user-editable notes so users see it but
          can't edit it. */}
      {exercise.programNotes && (
        <div style={{ margin: '0 12px 10px', padding: '9px 11px', borderRadius: 11, background: 'rgba(var(--ink),0.03)', border: XC_LINE }}>
          <p className="xc-mono" style={{ fontSize: 7.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: XC_RED, margin: '0 0 4px' }}>
            Program Note
          </p>
          <p style={{ fontSize: 11.5, fontStyle: 'italic', lineHeight: 1.5, color: 'rgba(var(--ink),0.7)', margin: 0 }}>{exercise.programNotes}</p>
        </div>
      )}

      {/* Notes */}
      {!readOnly && onNoteChange && (
        <div data-tutorial={dataTutorial ? 'exercise-notes' : undefined} style={{ padding: '0 12px 12px' }}>
          {note ? (
            <textarea
              value={note}
              onChange={(e) => onNoteChange(exercise.name, e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="xc-input"
              style={{ width: '100%', resize: 'none', fontSize: 13, lineHeight: 1.4, padding: '8px 10px', borderRadius: 10, background: 'var(--well)', border: XC_IN, color: 'rgba(var(--ink),0.8)', outline: 'none' }}
            />
          ) : (
            <button
              type="button"
              onClick={() => onNoteChange(exercise.name, ' ')}
              className="xc-mono active:scale-[0.99] transition-transform"
              style={{ width: '100%', height: 34, borderRadius: 10, border: '1px dashed rgba(var(--ink),0.14)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(var(--ink),0.55)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h9" /></svg>
              Add notes
            </button>
          )}
        </div>
      )}
      {readOnly && note && (
        <div style={{ padding: '0 12px 12px' }}>
          <p style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'rgba(var(--ink),0.6)', margin: 0 }}>{note}</p>
        </div>
      )}
      </div>

      {/* Delete Set Confirmation */}
      {deleteIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          onClick={() => setDeleteIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ec-delete-set-title"
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            ref={deleteSetTrapRef}
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ec-delete-set-title" className="text-base font-bold text-white text-center mb-1">Delete selected set?</h3>
            <p className="text-wf-gray-400 text-sm text-center mb-5">
              Set {deleteIdx + 1} of {exercise.name}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteIdx(null)}
                className="flex-1 glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteSet(exercise.name, deleteIdx);
                  setDeleteIdx(null);
                }}
                className="flex-1 bg-wf-red/90 hover:bg-wf-red text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Completed Last Set */}
      {confirmDeleteLast && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          onClick={() => setConfirmDeleteLast(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ec-confirm-delete-last-title"
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            ref={confirmDeleteLastTrapRef}
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="ec-confirm-delete-last-title" className="text-base font-bold text-white text-center mb-1">Delete completed set?</h3>
            <p className="text-wf-gray-400 text-sm text-center mb-5">
              Are you sure you want to delete a completed set?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteLast(false)}
                className="flex-1 glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteSet(exercise.name, exercise.sets.length - 1);
                  setConfirmDeleteLast(false);
                }}
                className="flex-1 bg-wf-red/90 hover:bg-wf-red text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Exercise Modal */}
      {showSwap && <SwapModal
        exerciseName={exercise.name}
        allExercises={allExercises}
        search={swapSearch}
        onSearchChange={setSwapSearch}
        onSelect={(newName) => {
          if (navigator.vibrate) navigator.vibrate(15);
          addToRecent(newName);
          onSwapExercise(exercise.name, newName);
          setShowSwap(false);
        }}
        onClose={() => setShowSwap(false)}
        allWorkoutExercises={allWorkoutExercises}
      />}

      {/* Video Player Modal */}
      {showVideo && videoId && (
        <VideoPlayerModal
          videoId={videoId}
          exerciseName={exercise.name}
          onClose={() => setShowVideo(false)}
        />
      )}

      {/* Plate Calculator Modal — opened by long-press on a weight input
          (per-set, writes back on Use) or by the ⚖ icon in the card
          header (informational; pre-fills from the last focused set's
          weight if any, otherwise opens at the bar). */}
      {plateCalcSetIdx !== null && (() => {
        const setEntry = entries?.[plateCalcSetIdx] || {};
        // Only pre-fill with the user's actually-logged weight. Skip the
        // template's suggestedWeight so the calc opens at a clean
        // bar-only state when the set hasn't been entered yet (modal
        // defaults target to bar weight when initialWeight is 0).
        const initial = Number(setEntry.weight) || 0;
        return (
          <PlateCalculatorModal
            open={true}
            initialWeight={initial}
            onUse={(weight) => {
              // Use writes to the first non-completed set and cascades to
              // remaining non-completed-non-user-edited sets, same as the
              // → Apply pill on the Per Side row. Falls back to writing
              // directly to the originating set if the WorkoutSession parent
              // didn't supply onApplyCalculatedWeight (e.g. the standalone
              // /plate-calculator utility page, which doesn't render this
              // modal from a card context).
              if (onApplyCalculatedWeight) {
                onApplyCalculatedWeight(exercise.name, Number(weight) || 0);
              } else if (onChange) {
                onChange(exercise.name, plateCalcSetIdx, 'weight', String(weight));
              }
              setPlateCalcSetIdx(null);
            }}
            onApplyToFirstUncompleted={onApplyCalculatedWeight ? (weight) => {
              onApplyCalculatedWeight(exercise.name, Number(weight) || 0);
              setPlateCalcSetIdx(null);
            } : undefined}
            restoreState={plateCalcMemoryRef.current[keyName] || null}
            defaults={plateCalcDefaults(exercise.name)}
            onPersist={(s) => { plateCalcMemoryRef.current[keyName] = s; }}
            onClose={() => setPlateCalcSetIdx(null)}
          />
        );
      })()}
      {plateCalcFromHeader && (() => {
        // Header-triggered: pick a sensible initial weight. If the user
        // most recently focused a weight input on this card, use that
        // set's current weight (or its suggested weight as a fallback).
        // Otherwise pass 0 so the modal falls back to bar weight (45).
        const lastIdx = lastFocusedSetIdxRef.current;
        let initial = 0;
        if (lastIdx !== null && lastIdx !== undefined) {
          const e = entries?.[lastIdx] || {};
          const s = exercise.sets?.[lastIdx] || {};
          initial = Number(e.weight) || Number(s.suggestedWeight) || 0;
        }
        return (
          <PlateCalculatorModal
            open={true}
            initialWeight={initial}
            onUse={(weight) => {
              // Same unified behavior as the long-press path: Use writes
              // to the first non-completed set (and cascades) regardless of
              // which trigger opened the modal. Falls back to the original
              // last-focused-set semantics if onApplyCalculatedWeight wasn't
              // supplied by the parent — keeps the standalone
              // /plate-calculator page working when it lacks session context.
              if (onApplyCalculatedWeight) {
                onApplyCalculatedWeight(exercise.name, Number(weight) || 0);
              } else {
                const idx = lastFocusedSetIdxRef.current;
                if (idx !== null && idx !== undefined && onChange) {
                  onChange(exercise.name, idx, 'weight', String(weight));
                }
              }
              setPlateCalcFromHeader(false);
            }}
            onApplyToFirstUncompleted={onApplyCalculatedWeight ? (weight) => {
              onApplyCalculatedWeight(exercise.name, Number(weight) || 0);
              setPlateCalcFromHeader(false);
            } : undefined}
            restoreState={plateCalcMemoryRef.current[keyName] || null}
            defaults={plateCalcDefaults(exercise.name)}
            onPersist={(s) => { plateCalcMemoryRef.current[keyName] = s; }}
            onClose={() => setPlateCalcFromHeader(false)}
          />
        );
      })()}

    </div>

      {/* Add Exercise Below — inline card */}
      {showAddBelow && onAddExercise && (() => {
        const allEx = allExercises;
        const q = addBelowSearch.toLowerCase().trim();
        const seen = new Set();
        // No cap — the dropdown body is `max-h-48 overflow-y-auto` so the
        // user can scroll the full filtered list. Capping at 8 hid the
        // rest behind the cut-off.
        const filtered = q
          ? allEx.filter((ex) => {
              if (seen.has(ex.name)) return false;
              seen.add(ex.name);
              return ex.name.toLowerCase().includes(q);
            })
          : [];
        return (
          <div ref={addBelowRef} className="glass-card rounded-xl overflow-hidden mb-3 border border-green-500/20 animate-drop-down">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <input
                type="text"
                value={addBelowSearch}
                onChange={(e) => setAddBelowSearch(e.target.value)}
                placeholder="Search for an exercise..."
                ref={iosFocusRef}
                // 16px (text-base) so iOS doesn't auto-zoom the page on focus.
                className="flex-1 bg-transparent text-white text-base font-semibold placeholder:text-wf-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowAddBelow(false)}
                aria-label="Close"
                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {/* Custom name option */}
              {q && !allEx.some((ex) => ex.name.toLowerCase() === q) && (
                <button
                  type="button"
                  onClick={() => { addToRecent(addBelowSearch.trim()); onAddExercise(addBelowSearch.trim()); setShowAddBelow(false); }}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-2 active:bg-white/10 transition-colors border-b border-white/5"
                >
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="text-sm text-white">Add "<span className="font-semibold">{addBelowSearch}</span>"</span>
                </button>
              )}
              {/* Search results */}
              {filtered.map((ex) => (
                <button
                  key={ex.name}
                  type="button"
                  onClick={() => { addToRecent(ex.name); onAddExercise(ex.name); setShowAddBelow(false); }}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between active:bg-white/10 transition-colors"
                >
                  <span className="text-sm text-white">{ex.name}</span>
                  <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider ml-2 shrink-0">{ex.muscle}</span>
                </button>
              ))}
              {/* Empty state */}
              {q && filtered.length === 0 && !allEx.some((ex) => ex.name.toLowerCase() === q) && (
                <p className="text-wf-gray-500 text-xs text-center py-4">Type to search or add a custom exercise</p>
              )}
              {!q && (() => {
                const recentNames = getRecent();
                const recentExercises = recentNames.map(n => allEx.find(e => e.name === n)).filter(Boolean).slice(0, 5);
                if (recentExercises.length === 0) return (
                  <p className="text-wf-gray-500 text-xs text-center py-4">Start typing to search exercises...</p>
                );
                return (
                  <>
                    <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mt-3 mb-2 px-4">Recently Used</p>
                    {recentExercises.map((ex) => (
                      <button
                        key={ex.name}
                        type="button"
                        onClick={() => { addToRecent(ex.name); onAddExercise(ex.name); setShowAddBelow(false); }}
                        className="w-full text-left px-4 py-2.5 flex items-center justify-between active:bg-white/10 transition-colors"
                      >
                        <span className="text-sm text-white">{ex.name}</span>
                        <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider ml-2 shrink-0">{ex.muscle}</span>
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}
    </>
  );
}

function SwapModal({ exerciseName, allExercises, search, onSearchChange, onSelect, onClose, allWorkoutExercises }) {
  const swapTrapRef = useFocusTrap(true);
  // Ensure allExercises have required fields, AND dedupe by name.
  // The library sometimes has the same exercise name tagged to multiple muscles,
  // which produces React "duplicate key" warnings downstream. First occurrence wins.
  const safeExercises = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const e of (allExercises || [])) {
      const key = (e.name || '').toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push({ ...e, muscle: e.muscle || '', tags: e.tags || [] });
    }
    return result;
  }, [allExercises]);
  const substitutes = useMemo(() => getSubstitutesFromList(exerciseName, safeExercises), [exerciseName, safeExercises]);

  // Body-part filter for the swap search. Pills are derived from the muscles
  // actually present in the available exercises ('all' first), mirroring the
  // Add Exercise search filter in WorkoutSession.
  const [muscleFilter, setMuscleFilter] = useState('all');
  const muscleList = useMemo(
    () => Array.from(new Set(safeExercises.map((e) => e.muscle).filter(Boolean))).sort(),
    [safeExercises]
  );

  const filtered = useMemo(() => {
    // Apply the body-part pill filter first, then the text search on top.
    let base = substitutes;
    if (muscleFilter !== 'all') {
      base = base.filter((e) => (e.muscle || '').toLowerCase() === muscleFilter.toLowerCase());
    }
    if (!search.trim()) return base;
    const q = search.toLowerCase().trim();
    // Score results by match quality so prefix/word-start matches rank above
    // buried substring matches. Keeps "row" → "Barbell Row" above
    // "Single-Arm Arrow Shoulder Fly" (contrived example).
    return base
      .map((e) => {
        const name = (e.name || '').toLowerCase();
        const muscle = (e.muscle || '').toLowerCase();
        const words = name.split(/\s+/);
        let relevance = 0;
        if (name === q) relevance = 100;
        else if (name.startsWith(q)) relevance = 60;
        else if (words.some((w) => w.startsWith(q))) relevance = 40;
        else if (name.includes(q)) relevance = 25;
        else if (muscle === q) relevance = 15;
        else if (muscle.includes(q)) relevance = 10;
        return { ...e, relevance };
      })
      .filter((e) => e.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || a.name.localeCompare(b.name));
  }, [substitutes, search, muscleFilter]);

  // Only used when NOT searching: group by same-muscle score.
  // When searching, we render a single flat relevance-sorted list.
  const suggested = filtered.filter((e) => e.score >= 12);
  const others = filtered.filter((e) => !e.score || e.score < 12);

  // Portal to document.body to escape any transformed ancestor
  // (e.g. the `.fade-slide-up` wrapper around each exercise card), which would
  // otherwise trap our `position: fixed` inside the card.
  // z-[110] so the modal renders ABOVE the full-screen exercise overlay
  // (WorkoutSession.jsx:2482, portal'd to body at z-[90]); plain z-50 was
  // hidden behind that overlay when the user opened swap from inside
  // full-screen mode. Matches the tier other "above full-screen" modals
  // in WorkoutSession.jsx already use.
  // Guard against transient HMR / SSR states where document.body is not ready.
  if (typeof document === 'undefined' || !document.body) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-title"
    >
      <div className="absolute inset-0 bg-black/80" />
      <div
        ref={swapTrapRef}
        className="relative mt-auto mb-20 w-[calc(100%-32px)] max-w-md h-[75vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          // Static red -> white hotspot -> red gradient border, matching the
          // top accent bar on the Will's Hypertrophy featured program card.
          // background-clip trick keeps the rounded corners working:
          // inner bg fills the padding-box, gradient fills the border-box.
          border: '1px solid transparent',
          background:
            'linear-gradient(#111111, #111111) padding-box, ' +
            'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,1) 45%, rgba(255,255,255,0.8) 50%, rgba(239,68,68,1) 55%, rgba(239,68,68,0.15) 100%) border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 id="swap-title" className="text-lg font-black text-white">Swap Exercise</h3>
            <button onClick={onClose} aria-label="Close" className="text-wf-gray-400 active:opacity-70">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-wf-gray-500 text-xs mb-3">
            Replacing <span className="text-white font-semibold">{exerciseName}</span>
          </p>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search exercises..."
              ref={iosFocusRef}
              className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none"
            />
          </div>
          {/* Body-part filter pills — narrow the swap results by muscle group.
              Horizontal scroll so the row never blows out the modal width. */}
          {muscleList.length > 0 && (
            <div className="-mx-4 mt-3 px-4 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {[{ value: 'all', label: 'All' }, ...muscleList.map((m) => ({ value: m, label: m }))].map((f) => {
                const isActive = muscleFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setMuscleFilter(f.value)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.97] ${
                      isActive
                        ? 'bg-wf-red text-white'
                        : 'bg-white/5 text-white/60 border border-white/10'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto px-4 pb-20">
          {/* Custom exercise option — always the first option when user has typed something
              and no exact match exists in the library. */}
          {search.trim() && !allExercises.some((ex) => ex.name.toLowerCase() === search.trim().toLowerCase()) && (
            <>
              <button
                onClick={() => onSelect(search.trim())}
                className="w-full text-left rounded-xl px-3 py-3 flex items-center gap-3 bg-wf-red/10 active:bg-wf-red/20 active:scale-[0.98] transition-all mb-2 mt-3"
              >
                <svg className="w-5 h-5 text-wf-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="text-sm text-white">Add "<span className="font-semibold">{search.trim()}</span>" as custom exercise</span>
              </button>
              {filtered.length > 0 && <div className="border-t border-white/5 my-2" />}
            </>
          )}

          {!search.trim() && (() => {
            const recentNames = getRecent();
            const recentExercises = recentNames.map(n => substitutes.find(e => e.name === n) || allExercises.find(e => e.name === n)).filter(Boolean).slice(0, 5);
            if (recentExercises.length === 0) return null;
            return (
              <>
                <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mt-3 mb-2">Recently Used</p>
                {recentExercises.map((ex) => (
                  <ExerciseOption key={ex.name} exercise={ex} onSelect={(name) => { addToRecent(name); onSelect(name); }} />
                ))}
              </>
            );
          })()}

          {/* When searching: flat list sorted by search relevance (no suggested/others split) */}
          {search.trim() && filtered.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mb-2">Matches</p>
              {filtered.map((ex) => (
                <ExerciseOption key={ex.name} exercise={ex} onSelect={onSelect} />
              ))}
            </div>
          )}

          {/* When not searching: suggested (same muscle) + all exercises */}
          {!search.trim() && suggested.length > 0 && (
            <>
              <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mt-3 mb-2">Suggested Substitutes</p>
              {suggested.map((ex) => (
                <ExerciseOption key={ex.name} exercise={ex} onSelect={onSelect} highlight />
              ))}
            </>
          )}

          {!search.trim() && others.length > 0 && (
            <>
              {suggested.length > 0 && (
                <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mt-4 mb-2">All Exercises</p>
              )}
              {others.map((ex) => (
                <ExerciseOption key={ex.name} exercise={ex} onSelect={onSelect} />
              ))}
            </>
          )}

          {filtered.length === 0 && !search.trim() && (
            <div className="text-center py-12">
              <p className="text-wf-gray-500 text-sm">No exercises found</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ExerciseOption({ exercise, onSelect, highlight }) {
  return (
    <button
      onClick={() => onSelect(exercise.name)}
      className={`w-full text-left px-3 py-3 rounded-xl mb-1 flex items-center justify-between active:scale-[0.98] transition-all ${
        highlight ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/[0.03] active:bg-white/10'
      }`}
    >
      <div>
        <span className={`text-sm font-medium ${highlight ? 'text-blue-300' : 'text-white'}`}>
          {exercise.name}
        </span>
        <span className="text-xs text-wf-gray-500 ml-2">{exercise.muscle}</span>
      </div>
      {highlight && (
        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      )}
    </button>
  );
}

export default memo(ExerciseCard);
