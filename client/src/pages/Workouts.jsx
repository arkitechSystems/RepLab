import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { buildProgramColorMap, getColorFromMap } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';
import { iosFocusRef } from '../utils/iosFocus';
import TrainerProfile from '../components/TrainerProfile';
import { getTrainers, getTrainerById } from '../data/trainers';
import { useAuth } from '../context/AuthContext';

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ProgramCard({ program, idx, onSelect, onBegin, onDelete }) {
  return (
    <div
      onClick={() => onSelect(program.id)}
      style={{ animationDelay: `${idx * 80}ms` }}
      className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
    >
      {/* Color strip */}
      <div className="flex h-1.5">
        {[...program.colorMap.values()].map((c, i) => (
          <div key={i} className={`flex-1 ${c.dot}`} />
        ))}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-white tracking-tight">{program.name}</h2>
            <p className="text-wf-gray-400 text-sm mt-1">
              {program.weekCount} {program.weekCount === 1 ? 'week' : 'weeks'} &middot; {program.workoutCount} workouts
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {program.workoutCount > 0 && (
              <button
                onClick={(e) => onBegin(e, program)}
                className="btn-gradient text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
              >
                Begin Program
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(program.id); }}
                className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center active:bg-red-500/25 transition-colors"
                title="Delete program"
              >
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Workout preview dots — unique names only */}
        <div className="flex items-center gap-3 mt-4">
          {[...program.colorMap.entries()].map(([name, color]) => (
            <div key={name} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
              <span className="text-xs text-wf-gray-400 font-medium capitalize">{name}</span>
            </div>
          ))}
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
  const { user } = useAuth();
  const isPremium = user?.plan && user.plan !== 'Free';
  const [showPremiumGate, setShowPremiumGate] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null); // 'browse' | 'my' | 'partners' | null
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [previewWorkout, setPreviewWorkout] = useState(null); // template object for detail view
  const [bioExpanded, setBioExpanded] = useState(false);
  const [expandedWorkoutCard, setExpandedWorkoutCard] = useState(null);
  const [expandedExercises, setExpandedExercises] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [browseSearch, setBrowseSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(null); // week number (1-based)
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
  const beginDateRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    Promise.all([api('/programs'), api('/templates'), api('/sessions')])
      .then(([progs, tmpls, sessions]) => {
        setPrograms(progs);
        setTemplates(tmpls);

        // Calculate streak — consecutive days with a session going back from today
        const sessionDates = new Set(sessions.map((s) => s.date));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let count = 0;
        // Start from today; if today has no session, start from yesterday
        let startDay = new Date(today);
        const todayStr = startDay.toISOString().slice(0, 10);
        if (!sessionDates.has(todayStr)) {
          startDay.setDate(startDay.getDate() - 1);
        }
        for (let d = startDay; ; d.setDate(d.getDate() - 1)) {
          const dateStr = d.toISOString().slice(0, 10);
          if (sessionDates.has(dateStr)) {
            count++;
          } else {
            break;
          }
        }
        setStreak(count);
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
      .map((e) => {
        const existing = schedule.find((s) => s.dayOfWeek === e.dayOfWeek && s.templateId);
        const dayLabel = `${DAY_NAMES_FULL[e.dayOfWeek]}, ${e.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
        return { dayLabel, workoutName: existing?.templateName || 'Unknown workout' };
      });
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
    navigate('/calendar');
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
        workoutName: existing.templateName || 'Unknown workout',
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
    navigate('/calendar');
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
      const colorMap = buildProgramColorMap(programTemplates);
      return {
        ...p,
        templates: programTemplates,
        weekCount: Math.max(1, Math.ceil(programTemplates.length / 7)),
        workoutCount: nonRest.length,
        exerciseCount: totalExercises,
        colorMap,
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
      setSelectedWeek(null);
      setEditMode(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteWeek(program, weekIndex) {
    const weeks = [];
    for (let i = 0; i < program.templates.length; i += 7) {
      weeks.push(program.templates.slice(i, i + 7));
    }
    const weekToDelete = weeks[weekIndex];
    if (!weekToDelete) return;
    if (!confirm(`Delete Week ${weekIndex + 1} and all its workouts? Remaining weeks will be renumbered. This cannot be undone.`)) return;
    try {
      // Delete all templates in this week
      for (const t of weekToDelete) {
        await api(`/templates/${t.id}`, { method: 'DELETE' });
      }
      // Remove deleted templates from state
      const deletedIds = new Set(weekToDelete.map((t) => t.id));
      setTemplates((prev) => {
        const remaining = prev.filter((t) => !deletedIds.has(t.id));
        // Renumber sort orders for templates in this program
        let sort = 0;
        return remaining.map((t) => {
          if (t.programId === program.id) {
            return { ...t, sortOrder: sort++ };
          }
          return t;
        });
      });
      // Update sort orders on server
      const remaining = program.templates.filter((t) => !deletedIds.has(t.id));
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].sortOrder !== i) {
          await api(`/templates/reorder`, {
            method: 'PUT',
            body: JSON.stringify({ programId: program.id, templateIds: remaining.map((t) => t.id) }),
          });
          break;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Workout detail/preview view
  if (previewWorkout) {
    const pw = previewWorkout;
    const pwProgram = enrichedPrograms.find((p) => p.id === pw.programId);
    const pwColor = pwProgram ? getColorFromMap(pwProgram.colorMap, pw.name, pw.isRest) : getColorFromMap(new Map(), pw.name, pw.isRest);
    const totalSets = pw.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0;
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
              {pw.exercises?.length || 0} exercises &middot; {totalSets} total sets
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
                          {set.suggestedWeight ? `${set.suggestedWeight} lbs` : '—'}
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

    // Group templates into weeks (7 days per week)
    const weeks = [];
    for (let i = 0; i < program.templates.length; i += 7) {
      weeks.push(program.templates.slice(i, i + 7));
    }
    // Show week picker when no week is selected
    if (selectedWeek === null) {
      return (
        <div>
          <StickyHeader title={program.name}>
            {program.workoutCount > 0 && (
              <button
                onClick={(e) => openBeginProgram(e, program)}
                className="btn-gradient shrink-0 text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
              >
                Begin Program
              </button>
            )}
          </StickyHeader>

          {/* Back button */}
          <div className="px-4 mb-3">
            <button
              onClick={() => { setSelectedProgram(null); setSelectedWeek(null); }}
              className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              {selectedGroup === 'browse' ? 'Browse Workout Library' : selectedGroup === 'my' ? 'My Workouts' : 'All Workouts'}
            </button>
          </div>

          <div className="px-4">
            <p className="text-wf-gray-400 text-sm mb-4">
              {weeks.length} weeks &middot; {program.workoutCount} workouts &middot; Select a week to view
            </p>
            <div className="space-y-3 pb-4">
              {weeks.map((weekTemplates, wIdx) => {
                const weekNum = wIdx + 1;
                const weekWorkouts = weekTemplates.filter((t) => !t.isRest);
                const weightBump = Math.floor(wIdx / 2) * 5;
                // Get unique workout color dots for this week
                const uniqueNames = [];
                weekWorkouts.forEach((t) => {
                  const key = t.name.toLowerCase().replace(/\s*\(week\s*\d+\)\s*/gi, '').trim();
                  if (!uniqueNames.includes(key)) uniqueNames.push(key);
                });

                return (
                  <div
                    key={wIdx}
                    onClick={() => setSelectedWeek(weekNum)}
                    style={{ animationDelay: `${wIdx * 60}ms` }}
                    className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
                  >
                    {/* Color strip from this week's unique workouts */}
                    <div className="flex h-1.5">
                      {uniqueNames.map((name, i) => {
                        const color = program.colorMap.get(name);
                        return <div key={i} className={`flex-1 ${color ? color.dot : 'bg-wf-orange'}`} />;
                      })}
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white">Week {weekNum}</h3>
                          <p className="text-wf-gray-400 text-sm mt-1">
                            {weekWorkouts.length} workouts{weightBump > 0 ? ` · +${weightBump} lbs` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedGroup === 'my' && weeks.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteWeek(program, wIdx); }}
                              className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center active:bg-red-500/25 transition-colors"
                              title="Delete week"
                            >
                              <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          )}
                          <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </div>
                      </div>
                      {/* Workout preview dots */}
                      <div className="flex items-center gap-3 mt-3">
                        {uniqueNames.map((name, i) => {
                          const color = program.colorMap.get(name);
                          return (
                            <div key={i} className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${color ? color.dot : 'bg-wf-orange'}`} />
                              <span className="text-xs text-wf-gray-400 font-medium capitalize">{name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {renderBeginModals()}
        </div>
      );
    }

    // Show workouts for selected week
    const weekTemplates = weeks[selectedWeek - 1] || [];
    const weekTitle = `${program.name} — Week ${selectedWeek}`;

    return (
      <div>
        <StickyHeader title={editMode ? '' : weekTitle}>
          {editMode ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 min-w-0 glass-input rounded-lg px-3 py-2 text-white text-sm font-semibold focus:outline-none"
                ref={iosFocusRef}
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
              {program.workoutCount > 0 && (
                <button
                  onClick={(e) => openBeginProgram(e, program)}
                  className="btn-gradient shrink-0 text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
                >
                  Begin Program
                </button>
              )}
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
            onClick={() => {
              setSelectedWeek(null);
              setEditMode(false);
            }}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {program.name}
          </button>
        </div>

        <div className="px-4">
          <div className="space-y-3 pb-4">
            {weekTemplates.map((t, idx) => {
              const color = getColorFromMap(program.colorMap, t.name, t.isRest);
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
                          disabled={idx === weekTemplates.length - 1}
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

                  {/* Exercise accordion cards (hidden in edit mode) */}
                  {!editMode && !t.isRest && t.exercises.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      {t.exercises.map((ex) => {
                        const exKey = `${t.id}-${ex.name}`;
                        const isExpanded = expandedExercises.has(exKey);
                        const topWeight = Math.max(...ex.sets.map(s => s.suggestedWeight || 0));
                        const reps = ex.repRange || ex.sets[0]?.plannedReps || '—';
                        return (
                          <div key={ex.name} className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedExercises(prev => {
                                  const next = new Set(prev);
                                  if (next.has(exKey)) next.delete(exKey);
                                  else next.add(exKey);
                                  return next;
                                });
                              }}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between active:bg-white/5 transition-colors"
                            >
                              <div className="text-left min-w-0">
                                <h4 className="text-sm font-semibold text-white truncate">{ex.name}</h4>
                                <p className="text-xs text-wf-gray-500 mt-0.5">
                                  {ex.sets.length} sets{topWeight > 0 ? ` · ${topWeight} lbs` : ''}{reps !== '—' ? ` · ${reps} reps` : ''}
                                </p>
                              </div>
                              <svg
                                className={`w-4 h-4 text-wf-gray-400 transition-transform duration-200 shrink-0 ml-2 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-white/5 px-3.5 py-2.5 space-y-1.5 bg-white/[0.02]">
                                {ex.sets.map((set, sIdx) => (
                                  <div key={sIdx} className="flex items-center justify-between py-1.5">
                                    <span className="text-xs text-wf-gray-500 font-bold">Set {sIdx + 1}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-white">
                                        {set.suggestedWeight ? `${set.suggestedWeight} lbs` : '—'}
                                      </span>
                                      <span className="text-xs text-wf-gray-600">&times;</span>
                                      <span className="text-sm font-bold text-wf-red">
                                        {set.plannedReps || '—'} reps
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
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
        {renderBeginModals()}
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
                onClick={() => { setShowCreateMenu(false); navigate('/workouts/create?quick=1'); }}
                className="w-full text-left rounded-xl p-3.5 flex items-center gap-3.5 active:scale-[0.98] transition-all hover:bg-white/5 active:bg-white/10"
              >
                <div className="w-10 h-10 rounded-xl btn-gradient flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L10.5 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white">Quick Create</h4>
                  <p className="text-xs text-wf-gray-400 mt-0.5">Build a standalone workout fast</p>
                </div>
                <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              <div className="border-t border-white/5 mx-2" />
              <button
                onClick={() => { setShowCreateMenu(false); navigate('/programs/create'); }}
                className="w-full text-left rounded-xl p-3.5 flex items-center gap-3.5 active:scale-[0.98] transition-all hover:bg-white/5 active:bg-white/10"
              >
                <div className="w-10 h-10 rounded-xl bg-wf-blue/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-wf-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white">Add to Program</h4>
                  <p className="text-xs text-wf-gray-400 mt-0.5">Add a workout to an existing program</p>
                </div>
                <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              <div className="border-t border-white/5 mx-2" />
              <button
                onClick={() => { setShowCreateMenu(false); navigate('/workouts/ai'); }}
                className="w-full text-left rounded-xl p-3.5 flex items-center gap-3.5 active:scale-[0.98] transition-all hover:bg-white/5 active:bg-white/10"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white">Create a Workout for Me</h4>
                  <p className="text-xs text-wf-gray-400 mt-0.5">AI-powered personalized workout</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={closeBeginModal}>
            <div className="absolute inset-0 bg-black/70" />
            <div
              className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
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
                    onClick={() => {
                      setShowDatePicker(true);
                      setTimeout(() => {
                        if (beginDateRef.current) {
                          beginDateRef.current.focus();
                          try { beginDateRef.current.showPicker(); } catch {}
                        }
                      }, 50);
                    }}
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
                    ref={beginDateRef}
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
              <ul className="mb-5 space-y-2">
                {conflictInfo.conflicts.map((c) => (
                  <li key={c.dayLabel} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-wf-red mt-1.5 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-wf-red">{c.dayLabel}</span>
                      <span className="text-xs text-wf-gray-400 ml-1">({c.workoutName})</span>
                    </div>
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
                    ref={iosFocusRef}
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
              <div className="flex items-start gap-2 mb-5">
                <div className="w-1.5 h-1.5 rounded-full bg-wf-red mt-1.5 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-wf-red">{addConflictInfo.dayName}</span>
                  <span className="text-xs text-wf-gray-400 ml-1">({addConflictInfo.workoutName})</span>
                </div>
              </div>
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
          workoutName: existing.templateName || 'Unknown workout',
          entry: { dayOfWeek: dow, templateId },
        });
      } else {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId }] }),
        });
        navigate('/calendar');
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
          workoutName: existing.templateName || 'Unknown workout',
          entry: { dayOfWeek: dow, templateId },
        });
      } else {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId }] }),
        });
        navigate('/calendar');
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

  // Challenges view
  if (selectedGroup === 'challenges') {
    return (
      <div>
        <StickyHeader title="Challenges" />
        <div className="px-4 mb-3">
          <button
            onClick={() => selectedChallenge ? setSelectedChallenge(null) : setSelectedGroup(null)}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {selectedChallenge ? 'All Challenges' : 'All Workouts'}
          </button>
        </div>

        {!selectedChallenge ? (
          <div className="px-4 pb-4 space-y-3">
            {/* Max Pushups Challenge Card */}
            <div
              onClick={() => setSelectedChallenge('max-pushups')}
              className="glass-card rounded-xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="h-1.5 bg-gradient-to-r from-orange-500 to-yellow-500" />
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <h4 className="text-lg font-semibold text-white">Max Pushups</h4>
                  </div>
                  <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
                <p className="text-xs text-wf-gray-400 ml-4.5 mb-3">Drop and give us everything you've got. How many can you do in one set?</p>
                <div className="flex items-center gap-3 ml-4.5">
                  <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                    </svg>
                    1 set to failure
                  </span>
                  <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    Leaderboard
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center pt-8">
              <p className="text-wf-gray-500 text-sm">More challenges coming soon</p>
            </div>
          </div>
        ) : (
          <MaxPushupsChallenge />
        )}
      </div>
    );
  }

  // Featured Workouts view
  if (selectedGroup === 'featured') {
    return (
      <div>
        <StickyHeader title="Featured Workouts" />

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

        <div className="px-4 pb-4 space-y-3">
          {/* 10X10 Workout Card */}
          <div
            onClick={() => setPreviewWorkout({
              id: '__featured-10x10__',
              name: '10X10',
              description: 'German Volume Training — 10 sets of 10 reps per exercise. High volume, maximum hypertrophy.',
              exercises: [
                { name: 'Barbell Bench Press', sets: Array(10).fill({ plannedReps: 10 }), repRange: '10' },
                { name: 'Lat Pulldowns', sets: Array(10).fill({ plannedReps: 10 }), repRange: '10' },
              ],
              isRest: false,
            })}
            className="glass-card rounded-xl overflow-hidden fade-slide-up cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="h-1.5 bg-gradient-to-r from-wf-red to-orange-500" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-wf-red" />
                  <h4 className="text-lg font-semibold text-white">10X10</h4>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                  Advanced
                </span>
              </div>
              <p className="text-xs text-wf-gray-400 ml-4.5 mb-2">German Volume Training — maximum hypertrophy</p>
              <div className="flex items-center gap-3 ml-4.5">
                <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  60 min
                </span>
                <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                  2 exercises
                </span>
                <span className="flex items-center gap-1 text-xs text-wf-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 9.75V10.5" />
                  </svg>
                  20 total sets
                </span>
              </div>
              <div className="flex items-center justify-end mt-2">
                <span className="text-xs text-wf-gray-500 mr-1">Tap to preview</span>
                <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* More coming soon */}
          <div className="glass-card rounded-xl p-6 text-center fade-slide-up" style={{ animationDelay: '80ms' }}>
            <p className="text-wf-gray-400 text-sm">More workouts dropping soon. Stay Tuned!!</p>
          </div>
        </div>
      </div>
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

        {/* Search bar (browse only) */}
        {isBrowse && groupPrograms.length > 0 && (
          <div className="px-4 mb-3">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                placeholder="Search programs..."
                className="w-full glass-input rounded-xl pl-10 pr-9 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none"
              />
              {browseSearch && (
                <button
                  onClick={() => setBrowseSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-wf-gray-500 active:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter toggles (browse only) */}
        {isBrowse && (
          <div className="px-4 mb-3 flex gap-2">
            <button className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/10 text-wf-gray-400 border border-white/10 active:bg-white/20 transition-all flex items-center gap-1">
              Strength
              <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded-full">PRO</span>
            </button>
            <button className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/10 text-wf-gray-400 border border-white/10 active:bg-white/20 transition-all flex items-center gap-1">
              Hypertrophy
              <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded-full">PRO</span>
            </button>
            <button className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/10 text-wf-gray-400 border border-white/10 active:bg-white/20 transition-all flex items-center gap-1">
              Beginner Friendly
              <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded-full">PRO</span>
            </button>
          </div>
        )}

        <div className="px-4">
          {(() => {
            const filtered = isBrowse && browseSearch.trim()
              ? groupPrograms.filter((p) => p.name.toLowerCase().includes(browseSearch.toLowerCase()))
              : groupPrograms;
            if (filtered.length === 0 && browseSearch.trim()) {
              return (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <p className="text-wf-gray-400 text-sm">No programs matching "{browseSearch}"</p>
                </div>
              );
            }
            if (filtered.length === 0) {
              return (
                <div className="glass-card rounded-2xl p-8 flex flex-col items-center text-center">
                  <p className="text-wf-gray-400 text-sm">Your created workouts will appear here</p>
                  <button
                    onClick={() => setShowCreateMenu(true)}
                    className="mt-4 btn-gradient text-white font-semibold px-6 py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                  >
                    Create Your First Workout
                  </button>
                </div>
              );
            }
            return (
              <div className="space-y-4 pb-4">
                {filtered.map((program, idx) => (
                  <ProgramCard key={program.id} program={program} idx={idx} onSelect={(id) => { setSelectedProgram(id); setBrowseSearch(''); }} onBegin={openBeginProgram} onDelete={!isBrowse ? handleDeleteProgram : undefined} />
                ))}
              </div>
            );
          })()}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center active:scale-90 transition-all shrink-0"
          >
            <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
          <button
            onClick={() => setShowCreateMenu(true)}
            className="btn-gradient active:scale-[0.98] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0"
          >
            + Create
          </button>
        </div>
      </StickyHeader>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-4 mb-3">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search programs and workouts..."
              ref={iosFocusRef}
              className="w-full glass-input rounded-xl pl-10 pr-10 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wf-gray-500 active:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Search Results */}
          {searchQuery.trim() && (() => {
            const q = searchQuery.toLowerCase();
            const matchedPrograms = programs.filter((p) => p.name.toLowerCase().includes(q));
            const matchedTemplates = templates.filter((t) => t.name.toLowerCase().includes(q));
            const hasResults = matchedPrograms.length > 0 || matchedTemplates.length > 0;

            return (
              <div className="mt-3 space-y-2">
                {!hasResults && (
                  <p className="text-wf-gray-500 text-sm text-center py-6">No results for "{searchQuery}"</p>
                )}
                {matchedPrograms.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 font-semibold px-1">Programs</p>
                    {matchedPrograms.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setShowSearch(false); setSearchQuery(''); setSelectedGroup(p.userId ? 'my' : 'browse'); setSelectedProgram(p.id); }}
                        className="w-full text-left glass-card rounded-xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-all"
                      >
                        <div>
                          <span className="text-sm font-semibold text-white">{p.name}</span>
                          {p.description && <p className="text-xs text-wf-gray-500 mt-0.5 truncate">{p.description}</p>}
                        </div>
                        <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    ))}
                  </>
                )}
                {matchedTemplates.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 font-semibold px-1 mt-3">Workouts</p>
                    {matchedTemplates.map((t) => {
                      const program = programs.find((p) => p.id === t.programId);
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setShowSearch(false); setSearchQuery(''); setSelectedGroup(program?.userId ? 'my' : 'browse'); setSelectedProgram(t.programId); }}
                          className="w-full text-left glass-card rounded-xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-all"
                        >
                          <div>
                            <span className="text-sm font-semibold text-white">{t.name}</span>
                            <p className="text-xs text-wf-gray-500 mt-0.5">{program?.name || 'Unknown program'}</p>
                          </div>
                          <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      <div className="px-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="glass-skeleton rounded-xl h-40" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {/* Streak Card */}
            {streak > 0 && (
              <div className="glass-card rounded-2xl p-4 fade-slide-up flex items-center gap-4 border-l-4 border-orange-500">
                <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center shrink-0">
                  <span className="text-2xl">🔥</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {streak} Day Streak{streak >= 7 ? '!' : ''}
                  </h3>
                  <p className="text-xs text-wf-gray-400 mt-0.5">
                    {streak === 1 ? "You worked out today — keep it going!" :
                     streak < 7 ? `${streak} days in a row — keep pushing!` :
                     streak < 14 ? "A full week strong — on fire!" :
                     streak < 30 ? `${streak} days — unstoppable!` :
                     `${streak} days — legendary consistency!`}
                  </p>
                </div>
              </div>
            )}

            {/* Featured Workouts video card */}
            <div
              onClick={() => isPremium ? setSelectedGroup('featured') : setShowPremiumGate(true)}
              className="w-full rounded-2xl overflow-hidden fade-slide-up relative cursor-pointer active:scale-[0.98] transition-transform"
              style={{ animationDelay: '0ms', minHeight: '140px' }}
            >
              {/* Background video — starts at 7s, loops back before last 6s */}
              <video
                ref={(el) => {
                  if (!el) return;
                  el.currentTime = 7;
                  el.ontimeupdate = () => {
                    if (el.duration && el.currentTime >= el.duration - 6) {
                      el.currentTime = 7;
                    }
                  };
                  // iOS fallback: try to play programmatically
                  el.play().catch(() => {});
                }}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                webkit-playsinline=""
                preload="auto"
                src="/Gym cinematic promotion video.mp4"
              />
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              {/* Card content */}
              <div className="relative z-10 p-5 flex flex-col justify-end h-full" style={{ minHeight: '140px' }}>
                <div className="mt-auto">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-lg">Featured Workouts</h2>
                    {!isPremium && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-white/70 text-sm mt-1 drop-shadow">
                    View the latest drops
                  </p>
                </div>
              </div>
            </div>

            {/* Premium Gate Modal */}
            {showPremiumGate && (
              <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setShowPremiumGate(false)}>
                <div className="absolute inset-0 bg-black/70" />
                <div
                  className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white">Premium Feature</h3>
                    <p className="text-wf-gray-400 text-sm mt-2">
                      Featured Workouts are available exclusively for Pro members. Upgrade your plan to access curated workouts from top trainers.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPremiumGate(false)}
                      className="flex-1 glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                    >
                      Maybe Later
                    </button>
                    <button
                      onClick={() => { setShowPremiumGate(false); navigate('/upgrade'); }}
                      className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                    >
                      Upgrade
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* My Workouts card */}
            <div
              onClick={() => setSelectedGroup('my')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '0ms' }}
            >
              <div className="h-1.5 bg-wf-red" />
              <div className="p-5">
                <h2 className="text-xl font-black text-white tracking-tight">My Workouts</h2>
                <p className="text-wf-gray-400 text-sm mt-1">
                  {myPrograms.length === 0
                    ? 'Your created workouts will appear here'
                    : `${myPrograms.length} program${myPrograms.length !== 1 ? 's' : ''} · Your custom workouts`}
                </p>
                <div className="flex items-center justify-end mt-3">
                  <span className="text-xs text-wf-gray-500 mr-1">{myPrograms.length === 0 ? 'Get started' : 'View programs'}</span>
                  <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Browse Workout Library card */}
            <div
              onClick={() => setSelectedGroup('browse')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '0ms' }}
            >
              <div className="h-1.5 bg-wf-green" />
              <div className="p-5">
                <h2 className="text-xl font-black text-white tracking-tight">Browse Workout Library</h2>
                <p className="text-wf-gray-400 text-sm mt-1">
                  Pre-built workout plans &middot; {browsePrograms.length} programs
                </p>
                <div className="flex items-center justify-end mt-3">
                  <span className="text-xs text-wf-gray-500 mr-1">View programs</span>
                  <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Featured Trainers card */}
            <div
              onClick={() => setSelectedGroup('partners')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '80ms' }}
            >
              <div className="h-1.5 bg-wf-blue" />
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

            {/* Challenges card */}
            <div
              onClick={() => setSelectedGroup('challenges')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '0ms' }}
            >
              <div className="h-1.5 bg-wf-orange" />
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-white tracking-tight">Challenges</h2>
                      {!isPremium && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
                          Pro
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                        New
                      </span>
                    </div>
                    <p className="text-wf-gray-400 text-sm mt-1">Compete, push your limits, and earn rewards</p>
                  </div>
                  <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* App Tour card */}
            <div
              onClick={() => navigate('/welcome')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{ animationDelay: '240ms' }}
            >
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-white">New here?</h3>
                    <p className="text-xs text-wf-gray-500">Take a quick tour of the app</p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
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

function MaxPushupsChallenge() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [myCurrentValue, setMyCurrentValue] = useState(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });

  // Countdown to Mar 28, 2026 midnight ET
  useEffect(() => {
    function update() {
      const end = new Date('2026-03-28T05:00:00Z'); // midnight ET = 5am UTC
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
        return;
      }
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        ended: false,
      });
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Promise.all([
      api('/challenges/max-pushups/leaderboard'),
      api('/challenges/max-pushups/my-entry'),
    ])
      .then(([leaderboard, myEntry]) => {
        setEntries(leaderboard);
        if (myEntry?.value) setMyCurrentValue(myEntry.value);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function submitEntry(value) {
    setPosting(true);
    try {
      const updated = await api('/challenges/max-pushups', {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
      setEntries(updated);
      setMyCurrentValue(value);
      setInputValue('');
      setShowOverwriteConfirm(false);
      setPendingValue(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  }

  function handlePost() {
    const num = parseInt(inputValue);
    if (!num || num < 1) return;
    // If user already has an entry and new value is lower, confirm overwrite
    if (myCurrentValue && num < myCurrentValue) {
      setPendingValue(num);
      setShowOverwriteConfirm(true);
      return;
    }
    submitEntry(num);
  }

  function getInitials(entry) {
    if (entry.firstName && entry.lastName) return `${entry.firstName[0]}${entry.lastName[0]}`.toUpperCase();
    if (entry.firstName) return entry.firstName[0].toUpperCase();
    return '?';
  }

  function getDisplayName(entry) {
    if (entry.firstName && entry.lastName) return `${entry.firstName} ${entry.lastName[0]}.`;
    if (entry.firstName) return entry.firstName;
    if (entry.username && !entry.username.startsWith('user')) return `@${entry.username}`;
    return 'Anonymous';
  }

  const rankColors = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];
  const rankBgs = ['bg-yellow-500/20', 'bg-gray-400/20', 'bg-orange-500/20'];

  return (
    <div className="px-4 pb-24">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-black text-white">Max Pushups</h2>
        <p className="text-wf-gray-400 text-sm mt-1">How many can you do in one set? Post your best.</p>
      </div>

      {/* Countdown Timer */}
      <div className="glass-card rounded-xl p-4 mb-5 border border-orange-500/20">
        {countdown.ended ? (
          <div className="text-center">
            <p className="text-orange-400 text-sm font-bold uppercase tracking-wider">Challenge Ended</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium text-center mb-3">Challenge ends in</p>
            <div className="flex items-center justify-center gap-3">
              {[
                { value: countdown.days, label: 'Days' },
                { value: countdown.hours, label: 'Hrs' },
                { value: countdown.minutes, label: 'Min' },
                { value: countdown.seconds, label: 'Sec' },
              ].map((unit) => (
                <div key={unit.label} className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-xl font-black text-white tabular-nums">{String(unit.value).padStart(2, '0')}</span>
                  </div>
                  <span className="text-[9px] text-wf-gray-500 uppercase tracking-wider mt-1">{unit.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-wf-gray-500 text-center mt-3">Mar 28, 2026 at midnight ET</p>
          </>
        )}
      </div>

      {/* Input */}
      <div className="glass-card rounded-xl p-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.firstName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 relative">
            <input
              type="number"
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePost()}
              placeholder="Enter your max pushups..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none focus:border-orange-500/50"
            />
          </div>
          <button
            onClick={handlePost}
            disabled={posting || !inputValue}
            className="h-11 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-500 text-black text-sm font-bold active:scale-95 transition-all disabled:opacity-40"
          >
            {posting ? '...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-medium mb-3">Leaderboard</p>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="glass-skeleton rounded-xl h-16" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-wf-gray-500 text-sm">No entries yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 ${idx === 0 ? 'border border-yellow-500/20' : ''}`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${idx < 3 ? rankBgs[idx] : 'bg-white/5'}`}>
                  <span className={idx < 3 ? rankColors[idx] : 'text-wf-gray-500'}>{idx + 1}</span>
                </div>

                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0 ${
                  entry.photoUrl ? '' : entry.userId === user?.id
                    ? 'bg-gradient-to-br from-orange-500 to-yellow-500 text-white'
                    : 'bg-white/10 text-wf-gray-300'
                }`}>
                  {entry.photoUrl ? (
                    <img src={entry.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : getInitials(entry)}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${entry.userId === user?.id ? 'text-orange-400' : 'text-white'}`}>
                    {getDisplayName(entry)}
                    {entry.userId === user?.id && <span className="text-[10px] text-wf-gray-500 ml-1.5">you</span>}
                  </p>
                  <p className="text-[10px] text-wf-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {/* Count */}
                <div className="text-right shrink-0">
                  <span className={`text-xl font-black tabular-nums ${idx === 0 ? 'text-yellow-400' : 'text-white'}`}>
                    {entry.value}
                  </span>
                  <p className="text-[10px] text-wf-gray-500">reps</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overwrite confirmation modal */}
      {showOverwriteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => { setShowOverwriteConfirm(false); setPendingValue(null); }}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-xs bg-wf-gray-900 border border-white/10 rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white text-center mb-2">Lower Score</h3>
            <p className="text-wf-gray-400 text-sm text-center mb-5">
              Your current record is <span className="text-white font-bold">{myCurrentValue}</span> reps. You're about to replace it with <span className="text-orange-400 font-bold">{pendingValue}</span> reps. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowOverwriteConfirm(false); setPendingValue(null); }}
                className="flex-1 glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
              >
                Keep Current
              </button>
              <button
                onClick={() => submitEntry(pendingValue)}
                disabled={posting}
                className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {posting ? '...' : 'Overwrite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
