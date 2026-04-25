import { useState, useRef, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { getExerciseVideoId, getExerciseSearchUrl } from '../utils/exerciseVideos.js';
import { useExercises, getSubstitutesFromList } from '../hooks/useExercises.js';
import VideoPlayerModal from './VideoPlayerModal.jsx';
import CardioAccelerationCard from './CardioAccelerationCard.jsx';
import { iosFocusRef } from '../utils/iosFocus.js';

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

const SET_TYPES = [
  { value: 'warm_up',      short: 'WU',   label: 'Warm Up' },
  { value: 'touch_up',     short: 'TU',   label: 'Touch Up' },
  { value: 'straight',     short: 'REG',  label: 'Regular' },
  { value: 'drop',         short: 'DS',   label: 'Drop Set' },
  { value: 'rest_pause',   short: 'RP',   label: 'Rest-Pause Set' },
  { value: 'superset',     short: 'SS',   label: 'Super Set' },
  { value: 'alternating',  short: 'Alt',  label: 'Alternating Set' },
  { value: 'pre_exhaust',  short: 'PrEx', label: 'Pre-Exhaust' },
];

function getSetTypeShort(value) {
  return SET_TYPES.find(t => t.value === value)?.short || 'REG';
}

export { SET_TYPES };

function ExerciseCard({ exercise, exerciseKey, entries, pbs, onChange, onBlur, readOnly, inputsLocked, onLockedTap, completedSets, autoFilled, onToggleComplete, onAddSet, onDeleteSet, onSwapExercise, onAddExercise, onDeleteExercise, onMoveUp, onMoveDown, note, onNoteChange, weightSuggestion, onApplySuggestion, allWorkoutExercises, lastEntries, forceShowDemo, mode = 'session', dataTutorial, showGoalWeight = true, showGoalReps = true, showSetType = true, exerciseNumber, cardioEnabled = false, cardioSelections, onCardioChange }) {
  const isTemplate = mode === 'template';
  // Use exerciseKey (unique per card) for set-level keys; fall back to exercise.name
  const keyName = exerciseKey || exercise.name;
  const exercisePbs = pbs?.[exercise.name] || {};
  const { exercises: allExercises } = useExercises();
  const dbExercise = allExercises.find(e => e.name.toLowerCase() === exercise.name.toLowerCase());
  const videoId = getExerciseVideoId(exercise.name, dbExercise?.videoId);
  const [showVideo, setShowVideo] = useState(false);
  const [showDemoLocal, setShowDemoLocal] = useState(false);
  const showDemo = forceShowDemo || showDemoLocal;
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [confirmDeleteLast, setConfirmDeleteLast] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  const [showAddBelow, setShowAddBelow] = useState(false);
  const [addBelowSearch, setAddBelowSearch] = useState('');
  const longPressRef = useRef(null);

  const touchStartPos = useRef(null);
  const swipeRowRefs = useRef({});
  const swipeActive = useRef(false);

  const handleTouchStart = useCallback((idx, e) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY, idx };
    swipeActive.current = false;
    longPressRef.current = setTimeout(() => {
      navigator.vibrate?.(30);
      setDeleteIdx(idx);
      longPressRef.current = null;
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    const absDx = Math.abs(dx);

    // Cancel long press if finger moved
    if (longPressRef.current && (absDx > 10 || dy > 10)) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }

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
        rowEl.style.background = clamped > 30 ? `rgba(34,197,94,${Math.min(clamped/100*0.25, 0.25)})` :
                                  clamped < -30 ? `rgba(239,68,68,${Math.min(Math.abs(clamped)/100*0.25, 0.25)})` : '';
      }
    }
  }, [isTemplate]);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }

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
        rowEl.style.transition = 'transform 0.2s ease, background 0.2s ease';
        rowEl.style.transform = 'translateX(0)';
        rowEl.style.background = '';
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
    <div data-tutorial={dataTutorial ? 'exercise-card' : undefined} className={`exercise-card-light-test glass-card rounded-xl overflow-hidden mb-3${EXERCISE_CARD_GRADIENT_BORDER ? ' exercise-card-gradient-border' : ''}`}>
      {/* Exercise Header — name + demo button */}
      <div data-tutorial={dataTutorial} className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '3px double rgba(255,255,255,0.15)' }}>
        <div className="min-w-0">
          <span className="text-[17px] font-bold text-white">{exercise.name}</span>
          <div className="text-[10px] text-wf-gray-500 mt-0.5">
            {exercise.sets?.length || 0} sets{exercise.setType && exercise.setType !== 'straight' ? ` · ${exercise.setType.replace('_', ' ')}` : ''}
          </div>
        </div>
        {!isTemplate && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); videoId ? setShowDemoLocal(!showDemoLocal) : handleVideoClick(); }}
            className={`shrink-0 h-7 px-2.5 rounded-lg flex items-center gap-1.5 active:scale-95 transition-all ${showDemo ? 'bg-wf-red/20 border border-wf-red/40' : 'bg-wf-red/10 border border-wf-red/20'}`}
          >
            <svg className="w-3.5 h-3.5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            <span className="text-[10px] font-semibold text-wf-red">Demo</span>
          </button>
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
              <button type="button" onClick={onMoveUp} aria-label="Move exercise up" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={onMoveDown} aria-label="Move exercise down" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
            )}
            </span>
            {onSwapExercise && (
              <button type="button" data-tutorial={dataTutorial ? 'swap-button' : undefined} onClick={() => { setShowSwap(true); setSwapSearch(''); }} className="h-12 px-3 rounded-full bg-white/10 flex items-center gap-1 text-wf-gray-400 hover:text-blue-400 hover:bg-blue-500/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                <span className="text-[10px] font-semibold">Swap</span>
              </button>
            )}
            <span data-tutorial={dataTutorial ? 'add-delete-buttons' : undefined} className="flex items-center gap-1.5">
            {onAddExercise && (
              <button type="button" onClick={() => { setShowAddBelow(true); setAddBelowSearch(''); }} aria-label="Add exercise below" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-green-400 hover:bg-green-500/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </button>
            )}
            {onDeleteExercise && (
              <button type="button" onClick={onDeleteExercise} aria-label="Delete exercise" className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
        <div className={showGoalWeight ? 'w-[3.15rem] shrink-0 text-center' : 'w-[6.5rem] shrink-0 text-center'}>Actual Wt</div>
        {isTemplate ? (
          <div className="flex-1 text-center">Reps</div>
        ) : (
          <>
            {showGoalReps && <div className="flex-1 text-center">Goal Reps</div>}
            <div className="text-center" style={{ flex: '1' }}>Actual Reps</div>
          </>
        )}
      </div>

      {/* Set Rows */}
      <div className="divide-y divide-white/5">
        {exercise.sets.map((set, idx) => {
          const entry = entries?.[idx] || {};
          const setKey = `${keyName}-${idx}`;
          const isCompleted = !isTemplate && completedSets?.has(setKey);
          const isAutoFill = !isTemplate && autoFilled?.has(setKey) && !isCompleted;
          const rowWeight = entry.weight ?? set.suggestedWeight;
          const pbReps = (rowWeight !== undefined && rowWeight !== '' && rowWeight !== null) ? exercisePbs[rowWeight] : undefined;
          const rowContent = (
            <div
              ref={!isTemplate ? (el) => { swipeRowRefs.current[idx] = el; } : undefined}
              data-tutorial={dataTutorial && idx === 0 ? 'set-row' : undefined}
              className={`px-3 py-2.5 flex items-center gap-1.5 transition-colors duration-200 ${
                isCompleted ? 'bg-green-500/10' : ''
              }`}
              onTouchStart={!readOnly && !isTemplate ? (e) => handleTouchStart(idx, e) : undefined}
              onTouchEnd={!readOnly && !isTemplate ? handleTouchEnd : undefined}
              onTouchMove={!readOnly && !isTemplate ? handleTouchMove : undefined}
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
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

              {/* Weight input */}
              <div className={showGoalWeight ? 'w-[3.15rem] shrink-0' : 'w-[6.5rem] shrink-0'}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="9999"
                  value={entry.weight ?? (isTemplate ? '' : set.suggestedWeight ?? '')}
                  placeholder={readOnly || inputsLocked ? '—' : '0'}
                  onChange={(e) => onChange?.(exercise.name, idx, 'weight', e.target.value)}
                  onFocus={(e) => { if (inputsLocked && onLockedTap) { e.target.blur(); onLockedTap(); return; } e.target.select(); }}
                  onBlur={() => onBlur?.(exercise.name, idx, 'weight')}
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
                    className="w-6 h-6 rounded-full flex items-center justify-center text-wf-gray-600 hover:text-green-400 hover:bg-green-500/20 active:scale-90 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                  {onDeleteSet && exercise.sets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDeleteIdx(idx)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-wf-gray-600 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

          // In session mode, wrap with swipe support
          if (!isTemplate && !readOnly) {
            return (
              <div key={idx} className="relative overflow-hidden">
                {rowContent}
                {lastHint}
                {cardioCard}
              </div>
            );
          }

          return <div key={idx}>{rowContent}{lastHint}{cardioCard}</div>;
        })}
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setDeleteIdx(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white text-center mb-1">Delete selected set?</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setConfirmDeleteLast(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white text-center mb-1">Delete completed set?</h3>
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

    </div>

      {/* Add Exercise Below — inline card */}
      {showAddBelow && onAddExercise && (() => {
        const allEx = allExercises;
        const q = addBelowSearch.toLowerCase().trim();
        const seen = new Set();
        const filtered = q
          ? allEx.filter((ex) => {
              if (seen.has(ex.name)) return false;
              seen.add(ex.name);
              return ex.name.toLowerCase().includes(q);
            }).slice(0, 8)
          : [];
        return (
          <div className="glass-card rounded-xl overflow-hidden mb-3 border border-green-500/20 animate-drop-down">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
    <div className="fixed inset-0 z-50 flex flex-col items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div
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
            <h3 className="text-lg font-black text-white">Swap Exercise</h3>
            <button onClick={onClose} aria-label="Close" className="text-wf-gray-400 active:opacity-70">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-wf-gray-500 text-xs mb-3">
            Replacing <span className="text-white font-semibold">{exerciseName}</span>
          </p>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                <svg className="w-5 h-5 text-wf-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      )}
    </button>
  );
}

export default memo(ExerciseCard);
