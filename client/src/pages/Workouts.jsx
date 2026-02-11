import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';

export default function Workouts() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api('/templates')
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group templates into programs
  function getPrograms() {
    if (templates.length === 0) return [];
    const nonRest = templates.filter((t) => !t.isRest);
    const programName = nonRest.map((t) => t.name).join(', ');
    const totalExercises = nonRest.reduce((sum, t) => sum + (t.exercises?.length || 0), 0);
    return [
      {
        id: 'default',
        name: programName || 'My Program',
        workoutCount: templates.length,
        exerciseCount: totalExercises,
        templates,
        colors: nonRest.map((t) => getWorkoutColor(t.name)),
      },
    ];
  }

  const programs = getPrograms();

  // Program detail view — show individual templates
  if (selectedProgram) {
    const program = programs.find((p) => p.id === selectedProgram);
    if (!program) return null;

    return (
      <div>
        <StickyHeader title={program.name}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/workouts/create')}
              className="btn-gradient active:scale-[0.98] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0"
            >
              + Create
            </button>
          </div>
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
          onClick={() => navigate('/workouts/create')}
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
        ) : programs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-wf-gray-400 text-sm">No programs yet</p>
            <p className="text-wf-gray-500 text-xs mt-1">Create your first workout to get started</p>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {programs.map((program, idx) => (
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
    </div>
  );
}
