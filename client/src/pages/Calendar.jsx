import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startOfWeek, startOfMonth, endOfMonth, addDays, format, isToday, isSameWeek, isSameMonth, isSameDay } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { getWorkoutColor } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Calendar() {
  const { user } = useAuth();
  const isPremium = user?.plan && user.plan !== 'Free';
  const [schedule, setSchedule] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [editingDay, setEditingDay] = useState(null); // date object of day being edited
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [editError, setEditError] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [restDayPrompt, setRestDayPrompt] = useState(false); // show rest day options sub-modal
  const [clearCalendarConfirm, setClearCalendarConfirm] = useState(false); // confirm clear calendar modal
  const [copySource, setCopySource] = useState(null); // { templateId, templateName, date }
  const [copyStep, setCopyStep] = useState(null); // 'pick-day' | 'confirm-overwrite' | 'use-reps'
  const [copyTarget, setCopyTarget] = useState(null); // Date object
  const [copying, setCopying] = useState(false);
  const [copyWeekOffset, setCopyWeekOffset] = useState(0);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tutorialDone, setTutorialDone] = useState(() => searchParams.get('tutorialDone') === '1');

  // Clear the query param without a full reload
  useEffect(() => {
    if (searchParams.has('tutorialDone')) {
      searchParams.delete('tutorialDone');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    // Update "today" at midnight
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timeout = setTimeout(() => {
      setToday(new Date());
    }, msUntilMidnight + 100);
    return () => clearTimeout(timeout);
  }, [today]);
  const weekStart = addDays(startOfWeek(today, { weekStartsOn: 0 }), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = isSameWeek(weekStart, today, { weekStartsOn: 0 });

  // Month view calculations
  const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const isCurrentMonth = isSameMonth(monthDate, today);
  // Build 6-week grid (42 days) to cover any month layout
  const monthGridDays = Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i));

  // Compute visible date range for fetching schedule
  // Cover both week and month views — use the earliest/latest visible date plus padding
  const weekEnd = addDays(weekStart, 6);
  const rangeStart = monthGridStart < weekStart ? monthGridStart : weekStart;
  const rangeEnd = addDays(monthGridStart, 41) > weekEnd ? addDays(monthGridStart, 41) : weekEnd;
  const fetchFrom = format(addDays(rangeStart, -7), 'yyyy-MM-dd');
  const fetchTo = format(addDays(rangeEnd, 7), 'yyyy-MM-dd');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  async function refreshSchedule(opts = {}) {
    const [s, completed] = await Promise.all([
      api(`/schedule?from=${fetchFrom}&to=${fetchTo}`, opts),
      api('/sessions/completed', opts),
    ]);
    setSchedule(s);
    setCompletedSessions(completed);
    return s;
  }

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    Promise.all([api(`/schedule?from=${fetchFrom}&to=${fetchTo}`, opts), api('/templates', opts), api('/programs', opts), api('/sessions/completed', opts)])
      .then(([s, t, p, c]) => { setSchedule(s); setTemplates(t); setPrograms(p); setCompletedSessions(c); })
      .catch((err) => { if (err.name !== 'AbortError') setLoadError('Failed to load calendar data'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchFrom, fetchTo]);

  function getEnrichedPrograms() {
    return programs.map((p) => {
      const programTemplates = templates
        .filter((t) => t.programId === p.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return { ...p, templates: programTemplates };
    });
  }

  function getWorkoutForDay(date) {
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedule.find((s) => s.date === dateStr);
  }

  function isDayCompleted(date) {
    const workout = getWorkoutForDay(date);
    if (!workout) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    return completedSessions.some((c) => c.templateId === workout.templateId && c.date === dateStr);
  }

  function handleDayTap(date) {
    const workout = getWorkoutForDay(date);
    if (!workout || workout.isRest || !workout.templateId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/session/${workout.templateId}/${dateStr}`);
  }

  function openEditor(e, date) {
    if (e) e.stopPropagation();
    setExpandedProgram(null);
    setPickerSearch('');
    setEditError('');
    setRestDayPrompt(false);
    setClearCalendarConfirm(false);
    setEditingDay(date);
  }

  async function handleSwap(templateId) {
    const dateStr = format(editingDay, 'yyyy-MM-dd');
    setScheduleSaving(true);
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ date: dateStr, templateId }] }),
      });
      await refreshSchedule();
      setEditingDay(null);
    } catch (err) {
      console.error(err);
      setEditError('Failed to save. Please try again.');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleClearDay() {
    const dateStr = format(editingDay, 'yyyy-MM-dd');
    setScheduleSaving(true);
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ date: dateStr, templateId: null }] }),
      });
      await refreshSchedule();
      setEditingDay(null);
    } catch (err) {
      console.error(err);
      setEditError('Failed to save. Please try again.');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleSkipWorkout() {
    // Replace this day's workout with nothing (rest)
    const dateStr = format(editingDay, 'yyyy-MM-dd');
    setScheduleSaving(true);
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ date: dateStr, templateId: null }] }),
      });
      await refreshSchedule();
      setRestDayPrompt(false);
      setEditingDay(null);
    } catch (err) {
      console.error(err);
      setEditError('Failed to save. Please try again.');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleInsertRestDay() {
    // Shift all workouts from this day onward forward by one day
    // The edited day becomes empty (rest)
    const dateStr = format(editingDay, 'yyyy-MM-dd');
    setScheduleSaving(true);
    try {
      // Get all scheduled workouts from this date onward
      const futureWorkouts = schedule
        .filter((s) => s.date >= dateStr && s.templateId)
        .sort((a, b) => a.date.localeCompare(b.date));

      // Build updates: each workout moves to the next day, edited day is cleared
      const updates = [{ date: dateStr, templateId: null }];
      for (const w of futureWorkouts) {
        const nextDay = format(addDays(new Date(w.date + 'T00:00:00'), 1), 'yyyy-MM-dd');
        updates.push({ date: nextDay, templateId: w.templateId });
      }

      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: updates }),
      });
      await refreshSchedule();
      setRestDayPrompt(false);
      setEditingDay(null);
    } catch (err) {
      console.error(err);
      setEditError('Failed to save. Please try again.');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleClearCalendar() {
    const dateStr = format(editingDay, 'yyyy-MM-dd');
    setScheduleSaving(true);
    try {
      await api(`/schedule?from=${dateStr}`, { method: 'DELETE' });
      await refreshSchedule();
      setClearCalendarConfirm(false);
      setEditingDay(null);
    } catch (err) {
      console.error(err);
      setEditError('Failed to save. Please try again.');
    } finally {
      setScheduleSaving(false);
    }
  }

  function toggleProgram(programId) {
    setExpandedProgram(expandedProgram === programId ? null : programId);
  }

  function startCopy(currentWorkout, date) {
    setCopySource({
      templateId: currentWorkout.templateId,
      templateName: currentWorkout.templateName,
      date: format(date, 'yyyy-MM-dd'),
    });
    setCopyStep('pick-day');
    setCopyTarget(null);
    setCopyWeekOffset(0);
    setEditingDay(null);
  }

  function cancelCopy() {
    setCopySource(null);
    setCopyStep(null);
    setCopyTarget(null);
    setCopying(false);
  }

  function handlePickCopyDay(targetDate) {
    const targetWorkout = getWorkoutForDay(targetDate);
    const hasTargetWorkout = targetWorkout && !targetWorkout.isRest && targetWorkout.templateId;
    setCopyTarget(targetDate);

    if (hasTargetWorkout) {
      setCopyStep('confirm-overwrite');
    } else {
      checkIfSourceCompleted(targetDate);
    }
  }

  function checkIfSourceCompleted(targetDate) {
    const isCompleted = completedSessions.some(
      (c) => c.templateId === copySource.templateId && c.date === copySource.date
    );
    if (isCompleted) {
      setCopyTarget(targetDate || copyTarget);
      setCopyStep('use-reps');
    } else {
      executeCopy(targetDate || copyTarget, false);
    }
  }

  async function executeCopy(targetDate, useReps) {
    setCopying(true);
    try {
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');

      // Step 1: Assign the templateId to the target day's schedule
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ date: targetDateStr, templateId: copySource.templateId }] }),
      });

      // Fetch source session to copy weights (and optionally reps as goals)
      const sourceSession = await api(`/sessions/by-template/${copySource.templateId}/${copySource.date}`).catch(() => null);

      // Build workout data: use source session if available, otherwise fetch template
      let workoutDataForCopy = null;

      if (sourceSession && sourceSession.workoutData) {
        workoutDataForCopy = { ...sourceSession.workoutData };
        if (workoutDataForCopy.exercises && sourceSession.entries) {
          workoutDataForCopy.exercises = workoutDataForCopy.exercises.map((ex) => {
            if (ex.isSectionHeader) return ex;
            const exEntries = sourceSession.entries.filter((e) => e.exerciseName === ex.name);
            return {
              ...ex,
              sets: ex.sets.map((s) => {
                const matchingEntry = exEntries.find((e) => e.setNumber === s.setNumber);
                return {
                  ...s,
                  plannedReps: useReps && matchingEntry && matchingEntry.reps > 0 ? matchingEntry.reps : s.plannedReps,
                  suggestedWeight: matchingEntry && matchingEntry.weight > 0 ? matchingEntry.weight : s.suggestedWeight,
                };
              }),
            };
          });
        }
      } else {
        // No session exists — fetch the template directly to get suggestedWeight values
        const templates = await api('/templates');
        const tpl = templates.find((t) => t.id === copySource.templateId);
        if (tpl) {
          workoutDataForCopy = {
            name: tpl.name,
            exercises: tpl.exercises.map((ex) => ({
              ...ex,
              sets: ex.sets.map((s, i) => ({
                setNumber: s.setNumber || i + 1,
                plannedReps: s.plannedReps || 10,
                suggestedWeight: s.suggestedWeight || 0,
              })),
            })),
          };
        }
      }

      if (workoutDataForCopy) {
        // Build blank entries (user starts fresh, weights show as suggestions)
        const entries = [];
        for (const ex of workoutDataForCopy.exercises) {
          if (ex.isSectionHeader) continue;
          for (const s of ex.sets) {
            entries.push({ exerciseName: ex.name, setNumber: s.setNumber, weight: 0, reps: 0 });
          }
        }

        await api('/sessions', {
          method: 'POST',
          body: JSON.stringify({
            templateId: copySource.templateId,
            date: targetDateStr,
            entries,
            notes: {},
            workoutData: workoutDataForCopy,
          }),
        });
      }

      // Refresh schedule and completed sessions
      await refreshSchedule();
      cancelCopy();
    } catch (err) {
      console.error('Copy failed:', err);
      cancelCopy();
    }
  }

  const enrichedPrograms = getEnrichedPrograms();

  return (
    <div>
      <StickyHeader
        title="Schedule"
        subtitle={viewMode === 'week'
          ? `Week of ${format(weekStart, 'MMM d')} — ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
          : format(monthDate, 'MMMM yyyy')
        }
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => viewMode === 'week' ? setWeekOffset(w => w - 1) : setMonthOffset(m => m - 1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          {((viewMode === 'week' && !isCurrentWeek) || (viewMode === 'month' && !isCurrentMonth)) && (
            <button
              onClick={() => viewMode === 'week' ? setWeekOffset(0) : setMonthOffset(0)}
              className="px-3 h-9 rounded-full bg-white/10 text-xs font-semibold text-white active:scale-90 transition-transform"
            >
              Today
            </button>
          )}
          <button
            onClick={() => viewMode === 'week' ? setWeekOffset(w => w + 1) : setMonthOffset(m => m + 1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </StickyHeader>

      {/* View Mode Toggle */}
      <div className="px-4 mb-3">
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            onClick={() => setViewMode('week')}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
              viewMode === 'week' ? 'bg-wf-red text-white' : 'text-wf-gray-400'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
              viewMode === 'month' ? 'bg-wf-red text-white' : 'text-wf-gray-400'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Monthly View */}
      {viewMode === 'month' && !loading && !loadError && (
        <div className="px-4 pb-4">
          {/* Day name headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] text-wf-gray-500 uppercase tracking-wider font-medium py-1">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px">
            {monthGridDays.map((date) => {
              const inMonth = isSameMonth(date, monthDate);
              const dayIsToday = isToday(date);
              const workout = getWorkoutForDay(date);
              const dayCompleted = isDayCompleted(date);
              const hasWorkout = workout && !workout.isRest && workout.templateId;
              const color = getWorkoutColor(workout?.templateName);
              const dateStr = format(date, 'yyyy-MM-dd');

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    if (hasWorkout) {
                      navigate(`/session/${workout.templateId}/${dateStr}`);
                    }
                  }}
                  className={`relative min-h-[72px] rounded-lg p-1 transition-all ${
                    !inMonth ? 'opacity-20' : ''
                  } ${hasWorkout ? 'cursor-pointer active:scale-[0.97]' : ''} ${
                    dayIsToday ? 'ring-2 ring-wf-red' : ''
                  } ${dayCompleted ? 'bg-green-500/10' : 'bg-white/[0.02]'}`}
                >
                  {/* Date number */}
                  <div className={`text-center text-xs font-bold mb-0.5 ${
                    dayIsToday ? 'text-wf-red' : dayCompleted ? 'text-green-400' : inMonth ? 'text-white' : 'text-wf-gray-600'
                  }`}>
                    {format(date, 'd')}
                  </div>
                  {/* Workout name */}
                  {hasWorkout && inMonth && (
                    <div className={`text-[8px] leading-tight font-medium text-center truncate px-0.5 ${
                      dayCompleted ? 'text-green-400' : color.text || 'text-wf-gray-400'
                    }`}>
                      {workout.templateName}
                    </div>
                  )}
                  {workout?.isRest && inMonth && (
                    <div className="text-[8px] leading-tight font-medium text-center text-wf-gray-500 px-0.5">
                      Rest
                    </div>
                  )}
                  {/* Color dot indicator */}
                  {hasWorkout && inMonth && (
                    <div className="flex justify-center mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${dayCompleted ? 'bg-green-500' : color.dot}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly View */}
      <div className={`px-4 ${viewMode === 'month' ? 'hidden' : ''}`}>
        {tutorialDone && (
          <div className="mb-5 rounded-2xl bg-gradient-to-br from-wf-red/20 to-wf-cyan/10 border border-wf-red/30 p-5 fade-slide-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-wf-red/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-base mb-1">Tutorial Complete!</h3>
                <p className="text-sm text-wf-gray-300 leading-relaxed">
                  Nothing was added to your calendar during the walkthrough. You can now browse the library for a program you like and either start an entire program or add one specific workout for a day.
                </p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => { setTutorialDone(false); navigate('/'); }}
                    className="flex-1 btn-gradient text-white text-sm font-semibold py-2.5 px-4 rounded-xl active:scale-[0.97] transition-transform"
                  >
                    Browse Library
                  </button>
                  <button
                    onClick={() => setTutorialDone(false)}
                    className="text-sm text-wf-gray-400 py-2.5 px-4 rounded-xl bg-white/5 active:bg-white/10 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div className="space-y-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="glass-skeleton rounded-xl h-20" />
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-16 fade-slide-up">
            <p className="text-red-400 mb-3">{loadError}</p>
            <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
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

              const hasWorkout = workout && !isRest && workout.templateId;

              return (
                <div
                  key={date.toISOString()}
                  onClick={() => handleDayTap(date)}
                  role={hasWorkout ? 'button' : undefined}
                  style={{ animationDelay: `${idx * 60}ms` }}
                  className={`w-full text-left rounded-xl overflow-hidden transition-all fade-slide-up ${
                    hasWorkout ? 'active:scale-[0.98] cursor-pointer' : 'opacity-60'
                  } ${
                    dayIsToday
                      ? 'glass-card !border-2 !border-wf-red today-glow'
                      : 'glass-card'
                  }`}
                >
                  <div className="flex">
                    {/* Color accent bar */}
                    <div className={`w-1 shrink-0 ${dayCompleted ? 'bg-green-500' : color.dot}`} />
                    <div className="flex-1 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Day circle */}
                          <div
                            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center shrink-0 ${
                              dayIsToday ? 'btn-gradient text-white' : dayCompleted ? 'bg-green-500/15 text-green-400' : `${color.bg} text-wf-gray-400`
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
                              <span className="text-xs text-green-400 font-medium">Complete</span>
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
                          {hasWorkout && (
                            <svg className="w-5 h-5 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Workout Picker Modal */}
      {editingDay && (() => {
        const currentWorkout = getWorkoutForDay(editingDay);
        const isCurrentRest = currentWorkout?.isRest;
        const hasWorkout = currentWorkout && !isCurrentRest && currentWorkout.templateId;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setEditingDay(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-lg bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl max-h-[75vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >

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

              {/* Search bar */}
              <div className="px-5 pb-3 shrink-0">
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search workouts..."
                    className="w-full glass-input rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder:text-wf-gray-500 focus:outline-none transition-all"
                  />
                  {pickerSearch && (
                    <button
                      onClick={() => setPickerSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-wf-gray-500 active:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Error feedback */}
              {editError && (
                <div className="px-5 pb-2 shrink-0">
                  <p className="text-sm text-red-400 text-center">{editError}</p>
                </div>
              )}

              {/* Workout list — flat, grouped by program */}
              <div className="overflow-y-auto flex-1 px-5 py-3">
                {/* Quick actions */}
                {!pickerSearch && (
                  <div className="mb-4 space-y-1.5">
                    <button
                      onClick={() => { setEditingDay(null); navigate(`/clientworkouts/create?quick=1&date=${format(editingDay, 'yyyy-MM-dd')}`); }}
                      className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all"
                    >
                      <div className="w-8 h-8 rounded-full btn-gradient flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-white">Create a Workout</span>
                    </button>
                    {hasWorkout && (
                      isPremium ? (
                        <button
                          onClick={() => startCopy(currentWorkout, editingDay)}
                          className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all"
                        >
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-wf-gray-300">Copy Workout</span>
                        </button>
                      ) : (
                        <div className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 opacity-50 cursor-not-allowed">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-wf-gray-300">Copy Workout</span>
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[10px] font-bold text-yellow-400 uppercase tracking-wider">Pro</span>
                        </div>
                      )
                    )}
                    {(hasWorkout || isCurrentRest) && (
                      <button
                        onClick={handleClearDay}
                        disabled={scheduleSaving}
                        className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all ${scheduleSaving ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-wf-gray-300">Clear — No Workout</span>
                      </button>
                    )}
                    {hasWorkout && (
                      <button
                        onClick={() => setRestDayPrompt(true)}
                        disabled={scheduleSaving}
                        className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all ${scheduleSaving ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-wf-gray-300">Rest Day</span>
                      </button>
                    )}
                    <button
                      onClick={() => setClearCalendarConfirm(true)}
                      disabled={scheduleSaving}
                      className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all ${scheduleSaving ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-red-400">Clear Calendar</span>
                    </button>
                  </div>
                )}

                {/* All workouts, grouped by program (filtered by search) */}
                {(() => {
                  const q = pickerSearch.toLowerCase().trim();
                  const filteredPrograms = enrichedPrograms.map((program) => {
                    const nonRest = program.templates.filter((t) => !t.isRest);
                    if (!q) return { ...program, filtered: nonRest };
                    const matched = nonRest.filter((t) =>
                      t.name.toLowerCase().includes(q) ||
                      (t.exercises && t.exercises.some((ex) => ex.name.toLowerCase().includes(q)))
                    );
                    return { ...program, filtered: matched };
                  }).filter((p) => p.filtered.length > 0);

                  if (q && filteredPrograms.length === 0) {
                    return (
                      <p className="text-wf-gray-500 text-sm text-center py-8">No workouts matching "{pickerSearch}"</p>
                    );
                  }

                  return filteredPrograms.map((program) => {
                  return (
                    <div key={program.id} className="mb-4">
                      <p className="text-[10px] uppercase tracking-widest text-wf-gray-500 font-semibold mb-2 px-1">{program.name}</p>
                      <div className="space-y-1.5">
                        {program.filtered.map((t) => {
                          const color = getWorkoutColor(t.name);
                          const isCurrentChoice = currentWorkout?.templateId === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => handleSwap(t.id)}
                              disabled={scheduleSaving}
                              className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] ${isCurrentChoice ? 'bg-wf-red/15 border border-wf-red/30' : 'bg-white/5 active:bg-white/10'} ${scheduleSaving ? 'opacity-50 pointer-events-none' : ''}`}
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
                });
                })()}

                {/* Create new workout */}
                <button
                  onClick={() => { setEditingDay(null); navigate('/clientworkouts/create?quick=1'); }}
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

      {/* Rest Day Options Modal */}
      {restDayPrompt && editingDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setRestDayPrompt(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Rest Day</h3>
                  <p className="text-sm text-wf-gray-400 mt-0.5">
                    {DAY_NAMES[editingDay.getDay()]}, {format(editingDay, 'MMM d')}
                  </p>
                </div>
                <button
                  onClick={() => setRestDayPrompt(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="p-5 space-y-3">
              {/* Skip Workout */}
              <button
                onClick={handleSkipWorkout}
                disabled={scheduleSaving}
                className={`w-full text-left rounded-xl px-4 py-4 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all ${scheduleSaving ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061a1.125 1.125 0 01-1.683-.977V8.69z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Skip Workout</p>
                    <p className="text-xs text-wf-gray-500 mt-0.5">Replace this day with a rest day. Other days stay the same.</p>
                  </div>
                </div>
              </button>

              {/* Insert Rest Day */}
              <button
                onClick={handleInsertRestDay}
                disabled={scheduleSaving}
                className={`w-full text-left rounded-xl px-4 py-4 bg-white/5 active:bg-white/10 active:scale-[0.98] transition-all ${scheduleSaving ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Insert Rest Day</p>
                    <p className="text-xs text-wf-gray-500 mt-0.5">Push this and all later workouts forward by one day.</p>
                  </div>
                </div>
              </button>
            </div>

            {editError && (
              <div className="px-5 pb-4">
                <p className="text-sm text-red-400 text-center">{editError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear Calendar Confirmation Modal */}
      {clearCalendarConfirm && editingDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setClearCalendarConfirm(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white text-center">Clear Calendar</h3>
              <p className="text-sm text-wf-gray-400 text-center mt-2">
                This will remove all workouts from <span className="text-white font-medium">{format(editingDay, 'MMM d')}</span> onward.
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setClearCalendarConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCalendar}
                disabled={scheduleSaving}
                className={`flex-1 py-3 rounded-xl bg-red-500 text-sm font-semibold text-white active:scale-[0.98] transition-all ${scheduleSaving ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {scheduleSaving ? 'Clearing...' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Workout Modal */}
      {copySource && copyStep && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={cancelCopy}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {copyStep === 'pick-day' && 'Copy Workout'}
                    {copyStep === 'confirm-overwrite' && 'Overwrite Workout?'}
                    {copyStep === 'use-reps' && 'Use Previous Reps?'}
                  </h3>
                  <p className="text-sm text-wf-gray-400 mt-0.5">
                    {copyStep === 'pick-day' && (
                      <>Copying <span className="text-white/70">{copySource.templateName}</span> — pick a target day</>
                    )}
                    {copyStep === 'confirm-overwrite' && copyTarget && (() => {
                      const targetWorkout = getWorkoutForDay(copyTarget);
                      return (
                        <><span className="text-white/70">{targetWorkout?.templateName}</span> is already scheduled for {FULL_DAY_NAMES[copyTarget.getDay()]}</>
                      );
                    })()}
                    {copyStep === 'use-reps' && 'Your source workout is completed. Use those reps as goals?'}
                  </p>
                </div>
                <button
                  onClick={cancelCopy}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              {/* Step: Pick a day */}
              {copyStep === 'pick-day' && (() => {
                const copyWeekStart = addDays(startOfWeek(today, { weekStartsOn: 0 }), copyWeekOffset * 7);
                const copyWeekDays = Array.from({ length: 7 }, (_, i) => addDays(copyWeekStart, i));
                return (
                <div>
                  {/* Week navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={() => setCopyWeekOffset(prev => prev - 1)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium text-wf-gray-300">
                      {format(copyWeekStart, 'MMM d')} — {format(addDays(copyWeekStart, 6), 'MMM d')}
                    </span>
                    <button
                      onClick={() => setCopyWeekOffset(prev => prev + 1)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2">
                  {copyWeekDays.map((date) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const isSourceDay = dateStr === copySource.date;
                    const workout = getWorkoutForDay(date);
                    const hasWorkout = workout && !workout.isRest && workout.templateId;
                    const dayCompleted = isDayCompleted(date);
                    const dayIsToday = isToday(date);
                    const color = hasWorkout ? getWorkoutColor(workout.templateName) : null;

                    return (
                      <button
                        key={dateStr}
                        disabled={isSourceDay}
                        onClick={() => handlePickCopyDay(date)}
                        className={`w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                          isSourceDay
                            ? 'bg-white/5 opacity-40 cursor-not-allowed'
                            : 'bg-white/5 active:bg-white/10 active:scale-[0.98]'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0 ${
                            dayIsToday ? 'btn-gradient text-white' : dayCompleted ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-wf-gray-400'
                          }`}
                        >
                          <span className="text-[9px] font-medium uppercase leading-none">
                            {DAY_NAMES[date.getDay()]}
                          </span>
                          <span className="text-sm font-bold leading-none mt-0.5">
                            {format(date, 'd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {hasWorkout ? (
                            <>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${color?.dot}`} />
                                <span className="text-sm font-medium text-white truncate">{workout.templateName}</span>
                              </div>
                              {dayCompleted && <span className="text-[10px] text-green-400">Complete</span>}
                            </>
                          ) : (
                            <span className="text-sm text-wf-gray-500">No workout</span>
                          )}
                        </div>
                        {isSourceDay ? (
                          <span className="text-[10px] text-wf-gray-500 font-medium uppercase">Source</span>
                        ) : (
                          <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  </div>
                </div>
                );
              })()}

              {/* Step: Confirm overwrite */}
              {copyStep === 'confirm-overwrite' && (
                <div className="space-y-4">
                  <p className="text-sm text-wf-gray-300 text-center">
                    This will replace the existing workout on {copyTarget && FULL_DAY_NAMES[copyTarget.getDay()]} with <span className="text-white font-medium">{copySource.templateName}</span>.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCopyStep('pick-day')}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/10 text-sm font-medium text-white active:bg-white/20 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => checkIfSourceCompleted(copyTarget)}
                      className="flex-1 px-4 py-3 rounded-xl btn-gradient text-sm font-semibold text-white active:scale-[0.97] transition-transform"
                    >
                      Overwrite
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Use previous reps */}
              {copyStep === 'use-reps' && (
                <div className="space-y-4">
                  <p className="text-sm text-wf-gray-300 text-center">
                    Would you like to use your previous reps as goal reps for the new workout?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => executeCopy(copyTarget, false)}
                      disabled={copying}
                      className={`flex-1 px-4 py-3 rounded-xl bg-white/10 text-sm font-medium text-white active:bg-white/20 transition-all ${copying ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      No
                    </button>
                    <button
                      onClick={() => executeCopy(copyTarget, true)}
                      disabled={copying}
                      className={`flex-1 px-4 py-3 rounded-xl btn-gradient text-sm font-semibold text-white active:scale-[0.97] transition-transform ${copying ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {copying ? 'Copying...' : 'Yes, Use Reps'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
