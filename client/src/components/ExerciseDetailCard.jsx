/**
 * ExerciseDetailCard — full exercise breakdown used on detail pages.
 *
 * Renders all sections of an exercise detail page from an exercise data object:
 * - Header (name, tags)
 * - Anatomy diagram
 * - Video embed
 * - Overview
 * - Quick info grid
 * - Muscle activation chart
 * - Step-by-step instructions
 * - Form tips
 * - Common mistakes
 *
 * Props:
 *   exercise — a full exercise data object (see data/exercises/)
 */

import ExerciseAnatomy from './ExerciseAnatomy.jsx';

export default function ExerciseDetailCard({ exercise }) {
  if (!exercise) return null;

  return (
    <div className="space-y-4">
      {/* === HEADER === */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-1">{exercise.name}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-wf-red/15 text-wf-red">
            {exercise.category}
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-wf-gray-400 border border-white/10">
            {exercise.type}
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-wf-gray-400 border border-white/10">
            {exercise.difficulty}
          </span>
        </div>
      </div>

      {/* === ANATOMY DIAGRAM === */}
      <ExerciseAnatomy figure={exercise.figure} />

      {/* === VIDEO === */}
      {exercise.videoId && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${exercise.videoId}?rel=0`}
            title={`${exercise.name} form guide`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* === OVERVIEW === */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">Overview</h2>
        <p className="text-sm text-wf-gray-300 leading-relaxed">{exercise.description}</p>
      </div>

      {/* === QUICK INFO === */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest mb-1">Equipment</p>
          <p className="text-sm font-semibold text-white">{exercise.equipment}</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest mb-1">Secondary Muscles</p>
          <p className="text-sm font-semibold text-white">{exercise.secondaryMuscles.join(', ')}</p>
        </div>
      </div>

      {/* === MUSCLE ACTIVATION === */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Muscle Activation</h2>
        <div className="space-y-3">
          {exercise.musclesWorked.map(m => (
            <div key={m.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">{m.name}</span>
                <span className="text-xs text-wf-gray-500 capitalize">{m.role}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${m.percentage}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === INSTRUCTIONS === */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">How To Perform</h2>
        <ol className="space-y-3">
          {exercise.instructions.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-wf-red/15 text-wf-red text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-wf-gray-300 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* === FORM TIPS === */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Form Tips</h2>
        <ul className="space-y-2">
          {exercise.formTips.map((tip, i) => (
            <li key={i} className="flex gap-2">
              <svg className="w-4 h-4 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <p className="text-sm text-wf-gray-300 leading-relaxed">{tip}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* === COMMON MISTAKES === */}
      <div className="glass-card rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Common Mistakes</h2>
        <div className="space-y-3">
          {exercise.commonMistakes.map((item, i) => (
            <div key={i} className="border-l-2 border-red-500/50 pl-3">
              <p className="text-sm font-medium text-red-400 mb-0.5">{item.mistake}</p>
              <p className="text-sm text-wf-gray-400">{item.fix}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
