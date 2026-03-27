import { useState, useRef, useCallback, useMemo } from 'react';
import { getExerciseVideoId, getExerciseSearchUrl } from '../utils/exerciseVideos.js';
import { useExercises, getSubstitutesFromList } from '../hooks/useExercises.js';
import VideoPlayerModal from './VideoPlayerModal.jsx';
import { iosFocusRef } from '../utils/iosFocus.js';
import { api } from '../api.js';

const SET_TYPES = [
  { value: 'warm_up',      short: 'WU',   label: 'Warm Up' },
  { value: 'touch_up',     short: 'TU',   label: 'Touch Up' },
  { value: 'straight',     short: 'REG',  label: 'Regular' },
  { value: 'drop',         short: 'DS',   label: 'Drop Set' },
  { value: 'rest_pause',   short: 'RP',   label: 'Rest-Pause Set' },
  { value: 'superset',     short: 'SS',   label: 'Super Set' },
  { value: 'alternating',  short: 'Alt',  label: 'Alternating Set' },
  { value: 'giant',        short: 'Gia',  label: 'Giant Set' },
  { value: 'pre_exhaust',  short: 'PrEx', label: 'Pre-Exhaust' },
];

function getSetTypeShort(value) {
  return SET_TYPES.find(t => t.value === value)?.short || 'REG';
}

export { SET_TYPES };

export default function ExerciseCard({ exercise, entries, pbs, onChange, onBlur, readOnly, completedSets, autoFilled, onToggleComplete, onAddSet, onDeleteSet, onSwapExercise, onAddExercise, onDeleteExercise, onMoveUp, onMoveDown, note, onNoteChange, weightSuggestion, onApplySuggestion, allWorkoutExercises, mode = 'session', dataTutorial }) {
  const isTemplate = mode === 'template';
  const exercisePbs = pbs?.[exercise.name] || {};
  const videoId = getExerciseVideoId(exercise.name);
  const { exercises: allExercises } = useExercises();
  const [showVideo, setShowVideo] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [confirmDeleteLast, setConfirmDeleteLast] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');
  const [showAddBelow, setShowAddBelow] = useState(false);
  const [addBelowSearch, setAddBelowSearch] = useState('');
  const longPressRef = useRef(null);

  const touchStartPos = useRef(null);

  const handleTouchStart = useCallback((idx, e) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressRef.current = setTimeout(() => {
      navigator.vibrate?.(30);
      setDeleteIdx(idx);
      longPressRef.current = null;
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e) => {
    // Only cancel if finger moved more than 10px (prevents natural jitter from canceling)
    if (longPressRef.current && touchStartPos.current) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    touchStartPos.current = null;
  }, []);

  const handleVideoClick = () => {
    if (videoId) {
      setShowVideo(true);
    } else {
      window.open(getExerciseSearchUrl(exercise.name), '_blank');
    }
  };

  return (
    <>
    <div data-tutorial={dataTutorial ? 'exercise-card' : undefined} className="glass-card rounded-xl overflow-hidden mb-3">
      {/* Exercise Header */}
      <div data-tutorial={dataTutorial} className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <button
          type="button"
          onClick={handleVideoClick}
          className="inline-flex items-center gap-1.5 text-base font-semibold text-white hover:text-wf-red transition-colors text-left"
        >
          {exercise.name}
          <svg className="w-4 h-4 text-wf-red shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
          </svg>
        </button>
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <span data-tutorial={dataTutorial ? 'move-buttons' : undefined} className="flex items-center gap-1.5">
            {onMoveUp && (
              <button
                type="button"
                onClick={onMoveUp}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={onMoveDown}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            )}
            </span>
            {onSwapExercise && (
              <button
                type="button"
                data-tutorial={dataTutorial ? 'swap-button' : undefined}
                onClick={() => { setShowSwap(true); setSwapSearch(''); }}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-blue-400 hover:bg-blue-500/20 active:scale-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
              </button>
            )}
            <span data-tutorial={dataTutorial ? 'add-delete-buttons' : undefined} className="flex items-center gap-1.5">
            {onAddExercise && (
              <button
                type="button"
                onClick={() => { setShowAddBelow(true); setAddBelowSearch(''); }}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-green-400 hover:bg-green-500/20 active:scale-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
            {onDeleteExercise && (
              <button
                type="button"
                onClick={onDeleteExercise}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            </span>
          </div>
        )}
      </div>

      {/* Exercise Description (from template) */}
      {exercise.exerciseDescription && (
        <div className="px-4 py-2 border-b border-white/5 bg-white/[0.02]">
          <p className="text-xs text-wf-gray-400 leading-relaxed">{exercise.exerciseDescription}</p>
        </div>
      )}

      {/* Smart Weight Suggestion Banner */}
      {!isTemplate && !readOnly && weightSuggestion && (
        <div className={`px-4 py-2 border-b border-white/5 flex items-center justify-between ${
          weightSuggestion.direction === 'up' ? 'bg-green-500/10' :
          weightSuggestion.direction === 'hold' ? 'bg-yellow-500/10' :
          'bg-orange-500/10'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm shrink-0 ${
              weightSuggestion.direction === 'up' ? 'text-green-400' :
              weightSuggestion.direction === 'hold' ? 'text-yellow-400' :
              'text-orange-400'
            }`}>
              {weightSuggestion.direction === 'up' ? '\u2191' : weightSuggestion.direction === 'hold' ? '\u2192' : '\u2193'}
            </span>
            <div className="min-w-0">
              <span className="text-xs text-white font-semibold">
                {weightSuggestion.direction === 'up' ? `Try ${weightSuggestion.weight} lbs` :
                 weightSuggestion.direction === 'hold' ? `Hold at ${weightSuggestion.weight} lbs` :
                 `Drop to ${weightSuggestion.weight} lbs`}
              </span>
              <span className="text-[10px] text-wf-gray-400 ml-1.5">{weightSuggestion.reason}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => onApplySuggestion(exercise.name, weightSuggestion.weight)}
              className="h-6 px-2 rounded-full bg-white/10 text-[10px] font-semibold text-white uppercase tracking-wider hover:bg-white/20 active:scale-90 transition-all"
            >
              Apply
            </button>
          </div>
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
              className="h-7 px-2.5 rounded-full bg-white/10 flex items-center justify-center gap-1 text-wf-gray-400 hover:text-white hover:bg-white/20 active:scale-90 transition-all"
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
                  const lastKey = `${exercise.name}-${lastIdx}`;
                  if (completedSets?.has(lastKey)) {
                    setConfirmDeleteLast(true);
                  } else {
                    onDeleteSet(exercise.name, lastIdx);
                  }
                }}
                className="h-7 px-2.5 rounded-full bg-white/10 flex items-center justify-center gap-1 text-wf-gray-400 hover:text-red-400 hover:bg-red-500/20 active:scale-90 transition-all"
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
        {!isTemplate && !readOnly && onToggleComplete && <div className="w-5 shrink-0" />}
        <div className="w-[1.3rem] shrink-0 text-center">Set</div>
        <div className="w-[2.8rem] shrink-0 text-center">Type</div>
        {!isTemplate && <div className="w-[3.15rem] shrink-0 text-center">Goal Wt</div>}
        <div className="w-[3.15rem] shrink-0 text-center">Weight</div>
        {isTemplate ? (
          <div className="flex-1 text-center">Reps</div>
        ) : (
          <>
            <div className="flex-1 text-center">Goal</div>
            <div className="flex-1 text-center">Actual</div>
          </>
        )}
      </div>

      {/* Set Rows */}
      <div className="divide-y divide-white/5">
        {exercise.sets.map((set, idx) => {
          const entry = entries?.[idx] || {};
          const setKey = `${exercise.name}-${idx}`;
          const isCompleted = !isTemplate && completedSets?.has(setKey);
          const isAutoFill = !isTemplate && autoFilled?.has(setKey) && !isCompleted;
          const rowWeight = entry.weight ?? set.suggestedWeight;
          const pbReps = (rowWeight !== undefined && rowWeight !== '' && rowWeight !== null) ? exercisePbs[rowWeight] : undefined;
          return (
            <div
              key={idx}
              data-tutorial={dataTutorial && idx === 0 ? 'set-row' : undefined}
              className={`px-3 py-2.5 flex items-center gap-1.5 transition-colors duration-200 ${
                isCompleted ? 'bg-green-500/10' : ''
              }`}
              onTouchStart={!readOnly && onDeleteSet ? (e) => handleTouchStart(idx, e) : undefined}
              onTouchEnd={!readOnly && onDeleteSet ? handleTouchEnd : undefined}
              onTouchMove={!readOnly && onDeleteSet ? handleTouchMove : undefined}
              onContextMenu={!readOnly && onDeleteSet ? (e) => { e.preventDefault(); setDeleteIdx(idx); } : undefined}
            >
              {/* Checkmark circle — session mode only */}
              {!isTemplate && !readOnly && onToggleComplete && (
                <button
                  type="button"
                  onClick={() => onToggleComplete(exercise.name, idx)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
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
              <span className="text-wf-gray-400 text-xs font-medium w-[1.3rem] shrink-0 text-center">
                {isTemplate ? idx + 1 : set.setNumber}
              </span>

              {/* Set type dropdown — shows shorthand, dropdown lists full names */}
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

              {/* Goal Weight (read-only, from template) — session mode only */}
              {!isTemplate && (
                <div className="w-[3.15rem] shrink-0">
                  <div className="w-full rounded-lg px-1 py-2.5 text-center text-sm font-mono-stat text-wf-gray-500 bg-black/40 border border-white/5">
                    {set.suggestedWeight ?? '—'}
                  </div>
                </div>
              )}

              {/* Weight input */}
              <div className="w-[3.15rem] shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="9999"
                  value={entry.weight ?? (isTemplate ? '' : set.suggestedWeight ?? '')}
                  placeholder={readOnly ? '—' : '0'}
                  onChange={(e) => onChange?.(exercise.name, idx, 'weight', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => onBlur?.(exercise.name, idx, 'weight')}
                  readOnly={readOnly}
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
                    onChange={(e) => onChange?.(exercise.name, idx, 'reps', e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="w-full lcd-input rounded-lg px-2 py-2.5 text-center text-base text-white focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  {/* Goal reps (read-only, from template) */}
                  <div className="flex-1">
                    <div className="w-full rounded-lg px-2 py-2.5 text-center text-base font-mono-stat text-wf-gray-500 bg-black/40 border border-white/5">
                      {set.plannedReps ?? '—'}
                    </div>
                  </div>

                  {/* Actual reps (editable) */}
                  <div className="flex-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max="9999"
                      value={entry.reps ?? ''}
                      onChange={(e) => onChange?.(exercise.name, idx, 'reps', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => onBlur?.(exercise.name, idx, 'reps')}
                      readOnly={readOnly}
                      placeholder={readOnly ? '—' : '0'}
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
                  onClick={() => { onAddExercise(addBelowSearch.trim()); setShowAddBelow(false); }}
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
                  onClick={() => { onAddExercise(ex.name); setShowAddBelow(false); }}
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
              {!q && (
                <p className="text-wf-gray-500 text-xs text-center py-4">Start typing to search exercises...</p>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

function SwapModal({ exerciseName, allExercises, search, onSearchChange, onSelect, onClose, allWorkoutExercises }) {
  const substitutes = useMemo(() => getSubstitutesFromList(exerciseName, allExercises), [exerciseName, allExercises]);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return substitutes;
    const q = search.toLowerCase().trim();
    return substitutes.filter((e) =>
      e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)
    );
  }, [substitutes, search]);

  const handleAISuggest = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await api('/ai/suggest-swap', {
        method: 'POST',
        body: JSON.stringify({
          exerciseName,
          reason: 'equipment_taken',
          currentWorkoutExercises: allWorkoutExercises || [],
        }),
      });
      setAiSuggestions(result.suggestions);
    } catch (err) {
      setAiError(err.message || 'Failed to get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  // Group into suggested (high score, same muscle) and the rest
  const suggested = filtered.filter((e) => e.score >= 12);
  const others = filtered.filter((e) => !e.score || e.score < 12);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80" />
      <div
        className="relative flex-1 flex flex-col mt-12 bg-wf-gray-900 rounded-t-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black text-white">Swap Exercise</h3>
            <button onClick={onClose} className="text-wf-gray-400 active:opacity-70">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-wf-gray-500 text-xs mb-3">
            Replacing <span className="text-white font-semibold">{exerciseName}</span>
          </p>
          {/* Search + AI Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
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
            <button
              type="button"
              onClick={handleAISuggest}
              disabled={aiLoading}
              className="shrink-0 h-[46px] px-3 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center gap-1.5 text-purple-300 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              )}
              AI
            </button>
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {/* Custom exercise option — show when search doesn't match exactly, or when few results remain */}
          {search.trim() && (!allExercises.some((ex) => ex.name.toLowerCase() === search.trim().toLowerCase()) || filtered.length < 3) && (
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

          {/* AI Suggestions */}
          {aiSuggestions && aiSuggestions.length > 0 && (
            <>
              <p className="text-[10px] text-purple-400 uppercase tracking-widest font-medium mt-3 mb-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                AI Suggestions
              </p>
              {aiSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSelect(s.name)}
                  className="w-full text-left px-3 py-3 rounded-xl mb-1 bg-purple-500/10 border border-purple-500/20 active:scale-[0.98] transition-all"
                >
                  <span className="text-sm font-medium text-purple-300">{s.name}</span>
                  <p className="text-[10px] text-wf-gray-400 mt-0.5">{s.reason}</p>
                </button>
              ))}
            </>
          )}

          {aiError && (
            <div className="mt-3 mb-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">{aiError}</p>
            </div>
          )}

          {suggested.length > 0 && !search.trim() && (
            <>
              <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mt-3 mb-2">Suggested Substitutes</p>
              {suggested.map((ex) => (
                <ExerciseOption key={ex.name} exercise={ex} onSelect={onSelect} highlight />
              ))}
            </>
          )}

          {others.length > 0 && (
            <>
              {!search.trim() && suggested.length > 0 && (
                <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mt-4 mb-2">All Exercises</p>
              )}
              {others.map((ex) => (
                <ExerciseOption key={ex.name} exercise={ex} onSelect={onSelect} />
              ))}
            </>
          )}

          {filtered.length === 0 && !aiSuggestions && !search.trim() && (
            <div className="text-center py-12">
              <p className="text-wf-gray-500 text-sm">No exercises found</p>
            </div>
          )}
        </div>
      </div>
    </div>
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
