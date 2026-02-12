import { useState } from 'react';
import { getExerciseVideoId, getExerciseSearchUrl } from '../utils/exerciseVideos.js';
import VideoPlayerModal from './VideoPlayerModal.jsx';

export default function ExerciseCard({ exercise, entries, pbs, onChange, readOnly, completedSets, onToggleComplete }) {
  const pb = pbs?.[exercise.name];
  const videoId = getExerciseVideoId(exercise.name);
  const [showVideo, setShowVideo] = useState(false);

  const handleVideoClick = () => {
    if (videoId) {
      setShowVideo(true);
    } else {
      window.open(getExerciseSearchUrl(exercise.name), '_blank');
    }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden mb-3">
      {/* Exercise Header */}
      <div className="px-4 py-3 border-b border-white/10">
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
      </div>

      {/* Column Headers */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[9px] text-wf-gray-500 uppercase tracking-wider">
        {!readOnly && onToggleComplete && <div className="w-7 shrink-0" />}
        <div className="w-8 shrink-0 text-center">Set</div>
        <div className="flex-1 text-center">Weight</div>
        <div className="w-14 shrink-0 text-center">Goal</div>
        <div className="flex-1 text-center">Actual</div>
        <div className="w-16 shrink-0 text-right">PR</div>
      </div>

      {/* Set Rows */}
      <div className="divide-y divide-white/5">
        {exercise.sets.map((set, idx) => {
          const entry = entries?.[idx] || {};
          const isCompleted = completedSets?.has(`${exercise.name}-${idx}`);
          return (
            <div
              key={idx}
              className={`px-3 py-2.5 flex items-center gap-1.5 transition-colors duration-200 ${
                isCompleted ? 'bg-green-500/10' : ''
              }`}
            >
              {/* Checkmark circle */}
              {!readOnly && onToggleComplete && (
                <button
                  type="button"
                  onClick={() => onToggleComplete(exercise.name, idx)}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500'
                      : 'border-wf-gray-500 bg-transparent'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )}

              {/* Set label */}
              <span className="text-wf-gray-400 text-xs font-medium w-8 shrink-0 text-center">
                {set.setNumber}
              </span>

              {/* Weight input */}
              <div className="flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={entry.weight ?? set.suggestedWeight ?? ''}
                  onChange={(e) => onChange?.(exercise.name, idx, 'weight', e.target.value)}
                  readOnly={readOnly}
                  className="w-full glass-input rounded-lg px-2 py-2 text-white text-center text-sm font-medium focus:outline-none transition-all disabled:opacity-50"
                  disabled={readOnly}
                />
              </div>

              {/* Goal reps (read-only, from template) */}
              <div className="w-14 shrink-0">
                <div className="w-full rounded-lg px-2 py-2 text-center text-sm font-medium text-wf-gray-400 bg-white/5">
                  {set.plannedReps ?? '—'}
                </div>
              </div>

              {/* Actual reps (editable) */}
              <div className="flex-1">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={entry.reps ?? ''}
                  onChange={(e) => onChange?.(exercise.name, idx, 'reps', e.target.value)}
                  readOnly={readOnly}
                  placeholder={readOnly ? '—' : ''}
                  className="w-full glass-input rounded-lg px-2 py-2 text-white text-center text-sm font-medium focus:outline-none transition-all disabled:opacity-50 placeholder:text-wf-gray-600"
                  disabled={readOnly}
                />
              </div>

              {/* PR display */}
              <div className="w-16 shrink-0 text-right">
                {pb ? (
                  <div className="pb-badge rounded-lg px-1.5 py-1.5 inline-flex items-center gap-0.5">
                    <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
                    </svg>
                    <span className="text-[11px] font-bold text-amber-400 tabular-nums">
                      {pb.bestWeight}x{pb.bestReps}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-wf-gray-500 py-2">—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Player Modal */}
      {showVideo && videoId && (
        <VideoPlayerModal
          videoId={videoId}
          exerciseName={exercise.name}
          onClose={() => setShowVideo(false)}
        />
      )}
    </div>
  );
}
