import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
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
import CardioAccelerationCard from './CardioAccelerationCard.jsx';
import { iosFocusRef } from '../utils/iosFocus.js';
import useFocusTrap from '../hooks/useFocusTrap.js';

// When true, exercise cards in workout sessions get a red->white->red gradient
// border matching the Swap Exercise modal. Flip to false to revert.
const EXERCISE_CARD_GRADIENT_BORDER = true;

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

// Superset label letter -> ring color. Order mirrors the Week at a Glance
// carousel's DAY_COLORS so the spectrum reads the same across the app:
// A red, B orange, C yellow, D green, E blue, F purple, G pink.
const SUPERSET_COLORS = {
  A: '#ef4444',
  B: '#f97316',
  C: '#eab308',
  D: '#22c55e',
  E: '#3b82f6',
  F: '#a855f7',
  G: '#ec4899',
};

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

function ExerciseCard({ exercise, exerciseKey, entries, pbs, onChange, onBlur, readOnly, inputsLocked, onLockedTap, completedSets, autoFilled, onToggleComplete, onAddSet, onDeleteSet, onReorderSets, onSwapExercise, onAddExercise, onDeleteExercise, onMoveUp, onMoveDown, onShowPRs, note, onNoteChange, weightSuggestion, onApplySuggestion, allWorkoutExercises, lastEntries, forceShowDemo, mode = 'session', dataTutorial, showGoalWeight = true, showGoalReps = true, showSetType = true, exerciseNumber, cardioEnabled = false, cardioSelections, onCardioChange, cardTheme = 'light', onEnterFullScreen, fullScreen = false, onOpenSupersetPicker }) {
  // 'light' = #e8e8e8 card with dark text (default)
  // 'dark'  = transparent card, white text — page bg shows through
  const isDarkTheme = cardTheme === 'dark';
  const isTemplate = mode === 'template';
  // Use exerciseKey (unique per card) for set-level keys; fall back to exercise.name
  const keyName = exerciseKey || exercise.name;
  const exercisePbs = pbs?.[exercise.name] || {};
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
  const [showVideo, setShowVideo] = useState(false);
  const [showDemoLocal, setShowDemoLocal] = useState(false);
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

  // Superset tint — paint a very light colored gradient across the entire
  // card so all exercises in the same group are visually linked. The card's
  // base background is locked behind `!important` in index.css, so we use
  // setProperty(..., 'important') from a ref to layer the tint on top via
  // background-image (which renders below in-flow content automatically).
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (exercise.supersetLabel) {
      const c = SUPERSET_COLORS[exercise.supersetLabel[0]] || '#ef4444';
      // ~14% top -> ~4% bottom: subtle enough to read as a tint, strong
      // enough to be obvious at a glance on both light and dark cards.
      el.style.setProperty('background-image', `linear-gradient(160deg, ${c}24 0%, ${c}0A 100%)`, 'important');
    } else {
      el.style.removeProperty('background-image');
    }
  }, [exercise.supersetLabel]);

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

  const handleVideoClick = () => {
    if (videoId) {
      setShowVideo(true);
    } else {
      window.open(getExerciseSearchUrl(exercise.name), '_blank');
    }
  };

  return (
    <>
    <div ref={cardRef} data-tutorial={dataTutorial ? 'exercise-card' : undefined} className={`${isDarkTheme ? 'exercise-card-transparent-test' : 'exercise-card-light-test'} glass-card${fullScreen ? ' min-h-full' : ' overflow-hidden rounded-xl mb-3'}${EXERCISE_CARD_GRADIENT_BORDER && !isDarkTheme && !fullScreen ? ' exercise-card-gradient-border' : ''}`} style={{ position: 'relative' }}>
      {/* Viewfinder ⛶ row — sits slightly above the icon cluster
          (PRs / ⚖ / Demo) in the card header. Tap to enter full-screen
          mode for this exercise. Hidden in template mode and when the
          parent doesn't supply onEnterFullScreen (e.g. read-only views). */}
      {!isTemplate && onEnterFullScreen && (
        <div className="px-3 pt-2 flex items-center justify-end" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <button
            type="button"
            data-tutorial={dataTutorial ? 'full-screen' : undefined}
            onClick={(e) => { e.stopPropagation(); onEnterFullScreen(exerciseKey); }}
            aria-label={`Enter full-screen mode for ${exercise.name}`}
            title="Full-screen"
            className="relative h-6 w-6 rounded-md flex items-center justify-center text-wf-gray-400 hover:text-white active:scale-90 active:bg-white/10 transition-all before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {/* Four L-shaped corner brackets of a square */}
              <path d="M4 9V5a1 1 0 011-1h4" />
              <path d="M20 9V5a1 1 0 00-1-1h-4" />
              <path d="M4 15v4a1 1 0 001 1h4" />
              <path d="M20 15v4a1 1 0 01-1 1h-4" />
            </svg>
          </button>
        </div>
      )}
      {/* Exercise Header — name + plate-calc + PRs + demo. Sticky so it
          stays pinned at the top of the scroll viewport while the user
          scrolls long set lists, especially valuable in full-screen mode
          where every set might require referring back to the name + PRs. */}
      <div data-tutorial={dataTutorial} className="px-4 py-3 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md" style={{ background: isDarkTheme ? 'rgba(20,20,20,0.9)' : 'rgba(242,242,242,0.9)', borderBottom: '3px double rgba(255,255,255,0.15)' }}>
        <div className="min-w-0">
          {onOpenSupersetPicker && !readOnly && !isTemplate ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenSupersetPicker(exerciseKey || exercise.name); }}
              aria-label={`Set superset group for ${exercise.name}`}
              className="superset-press-target text-[17px] font-bold text-white text-left active:opacity-70 transition-opacity"
            >
              {exercise.supersetLabel ? (
                <span className="text-wf-gray-500 mr-1">{exercise.supersetLabel} ·</span>
              ) : null}
              {exercise.name}
            </button>
          ) : (
            <span className="text-[17px] font-bold text-white">
              {exercise.supersetLabel ? (
                <span className="text-wf-gray-500 mr-1">{exercise.supersetLabel} ·</span>
              ) : null}
              {exercise.name}
            </span>
          )}
          <div className="text-[10px] text-wf-gray-500 mt-0.5">
            {exercise.sets?.length || 0} sets{exercise.setType && exercise.setType !== 'straight' ? ` · ${exercise.setType.replace('_', ' ')}` : ''}
          </div>
        </div>
        {!isTemplate && (
          <div className="shrink-0 flex items-center gap-1.5">
            {!readOnly && (
              <button
                type="button"
                data-tutorial={dataTutorial ? 'plate-calc' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setPlateCalcFromHeader(true);
                }}
                aria-label={`Open plate calculator for ${exercise.name}`}
                title="Plate calculator"
                className="relative h-7 w-7 rounded-lg flex items-center justify-center active:scale-95 transition-all bg-wf-red/10 border border-wf-red/20 before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]"
              >
                <span className="text-[10px] font-semibold text-wf-red">PC</span>
              </button>
            )}
            {onShowPRs && (
              <button
                type="button"
                data-tutorial={dataTutorial ? 'prs-button' : undefined}
                onClick={(e) => { e.stopPropagation(); onShowPRs(exercise.name); }}
                aria-label={`View personal records for ${exercise.name}`}
                className="relative h-7 px-2.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all bg-wf-red/10 border border-wf-red/20 before:absolute before:content-[''] before:left-0 before:right-0 before:top-1/2 before:-translate-y-1/2 before:min-h-[44px]"
              >
                <svg className="w-3.5 h-3.5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                </svg>
                <span className="text-[10px] font-semibold text-wf-red">PRs</span>
              </button>
            )}
            <button
              type="button"
              data-tutorial={dataTutorial ? 'demo-button' : undefined}
              onClick={(e) => { e.stopPropagation(); videoId ? setShowDemoLocal(!showDemoLocal) : handleVideoClick(); }}
              className={`relative h-7 px-2.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all before:absolute before:content-[''] before:left-0 before:right-0 before:top-1/2 before:-translate-y-1/2 before:min-h-[44px] ${showDemo ? 'bg-wf-red/20 border border-wf-red/40' : 'bg-wf-red/10 border border-wf-red/20'}`}
            >
              <svg className="w-3.5 h-3.5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              <span className="text-[10px] font-semibold text-wf-red">Demo</span>
            </button>
          </div>
        )}
      </div>

      {/* Inline Demo Section */}
      {showDemo && videoId && (
        <div className="border-t border-white/5 bg-black/20">
          <div className="p-3">
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              {videoId.startsWith('http') || videoId.startsWith('/') ? (
                <video src={videoId} className="w-full h-full object-contain" controls playsInline preload="metadata" controlsList="nodownload" />
              ) : (
                <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&origin=${window.location.origin}`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={`${exercise.name} demo`} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exercise Description (from template) */}
      {exercise.exerciseDescription && (
        <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
          <p className="text-xs text-wf-gray-400 leading-relaxed">{exercise.exerciseDescription}</p>
        </div>
      )}

      {/* Controls subheader — move, swap, add exercise, delete exercise */}
      {!readOnly && (
        <div className="px-4 py-2 border-b border-white/5 flex items-center gap-1.5 bg-white/[0.015]">
            <span data-tutorial={dataTutorial ? 'move-buttons' : undefined} className="flex items-center gap-1.5">
            {onMoveUp && (
              <button type="button" onClick={() => { wasJustClickedRef.current = true; onMoveUp(); }} aria-label="Move exercise up" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={() => { wasJustClickedRef.current = true; onMoveDown(); }} aria-label="Move exercise down" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
            )}
            </span>
            {onSwapExercise && (
              <button type="button" data-tutorial={dataTutorial ? 'swap-button' : undefined} onClick={() => { setShowSwap(true); setSwapSearch(''); }} className="h-12 px-3 rounded-full bg-white/10 flex items-center gap-1 text-wf-gray-400 hover:text-blue-400 hover:bg-blue-500/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                <span className="text-[10px] font-semibold">Swap</span>
              </button>
            )}
            <span data-tutorial={dataTutorial ? 'add-delete-buttons' : undefined} className="flex items-center gap-1.5">
            {onAddExercise && (
              <button type="button" onClick={() => { setShowAddBelow(true); setAddBelowSearch(''); }} aria-label="Add exercise below" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-green-400 hover:bg-green-500/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            )}
            {onDeleteExercise && (
              <button type="button" onClick={onDeleteExercise} aria-label="Delete exercise" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            </span>
        </div>
      )}


      {/* Set Controls Subheader */}
      {!readOnly && onAddSet && (
        <div data-tutorial={dataTutorial ? 'set-controls' : undefined} className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium">
            {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAddSet(exercise.name)}
              className="h-12 px-3 rounded-full bg-white/10 flex items-center justify-center gap-1 text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Add Set</span>
            </button>
            {onDeleteSet && exercise.sets.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const lastIdx = exercise.sets.length - 1;
                  const lastKey = `${keyName}-${lastIdx}`;
                  if (completedSets?.has(lastKey)) {
                    setConfirmDeleteLast(true);
                  } else {
                    onDeleteSet(exercise.name, lastIdx);
                  }
                }}
                className="h-12 px-3 rounded-full bg-white/10 flex items-center justify-center gap-1 text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
                <span className="text-[10px] font-semibold uppercase tracking-wider">Remove</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Column Headers */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[9px] text-wf-gray-500 uppercase tracking-wider">
        {!isTemplate && !readOnly && onToggleComplete && <div className={showSetType ? 'w-5 shrink-0' : 'w-[1.8rem] shrink-0'} />}
        <div className={showSetType ? 'w-[1.43rem] shrink-0 text-center' : 'w-[2.8rem] shrink-0 text-center'}>Set</div>
        {showSetType && <div className="w-[2.8rem] shrink-0 text-center">Type</div>}
        {!isTemplate && showGoalWeight && <div className="w-[3.15rem] shrink-0 text-center">Goal Wt</div>}
        {/* When the Goal column is hidden there's only one weight column,
            so the simpler "Weight" label reads cleaner than "Actual Wt"
            (which only makes sense as a contrast to "Goal Wt"). */}
        <div className={showGoalWeight ? 'w-[3.15rem] shrink-0 text-center' : 'w-[6.5rem] shrink-0 text-center'}>{showGoalWeight ? 'Actual Wt' : 'Weight'}</div>
        {isTemplate ? (
          <div className="flex-1 text-center">Reps</div>
        ) : (
          <>
            {showGoalReps && <div className="flex-1 text-center">Goal Reps</div>}
            <div className="text-center" style={{ flex: '1' }}>{showGoalReps ? 'Actual Reps' : 'Reps'}</div>
          </>
        )}
      </div>

      {/* Set Rows — wrapped in dnd-kit so long-press initiates a drag-to-
          reorder. Completed sets (and template/readOnly modes) are passed
          `disabled` so they're not draggable but still render in place. */}
      <DndContext sensors={sortableSensors} collisionDetection={closestCenter} onDragEnd={handleSetDragEnd}>
        <SortableContext items={exercise.sets.map((_, i) => i)} strategy={verticalListSortingStrategy}>
      <div className="divide-y divide-white/5">
        {exercise.sets.map((set, idx) => {
          const entry = entries?.[idx] || {};
          const setKey = `${keyName}-${idx}`;
          const isCompleted = !isTemplate && completedSets?.has(setKey);
          const isAutoFill = !isTemplate && autoFilled?.has(setKey) && !isCompleted;
          const rowWeight = entry.weight ?? set.suggestedWeight;
          const pbReps = (rowWeight !== undefined && rowWeight !== '' && rowWeight !== null) ? exercisePbs[rowWeight] : undefined;
          const isSwipeable = !isTemplate && !readOnly;
          const rowContent = (
            <div
              ref={!isTemplate ? (el) => { swipeRowRefs.current[idx] = el; } : undefined}
              data-tutorial={dataTutorial && idx === 0 ? 'set-row' : undefined}
              className={`relative px-3 py-2.5 flex items-center gap-1.5 transition-colors duration-200 ${
                !isSwipeable && isCompleted ? 'bg-green-500/10' : ''
              }`}
              style={
                // In session mode the row sits over swipe-action buttons —
                // give it an opaque background so the buttons stay hidden
                // until the row is dragged. Color matches the parent card:
                //   • dark theme:  solid black (page bg)
                //   • light theme: #e8e8e8 (light card)
                // Completed rows get a precomputed alpha-blend of green/10
                // over the base so we keep the same visual cue.
                isSwipeable
                  ? {
                      background: isDarkTheme
                        ? (isCompleted ? 'rgb(11, 32, 18)' : '#0a0a0a')
                        : (isCompleted ? 'rgb(213, 228, 218)' : '#e8e8e8'),
                    }
                  : undefined
              }
              onTouchStart={isSwipeable ? (e) => handleTouchStart(idx, e) : undefined}
              onTouchEnd={isSwipeable ? handleTouchEnd : undefined}
              onTouchMove={isSwipeable ? handleTouchMove : undefined}
              onContextMenu={!readOnly && onDeleteSet ? (e) => { e.preventDefault(); setDeleteIdx(idx); } : undefined}
            >
              {/* Checkmark circle — session mode only */}
              {!isTemplate && !readOnly && onToggleComplete && (
                <button
                  type="button"
                  onClick={() => onToggleComplete(exercise.name, idx)}
                  aria-label={isCompleted ? 'Mark set incomplete' : 'Mark set complete'}
                  className={`${showSetType ? 'w-5 h-5' : 'w-6 h-6'} rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500'
                      : 'border-wf-gray-500 bg-transparent'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )}

              {/* Set label */}
              <span className={`text-wf-gray-400 text-xs font-medium shrink-0 text-center ${showSetType ? 'w-[1.43rem]' : 'w-[2.8rem]'}`}>
                {isTemplate ? idx + 1 : set.setNumber}
              </span>

              {/* Set type dropdown — shows shorthand, dropdown lists full names */}
              {showSetType && (
                <div className="w-[2.8rem] shrink-0 relative">
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-wf-gray-400 uppercase pointer-events-none">
                    {getSetTypeShort(entry.setType || exercise.setType || 'straight')}
                  </span>
                  {!readOnly ? (
                    <select
                      value={entry.setType || exercise.setType || 'straight'}
                      onChange={(e) => onChange?.(exercise.name, idx, 'setType', e.target.value)}
                      className="w-full h-10 bg-transparent text-transparent rounded-lg border border-white/5 focus:outline-none appearance-none cursor-pointer"
                    >
                      {SET_TYPES.map(t => (
                        <option key={t.value} value={t.value} className="bg-wf-gray-900 text-white text-sm">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-10" />
                  )}
                </div>
              )}

              {/* Goal Weight (read-only, from template) — session mode only */}
              {!isTemplate && showGoalWeight && (
                <div className="w-[3.15rem] shrink-0">
                  <div className="w-full rounded-lg px-1 py-2.5 text-center text-sm font-mono-stat bg-black/40 border border-white/5" style={{ color: 'rgba(239,68,68,0.6)' }}>
                    {set.suggestedWeight ?? '—'}
                  </div>
                </div>
              )}

              {/* Weight input — long-press (600ms) on the input opens the
                  in-session plate calculator pre-filled with this set's
                  current weight. The discoverable affordance lives in the
                  card header (⚖ icon next to PRs); long-press is the
                  power-user shortcut. Movement during press cancels so
                  scrolling doesn't trigger it. */}
              <div className={`${showGoalWeight ? 'w-[3.15rem] shrink-0' : 'w-[6.5rem] shrink-0'} relative`}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="9999"
                  aria-label={`Set ${idx + 1} weight`}
                  value={entry.weight ?? (isTemplate ? '' : set.suggestedWeight ?? '')}
                  placeholder={readOnly || inputsLocked ? '—' : '0'}
                  onChange={(e) => onChange?.(exercise.name, idx, 'weight', e.target.value)}
                  onFocus={(e) => {
                    if (inputsLocked && onLockedTap) { e.target.blur(); onLockedTap(); return; }
                    lastFocusedSetIdxRef.current = idx;
                    e.target.select();
                  }}
                  onBlur={() => onBlur?.(exercise.name, idx, 'weight')}
                  onPointerDown={(readOnly || inputsLocked) ? undefined : () => {
                    plateCalcLongPressRef.current = setTimeout(() => {
                      setPlateCalcSetIdx(idx);
                    }, 600);
                  }}
                  onPointerUp={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onPointerMove={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onPointerCancel={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onPointerLeave={() => { if (plateCalcLongPressRef.current) { clearTimeout(plateCalcLongPressRef.current); plateCalcLongPressRef.current = null; } }}
                  onContextMenu={(e) => e.preventDefault()}
                  readOnly={readOnly || inputsLocked}
                  className={`w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base focus:outline-none disabled:opacity-50 ${isCompleted ? 'completed text-white' : isAutoFill ? 'text-wf-gray-500 italic' : 'text-white'}`}
                  disabled={readOnly}
                />
              </div>

              {isTemplate ? (
                /* Template mode: editable Reps input */
                <div className="flex-1">
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
                    placeholder="0"
                    className="w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base text-white focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  {/* Goal reps (read-only, from template) */}
                  {showGoalReps && (
                    <div className="flex-1">
                      <div className="w-full rounded-lg px-2 py-2.5 text-center text-base font-mono-stat bg-black/40 border border-white/5" style={{ color: 'rgba(239,68,68,0.6)' }}>
                        {set.plannedReps ?? '—'}
                      </div>
                    </div>
                  )}

                  {/* Actual reps (editable) */}
                  <div style={{ flex: '1' }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max="9999"
                      aria-label={`Set ${idx + 1} reps`}
                      value={entry.reps ?? ''}
                      onChange={(e) => { const v = e.target.value; onChange?.(exercise.name, idx, 'reps', v === '' ? '' : Math.max(0, Number(v))); }}
                      onFocus={(e) => { if (inputsLocked && onLockedTap) { e.target.blur(); onLockedTap(); return; } e.target.select(); }}
                      onBlur={() => onBlur?.(exercise.name, idx, 'reps')}
                      readOnly={readOnly || inputsLocked}
                      placeholder={readOnly || inputsLocked ? '—' : '0'}
                      className={`w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base focus:outline-none disabled:opacity-50 placeholder:text-wf-gray-700 ${isCompleted ? 'completed text-white' : isAutoFill ? 'text-wf-gray-500 italic' : 'text-white'}`}
                      disabled={readOnly}
                    />
                  </div>
                </>
              )}

              {/* Row set controls - hidden, use subheader buttons instead */}
              {false && onAddSet && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAddSet(exercise.name, idx)}
                    aria-label="Add set"
                    className="w-6 h-6 rounded-full flex items-center justify-center text-wf-gray-600 hover:text-green-400 hover:bg-green-500/20 active:scale-90 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                  {onDeleteSet && exercise.sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDeleteIdx(idx)}
                      aria-label="Delete set"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-wf-gray-600 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          );

          const lastEntry = lastEntries?.[idx];
          const lastHint = !isTemplate && lastEntry && (lastEntry.weight > 0 || lastEntry.weight === -1 || lastEntry.reps > 0) ? (
            <div className="px-3 pb-1 -mt-0.5">
              <p className="text-[9px] text-wf-gray-600 text-right">
                Last: {lastEntry.weight === -1 ? 'BW' : lastEntry.weight + ' lbs'} &times; {lastEntry.reps}
              </p>
            </div>
          ) : null;

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
                    className="absolute inset-y-0 left-0 flex items-center justify-start pl-5"
                    style={{ width: 100, background: '#22c55e', pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-0.5 text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Complete</span>
                    </div>
                  </div>
                  {/* Red Delete — revealed when row is swiped left */}
                  <div
                    className="absolute inset-y-0 right-0 flex items-center justify-end pr-5"
                    style={{ width: 100, background: '#ef4444', pointerEvents: 'none' }}
                    aria-hidden="true"
                  >
                    <div className="flex flex-col items-center gap-0.5 text-white">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
                    </div>
                  </div>
                  {rowContent}
                </div>
                {lastHint}
                {cardioCard}
              </SortableSetRow>
            );
          }

          return (
            <SortableSetRow key={idx} id={idx} disabled={dragDisabled}>
              {rowContent}{lastHint}{cardioCard}
            </SortableSetRow>
          );
        })}
      </div>
        </SortableContext>
      </DndContext>

      {/* Program-provided note (xlsx column Q — "Failure / Workout Note").
          Renders as a static italic block above the user-editable notes
          area so users see it but can't edit it. Distinct from the
          per-set exerciseDescription which lives in the header row. */}
      {exercise.programNotes && (
        <div className="px-3 py-2 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'rgba(239,68,68,0.7)', letterSpacing: '0.2em' }}>
            Program Note
          </p>
          <p className="text-xs italic text-wf-gray-300 leading-relaxed">{exercise.programNotes}</p>
        </div>
      )}

      {/* Notes */}
      {!readOnly && onNoteChange && (
        <div data-tutorial={dataTutorial ? 'exercise-notes' : undefined} className="px-3 py-2 border-t border-white/5">
          {note ? (
            <textarea
              value={note}
              onChange={(e) => onNoteChange(exercise.name, e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="w-full bg-transparent text-wf-gray-300 text-xs resize-none focus:outline-none placeholder:text-wf-gray-600"
            />
          ) : (
            <button
              onClick={() => onNoteChange(exercise.name, ' ')}
              className="text-xs text-wf-gray-500 hover:text-wf-gray-300 transition-colors"
            >
              + Add Notes
            </button>
          )}
        </div>
      )}
      {readOnly && note && (
        <div className="px-3 py-2 border-t border-white/5">
          <p className="text-xs text-wf-gray-400 whitespace-pre-wrap">{note}</p>
        </div>
      )}

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
              const idxAtOpen = plateCalcSetIdx;
              if (onChange) onChange(exercise.name, idxAtOpen, 'weight', String(weight));
              setPlateCalcSetIdx(null);
            }}
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
              // If the user had a specific set in focus when they opened
              // the calc from the header, write the result back to that
              // set. Otherwise just close — the header trigger is meant
              // to be informational when no set is anchored.
              const idx = lastFocusedSetIdxRef.current;
              if (idx !== null && idx !== undefined && onChange) {
                onChange(exercise.name, idx, 'weight', String(weight));
              }
              setPlateCalcFromHeader(false);
            }}
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
                className="flex-1 bg-transparent text-white text-sm font-semibold placeholder:text-wf-gray-500 focus:outline-none"
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

  const filtered = useMemo(() => {
    if (!search.trim()) return substitutes;
    const q = search.toLowerCase().trim();
    // Score results by match quality so prefix/word-start matches rank above
    // buried substring matches. Keeps "row" → "Barbell Row" above
    // "Single-Arm Arrow Shoulder Fly" (contrived example).
    return substitutes
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
  }, [substitutes, search]);

  // Only used when NOT searching: group by same-muscle score.
  // When searching, we render a single flat relevance-sorted list.
  const suggested = filtered.filter((e) => e.score >= 12);
  const others = filtered.filter((e) => !e.score || e.score < 12);

  // Portal to document.body to escape any transformed ancestor
  // (e.g. the `.fade-slide-up` wrapper around each exercise card), which would
  // otherwise trap our `position: fixed` inside the card.
  // Guard against transient HMR / SSR states where document.body is not ready.
  if (typeof document === 'undefined' || !document.body) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center"
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
