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
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
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
      const programTemplates = templates
        .filter((t) => t.programId === p.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
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

  function enterEditMode(program) {
    setEditMode(true);
    setEditName(program.name);
  }

  async function exitEditMode(program) {
    // Save name if changed
    if (editName.trim() && editName.trim() !== program.name) {
      try {
        await api(`/programs/${program.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: editName.trim() }),
        });
        setPrograms((prev) => prev.map((p) => p.id === program.id ? { ...p, name: editName.trim() } : p));
      } catch (err) {
        console.error(err);
      }
    }
    setEditMode(false);
  }

  async function handleMoveTemplate(program, idx, direction) {
    const tmplList = program.templates;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= tmplList.length) return;

    // Swap in local state
    const reordered = [...tmplList];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const orderedIds = reordered.map((t) => t.id);

    // Update local templates order
    setTemplates((prev) => {
      const updated = [...prev];
      for (let i = 0; i < orderedIds.length; i++) {
        const t = updated.find((u) => u.id === orderedIds[i]);
        if (t) t.sortOrder = i;
      }
      return updated;
    });

    try {
      await api('/templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ programId: program.id, templateIds: orderedIds }),
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteTemplate(templateId) {
    if (!confirm('Delete this workout? This will also remove its history and personal bests.')) return;
    try {
      await api(`/templates/${templateId}`, { method: 'DELETE' });
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteProgram(programId) {
    if (!confirm('Delete this entire program and all its workouts? This cannot be undone.')) return;
    try {
      await api(`/programs/${programId}`, { method: 'DELETE' });
      setPrograms((prev) => prev.filter((p) => p.id !== programId));
      setTemplates((prev) => prev.filter((t) => t.programId !== programId));
      setSelectedProgram(null);
      setEditMode(false);
    } catch (err) {
      console.error(err);
    }
  }

  // Program detail view — show individual templates
  if (selectedProgram) {
    const program = enrichedPrograms.find((p) => p.id === selectedProgram);
    if (!program) return null;

    return (
      <div>
        <StickyHeader title={editMode ? '' : program.name}>
          {editMode ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 min-w-0 glass-input rounded-lg px-3 py-2 text-white text-sm font-semibold focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => exitEditMode(program)}
                className="text-wf-green font-semibold text-sm px-3 py-2 shrink-0"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => enterEditMode(program)}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
              >
                <svg className="w-4.5 h-4.5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={() => navigate(`/workouts/create?programId=${program.id}`)}
                className="btn-gradient active:scale-[0.98] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0"
              >
                + Workout
              </button>
            </div>
          )}
        </StickyHeader>

        {/* Back button */}
        <div className="px-4 mb-3">
          <button
            onClick={() => { setSelectedProgram(null); setEditMode(false); }}
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
                  className={`glass-card rounded-xl p-4 transition-transform fade-slide-up border-l-4 ${color.border}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Edit mode: reorder arrows */}
                    {editMode && (
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMoveTemplate(program, idx, -1)}
                          disabled={idx === 0}
                          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center disabled:opacity-25 active:bg-white/20 transition-colors"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveTemplate(program, idx, 1)}
                          disabled={idx === program.templates.length - 1}
                          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center disabled:opacity-25 active:bg-white/20 transition-colors"
                        >
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Workout info */}
                    <div className="flex-1 min-w-0">
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

                    {/* Edit mode: delete button | Normal: edit button */}
                    {editMode ? (
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 active:bg-red-500/40 transition-colors"
                      >
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : !t.isRest ? (
                      <button
                        onClick={() => navigate(`/workouts/edit/${t.id}`)}
                        className="w-10 h-10 rounded-full bg-wf-red/20 flex items-center justify-center shrink-0 active:bg-wf-red/40 transition-colors"
                      >
                        <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
                    ) : null}
                  </div>

                  {/* Exercise list preview (hidden in edit mode) */}
                  {!editMode && !t.isRest && t.exercises.length > 0 && (
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

          {/* Delete Program button (edit mode only) */}
          {editMode && (
            <button
              onClick={() => handleDeleteProgram(program.id)}
              className="w-full glass-card !border-red-800/50 hover:!border-red-700 text-red-400 font-semibold py-4 rounded-xl text-sm transition-all active:scale-[0.98] mb-6"
            >
              Delete Program
            </button>
          )}
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
