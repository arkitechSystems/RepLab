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
    Promise.all([api('/schedule'), api('/templates'), api('/programs')])
      .then(([s, t, p]) => { setSchedule(s); setTemplates(t); setPrograms(p); })
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

  function handleDayTap(date) {
    const workout = getWorkoutForDay(date);
    if (!workout || workout.isRest) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/session/${workout.templateId}/${dateStr}`);
  }

  function openEditor(e, date) {
    e.stopPropagation();
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
        ) : (
          <div className="space-y-3 pb-4">
            {weekDays.map((date, idx) => {
              const workout = getWorkoutForDay(date);
              const dayIsToday = isToday(date);
              const isRest = workout?.isRest;
              const color = getWorkoutColor(workout?.templateName);

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDayTap(date)}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  className={`w-full text-left rounded-xl overflow-hidden transition-all active:scale-[0.98] fade-slide-up ${
                    dayIsToday
                      ? 'glass-card !border-2 !border-wf-red today-glow'
                      : 'glass-card'
                  }`}
                >
                  <div className="flex">
                    {/* Color accent bar */}
                    <div className={`w-1 shrink-0 ${color.dot}`} />
                    <div className="flex-1 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Day circle */}
                          <div
                            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shrink-0 ${
                              dayIsToday ? 'btn-gradient text-white' : `${color.bg} text-wf-gray-400`
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
                            {dayIsToday && (
                              <span className="text-xs text-wf-red font-medium">Today</span>
                            )}
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
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditingDay(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-wf-gray-900 rounded-t-2xl animate-slide-up max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Change Workout</h3>
                  <p className="text-sm text-wf-gray-400 mt-0.5">
                    {DAY_NAMES[editingDay.getDay()]}, {format(editingDay, 'MMM d')}
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

            {/* Programs accordion */}
            <div className="overflow-y-auto flex-1 px-5 py-3">
              {enrichedPrograms.map((program) => {
                const isExpanded = expandedProgram === program.id;
                const nonRest = program.templates.filter((t) => !t.isRest);
                const colors = nonRest.map((t) => getWorkoutColor(t.name));

                return (
                  <div key={program.id} className="mb-3">
                    {/* Program header */}
                    <button
                      onClick={() => toggleProgram(program.id)}
                      className="w-full text-left glass-card rounded-xl p-4 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-semibold text-white">{program.name}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            {colors.map((c, i) => (
                              <div key={i} className={`w-2 h-2 rounded-full ${c.dot}`} />
                            ))}
                            <span className="text-xs text-wf-gray-500 ml-1">
                              {program.templates.length} workouts
                            </span>
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-wf-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded workout list */}
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pl-2">
                        {program.templates.map((t) => {
                          const color = getWorkoutColor(t.name);
                          const isCurrentChoice = getWorkoutForDay(editingDay)?.templateId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleSwap(t.id)}
                              className={`w-full text-left rounded-lg px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
                                isCurrentChoice
                                  ? 'bg-wf-red/20 border border-wf-red/40'
                                  : 'bg-white/5 hover:bg-white/10'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full shrink-0 ${color.dot}`} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-white">{t.name}</span>
                                {t.description && (
                                  <p className="text-xs text-wf-gray-500 truncate">{t.description}</p>
                                )}
                              </div>
                              {isCurrentChoice && (
                                <svg className="w-5 h-5 text-wf-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Create new workout */}
              <button
                onClick={() => { setEditingDay(null); navigate('/workouts/create'); }}
                className="w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-3 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all mt-2"
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
      )}
    </div>
  );
}
