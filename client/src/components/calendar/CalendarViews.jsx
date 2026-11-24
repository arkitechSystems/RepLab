// Calendar building blocks shared by the Calendar page (real dates) and the
// program builder's sample calendar (Week N, Day 1–7), so both look the
// same: prev/next arrows, the Weekly / Monthly toggle, the weekly day cards,
// the monthly grid cells and its legend. Pages decide what a day holds and
// what a tap does; these only draw it. Extracted from Calendar.jsx
// (2026-11-23) without changing how the Calendar looks or behaves.

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Monthly cells: workouts in red (MONTHLY_ALL_RED in the Calendar's history).
export const MONTH_ACCENT = '#ef4444';

const NAV_BUTTON_CLASS = "relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[44px] before:h-[44px]";

// ‹ [Today] › — the round arrow buttons in the Calendar header.
export function CalendarNavButtons({ onPrev, onNext, onToday, showToday = false, prevDisabled = false, nextDisabled = false, prevLabel = 'Previous', nextLabel = 'Next' }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label={prevLabel}
        className={`${NAV_BUTTON_CLASS}${prevDisabled ? ' opacity-30' : ''}`}
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      {showToday && (
        <button
          onClick={onToday}
          className="px-3 h-9 rounded-full bg-white/10 text-xs font-semibold text-white active:scale-90 transition-transform"
        >
          Today
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
        className={`${NAV_BUTTON_CLASS}${nextDisabled ? ' opacity-30' : ''}`}
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}

export const WEEK_MONTH_OPTIONS = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

// Segmented Weekly / Monthly toggle (Nike style). `options` can add more
// (the program page adds List).
export function CalendarViewToggle({ value, onChange, options = WEEK_MONTH_OPTIONS, dataTutorial, ariaLabel }) {
  return (
    <div
      data-tutorial={dataTutorial}
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      className="flex p-[3px]"
      style={{
        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
        borderRadius: '2px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {options.map(({ id, label }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={ariaLabel ? isActive : undefined}
            className="flex-1 text-[11px] font-bold uppercase py-2.5 active:scale-[0.97] transition-all"
            style={{
              borderRadius: '2px',
              letterSpacing: '0.2em',
              background: isActive ? 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)' : 'transparent',
              color: isActive ? '#000' : 'rgba(255,255,255,0.45)',
              boxShadow: isActive ? '0 4px 14px rgba(255,255,255,0.1)' : 'none',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Status line on a weekly card when the page doesn't give its own.
function defaultStatus({ completed, isRest, isToday, hasWorkout }) {
  if (completed) return 'Complete';
  if (isRest) return 'Rest Day';
  if (isToday) return 'Today';
  if (hasWorkout) return 'Scheduled';
  return 'Rest Day';
}

// One day in the weekly view: small day name over a big number on the left,
// status + workout name, an edit button and a chevron on workout days.
//   dayName / dayNumber: "MON" / "24" on the Calendar, "DAY" / "3" in a program
//   completed: green check + green border; isToday: white pulse
export function WeekDayCard({
  idx = 0,
  dayName,
  dayNumber,
  title,
  statusLabel,
  isToday = false,
  completed = false,
  isRest = false,
  hasWorkout = false,
  onClick,
  onEdit,
  editLabel,
  cardRef,
  dataTutorial,
  ariaLabel, // program builder: every day is tappable, so each card is a labelled button
}) {
  const status = statusLabel || defaultStatus({ completed, isRest, isToday, hasWorkout });
  // Status text color: green for complete, red for today, faint
  // white otherwise so it's clear at a glance which day is which.
  const statusColor = completed
    ? 'rgba(34,197,94,0.95)'
    : isToday
      ? 'rgba(239,68,68,0.95)'
      : 'rgba(255,255,255,0.45)';

  // Stacked-shadow approach so today + completed can co-exist:
  //   today     → animated white pulse via .today-white-glow-week
  //               class (drives the entire box-shadow on today),
  //               so this branch only handles the non-today layers.
  //   completed → thick 4px green inset border (no outer glow).
  // Listing the green inset AFTER means it paints over any other
  // inset when both apply.
  const shadowLayers = ['0 4px 12px rgba(0,0,0,0.3)', 'inset 0 1px 0 rgba(255,255,255,0.05)'];
  if (!isToday) {
    shadowLayers.unshift('0 12px 40px rgba(0,0,0,0.5)');
  }
  if (completed) {
    shadowLayers.push('inset 0 0 0 4px #22c55e');
  }
  const cardBoxShadow = shadowLayers.join(', ');
  // Shared accent for top bar + ambient spotlight — keep these linked so the
  // card's right-side glow always matches the top line. Switches to green
  // for completed days so they stand out.
  const topHex = completed ? '#22c55e' : '#9ca3af';

  return (
    <div
      ref={cardRef}
      data-tutorial={dataTutorial}
      onClick={onClick}
      role={hasWorkout || ariaLabel ? 'button' : undefined}
      aria-label={ariaLabel}
      style={{
        animationDelay: `${idx * 60}ms`,
        position: 'relative',
        // Today drops `overflow: hidden` so the white pulse's
        // outer glow isn't clipped by ancestor compositing,
        // and bumps z-index so the radiant glow paints over
        // the next sibling card's opaque background. Without
        // this, only the upward glow shows because each
        // weekly card has its own gradient that overlaps the
        // 12px gap below today.
        overflow: isToday ? 'visible' : 'hidden',
        zIndex: isToday ? 5 : undefined,
        borderRadius: '2px',
        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
        // Today's box-shadow comes from .today-white-glow-week
        // (animated). Non-today uses the static stack above.
        boxShadow: isToday ? undefined : cardBoxShadow,
      }}
      className={`w-full fade-slide-up transition-all ${hasWorkout ? 'active:scale-[0.98] cursor-pointer' : 'opacity-70'} ${isToday ? 'today-white-glow-week' : ''}`}
    >
      <div style={{ height: '3px', background: `linear-gradient(90deg, ${topHex}, ${topHex}80, transparent)` }} />
      <div style={{ position: 'absolute', top: '-40%', right: '-20%', width: '60%', height: '180%', background: `radial-gradient(circle, ${topHex}26 0%, transparent 60%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />

      {/* Completed badge — small green check in top-right corner */}
      {completed && (
        <div
          aria-label="Completed"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(34,197,94,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
            zIndex: 2,
          }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}

      <div className="relative px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          {/* Date block */}
          <div className="shrink-0 text-center">
            <p className="text-[9px] text-white/40 uppercase font-light" style={{ letterSpacing: '0.3em' }}>{dayName}</p>
            <div className="text-[32px] font-black tracking-tight leading-[0.9] mt-1" style={{ color: isToday ? '#ef4444' : completed ? '#22c55e' : 'white' }}>{dayNumber}</div>
          </div>
          {/* Workout info */}
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase font-light" style={{ letterSpacing: '0.25em', color: statusColor }}>
              {status}
            </p>
            <h3 className="text-[14px] font-black text-white tracking-tight leading-tight mt-1 truncate">
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Edit button */}
          {onEdit && (
            <div
              role="button"
              aria-label={editLabel}
              onClick={onEdit}
              className="w-9 h-9 flex items-center justify-center active:bg-white/15 transition-colors"
              style={{ borderRadius: '2px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L16.5 3 21 7.5 7.5 21H3v-4.5z" />
              </svg>
            </div>
          )}
          {hasWorkout && (
            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// Day-name row above the monthly grid.
export function MonthDayHeaders({ labels = DAY_NAMES }) {
  return (
    <div className="grid grid-cols-7 gap-1 mb-2">
      {labels.map((d) => (
        <div key={d} className="text-center text-[9px] uppercase font-light py-1" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.9)' }}>{d}</div>
      ))}
    </div>
  );
}

// One cell of the monthly grid (heatmap block).
//   dateLabel: number in the top-left; label: workout abbreviation
//   inMonth=false: faded (days of the next/previous month)
//   clickable: defaults to hasWorkout (the Calendar only opens workout days)
export function MonthDayCell({
  dateLabel,
  label,
  inMonth = true,
  isToday = false,
  hasWorkout = false,
  isRest = false,
  completed = false,
  skipped = false,
  clickable,
  onClick,
  ariaLabel,
  accentHex = MONTH_ACCENT,
}) {
  const canClick = clickable ?? hasWorkout;
  let bg = 'rgba(255,255,255,0.02)'; // empty / out-of-month default
  if (inMonth && completed) bg = 'rgba(34,197,94,0.32)';
  else if (inMonth && hasWorkout && !skipped) bg = `${accentHex}28`;
  else if (inMonth && skipped) bg = 'rgba(239,68,68,0.10)'; // tinted red so skipped reads at a glance
  else if (inMonth && isRest) bg = 'rgba(148,163,184,0.08)'; // muted blue-grey: visibly different from empty

  const dateNumberColor = isToday
    ? '#fff'
    : inMonth
      ? 'rgba(255,255,255,0.85)'
      : 'rgba(255,255,255,0.4)';
  const labelColor = completed
    ? 'rgba(34,197,94,0.9)'
    : skipped
      ? 'rgba(255,255,255,0.3)'
      : `${accentHex}ee`;

  return (
    <div
      onClick={onClick}
      role={ariaLabel ? 'button' : undefined}
      aria-label={ariaLabel}
      className={`relative min-h-[56px] transition-all ${
        !inMonth ? 'opacity-20' : ''
      } ${canClick ? 'cursor-pointer active:scale-[0.97]' : ''} ${
        isToday ? 'today-white-glow-month' : ''
      }`}
      style={{
        borderRadius: '4px',
        background: bg,
        // The today cell's shadow comes from the .today-white-glow-month
        // class (animated white pulse). Non-today cells get a faint
        // hairline inset so the grid reads as a grid.
        boxShadow: isToday
          ? undefined
          : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* Date number — top-left */}
      <div className="absolute top-1 left-1.5 text-[10px] font-black tracking-tight" style={{ color: dateNumberColor }}>
        {dateLabel}
      </div>
      {/* Workout abbreviation — bottom-right */}
      {hasWorkout && inMonth && (
        <div className="absolute bottom-1 right-1.5 text-[8px] font-bold uppercase truncate max-w-[70%] text-right" style={{ color: labelColor, letterSpacing: '0.05em' }}>
          {label}
        </div>
      )}
      {/* Completed badge — small filled green check, top-right */}
      {completed && inMonth && (
        <div
          aria-label="Completed"
          style={{
            position: 'absolute',
            top: '3px', right: '3px',
            width: '12px', height: '12px',
            borderRadius: '50%',
            background: '#22c55e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 6px rgba(34,197,94,0.55)',
          }}
        >
          <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={4} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      )}
      {/* Skipped indicator — diagonal red slash, more visible than the prior hairline */}
      {skipped && (
        <div
          aria-label="Missed"
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%) rotate(-20deg)',
            width: '70%', height: '1.5px',
            background: 'rgba(239,68,68,0.55)',
          }}
        />
      )}
      {/* Rest indicator (only when explicitly scheduled as rest) */}
      {isRest && inMonth && (
        <div className="absolute bottom-1 right-1.5 text-[8px] font-medium uppercase" style={{ letterSpacing: '0.2em', color: 'rgba(148,163,184,0.7)' }}>
          Rest
        </div>
      )}
    </div>
  );
}

// Legend for the monthly cell states. Same visuals as the cells (Today
// white ring, Completed green check, Scheduled red "WO", Missed diagonal
// slash, Rest label).
export const MONTH_LEGEND_ITEMS = [
  { label: 'Today',     bg: 'transparent', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.95), 0 0 10px rgba(255,255,255,0.3)', dateColor: '#fff' },
  { label: 'Completed', bg: 'rgba(34,197,94,0.32)', dateColor: '#fff', badge: 'check' },
  { label: 'Scheduled', bg: 'rgba(239,68,68,0.16)', dateColor: '#fff', abbr: 'WO' },
  { label: 'Missed',    bg: 'rgba(239,68,68,0.10)', dateColor: '#fff', slash: true },
  { label: 'Rest',      bg: 'rgba(148,163,184,0.08)', dateColor: '#fff', restLabel: true },
];

export function MonthLegend({ items = MONTH_LEGEND_ITEMS }) {
  return (
    <div className="mt-5 px-2 py-3">
      <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-white/40 text-center mb-3">Legend</p>
      <div className="flex items-start justify-around gap-1">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <div
              className="relative w-9 h-9"
              style={{
                background: it.bg,
                borderRadius: '4px',
                boxShadow: it.boxShadow,
              }}
            >
              <span className="absolute top-0.5 left-1 text-[9px] font-black" style={{ color: it.dateColor }}>1</span>
              {it.badge === 'check' && (
                <div style={{
                  position: 'absolute', top: '2px', right: '2px',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#22c55e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 4px rgba(34,197,94,0.55)',
                }}>
                  <svg width="7" height="7" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={4.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
              {it.abbr && (
                <span className="absolute bottom-0.5 right-1 text-[7px] font-bold uppercase" style={{ color: 'rgba(239,68,68,0.9)' }}>{it.abbr}</span>
              )}
              {it.slash && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-20deg)',
                  width: '70%', height: '1.5px',
                  background: 'rgba(239,68,68,0.65)',
                }} />
              )}
              {it.restLabel && (
                <span className="absolute bottom-0 right-0.5 text-[6px] font-medium uppercase" style={{ letterSpacing: '0.15em', color: 'rgba(148,163,184,0.85)' }}>Rest</span>
              )}
            </div>
            <span className="text-[9px] uppercase font-medium text-white/55 tracking-wider text-center leading-tight">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
