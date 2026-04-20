import { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import StickyHeader from './StickyHeader';

// Social icon SVGs
const SOCIAL_ICONS = {
  instagram: (
    <svg className="w-4 h-4 text-wf-gray-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  youtube: (
    <svg className="w-4 h-4 text-wf-gray-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4 text-wf-gray-400" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
};

export default function TrainerProfile({
  trainer,
  bioExpanded,
  setBioExpanded,
  expandedWorkoutCard,
  setExpandedWorkoutCard,
  onBack,
  onPreviewWorkout,
  onAddToday,
  onChooseDate,
  showAddDatePicker,
  setShowAddDatePicker,
  addDateInput,
  setAddDateInput,
  onAddDate,
  addConflictInfo,
  setAddConflictInfo,
  onApplyAddWorkout,
}) {
  const t = trainer;
  const socialKeys = t.socials ? Object.keys(t.socials) : [];
  const trainerDateRef = useRef(null);

  return (
    <div>
      <StickyHeader title={t.name} />

      {/* Back button */}
      <div className="px-4 mb-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Featured Trainers
        </button>
      </div>

      <div className="px-4 pb-4">
        {/* Profile card */}
        <div className="glass-card rounded-2xl overflow-hidden fade-slide-up mb-5">
          {/* Photo + name + socials */}
          <div className="w-full pt-8 pb-4 bg-gradient-to-br from-purple-600/40 via-purple-500/20 to-wf-blue/30 flex flex-col items-center">
            <div className="w-28 h-28 rounded-full overflow-hidden ring-3 ring-purple-400/60 shadow-[0_0_25px_rgba(168,85,247,0.35)]">
              {t.photo ? (
                <img src={t.photo} alt={t.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-purple-500/30 flex items-center justify-center">
                  <span className="text-3xl font-black text-purple-300">{t.initials}</span>
                </div>
              )}
            </div>
            <h2 className="text-2xl font-black text-white mt-3">{t.name}</h2>
            <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mt-0.5">{t.title}</p>

            {socialKeys.length > 0 && (
              <div className="flex items-center gap-4 mt-3">
                {socialKeys.map((key) => (
                  <a key={key} href={t.socials[key]} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors">
                    {SOCIAL_ICONS[key]}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-around py-3 border-b border-white/10">
            <div className="text-center">
              <p className="text-lg font-black text-white">{t.stats.years}</p>
              <p className="text-[10px] text-wf-gray-500 uppercase tracking-wider">Years</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-lg font-black text-white">{t.stats.clients}</p>
              <p className="text-[10px] text-wf-gray-500 uppercase tracking-wider">Clients</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                </svg>
                <p className="text-lg font-black text-white">{t.stats.rating}</p>
              </div>
              <p className="text-[10px] text-wf-gray-500 uppercase tracking-wider">Rating</p>
            </div>
          </div>

          {/* Tags */}
          {t.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-b border-white/10">
              {t.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/25 text-[11px] font-semibold text-purple-300">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Credentials + bio */}
          <div className="p-5">
            {t.credentials && (
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
                <span className="text-xs text-green-400 font-semibold">{t.credentials}</span>
              </div>
            )}
            <div className={`relative ${!bioExpanded ? 'max-h-[3.6em] overflow-hidden' : ''}`}>
              <p className="text-sm text-wf-gray-400 leading-relaxed">{t.bio}</p>
              {!bioExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[rgba(255,255,255,0.05)] to-transparent" />
              )}
            </div>
            <button
              onClick={() => setBioExpanded(!bioExpanded)}
              className="text-xs text-purple-400 font-semibold mt-1 active:opacity-70"
            >
              {bioExpanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        </div>

        {/* Community counter (#13) */}
        <div className="glass-card rounded-xl p-4 mb-5 fade-slide-up flex items-center gap-3" style={{ animationDelay: '40ms' }}>
          <div className="w-10 h-10 rounded-xl bg-wf-red/15 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-black text-white">{t.stats.communityWorkouts?.toLocaleString() || 0}</p>
            <p className="text-[10px] text-wf-gray-500 uppercase tracking-wider">Workouts completed by community</p>
          </div>
        </div>

        {/* Featured Workouts */}
        <h3 className="text-sm font-semibold text-wf-gray-400 uppercase tracking-wider mb-3">Featured Workouts</h3>

        {t.workouts.map((workout, wIdx) => {
          const workoutKey = workout.id;
          const isExpanded = expandedWorkoutCard === workoutKey;
          const templateObj = {
            id: `__${workout.id}__`,
            name: workout.name,
            description: workout.description,
            trainerName: t.name,
            exercises: workout.exercises,
            isRest: false,
          };

          return (
            <div key={workout.id} className="glass-card rounded-xl overflow-hidden fade-slide-up mb-3" style={{ animationDelay: `${(wIdx + 2) * 40}ms` }}>
              <div className={`h-1.5 bg-gradient-to-r from-${workout.colorFrom} to-${workout.colorTo}`} />
              <div className="p-4">
                {/* Header — tap to expand */}
                <div
                  className="cursor-pointer"
                  onClick={() => setExpandedWorkoutCard(isExpanded ? null : workoutKey)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${workout.dotColor}`} />
                      <h4 className="text-lg font-semibold text-white">{workout.name}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full ${workout.badgeColor.bg} border ${workout.badgeColor.border} text-[10px] font-bold ${workout.badgeColor.text} uppercase tracking-wider`}>
                        {workout.difficulty}
                      </span>
                      <svg className={`w-4 h-4 text-wf-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>
                  {/* Meta — always visible */}
                  <div className="flex items-center gap-3 ml-4.5">
                    <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {workout.duration}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
                      </svg>
                      {workout.calories}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                      </svg>
                      {workout.exercises.length} exercises
                    </span>
                  </div>
                </div>

                {/* Collapsible content */}
                {isExpanded && (
                  <>
                    <div className="border-t border-white/10 pt-3 mb-4 mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600">Exercise</span>
                        <span className="w-10 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Sets</span>
                        <span className="w-14 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Reps</span>
                      </div>
                      {workout.exercises.map((ex) => (
                        <div key={ex.name} className="flex items-center gap-2 px-1">
                          <span className="flex-1 text-sm text-white/80 truncate">{ex.name}</span>
                          <span className="w-10 text-sm font-mono-stat text-wf-gray-400 text-center">{ex.sets.length}</span>
                          <span className="w-14 text-sm font-mono-stat text-wf-gray-400 text-center">{ex.repRange}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => onPreviewWorkout(templateObj)}
                        className="flex-1 glass-card text-wf-gray-400 font-semibold py-2.5 rounded-xl text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Preview
                      </button>
                    </div>
                  </>
                )}

                {/* Add to calendar buttons */}
                {!showAddDatePicker ? (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => onAddToday(workout)}
                      className="flex-1 btn-gradient text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                    >
                      Add to Today
                    </button>
                    <button
                      onClick={() => {
                        // flushSync mounts the input inside the user-gesture window
                        // so showPicker() actually opens the native calendar.
                        flushSync(() => setShowAddDatePicker(true));
                        const el = trainerDateRef.current;
                        if (el) {
                          el.focus();
                          try { el.showPicker?.(); } catch {}
                        }
                      }}
                      className="flex-1 glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                    >
                      Choose Date
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-2">
                    <button
                      onClick={() => { setShowAddDatePicker(false); setAddDateInput(''); }}
                      aria-label="Cancel date selection"
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-wf-gray-400 active:scale-90 transition-all z-10"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="flex gap-2 pt-4">
                      <input
                        type="date"
                        value={addDateInput}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setAddDateInput(e.target.value)}
                        className="flex-1 glass-input rounded-xl px-3 py-3 text-white text-sm focus:outline-none"
                        ref={trainerDateRef}
                      />
                      <button
                        onClick={() => onAddDate(workout)}
                        disabled={!addDateInput}
                        className="btn-gradient text-white font-semibold px-5 py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-40"
                      >
                        Schedule
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

      </div>

      {/* Conflict modal */}
      {addConflictInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setAddConflictInfo(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-white mb-2">Overwrite existing workout?</h3>
            <p className="text-wf-gray-400 text-sm mb-3">This will replace the current workout on:</p>
            <p className="text-sm font-semibold text-wf-red flex items-center gap-2 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-wf-red" />
              {addConflictInfo.dayName}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setAddConflictInfo(null)}
                className="flex-1 glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => onApplyAddWorkout(addConflictInfo.entry)}
                className="flex-1 bg-wf-red/90 hover:bg-wf-red text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
