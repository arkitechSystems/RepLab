import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { requireOnline, offlineMessage } from '../queries/edits';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import useFocusTrap from '../hooks/useFocusTrap';
import LoadingSpinnerOverlay from './LoadingSpinnerOverlay';
import CreateWorkoutModal from './CreateWorkoutModal';
import { createWorkoutUrl } from '../utils/createWorkout';
import {
  CalendarNavButtons, WeekDayCard, MonthDayHeaders, MonthDayCell, MonthLegend,
} from './calendar/CalendarViews';
import {
  MAX_PROGRAM_WEEKS, MONTH_PAGE_WEEKS, WEEKDAY_SHORT, WEEKDAY_FULL,
  programDays, weekCount, weekOf, startWeekdayOf, weekdayFor, dayHeaders, isWorkout,
  toLayoutSlots, setDay, addWeek, duplicateWeek, deleteWeek, moveDay, distinctWorkouts,
} from '../utils/programLayout';

// Program builder — a "sample calendar" of the program: Week N, Day 1–7
// (optionally labelled with weekdays), drawn with the Calendar page's own
// weekly cards and monthly grid (components/calendar/CalendarViews).
//
// Every change is saved straight away with one PUT /programs/:id/layout
// (atomic on the server, online-only like other edits that need the
// server's answer — decision 14 in docs/tanstack-query-migration.md), then
// `onSaved` reloads the page's programs + templates.
//
// Library programs (userId null) are view-only: tap a workout to see it.

const MONTH_LEGEND = [
  { label: 'Workout', bg: 'rgba(239,68,68,0.16)', dateColor: '#fff', abbr: 'WO' },
  { label: 'Rest', bg: 'rgba(148,163,184,0.08)', dateColor: '#fff', restLabel: true },
  { label: 'Empty', bg: 'rgba(255,255,255,0.02)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)', dateColor: 'rgba(255,255,255,0.85)' },
];

const RED_BUTTON = {
  letterSpacing: '0.15em',
  borderRadius: '2px',
  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
};
const GHOST_BUTTON = {
  letterSpacing: '0.15em',
  borderRadius: '2px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
};
const DANGER_BUTTON = {
  letterSpacing: '0.15em',
  borderRadius: '2px',
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.25)',
};

function exerciseSummary(ex) {
  const sets = ex.sets || [];
  const top = Math.max(0, ...sets.map((s) => Number(s.suggestedWeight) || 0));
  const reps = ex.repRange || sets[0]?.plannedReps;
  return `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}${top > 0 ? ` · ${top} lbs` : ''}${reps ? ` · ${reps} reps` : ''}`;
}

export default function ProgramCalendar({
  program,
  allTemplates = [],
  programs = [],
  view = 'week',
  initialWeek = 0,
  editable = false,
  onSaved,
}) {
  const navigate = useNavigate();
  const showToast = useToast();
  const confirmDialog = useConfirm();
  const days = useMemo(() => programDays(program?.templates), [program?.templates]);
  const weeks = weekCount(days);
  const [weekIdxRaw, setWeekIdx] = useState(Math.max(0, initialWeek));
  const weekIdx = Math.min(weekIdxRaw, weeks - 1);
  const start = startWeekdayOf(program);
  const [saving, setSaving] = useState(false);
  // Bottom sheet for one day: { index, step } — step 'menu' | 'view' |
  // 'pick-program' | 'pick-my' | 'move'; `swap` when picking a replacement.
  const [sheet, setSheet] = useState(null);
  const [mySearch, setMySearch] = useState('');
  const [createFor, setCreateFor] = useState(null); // day index for Create a Workout
  const sheetTrapRef = useFocusTrap(!!sheet);

  const pageStart = Math.floor(weekIdx / MONTH_PAGE_WEEKS) * MONTH_PAGE_WEEKS;
  const pageEnd = Math.min(weeks, pageStart + MONTH_PAGE_WEEKS);

  const programWorkouts = useMemo(() => distinctWorkouts(days), [days]);
  const programNames = useMemo(() => new Map(programs.map((p) => [p.id, p.name])), [programs]);
  // "Copy from My Workouts": the user's own workouts outside this program.
  const myWorkouts = useMemo(() => allTemplates
    .filter((t) => t.userId != null && !t.isRest && !t.isPrehab && t.programId !== program?.id)
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || '')), [allTemplates, program?.id]);

  if (!program) return null;

  const placeName = (index) => {
    const wd = weekdayFor(index % 7, start);
    return `Week ${weekOf(index) + 1} · Day ${(index % 7) + 1}${wd == null ? '' : ` · ${WEEKDAY_SHORT[wd]}`}`;
  };

  async function save(nextDays, { startWeekday, message } = {}) {
    if (saving) return false;
    setSaving(true);
    try {
      requireOnline();
      const body = { slots: toLayoutSlots(nextDays) };
      if (startWeekday !== undefined) body.startWeekday = startWeekday;
      await api(`/programs/${program.id}/layout`, { method: 'PUT', body: JSON.stringify(body) });
      if (onSaved) await onSaved();
      if (message) showToast(message);
      return true;
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      showToast(offlineMessage(err, err?.message || "Couldn't save the program. Please try again."), 'error', 4000);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openDay(index) {
    const t = days[index];
    if (!editable) {
      if (isWorkout(t)) setSheet({ index, step: 'view' });
      return;
    }
    setMySearch('');
    setSheet({ index, step: 'menu' });
  }

  const closeSheet = () => setSheet(null);

  async function confirmReplace(t, verb) {
    return confirmDialog({
      title: `${verb} ${t.name}?`,
      message: "This day's copy of the workout is deleted, along with its history and personal bests, and it comes off your calendar. Copies on other days are kept.",
      confirmLabel: verb,
      danger: true,
    });
  }

  async function pickWorkout(source) {
    const { index, swap } = sheet;
    const current = days[index];
    if (swap && isWorkout(current) && !(await confirmReplace(current, 'Replace'))) return;
    closeSheet();
    await save(setDay(days, index, { copyOf: source.id }), { message: `${source.name} added to ${placeName(index)}.` });
  }

  async function removeDay() {
    const { index } = sheet;
    const current = days[index];
    if (!(await confirmReplace(current, 'Remove'))) return;
    closeSheet();
    await save(setDay(days, index, null), { message: `${placeName(index)} is now a rest day.` });
  }

  async function markRest() {
    const { index } = sheet;
    closeSheet();
    // Saving fills every empty day with a rest day (programs are whole weeks).
    await save(days, { message: `${placeName(index)} is now a rest day.` });
  }

  async function moveTo(target) {
    const { index } = sheet;
    closeSheet();
    if (target === index) return;
    await save(moveDay(days, index, target), { message: `Moved to ${placeName(target)}.` });
  }

  function editWorkout(t) {
    closeSheet();
    const q = new URLSearchParams({ from: 'program', programId: String(program.id), week: String(weekOf(sheet.index) + 1) });
    navigate(`/clientworkouts/edit/${t.id}?${q.toString()}`);
  }

  async function handleDeleteWeek() {
    if (!(await confirmDialog({
      title: `Delete Week ${weekIdx + 1}?`,
      message: 'All workouts in this week will be deleted, along with their history and personal records. Remaining weeks will be renumbered. This cannot be undone.',
      confirmLabel: 'Delete Week',
      danger: true,
    }))) return;
    const ok = await save(deleteWeek(days, weekIdx), { message: `Week ${weekIdx + 1} deleted.` });
    if (ok) setWeekIdx(Math.max(0, weekIdx - 1));
  }

  async function handleAddWeek() {
    const ok = await save(addWeek(days), { message: `Week ${weeks + 1} added.` });
    if (ok) setWeekIdx(weeks);
  }

  async function handleDuplicateWeek() {
    const ok = await save(duplicateWeek(days, weekIdx), { message: `Week ${weekIdx + 1} copied to Week ${weeks + 1}.` });
    if (ok) setWeekIdx(weeks);
  }

  const atMaxWeeks = weeks >= MAX_PROGRAM_WEEKS;

  // ── Header: "WEEK 1 OF 4" / "WEEKS 1–4 OF 8" + arrows ──
  const header = (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.35em' }}>
          Sample Calendar
        </p>
        <h2 className="text-[20px] font-black text-white tracking-tight leading-tight" style={{ fontFamily: 'system-ui' }}>
          {view === 'month'
            ? (pageEnd - pageStart > 1 ? `WEEKS ${pageStart + 1}–${pageEnd}` : `WEEK ${pageStart + 1}`)
            : `WEEK ${weekIdx + 1}`}
          <span className="text-white/35 font-bold text-[13px] ml-2 tracking-[0.2em]">OF {weeks}</span>
        </h2>
      </div>
      <CalendarNavButtons
        prevLabel={view === 'month' ? 'Previous weeks' : 'Previous week'}
        nextLabel={view === 'month' ? 'Next weeks' : 'Next week'}
        prevDisabled={view === 'month' ? pageStart === 0 : weekIdx === 0}
        nextDisabled={view === 'month' ? pageEnd >= weeks : weekIdx >= weeks - 1}
        onPrev={() => setWeekIdx(view === 'month' ? Math.max(0, pageStart - MONTH_PAGE_WEEKS) : Math.max(0, weekIdx - 1))}
        onNext={() => setWeekIdx(view === 'month' ? Math.min(weeks - 1, pageStart + MONTH_PAGE_WEEKS) : Math.min(weeks - 1, weekIdx + 1))}
      />
    </div>
  );

  const startDayPicker = editable && (
    <div className="flex items-center justify-between gap-3 mb-4 px-1">
      <label htmlFor={`program-start-day-${program.id}`} className="text-[10px] uppercase font-bold text-white/50" style={{ letterSpacing: '0.2em' }}>
        Day 1 is
      </label>
      <select
        id={`program-start-day-${program.id}`}
        value={start == null ? '' : String(start)}
        disabled={saving}
        onChange={(e) => save(days, {
          startWeekday: e.target.value === '' ? null : Number(e.target.value),
          message: e.target.value === '' ? 'Days show as Day 1–7.' : `Day 1 is now ${WEEKDAY_FULL[Number(e.target.value)]}.`,
        })}
        className="glass-input rounded-[2px] px-3 py-2 text-white text-base focus:outline-none appearance-none"
        style={{ colorScheme: 'dark' }}
      >
        <option value="">Any day (Day 1–7)</option>
        {WEEKDAY_FULL.map((d, i) => <option key={d} value={i}>{d}</option>)}
      </select>
    </div>
  );

  const weekView = (
    <div className="space-y-3 pb-4">
      {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((t, d) => {
        const index = weekIdx * 7 + d;
        const wd = weekdayFor(d, start);
        const workout = isWorkout(t);
        const exCount = workout ? (t.exercises || []).filter((e) => !e.isSectionHeader).length : 0;
        return (
          <WeekDayCard
            key={index}
            idx={d}
            dayName={wd == null ? 'Day' : WEEKDAY_SHORT[wd]}
            dayNumber={d + 1}
            title={workout ? t.name : t ? 'Rest Day' : (editable ? 'Tap to add a workout' : 'Rest Day')}
            statusLabel={workout ? `${exCount} ${exCount === 1 ? 'exercise' : 'exercises'}` : t ? 'Rest Day' : 'Empty'}
            isRest={!!t && !workout}
            hasWorkout={workout}
            ariaLabel={editable || workout ? `${placeName(index)}: ${workout ? t.name : t ? 'Rest day' : 'Empty'}` : undefined}
            onClick={() => openDay(index)}
          />
        );
      })}
    </div>
  );

  const monthView = (
    <div className="pb-2">
      <MonthDayHeaders labels={dayHeaders(start)} />
      <div className="grid grid-cols-7 gap-[3px]">
        {days.slice(pageStart * 7, pageEnd * 7).map((t, i) => {
          const index = pageStart * 7 + i;
          const workout = isWorkout(t);
          return (
            <MonthDayCell
              key={index}
              dateLabel={index + 1}
              label={workout ? (t.name || '').slice(0, 3) : ''}
              hasWorkout={workout}
              isRest={!!t && !workout}
              clickable={editable || workout}
              ariaLabel={`${placeName(index)}: ${workout ? t.name : t ? 'Rest day' : 'Empty'}`}
              onClick={() => openDay(index)}
            />
          );
        })}
      </div>
      <MonthLegend items={MONTH_LEGEND} />
    </div>
  );

  const weekControls = editable && (
    <div className="flex flex-wrap items-center gap-2 pb-6">
      <button
        onClick={handleAddWeek}
        disabled={saving || atMaxWeeks}
        className="active:scale-[0.97] transition-all text-white text-[10px] font-bold uppercase px-3 py-2.5 whitespace-nowrap disabled:opacity-40"
        style={RED_BUTTON}
      >
        + Add Week
      </button>
      {view === 'week' && (
        <>
          <button
            onClick={handleDuplicateWeek}
            disabled={saving || atMaxWeeks}
            className="active:scale-[0.97] transition-all text-white/80 text-[10px] font-bold uppercase px-3 py-2.5 whitespace-nowrap disabled:opacity-40"
            style={GHOST_BUTTON}
          >
            Duplicate Week {weekIdx + 1}
          </button>
          <button
            onClick={handleDeleteWeek}
            disabled={saving}
            className="ml-auto active:scale-[0.97] transition-all text-red-400 text-[10px] font-bold uppercase px-3 py-2.5 whitespace-nowrap disabled:opacity-40"
            style={DANGER_BUTTON}
          >
            Delete Week
          </button>
        </>
      )}
    </div>
  );

  return (
    <div>
      {header}
      {startDayPicker}
      {view === 'month' ? monthView : weekView}
      {weekControls}
      {saving && <LoadingSpinnerOverlay />}
      {/* Portalled to <body> so they sit above the bottom nav (the page
          content is its own stacking context). */}
      {sheet && createPortal(renderSheet(), document.body)}
      {createFor != null && createPortal(
        <CreateWorkoutModal
          programs={programs}
          lockedProgram={program}
          onCancel={() => setCreateFor(null)}
          onConfirm={({ name, description }) => {
            const slot = createFor;
            setCreateFor(null);
            navigate(createWorkoutUrl({ name, description, programId: program.id, slot }));
          }}
        />,
        document.body,
      )}
    </div>
  );

  function renderSheet() {
    const { index, step } = sheet;
    const t = days[index];
    const workout = isWorkout(t);
    const title = workout ? t.name : t ? 'Rest Day' : 'Empty Day';

    const row = (label, onClick, { danger = false, hint } = {}) => (
      <button
        key={label}
        onClick={onClick}
        className={`w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 active:bg-white/10 transition-colors ${danger ? 'text-red-400' : 'text-white'}`}
        style={{ borderRadius: '2px', background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}` }}
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold">{label}</span>
          {hint && <span className="block text-[11px] text-white/40 font-light mt-0.5 truncate">{hint}</span>}
        </span>
        <svg className="w-4 h-4 text-white/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    );

    const back = (to) => (
      <button onClick={() => setSheet({ ...sheet, step: to, swap: false })} className="inline-flex items-center gap-1 text-xs text-wf-gray-400 active:text-white mb-3">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>
    );

    let body = null;
    if (step === 'view' && workout) {
      const list = t.exercises || [];
      body = (
        <>
          {editable && back('menu')}
          {list.length === 0 ? (
            <p className="text-sm text-white/50">No exercises yet.</p>
          ) : (
            <div className="space-y-1.5">
              {list.map((ex, i) => (ex.isSectionHeader ? (
                <p key={`s${i}`} className="text-[10px] uppercase font-black text-wf-red pt-2" style={{ letterSpacing: '0.25em' }}>{ex.name}</p>
              ) : (
                <div key={`e${i}`} className="px-3.5 py-2.5" style={{ borderRadius: '2px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-sm font-semibold text-white truncate">{ex.supersetLabel ? `${ex.supersetLabel} · ` : ''}{ex.name}</p>
                  <p className="text-xs text-wf-gray-500 mt-0.5">{exerciseSummary(ex)}</p>
                </div>
              )))}
            </div>
          )}
        </>
      );
    } else if (step === 'menu' && workout) {
      body = (
        <div className="space-y-2">
          {row('View', () => setSheet({ ...sheet, step: 'view' }), { hint: `${(t.exercises || []).filter((e) => !e.isSectionHeader).length} exercises` })}
          {row('Edit', () => editWorkout(t), { hint: 'Exercises, sets and goal weights' })}
          {row('Swap', () => setSheet({ ...sheet, step: 'pick-program', swap: true }), { hint: 'Put a different workout on this day' })}
          {row('Move to another day', () => setSheet({ ...sheet, step: 'move' }))}
          {row('Remove', removeDay, { danger: true, hint: 'This day becomes a rest day' })}
        </div>
      );
    } else if (step === 'menu') {
      body = (
        <div className="space-y-2">
          {programWorkouts.length > 0 && row('Add a workout from this program', () => setSheet({ ...sheet, step: 'pick-program' }), { hint: 'Places a copy on this day' })}
          {row('Copy from My Workouts', () => setSheet({ ...sheet, step: 'pick-my' }), { hint: 'Places a copy on this day' })}
          {row('Create a new workout', () => { closeSheet(); setCreateFor(index); })}
          {!t && row('Mark as rest day', markRest)}
        </div>
      );
    } else if (step === 'pick-program' || step === 'pick-my') {
      const fromProgram = step === 'pick-program';
      const q = mySearch.trim().toLowerCase();
      const list = fromProgram
        ? programWorkouts.filter((w) => !sheet.swap || !workout || w.name !== t.name)
        : myWorkouts.filter((w) => !q || (w.name || '').toLowerCase().includes(q));
      body = (
        <>
          {back('menu')}
          {sheet.swap && (
            <div className="flex gap-2 mb-3">
              {[['pick-program', 'This program'], ['pick-my', 'My Workouts']].map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => setSheet({ ...sheet, step: s })}
                  className={`text-[10px] font-bold uppercase px-3 py-2 ${step === s ? 'text-black' : 'text-white/60'}`}
                  style={{ letterSpacing: '0.15em', borderRadius: '2px', background: step === s ? 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)' : 'rgba(255,255,255,0.06)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!fromProgram && (
            <input
              type="text"
              value={mySearch}
              onChange={(e) => setMySearch(e.target.value)}
              placeholder="Search your workouts"
              aria-label="Search your workouts"
              className="w-full glass-input rounded-[2px] px-3 py-2.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none mb-3"
            />
          )}
          {list.length === 0 ? (
            <p className="text-sm text-white/50 py-2">
              {fromProgram ? 'No other workouts in this program yet.' : q ? 'No workouts match.' : 'No saved workouts outside this program yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((w) => row(w.name, () => pickWorkout(w), {
                hint: fromProgram
                  ? `${(w.exercises || []).filter((e) => !e.isSectionHeader).length} exercises`
                  : (programNames.get(w.programId) || 'My Workouts'),
              }))}
            </div>
          )}
        </>
      );
    } else if (step === 'move') {
      body = (
        <>
          {back('menu')}
          <p className="text-xs text-white/50 mb-3">Pick a day. If it already has a workout, the two swap.</p>
          <MonthDayHeaders labels={dayHeaders(start)} />
          <div className="grid grid-cols-7 gap-[3px]">
            {days.map((d, i) => (
              <MonthDayCell
                key={i}
                dateLabel={i + 1}
                label={isWorkout(d) ? (d.name || '').slice(0, 3) : ''}
                hasWorkout={isWorkout(d)}
                isRest={!!d && !isWorkout(d)}
                isToday={i === index}
                clickable
                ariaLabel={`Move to ${placeName(i)}`}
                onClick={() => moveTo(i)}
              />
            ))}
          </div>
        </>
      );
    }

    return (
      <div className="fixed inset-0 z-[110] flex items-end justify-center" onClick={closeSheet} role="dialog" aria-modal="true" aria-labelledby="program-day-sheet-title">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          ref={sheetTrapRef}
          className="relative w-full max-w-lg overflow-y-auto"
          style={{
            maxHeight: '82vh',
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px 2px 0 0',
            boxShadow: '0 -12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-light mb-1" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.85)' }}>
                {placeName(index)}
              </p>
              <h3 id="program-day-sheet-title" className="text-[20px] font-black text-white tracking-tight uppercase truncate" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
                {title}
              </h3>
            </div>
            <button onClick={closeSheet} aria-label="Close" className="w-8 h-8 flex items-center justify-center text-white/40 active:text-white shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-5">{body}</div>
        </div>
      </div>
    );
  }
}

