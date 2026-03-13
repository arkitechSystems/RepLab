import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';
import TrainerProfile from '../components/TrainerProfile';
import { getTrainers, getTrainerById } from '../data/trainers';

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ProgramCard({ program, idx, onSelect, onBegin }) {
  return (
    <div
      onClick={() => onSelect(program.id)}
      style={{ animationDelay: `${idx * 80}ms` }}
      className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
    >
      {/* Color strip */}
      <div className="flex h-1.5">
        {program.colors.map((c, i) => (
          <div key={i} className={`flex-1 ${c.dot}`} />
        ))}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white tracking-tight">{program.name}</h2>
            <p className="text-wf-gray-400 text-sm mt-1">
              {program.workoutCount} workouts &middot; {program.exerciseCount} exercises
            </p>
          </div>
          <button
            onClick={(e) => onBegin(e, program)}
            className="btn-gradient shrink-0 text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
          >
            Begin Program
          </button>
        </div>

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
    </div>
  );
}

export default function Workouts() {
  const [programs, setPrograms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null); // 'browse' | 'my' | 'partners' | null
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [previewWorkout, setPreviewWorkout] = useState(null); // template object for detail view
  const [bioExpanded, setBioExpanded] = useState(false);
  const [expandedWorkoutCard, setExpandedWorkoutCard] = useState(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  // Begin Program modal state
  const [beginModal, setBeginModal] = useState(null); // program object
  const [beginDateInput, setBeginDateInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [conflictInfo, setConflictInfo] = useState(null); // { conflicts: string[], pendingEntries: [] }
  // Add Workout modal state
  const [addWorkoutModal, setAddWorkoutModal] = useState(null); // template object
  const [addDateInput, setAddDateInput] = useState('');
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [addConflictInfo, setAddConflictInfo] = useState(null);
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

  async function openBeginProgram(e, program) {
    e.stopPropagation();
    setBeginModal(program);
    setBeginDateInput('');
    setConflictInfo(null);
  }

  function closeBeginModal() {
    setBeginModal(null);
    setBeginDateInput('');
    setShowDatePicker(false);
    setConflictInfo(null);
  }

  function buildEntries(program, startDate) {
    return program.templates.slice(0, 7).map((t, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      return { dayOfWeek: date.getDay(), templateId: t.id, date };
    });
  }

  async function tryApply(program, startDate) {
    const schedule = await api('/schedule');
    const entries = buildEntries(program, startDate);
    const conflicts = entries
      .filter((e) => schedule.some((s) => s.dayOfWeek === e.dayOfWeek && s.templateId))
      .map((e) => `${DAY_NAMES_FULL[e.dayOfWeek]}, ${e.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`);
    if (conflicts.length > 0) {
      setConflictInfo({ conflicts, pendingEntries: entries });
    } else {
      await applyEntries(entries);
    }
  }

  async function applyEntries(entries) {
    await api('/schedule', {
      method: 'PUT',
      body: JSON.stringify({ schedule: entries.map(({ dayOfWeek, templateId }) => ({ dayOfWeek, templateId })) }),
    });
    closeBeginModal();
    navigate('/');
  }

  async function handleStartToday() {
    await tryApply(beginModal, new Date());
  }

  async function handleBeginDate() {
    if (!beginDateInput) return;
    await tryApply(beginModal, new Date(beginDateInput + 'T00:00:00'));
  }

  // Add single workout to calendar
  function openAddWorkout(template) {
    setAddWorkoutModal(template);
    setAddDateInput('');
    setShowAddDatePicker(false);
    setAddConflictInfo(null);
  }

  function closeAddWorkoutModal() {
    setAddWorkoutModal(null);
    setAddDateInput('');
    setShowAddDatePicker(false);
    setAddConflictInfo(null);
  }

  async function tryAddWorkout(template, date) {
    const dow = date.getDay();
    const schedule = await api('/schedule');
    const existing = schedule.find((s) => s.dayOfWeek === dow && s.templateId);
    if (existing) {
      setAddConflictInfo({
        dayName: `${DAY_NAMES_FULL[dow]}, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
        entry: { dayOfWeek: dow, templateId: template.id },
      });
    } else {
      await applyAddWorkout({ dayOfWeek: dow, templateId: template.id });
    }
  }

  async function applyAddWorkout(entry) {
    await api('/schedule', {
      method: 'PUT',
      body: JSON.stringify({ schedule: [entry] }),
    });
    closeAddWorkoutModal();
    navigate('/');
  }

  async function handleAddToday() {
    await tryAddWorkout(addWorkoutModal, new Date());
  }

  async function handleAddDate() {
    if (!addDateInput) return;
    await tryAddWorkout(addWorkoutModal, new Date(addDateInput + 'T00:00:00'));
  }

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
  const browsePrograms = enrichedPrograms.filter((p) => p.userId === null);
  const myPrograms = enrichedPrograms.filter((p) => p.userId !== null);

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

  // Workout detail/preview view
  if (previewWorkout) {
    const pw = previewWorkout;
    const pwColor = getWorkoutColor(pw.name);
    return (
      <div>
        <StickyHeader title={pw.name} />

        {/* Back button — sticky below header */}
        <div className="sticky top-[52px] z-20 bg-black/80 backdrop-blur-xl px-4 py-2">
          <button
            onClick={() => setPreviewWorkout(null)}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>

        <div className="px-4 pb-4">
          {/* Workout header card */}
          <div className={`glass-card rounded-xl p-4 mb-4 border-l-4 ${pwColor.border} fade-slide-up`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${pwColor.dot}`} />
              <h2 className="text-xl font-black text-white">{pw.name}</h2>
            </div>
            {pw.description && (
              <p className="text-wf-gray-400 text-sm ml-5">{pw.description}</p>
            )}
            <p className="text-wf-gray-500 text-xs mt-1 ml-5">
              {pw.exercises?.length || 0} exercises &middot; {pw.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0} total sets
            </p>
          </div>

          {/* Exercise cards */}
          {pw.exercises?.filter(ex => !ex.isRest).map((ex, exIdx) => (
            <div
              key={ex.name}
              className="glass-card rounded-xl overflow-hidden mb-3 fade-slide-up"
              style={{ animationDelay: `${(exIdx + 1) * 60}ms` }}
            >
              {/* Exercise header */}
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="text-base font-semibold text-white">{ex.name}</h3>
                {ex.repRange && (
                  <p className="text-xs text-wf-gray-500 mt-0.5">Target: {ex.repRange} reps</p>
                )}
              </div>

              {/* Set rows */}
              <div className="px-4 py-2">
                {/* Column headers */}
                <div className="flex items-center gap-2 py-1.5 mb-1">
                  <span className="w-12 text-[10px] uppercase tracking-widest text-wf-gray-600">Set</span>
                  <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Weight</span>
                  <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Reps</span>
                </div>

                {ex.sets.map((set, setIdx) => (
                  <div
                    key={setIdx}
                    className="flex items-center gap-2 py-2 border-t border-white/5"
                  >
                    <span className="w-12 text-sm font-mono-stat text-wf-gray-500">{setIdx + 1}</span>
                    <div className="flex-1 text-center">
                      <span className="text-sm font-mono-stat text-wf-gray-400">
                        {set.plannedWeight ? `${set.plannedWeight} lbs` : '—'}
                      </span>
                    </div>
                    <div className="flex-1 text-center">
                      <span className="text-sm font-mono-stat text-wf-gray-400">
                        {set.plannedReps || '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes section */}
              {ex.notes && (
                <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.02]">
                  <div className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-wf-gray-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-xs text-wf-gray-500 leading-relaxed">{ex.notes}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
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
            {selectedGroup === 'browse' ? 'Browse Workout Library' : selectedGroup === 'my' ? 'My Workouts' : 'All Workouts'}
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

                    {/* Workout info — tap to preview */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => !editMode && !t.isRest && setPreviewWorkout(t)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                        <h3 className="text-lg font-semibold text-white">{t.name}</h3>
                      </div>
                      {t.description && (
                        <p className="text-wf-gray-400 text-sm mt-0.5 ml-4">{t.description}</p>
                      )}
                      <p className="text-wf-gray-500 text-xs mt-1 ml-4">
                        {t.isRest ? 'Rest day' : `${t.exercises.length} exercises · Tap to view`}
                      </p>
                    </div>

                    {/* Edit mode: delete button | Normal: add + edit buttons */}
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
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openAddWorkout(t)}
                          className="h-9 px-3 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0 active:bg-green-500/40 transition-colors"
                        >
                          <svg className="w-4 h-4 text-green-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          <span className="text-xs font-semibold text-green-400">Add</span>
                        </button>
                        <button
                          onClick={() => navigate(`/workouts/edit/${t.id}`)}
                          className="w-9 h-9 rounded-lg bg-wf-red/20 flex items-center justify-center shrink-0 active:bg-wf-red/40 transition-colors"
                        >
                          <svg className="w-4 h-4 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Exercise list with sets × reps (hidden in edit mode) */}
                  {!editMode && !t.isRest && t.exercises.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                      {/* Column headers */}
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <span className="flex-1 text-[10px] uppercase tracking-widest text-wf-gray-600">Exercise</span>
                        <span className="w-10 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Sets</span>
                        <span className="w-14 text-[10px] uppercase tracking-widest text-wf-gray-600 text-center">Reps</span>
                      </div>
                      {t.exercises.map((ex) => {
                        const reps = ex.repRange || ex.sets[0]?.plannedReps || '—';
                        return (
                          <div key={ex.name} className="flex items-center gap-2 px-1">
                            <span className="flex-1 text-sm text-white/80 truncate">{ex.name}</span>
                            <span className="w-10 text-sm font-mono-stat text-wf-gray-400 text-center">{ex.sets.length}</span>
                            <span className="w-14 text-sm font-mono-stat text-wf-gray-400 text-center">{reps}</span>
                          </div>
                        );
                      })}
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

        {renderAddWorkoutModals()}
      </div>
    );
  }

  function renderCreateMenu() {
    if (!showCreateMenu) return null;
    return (
      <div className="fixed inset-0 z-50" onClick={() => setShowCreateMenu(false)}>
        <div className="absolute inset-0 bg-black/50" />
        <div
          className="absolute top-16 right-4 left-4 max-w-sm ml-auto animate-drop-down"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
            <div className="p-3 space-y-1.5">
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
              <div className="border-t border-white/5 mx-2" />
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
    );
  }

  function renderBeginModals() {
    return (
      <>
        {beginModal && !conflictInfo && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={closeBeginModal}>
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full bg-wf-gray-900 border-t border-white/10 rounded-t-2xl p-5 pb-24 animate-drop-down"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <h3 className="text-lg font-black text-white mb-1">Begin Program</h3>
              <p className="text-wf-gray-400 text-sm mb-5">
                Schedule <span className="text-white font-semibold">{beginModal.name}</span> starting from a day of your choice.
              </p>
              {!showDatePicker ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleStartToday}
                    className="flex-1 btn-gradient text-white font-semibold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-all"
                  >
                    Start Today
                  </button>
                  <button
                    onClick={() => setShowDatePicker(true)}
                    className="flex-1 glass-card text-white font-semibold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-all"
                  >
                    Choose Date
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <input
                    type="date"
                    value={beginDateInput}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBeginDateInput(e.target.value)}
                    className="flex-1 glass-input rounded-xl px-3 py-3 text-white text-sm focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleBeginDate}
                    disabled={!beginDateInput}
                    className="btn-gradient text-white font-semibold px-5 py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    Schedule
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {conflictInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setConflictInfo(null)}>
            <div className="absolute inset-0 bg-black/70" />
            <div
              className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-black text-white mb-2">Overwrite existing workouts?</h3>
              <p className="text-wf-gray-400 text-sm mb-3">
                This will overwrite your current workout on:
              </p>
              <ul className="mb-5 space-y-1">
                {conflictInfo.conflicts.map((day) => (
                  <li key={day} className="text-sm font-semibold text-wf-red flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-wf-red" />
                    {day}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() => setConflictInfo(null)}
                  className="flex-1 glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => applyEntries(conflictInfo.pendingEntries)}
                  className="flex-1 bg-wf-red/90 hover:bg-wf-red text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                >
                  Overwrite
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  function renderAddWorkoutModals() {
    return (
      <>
        {addWorkoutModal && !addConflictInfo && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={closeAddWorkoutModal}>
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="relative w-full bg-wf-gray-900 border-t border-white/10 rounded-t-2xl p-5 pb-24 animate-drop-down"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <h3 className="text-lg font-black text-white mb-1">Add Workout</h3>
              <p className="text-wf-gray-400 text-sm mb-5">
                Add <span className="text-white font-semibold">{addWorkoutModal.name}</span> to your calendar.
              </p>
              {!showAddDatePicker ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleAddToday}
                    className="flex-1 btn-gradient text-white font-semibold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-all"
                  >
                    Begin Today
                  </button>
                  <button
                    onClick={() => setShowAddDatePicker(true)}
                    className="flex-1 glass-card text-white font-semibold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-all"
                  >
                    Choose Date
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <input
                    type="date"
                    value={addDateInput}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setAddDateInput(e.target.value)}
                    className="flex-1 glass-input rounded-xl px-3 py-3 text-white text-sm focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleAddDate}
                    disabled={!addDateInput}
                    className="btn-gradient text-white font-semibold px-5 py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    Schedule
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {addConflictInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setAddConflictInfo(null)}>
            <div className="absolute inset-0 bg-black/70" />
            <div
              className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-black text-white mb-2">Overwrite existing workout?</h3>
              <p className="text-wf-gray-400 text-sm mb-3">
                This will replace the current workout on:
              </p>
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
                  onClick={() => applyAddWorkout(addConflictInfo.entry)}
                  className="flex-1 bg-wf-red/90 hover:bg-wf-red text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                >
                  Overwrite
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Trainer profile view
  if (selectedGroup === 'partners' && selectedTrainer) {
    const trainerData = getTrainerById(selectedTrainer);
    if (!trainerData) return null;

    async function handleTrainerAddToday(workout) {
      let templateId;
      try {
        const res = await api('/templates', {
          method: 'POST',
          body: JSON.stringify({
            name: `${workout.name} - ${trainerData.name}`,
            description: workout.description || '',
            exercises: workout.exercises,
          }),
        });
        templateId = res.id;
      } catch (err) {
        console.error(err);
        return;
      }
      const dow = new Date().getDay();
      const schedule = await api('/schedule');
      const existing = schedule.find((s) => s.dayOfWeek === dow && s.templateId);
      if (existing) {
        setAddConflictInfo({
          dayName: `${DAY_NAMES_FULL[dow]}, ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
          entry: { dayOfWeek: dow, templateId },
        });
      } else {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId }] }),
        });
        navigate('/');
      }
    }

    async function handleTrainerAddDate(workout) {
      if (!addDateInput) return;
      let templateId;
      try {
        const res = await api('/templates', {
          method: 'POST',
          body: JSON.stringify({
            name: `${workout.name} - ${trainerData.name}`,
            description: workout.description || '',
            exercises: workout.exercises,
          }),
        });
        templateId = res.id;
      } catch (err) {
        console.error(err);
        return;
      }
      const date = new Date(addDateInput + 'T00:00:00');
      const dow = date.getDay();
      const schedule = await api('/schedule');
      const existing = schedule.find((s) => s.dayOfWeek === dow && s.templateId);
      if (existing) {
        setAddConflictInfo({
          dayName: `${DAY_NAMES_FULL[dow]}, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
          entry: { dayOfWeek: dow, templateId },
        });
      } else {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId }] }),
        });
        navigate('/');
      }
    }

    return (
      <TrainerProfile
        trainer={trainerData}
        bioExpanded={bioExpanded}
        setBioExpanded={setBioExpanded}
        expandedWorkoutCard={expandedWorkoutCard}
        setExpandedWorkoutCard={setExpandedWorkoutCard}
        onBack={() => setSelectedTrainer(null)}
        onPreviewWorkout={setPreviewWorkout}
        onAddToday={handleTrainerAddToday}
        onChooseDate={() => setShowAddDatePicker(true)}
        showAddDatePicker={showAddDatePicker}
        setShowAddDatePicker={setShowAddDatePicker}
        addDateInput={addDateInput}
        setAddDateInput={setAddDateInput}
        onAddDate={handleTrainerAddDate}
        addConflictInfo={addConflictInfo}
        setAddConflictInfo={setAddConflictInfo}
        onApplyAddWorkout={applyAddWorkout}
      />
    );
  }

  // Featured Trainers list view
  if (selectedGroup === 'partners') {
    return (
      <div>
        <StickyHeader title="Featured Trainers" />

        {/* Back button */}
        <div className="px-4 mb-3">
          <button
            onClick={() => setSelectedGroup(null)}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All Workouts
          </button>
        </div>

        <div className="px-4 space-y-3 pb-4">
          {getTrainers().map((trainer, idx) => (
            <div
              key={trainer.id}
              onClick={() => setSelectedTrainer(trainer.id)}
              className="glass-card rounded-xl p-4 fade-slide-up cursor-pointer active:scale-[0.98] transition-transform"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                  {trainer.photo ? (
                    <img src={trainer.photo} alt={trainer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-purple-500/20 flex items-center justify-center">
                      <span className="text-lg font-bold text-purple-400">{trainer.initials}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white">{trainer.name}</h3>
                  <p className="text-xs text-wf-gray-500">{trainer.tags.slice(0, 3).join(' \u00b7 ')}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-semibold text-wf-gray-400">{trainer.stats.rating}</span>
                </div>
                <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Group list view — programs within Browse or My Workouts
  if (selectedGroup && !selectedProgram) {
    const isBrowse = selectedGroup === 'browse';
    const groupPrograms = isBrowse ? browsePrograms : myPrograms;
    const groupTitle = isBrowse ? 'Browse Workout Library' : 'My Workouts';

    return (
      <div>
        <StickyHeader title={groupTitle}>
          {!isBrowse && (
            <button
              onClick={() => setShowCreateMenu(true)}
              className="btn-gradient active:scale-[0.98] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0"
            >
              + Create
            </button>
          )}
        </StickyHeader>

        {/* Back button */}
        <div className="px-4 mb-3">
          <button
            onClick={() => setSelectedGroup(null)}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All Workouts
          </button>
        </div>

        <div className="px-4">
          {groupPrograms.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-wf-gray-400 text-sm">No custom workouts yet</p>
              <p className="text-wf-gray-500 text-xs mt-1">Tap + Create to build your own</p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {groupPrograms.map((program, idx) => (
                <ProgramCard key={program.id} program={program} idx={idx} onSelect={setSelectedProgram} onBegin={openBeginProgram} />
              ))}
            </div>
          )}
        </div>

        {renderBeginModals()}
        {showCreateMenu && renderCreateMenu()}
      </div>
    );
  }

  // Top-level view — two group cards
  return (
    <div>
      <StickyHeader title="Workouts">
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
        ) : (
          <div className="space-y-4 pb-4">
            {/* New Workouts video card */}
            <div
              className="w-full rounded-2xl overflow-hidden fade-slide-up relative"
              style={{ animationDelay: '0ms', minHeight: '200px' }}
            >
              {/* Background video — starts at 5s, loops back before last 6s */}
              <video
                ref={(el) => {
                  if (!el) return;
                  el.currentTime = 5;
                  el.ontimeupdate = () => {
                    if (el.duration && el.currentTime >= el.duration - 6) {
                      el.currentTime = 5;
                    }
                  };
                }}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                src="/Gym cinematic promotion video.mp4"
              />
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              {/* Card content */}
              <div className="relative z-10 p-5 flex flex-col justify-end h-full" style={{ minHeight: '200px' }}>
                <div className="mt-auto">
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-lg">New Workouts</h2>
                  <p className="text-white/70 text-sm mt-1 drop-shadow">Watch the latest drops</p>
                </div>
              </div>
            </div>

            {/* Featured Trainers card */}
            <div
              onClick={() => setSelectedGroup('partners')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '0ms' }}
            >
              <div className="h-1.5 bg-gradient-to-r from-wf-blue to-purple-500" />
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-white tracking-tight">Featured Trainers</h2>
                    <p className="text-wf-gray-400 text-sm mt-1">Expert-led workouts from certified trainers</p>
                  </div>
                  <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Browse Workout Library card */}
            <div
              onClick={() => setSelectedGroup('browse')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '80ms' }}
            >
              {/* Color strip from all browse programs */}
              <div className="flex h-1.5">
                {browsePrograms.flatMap((p) => p.colors).map((c, i) => (
                  <div key={i} className={`flex-1 ${c.dot}`} />
                ))}
              </div>
              <div className="p-5">
                <h2 className="text-xl font-black text-white tracking-tight">Browse Workout Library</h2>
                <p className="text-wf-gray-400 text-sm mt-1">
                  {browsePrograms.length} programs &middot; Pre-built workout plans
                </p>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  {browsePrograms.map((p) => (
                    <span key={p.id} className="text-xs text-wf-gray-400 font-medium">{p.name}</span>
                  ))}
                </div>
                <div className="flex items-center justify-end mt-3">
                  <span className="text-xs text-wf-gray-500 mr-1">View programs</span>
                  <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* My Workouts card */}
            <div
              onClick={() => setSelectedGroup('my')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '160ms' }}
            >
              {myPrograms.length > 0 ? (
                <div className="flex h-1.5">
                  {myPrograms.flatMap((p) => p.colors).map((c, i) => (
                    <div key={i} className={`flex-1 ${c.dot}`} />
                  ))}
                </div>
              ) : (
                <div className="h-1.5 bg-white/10" />
              )}
              <div className="p-5">
                <h2 className="text-xl font-black text-white tracking-tight">My Workouts</h2>
                <p className="text-wf-gray-400 text-sm mt-1">
                  {myPrograms.length === 0
                    ? 'No custom workouts yet'
                    : `${myPrograms.length} program${myPrograms.length !== 1 ? 's' : ''} &middot; Your custom workouts`}
                </p>
                {myPrograms.length > 0 && (
                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    {myPrograms.map((p) => (
                      <span key={p.id} className="text-xs text-wf-gray-400 font-medium">{p.name}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-end mt-3">
                  <span className="text-xs text-wf-gray-500 mr-1">{myPrograms.length === 0 ? 'Get started' : 'View programs'}</span>
                  <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {renderBeginModals()}
      {renderCreateMenu()}
    </div>
  );
}
