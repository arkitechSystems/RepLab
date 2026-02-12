import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';

export default function Workouts() {
  const [programs, setPrograms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api('/programs'), api('/templates')])
      .then(([progs, tmpls]) => {
        setPrograms(progs);
        setTemplates(tmpls);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build enriched program list by matching templates to their programId
  function getEnrichedPrograms() {
    return programs.map((p) => {
      const programTemplates = templates.filter((t) => t.programId === p.id);
      const nonRest = programTemplates.filter((t) => !t.isRest);
      const totalExercises = nonRest.reduce((sum, t) => sum + (t.exercises?.length || 0), 0);
      return {
        ...p,
        templates: programTemplates,
        workoutCount: programTemplates.length,
        exerciseCount: totalExercises,
        colors: nonRest.map((t) => getWorkoutColor(t.name)),
      };
    });
  }

  const enrichedPrograms = getEnrichedPrograms();

  // Program detail view — show individual templates
  if (selectedProgram) {
    const program = enrichedPrograms.find((p) => p.id === selectedProgram);
    if (!program) return null;

    return (
      <div>
        <StickyHeader title={program.name}>
          <button
            onClick={() => navigate(`/workouts/create?programId=${program.id}`)}
            className="btn-gradient active:scale-[0.98] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0"
          >
            + Workout
          </button>
        </StickyHeader>

        {/* Back button */}
        <div className="px-4 mb-3">
          <button
            onClick={() => setSelectedProgram(null)}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All Programs
          </button>
        </div>

        <div className="px-4">
          <div className="space-y-3 pb-4">
            {program.templates.map((t, idx) => {
              const color = getWorkoutColor(t.name);
              return (
                <div
                  key={t.id}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  className={`glass-card rounded-xl p-4 active:scale-[0.98] transition-transform fade-slide-up border-l-4 ${color.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                        <h3 className="text-lg font-semibold text-white">{t.name}</h3>
                      </div>
                      {t.description && (
                        <p className="text-wf-gray-400 text-sm mt-0.5 ml-4">{t.description}</p>
                      )}
                      <p className="text-wf-gray-500 text-xs mt-1 ml-4">
                        {t.isRest ? 'Rest day' : `${t.exercises.length} exercises`}
                      </p>
                    </div>
                    {!t.isRest && (
                      <button
                        onClick={() => navigate(`/workouts/edit/${t.id}`)}
                        className="w-10 h-10 rounded-full bg-wf-red/20 flex items-center justify-center shrink-0 active:bg-wf-red/40 transition-colors"
                      >
                        <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Exercise list preview */}
                  {!t.isRest && t.exercises.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex flex-wrap gap-2">
                        {t.exercises.map((ex) => (
                          <span
                            key={ex.name}
                            className="text-xs bg-white/10 text-wf-gray-400 px-2.5 py-1 rounded-full"
                          >
                            {ex.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Programs list view
  return (
    <div>
      <StickyHeader title="Programs">
        <button
          onClick={() => setShowCreateMenu(true)}
          className="btn-gradient active:scale-[0.98] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0"
        >
          + Create
        </button>
      </StickyHeader>

      <div className="px-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="glass-skeleton rounded-xl h-40" />
            ))}
          </div>
        ) : enrichedPrograms.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-wf-gray-400 text-sm">No programs yet</p>
            <p className="text-wf-gray-500 text-xs mt-1">Create your first workout to get started</p>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {enrichedPrograms.map((program, idx) => (
              <button
                key={program.id}
                onClick={() => setSelectedProgram(program.id)}
                style={{ animationDelay: `${idx * 80}ms` }}
                className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up"
              >
                {/* Color strip */}
                <div className="flex h-1.5">
                  {program.colors.map((c, i) => (
                    <div key={i} className={`flex-1 ${c.dot}`} />
                  ))}
                </div>

                <div className="p-5">
                  <h2 className="text-xl font-black text-white tracking-tight">{program.name}</h2>
                  <p className="text-wf-gray-400 text-sm mt-1">
                    {program.workoutCount} workouts &middot; {program.exerciseCount} exercises
                  </p>

                  {/* Workout preview dots */}
                  <div className="flex items-center gap-3 mt-4">
                    {program.templates.filter((t) => !t.isRest).map((t) => {
                      const color = getWorkoutColor(t.name);
                      return (
                        <div key={t.id} className="flex items-center gap-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                          <span className="text-xs text-wf-gray-400 font-medium">{t.name}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tap hint */}
                  <div className="flex items-center justify-end mt-3">
                    <span className="text-xs text-wf-gray-500 mr-1">View workouts</span>
                    <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Choice Dropdown */}
      {showCreateMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setShowCreateMenu(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute top-16 right-4 left-4 max-w-sm ml-auto animate-drop-down"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
              {/* Options */}
              <div className="p-3 space-y-1.5">
                {/* New Program */}
                <button
                  onClick={() => { setShowCreateMenu(false); navigate('/programs/create'); }}
                  className="w-full text-left rounded-xl p-3.5 flex items-center gap-3.5 active:scale-[0.98] transition-all hover:bg-white/5 active:bg-white/10"
                >
                  <div className="w-10 h-10 rounded-xl btn-gradient flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white">New Program</h4>
                    <p className="text-xs text-wf-gray-400 mt-0.5">Create a group of workouts</p>
                  </div>
                  <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {/* Divider */}
                <div className="border-t border-white/5 mx-2" />

                {/* New Workout */}
                <button
                  onClick={() => { setShowCreateMenu(false); navigate('/workouts/create'); }}
                  className="w-full text-left rounded-xl p-3.5 flex items-center gap-3.5 active:scale-[0.98] transition-all hover:bg-white/5 active:bg-white/10"
                >
                  <div className="w-10 h-10 rounded-xl bg-wf-blue/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-wf-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white">New Workout</h4>
                    <p className="text-xs text-wf-gray-400 mt-0.5">Add to an existing program</p>
                  </div>
                  <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
