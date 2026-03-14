import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOfWeek, addDays, format, isToday, isSameWeek } from 'date-fns';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const [schedule, setSchedule] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingDay, setEditingDay] = useState(null); // date object of day being edited
  const [expandedProgram, setExpandedProgram] = useState(null);
  const navigate = useNavigate();

  const today = new Date();
  const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameWeek(weekStart, today, { weekStartsOn: 1 });

  useEffect(() => {
    Promise.all([api('/schedule'), api('/templates'), api('/programs'), api('/sessions/completed')])
      .then(([s, t, p, c]) => { setSchedule(s); setTemplates(t); setPrograms(p); setCompletedSessions(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function getEnrichedPrograms() {
    return programs.map((p) => {
      const programTemplates = templates
        .filter((t) => t.programId === p.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return { ...p, templates: programTemplates };
    });
  }

  function getWorkoutForDay(date) {
    const dow = date.getDay();
    return schedule.find((s) => s.dayOfWeek === dow);
  }

  function isDayCompleted(date) {
    const workout = getWorkoutForDay(date);
    if (!workout) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    return completedSessions.some((c) => c.templateId === workout.templateId && c.date === dateStr);
  }

  function handleDayTap(date) {
    const workout = getWorkoutForDay(date);
    if (!workout || workout.isRest) {
      // No workout assigned — open the picker directly
      openEditor(null, date);
      return;
    }
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/session/${workout.templateId}/${dateStr}`);
  }

  function openEditor(e, date) {
    if (e) e.stopPropagation();
    setExpandedProgram(null);
    setEditingDay(date);
  }

  async function handleSwap(templateId) {
    const dow = editingDay.getDay();
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId }] }),
      });
      // Refetch schedule
      const updated = await api('/schedule');
      setSchedule(updated);
    } catch (err) {
      console.error(err);
    }
    setEditingDay(null);
  }

  async function handleClearDay() {
    const dow = editingDay.getDay();
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId: null }] }),
      });
      const updated = await api('/schedule');
      setSchedule(updated);
    } catch (err) {
      console.error(err);
    }
    setEditingDay(null);
  }

  function toggleProgram(programId) {
    setExpandedProgram(expandedProgram === programId ? null : programId);
  }

  const enrichedPrograms = getEnrichedPrograms();

  return (
    <div>
      <StickyHeader
        title="Schedule"
        subtitle={`Week of ${format(weekStart, 'MMM d')} — ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 h-9 rounded-full bg-white/10 text-xs font-semibold text-white active:scale-90 transition-transform"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </StickyHeader>

      <div className="px-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="glass-skeleton rounded-xl h-20" />
            ))}
          </div>
        ) : schedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 fade-slide-up">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No schedule set up yet</h3>
            <p className="text-sm text-wf-gray-400 text-center max-w-xs mb-6">
              Assign workouts to each day of the week to build your routine. Tap a day below to get started!
            </p>
            <div className="space-y-3 w-full">
              {weekDays.map((date, idx) => {
                const dayIsToday = isToday(date);
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => openEditor(null, date)}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className={`w-full text-left rounded-xl overflow-hidden transition-all active:scale-[0.98] fade-slide-up ${
                      dayIsToday ? 'glass-card !border-2 !border-wf-red today-glow' : 'glass-card'
                    }`}
                  >
                    <div className="flex">
                      <div className="w-1 shrink-0 bg-white/10" />
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shrink-0 ${
                                dayIsToday ? 'btn-gradient text-white' : 'bg-white/5 text-wf-gray-400'
                              }`}
                            >
                              <span className="text-[10px] font-medium uppercase leading-none">
                                {DAY_NAMES[date.getDay()]}
                              </span>
                              <span className="text-lg font-bold leading-none mt-0.5">
                                {format(date, 'd')}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-wf-gray-500">Tap to assign</h3>
                              {dayIsToday && <span className="text-xs text-wf-red font-medium">Today</span>}
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {weekDays.map((date, idx) => {
              const workout = getWorkoutForDay(date);
              const dayIsToday = isToday(date);
              const isRest = workout?.isRest;
              const dayCompleted = isDayCompleted(date);
              const color = getWorkoutColor(workout?.templateName);

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDayTap(date)}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  className={`w-full text-left rounded-xl overflow-hidden transition-all active:scale-[0.98] fade-slide-up ${
                    dayCompleted
                      ? 'glass-card !border-2 !border-wf-red'
                      : dayIsToday
                        ? 'glass-card !border-2 !border-wf-red today-glow'
                        : 'glass-card'
                  }`}
                >
                  <div className="flex">
                    {/* Color accent bar */}
                    <div className={`w-1 shrink-0 ${dayCompleted ? 'bg-wf-red' : color.dot}`} />
                    <div className="flex-1 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Day circle */}
                          <div
                            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shrink-0 ${
                              dayCompleted ? 'bg-wf-red/20 text-wf-red' : dayIsToday ? 'btn-gradient text-white' : `${color.bg} text-wf-gray-400`
                            }`}
                          >
                            <span className="text-[10px] font-medium uppercase leading-none">
                              {DAY_NAMES[date.getDay()]}
                            </span>
                            <span className="text-lg font-bold leading-none mt-0.5">
                              {format(date, 'd')}
                            </span>
                          </div>

                          {/* Workout info */}
                          <div>
                            <h3 className="text-base font-semibold text-white">
                              {workout?.templateName || 'No workout'}
                            </h3>
                            {dayCompleted ? (
                              <span className="text-xs text-wf-red font-medium">Complete</span>
                            ) : dayIsToday ? (
                              <span className="text-xs text-wf-red font-medium">Today</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Edit button */}
                          <div
                            role="button"
                            onClick={(e) => openEditor(e, date)}
                            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 active:bg-white/20 transition-colors"
                          >
                            <svg className="w-4 h-4 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L16.5 3 21 7.5 7.5 21H3v-4.5z" />
                            </svg>
                          </div>
                          {/* Arrow */}
                          {!isRest && (
                            <svg className="w-5 h-5 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Workout Picker Modal */}
      {editingDay && (() => {
        const currentWorkout = getWorkoutForDay(editingDay);
        const hasWorkout = currentWorkout && !currentWorkout.isRest;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditingDay(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-lg bg-wf-gray-900 rounded-t-2xl animate-slide-up max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Modal header */}
              <div className="px-5 pt-2 pb-3 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {hasWorkout ? 'Change Workout' : 'Assign Workout'}
                    </h3>
                    <p className="text-sm text-wf-gray-400 mt-0.5">
                      {DAY_NAMES[editingDay.getDay()]}, {format(editingDay, 'MMM d')}
                      {hasWorkout && (
                        <span className="text-wf-gray-500"> · Currently: <span className="text-white/70">{currentWorkout.templateName}</span></span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingDay(null)}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Workout list — flat, grouped by program */}
              <div className="overflow-y-auto flex-1 px-5 py-3">
                {/* Quick actions */}
                {hasWorkout && (
                  <div className="mb-4">
                    <button
                      onClick={handleClearDay}
                      className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-wf-gray-300">Clear — No Workout</span>
                    </button>
                  </div>
                )}

                {/* All workouts, grouped by program */}
                {enrichedPrograms.map((program) => {
                  const nonRest = program.templates.filter((t) => !t.isRest);
                  if (nonRest.length === 0) return null;
                  return (
                    <div key={program.id} className="mb-4">
                      <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 font-semibold mb-2 px-1">{program.name}</p>
                      <div className="space-y-1.5">
                        {nonRest.map((t) => {
                          const color = getWorkoutColor(t.name);
                          const isCurrentChoice = currentWorkout?.templateId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleSwap(t.id)}
                              className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
                                isCurrentChoice
                                  ? 'bg-wf-red/15 border border-wf-red/30'
                                  : 'bg-white/5 active:bg-white/10'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full shrink-0 ${color.dot}`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-white">{t.name}</span>
                                {t.exercises && t.exercises.length > 0 && (
                                  <p className="text-xs text-wf-gray-500 truncate mt-0.5">
                                    {t.exercises.map((ex) => ex.name).join(', ')}
                                  </p>
                                )}
                              </div>
                              {isCurrentChoice ? (
                                <svg className="w-5 h-5 text-wf-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-wf-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Create new workout */}
                <button
                  onClick={() => { setEditingDay(null); navigate('/workouts/create?quick=1'); }}
                  className="w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-3 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all mt-1 mb-2"
                >
                  <div className="w-8 h-8 rounded-full btn-gradient flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-white">Create New Workout</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
