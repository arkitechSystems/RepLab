import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { buildProgramColorMap, getColorFromMap } from '../utils/workoutColors';
import StickyHeader from '../components/StickyHeader';
import { iosFocusRef } from '../utils/iosFocus';
import TrainerProfile from '../components/TrainerProfile';
import { getTrainers, getTrainerById } from '../data/trainers';
import { useAuth } from '../context/AuthContext';
import { sharePR } from '../utils/prShare';
import { useTutorial } from '../context/TutorialContext';
import UndoToast from '../components/UndoToast';
import LoadingSpinnerOverlay from '../components/LoadingSpinnerOverlay';
import { track } from '../utils/analytics';

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function CountUp({ to, duration = 1200, delay = 0, pulse, labelDelay }) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!to) return;
    const timeout = setTimeout(() => {
      const start = performance.now();
      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * to));
        if (progress < 1) ref.current = requestAnimationFrame(tick);
        else setDone(true);
      }
      ref.current = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timeout); if (ref.current) cancelAnimationFrame(ref.current); };
  }, [to, duration, delay]);
  return { value, done };
}

function StatNumber({ to, duration, delay, pulse, color, label, topLabel }) {
  const { value, done } = CountUp({ to, duration, delay });
  return (
    <div style={{ textAlign: 'center' }}>
      {topLabel && (
        <div style={{
          fontSize: '8px', color, marginBottom: '3px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600,
          opacity: done ? 1 : 0, transition: 'opacity 0.4s ease',
        }}>
          {topLabel}
        </div>
      )}
      <div style={{
        fontSize: '28px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui',
        animation: pulse && done ? 'statPulse 0.4s ease-out' : 'none',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '8px', color, marginTop: '3px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600,
        opacity: done ? 1 : 0, transition: 'opacity 0.4s ease',
      }}>
        {label}
      </div>
    </div>
  );
}

const CARD_BORDER_STYLE = {
  border: '0.75px solid rgba(255,255,255,0.3)',
  boxShadow: '0 0 20px rgba(255,255,255,0.07), 0 0 40px rgba(255,255,255,0.03)',
};

// Flip card for the Workout Library list. Combines Brainstorm demo #8
// (flip card) with demo #7 (3D mouse-tilt + spotlight). Tap card to flip.
// On desktop the card tilts toward the cursor with a moving highlight; on
// mobile mousemove doesn't fire so only the flip animates.
function LibraryFlipCard({ program, programColor, idx, isFlipped, onFlip, onView, navigate, openBeginProgram, dataTutorial }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onMove = (e) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setTilt({
      x: (e.clientX - r.left) / r.width - 0.5,
      y: (e.clientY - r.top) / r.height - 0.5,
    });
  };
  const reset = () => setTilt({ x: 0, y: 0 });

  const TILT_MAX = 12;
  const tiltX = -tilt.y * TILT_MAX;
  const tiltY = tilt.x * TILT_MAX;
  const flipY = isFlipped ? 180 : 0;
  // Decoupled transforms: tilt lives on an outer wrapper with a fast (0.1s)
  // transition for cursor-follow snappiness; flip lives on the inner wrapper
  // with the slow (0.7s) transition that matches Brainstorm demo #8.
  const tiltTransform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  const flipTransform = `rotateY(${flipY}deg)`;
  // Red mouse-follow spotlight on a near-black surface — matches the
  // brainstorm tilt demo #7 aesthetic exactly.
  const spotlight = `radial-gradient(circle at ${(tilt.x + 0.5) * 100}% ${(tilt.y + 0.5) * 100}%, rgba(239,68,68,0.25), transparent 50%)`;

  const FACE_BG = 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)';
  const FACE_BORDER = '1px solid rgba(255,255,255,0.10)';
  const FACE_SHADOW = '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)';
  const FlipHint = () => (
    <span className="absolute bottom-2 right-3 text-[9px] text-white/60 uppercase tracking-wider pointer-events-none">
      Tap to flip
    </span>
  );

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={reset}
      data-tutorial={dataTutorial}
      className="snap-start shrink-0 w-full wf-flip-outer fade-slide-up"
      style={{ animationDelay: `${idx * 60}ms`, height: '210px' }}
    >
      {/* Tilt wrapper — fast transition for cursor-follow. */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: tiltTransform,
          transition: 'transform 0.1s ease-out',
        }}
      >
      <div
        className="wf-flip-inner"
        style={{
          transform: flipTransform,
          // 0.7s matches Brainstorm demo #8's flip animation.
          transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* FRONT */}
        <div
          onClick={() => onFlip(program.id)}
          className="wf-flip-face cursor-pointer"
          style={{ background: FACE_BG, border: FACE_BORDER, boxShadow: FACE_SHADOW, borderRadius: '2px' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: spotlight, borderRadius: '2px' }} />
          <div className="h-[3px] relative" style={{ background: `linear-gradient(90deg, ${programColor}, ${programColor}40)` }} />
          <div className="relative p-6 pb-7 h-full flex flex-col">
            <h4 className="text-[24px] font-black text-white leading-[1.05] tracking-tight mb-3 uppercase" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
              {program.name}
            </h4>
            <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 mb-5">
              <span className="text-[11px] text-white/80 font-light">{program.weekCount} {program.weekCount === 1 ? 'week' : 'weeks'}</span>
              <span className="text-white/40 text-[11px] leading-none select-none">·</span>
              <span className="text-[11px] text-white/80 font-light">{program.workoutCount} workouts</span>
              {program.programType && program.programType !== 'other' && (
                <>
                  <span className="text-white/40 text-[11px] leading-none select-none">·</span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                    style={
                      program.programType === 'glute_focused'
                        ? { background: '#ec4899', color: '#ffffff', boxShadow: '0 4px 12px rgba(236,72,153,0.35)' }
                        : { background: '#e8eaed', color: '#000000', boxShadow: '0 4px 12px rgba(255,255,255,0.10)' }
                    }
                  >{
                    program.programType === 'strength_conditioning' ? 'Shred'
                    : program.programType === 'hypertrophy_strength' ? 'Hyp & Str'
                    : program.programType === 'glute_focused' ? 'Glute-Focused'
                    : program.programType
                  }</span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (program.isFeatured) {
                    navigate('/featured-session');
                  } else {
                    onView(program.id);
                  }
                }}
                className="flex-1 py-2.5 rounded-full border border-white/40 text-[10px] text-white uppercase tracking-[0.2em] font-medium active:bg-white/10 transition-colors"
              >
                View Program
              </button>
              <button
                data-tutorial={idx === 0 ? 'begin-program-btn' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (program.isFeatured) {
                    navigate('/featured-session');
                  } else if (program.workoutCount > 0) {
                    openBeginProgram(e, program);
                  }
                }}
                className="flex-1 py-2.5 rounded-full border border-white/40 text-[10px] text-white uppercase tracking-[0.2em] font-medium active:bg-white/10 transition-colors"
              >
                Begin
              </button>
            </div>
            <FlipHint />
          </div>
        </div>

        {/* BACK */}
        <div
          onClick={() => onFlip(program.id)}
          className="wf-flip-face wf-flip-back cursor-pointer"
          style={{ background: FACE_BG, border: FACE_BORDER, boxShadow: FACE_SHADOW, borderRadius: '2px' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: spotlight, borderRadius: '2px' }} />
          <div className="h-[3px] relative" style={{ background: `linear-gradient(90deg, ${programColor}, ${programColor}40)` }} />
          <div className="relative p-6 pb-7 h-full flex flex-col">
            {/* Abbreviated program name as the heading on the back face.
                Falls back to the full name when no shortName is set in the
                abbreviations table. */}
            <h4
              className="text-[18px] font-black text-white leading-[1.1] tracking-tight uppercase mb-2"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
            >
              {program.shortName || program.name}
            </h4>
            <p className="text-[10px] uppercase font-bold text-white/70 mb-2" style={{ letterSpacing: '0.25em' }}>
              Program Description
            </p>
            <p
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] text-white/90 leading-relaxed flex-1 mb-3 overflow-y-auto scrollbar-hide"
              style={{
                minHeight: 0,
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {program.description || 'No description available yet for this program.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (program.isFeatured) {
                    navigate('/featured-session');
                  } else {
                    onView(program.id);
                  }
                }}
                className="flex-1 py-2.5 rounded-full border border-white/40 text-[10px] text-white uppercase tracking-[0.2em] font-medium active:bg-white/10 transition-colors"
              >
                View Program
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (program.isFeatured) {
                    navigate('/featured-session');
                  } else if (program.workoutCount > 0) {
                    openBeginProgram(e, program);
                  }
                }}
                className="flex-1 py-2.5 rounded-full border border-white/40 text-[10px] text-white uppercase tracking-[0.2em] font-medium active:bg-white/10 transition-colors"
              >
                Begin
              </button>
            </div>
            <FlipHint />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// Stat — cardless (sits directly on the page background, matching brainstorm demo #5).
// A word above the number and another below it.
function OdometerStat({ value, labelTop, labelBottom, delay = 0 }) {
  const { value: n } = CountUp({ to: value, duration: 1400, delay });
  const labelCls = 'text-[9px] text-white/40 uppercase font-bold';
  const labelStyle = { letterSpacing: '0.25em' };
  return (
    <div className="text-center py-0">
      <p className={labelCls} style={labelStyle}>{labelTop}</p>
      <div
        className="text-3xl font-black tabular-nums my-1.5"
        style={{
          fontFamily: 'system-ui',
          lineHeight: 1,
          background: 'linear-gradient(180deg, #fff, #fff 50%, #888)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        }}
      >
        {n.toLocaleString()}
      </div>
      <p className={labelCls} style={labelStyle}>{labelBottom}</p>
    </div>
  );
}

// Weekly volume bar chart rendered at the bottom of the main Workouts page.
// Ported from Brainstorm sandbox card #6. Each day column shows the
// abbreviated workout name from the user's weekly schedule (or "REST" /
// "OFF" if the day is a rest day or has nothing scheduled). Self-fetches
// its own Sun→Sat range so callers don't need to widen the parent fetch.
function abbrevTemplateName(name) {
  if (!name) return '';
  // First word, capped at 5 chars, all-caps. Good enough as a default;
  // refine later if specific programs need a smarter mapping.
  return name.trim().split(/\s+/)[0].slice(0, 5).toUpperCase();
}

// Per-day visual states. Mirrors the monthly Calendar legend so users see
// the same conventions (completed, scheduled, missed, rest) on the weekly
// strip. Today gets a red border on top of any of these.
const STATE_BG = {
  completed: 'rgba(34,197,94,0.18)',
  scheduled: 'rgba(239,68,68,0.16)',
  missed:    'rgba(239,68,68,0.10)',
  rest:      'rgba(148,163,184,0.10)',
  off:       'rgba(255,255,255,0.05)',
};

function WorkoutsWeeklyBarChart({ templates = [] }) {
  const [mounted, setMounted] = useState(false);
  const [weekSchedule, setWeekSchedule] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  // Compute Sunday-of-current-week → Saturday range and fetch schedule.
  const { weekDates, todayIdx, todayStr } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return fmt(d);
    });
    return { weekDates: dates, todayIdx: today.getDay(), todayStr: fmt(today) };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api(`/schedule?from=${weekDates[0]}&to=${weekDates[6]}`).catch(() => []),
      api('/sessions/completed').catch(() => []),
    ]).then(([sched, completed]) => {
      if (cancelled) return;
      setWeekSchedule(sched || []);
      setCompletedSessions(completed || []);
    });
    return () => { cancelled = true; };
  }, [weekDates]);

  const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div>
      <div className="flex items-end gap-2 h-[640px]">
        {weekDates.map((date, i) => {
          const isToday = date === todayStr;
          const isPast = date < todayStr;
          const entry = weekSchedule.find((s) => s.date === date);
          const completedHere = entry?.templateId
            && completedSessions.some((c) => c.templateId === entry.templateId && c.date === date);

          let state;
          let label;
          if (entry?.isRest) {
            state = 'rest';
            label = 'REST';
          } else if (completedHere) {
            state = 'completed';
            const tmpl = templates.find((t) => t.id === entry.templateId);
            label = abbrevTemplateName(entry.templateName || tmpl?.name);
          } else if (!entry?.templateId) {
            state = 'off';
            label = 'OFF';
          } else if (isPast) {
            state = 'missed';
            const tmpl = templates.find((t) => t.id === entry.templateId);
            label = abbrevTemplateName(entry.templateName || tmpl?.name);
          } else {
            state = 'scheduled';
            const tmpl = templates.find((t) => t.id === entry.templateId);
            label = abbrevTemplateName(entry.templateName || tmpl?.name);
          }

          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="relative w-full flex-1 rounded flex items-center justify-center px-1 text-center"
                style={{
                  background: STATE_BG[state],
                  // Today gets a red inset border ring; otherwise a subtle white edge.
                  boxShadow: isToday ? 'inset 0 0 0 2px #ef4444' : 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                }}
              >
                <span
                  className={`text-[9px] font-bold uppercase leading-tight tracking-tight break-all ${
                    state === 'completed' ? 'text-white' : state === 'rest' ? 'text-white/45' : state === 'off' ? 'text-white/35' : 'text-white/75'
                  }`}
                  style={state === 'missed' ? { textDecoration: 'line-through', textDecorationColor: 'rgba(239,68,68,0.85)' } : undefined}
                >
                  {label}
                </span>
                {state === 'completed' && (
                  <div
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 12, height: 12, borderRadius: '50%',
                      background: '#22c55e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 6px rgba(34,197,94,0.55)',
                    }}
                  >
                    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={4.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                )}
              </div>
              {/* 4px marker bar — red + glow for today, dim white otherwise. */}
              <div
                className="w-full rounded origin-bottom"
                style={{
                  height: 4,
                  background: isToday ? 'linear-gradient(180deg, #ef4444, #dc2626)' : 'rgba(255,255,255,0.25)',
                  animation: mounted ? `wf-barRise 0.6s cubic-bezier(0.2,0.9,0.2,1) ${i * 80}ms both` : 'none',
                  boxShadow: isToday ? '0 0 10px rgba(239,68,68,0.55)' : 'none',
                }}
              />
              <span className={`text-[10px] font-bold ${isToday ? 'text-wf-red' : 'text-white/40'}`}>{dayLetters[i]}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-white/40 mt-3 uppercase font-bold tracking-[0.25em] text-center">Week at a Glance</p>
    </div>
  );
}

// Short names shown in the weekly-view StickyHeader (next to "Begin Program").
// Display short names now come from the program_name_abbreviations DB table
// — populated by the seed in server/initDb.js. The API ships them as
// program.shortName; render sites use `program.shortName || program.name`
// so a missing row falls back to the full name. To change an abbreviation,
// edit the seed in initDb.js and let it ON CONFLICT-update on next boot.

// Expandable program metadata card shown above the weekly grid on the
// program-detail screen. Source of truth is `programs.program_details`
// (JSONB) populated by per-program migrations from the workbook's
// Program Description sheet. Keys are rendered in a stable order with
// any extras appended.
const PROGRAM_DETAIL_ORDER = [
  'Source', 'Author', 'Main Goal', 'Training Level',
  'Program Duration', 'Days Per Week', 'Time Per Workout', 'Equipment',
  'Workout Link', 'Program',
];

function ProgramDetailsCard({ details }) {
  const [expanded, setExpanded] = useState(false);
  if (!details || typeof details !== 'object') return null;

  const overview = details.Overview || details.overview || '';
  // PDF is rendered as the download button on the hero, not as a raw row.
  // "Main Goal" duplicates the program-type pill on the Browse Library card,
  // so it's filtered out here too.
  const entries = Object.entries(details)
    .filter(([k]) => k !== 'Overview' && k !== 'overview' && k !== 'PDF' && k !== 'Main Goal')
    .sort(([a], [b]) => {
      const ai = PROGRAM_DETAIL_ORDER.indexOf(a);
      const bi = PROGRAM_DETAIL_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  return (
    <div className="glass-card rounded-xl overflow-hidden mb-4" style={CARD_BORDER_STYLE}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between active:bg-white/5 transition-colors"
      >
        <span className="text-[11px] uppercase font-bold tracking-widest text-wf-red">Program Details</span>
        <svg className={`w-4 h-4 text-white/50 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {overview && (
            <p className="text-sm text-white/75 leading-relaxed">{overview}</p>
          )}
          {entries.length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {entries.map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <dt className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{k}</dt>
                  <dd className="text-xs text-white/80 mt-0.5 break-words">
                    {typeof v === 'string' && /^https?:\/\//.test(v) ? (
                      <a href={v} target="_blank" rel="noreferrer" className="text-wf-red underline">Open link</a>
                    ) : (
                      String(v)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}

// Hero card shown at the top of a program's weekly view. Modeled after
// "Category Banner" (card #17 on NikeCardsTest) — heavy display banner with
// a kicker label, giant program name, inline metadata, and an overview
// paragraph below. Red accent throughout (Stoppani uses the purple original
// with red swapped in).
function ProgramOverviewHero({ program, weekCount }) {
  const workoutCount = program.workoutCount || 0;
  // Description card uses the FULL program name. The sticky page title at the
  // top still uses the abbreviated short name (program.shortName) so the
  // header stays compact while the hero shows the canonical name.
  const titleLines = program.name.split(' ');
  // Break long names onto two lines for the banner feel (as in #17).
  const mid = Math.ceil(titleLines.length / 2);
  const line1 = titleLines.slice(0, mid).join(' ').toUpperCase();
  const line2 = titleLines.slice(mid).join(' ').toUpperCase();

  return (
    <div
      className="mb-4 fade-slide-up"
      style={{
        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
        borderRadius: '2px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Diagonal hatch texture — same pattern as banner #17 */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 8px)' }}
      />
      {/* Red spotlight */}
      <div
        className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.14) 0%, transparent 60%)', filter: 'blur(40px)' }}
      />

      <div className="relative px-6 py-7">
        <p className="text-[11px] uppercase font-light" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.7)' }}>
          Program Description
        </p>
        <h2 className="text-[40px] font-black text-white tracking-tight leading-[0.9] mt-2" style={{ fontFamily: 'system-ui' }}>
          {line1}{line2 && <><br />{line2}</>}
        </h2>
        {/* Program description — comes from programs.description in the DB
            (set via per-program migrations). Falls back silently if empty. */}
        {program.description && (
          <p className="text-[13px] text-white/60 font-light mt-3 leading-relaxed">
            {program.description}
          </p>
        )}
        {/* Program-type badge removed — categories now live only on the
            cards in the Workout Library (ProgramCard) so the description
            card here doesn't repeat them. */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(239,68,68,0.8)', letterSpacing: '0.25em' }}>
            {weekCount} {weekCount === 1 ? 'Week' : 'Weeks'}
          </span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span className="text-[10px] font-bold uppercase text-white/50" style={{ letterSpacing: '0.25em' }}>
            {workoutCount} {workoutCount === 1 ? 'Workout' : 'Workouts'}
          </span>
        </div>
      </div>

      {/* Download PDF moved out of the hero — now lives in the back-button
          row above so it doesn't overlap any of the hero copy. */}
    </div>
  );
}

// Horizontal filter pills with static gradient fade affordances on both
// edges — always visible as a scroll hint, regardless of overflow state.
//
// Pill visuals mirror the type pills on the library cards:
//   • glute_focused → pink (#ec4899) background with white letters
//   • everything else → white background with black letters
// Selected state pops contrast: deeper pink for glute, black-on-white
// inverts to white-on-black, so the active filter is unambiguous.
function FilterPillsRow({ filters, value, onChange }) {
  return (
    <div className="relative -mx-4 mb-3">
      <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-hide">
        {filters.map((f) => {
          const isGlute = f.value === 'glute_focused';
          const isActive = value === f.value;
          let style;
          if (isGlute) {
            style = isActive
              ? { background: '#000000', color: '#ec4899', boxShadow: '0 4px 14px rgba(236,72,153,0.35)' }
              : { background: '#ec4899', color: '#ffffff', boxShadow: '0 4px 12px rgba(236,72,153,0.35)' };
          } else {
            style = isActive
              ? { background: '#000000', color: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }
              : { background: '#ffffff', color: '#000000', boxShadow: '0 4px 12px rgba(255,255,255,0.10)' };
          }
          return (
            <button
              key={f.value}
              onClick={() => onChange(f.value)}
              style={style}
              className="shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-[0.97]"
            >
              {f.label}
            </button>
          );
        })}
      </div>
      {/* Always-on fade affordances — rendered on both edges regardless of
          overflow so the "continues off-screen" cue is persistent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-2 left-0 w-8"
        style={{ background: 'linear-gradient(to right, #000 0%, transparent 100%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-2 right-0 w-8 flex items-center justify-end pr-1"
        style={{ background: 'linear-gradient(to left, #000 0%, transparent 100%)' }}
      >
        <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </div>
  );
}

function ProgramCard({ program, idx, onSelect, onBegin, onDelete, onShare, dataTutorial, onNavigateFeatured }) {
  return (
    <div
      data-tutorial={dataTutorial}
      onClick={() => program.isFeatured && onNavigateFeatured ? onNavigateFeatured() : onSelect(program.id)}
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
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {program.isFeatured && (
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">Featured</span>
              )}
              {program.programType && program.programType !== 'other' && (
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  program.programType === 'strength' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                  program.programType === 'hypertrophy' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                  program.programType === 'hybrid' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                  program.programType === 'conditioning' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                  program.programType === 'strength_conditioning' ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' :
                  program.programType === 'hypertrophy_strength' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
                  program.programType === 'glute_focused' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' :
                  'bg-white/10 text-wf-gray-400 border-white/10'
                }`}>{
                  program.programType === 'strength_conditioning' ? 'Shred'
                  : program.programType === 'hypertrophy_strength' ? 'Hypertrophy & Strength'
                  : program.programType === 'glute_focused' ? 'Glute-Focused'
                  : program.programType
                }</span>
              )}
            </div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase">{program.name}</h2>
            <p className="text-wf-gray-400 text-sm mt-1">
              {program.weekCount} {program.weekCount === 1 ? 'week' : 'weeks'} &middot; {program.workoutCount} workouts
            </p>
            {program.description && (
              <p className="text-wf-gray-500 text-xs mt-1.5 leading-relaxed line-clamp-2">{program.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {program.workoutCount > 0 && (
              <button
                data-tutorial="begin-program-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (program.isFeatured && onNavigateFeatured) {
                    onNavigateFeatured();
                  } else {
                    onBegin(e, program);
                  }
                }}
                className="text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.2)' }}
              >
                Begin Program
              </button>
            )}
            {onShare && (
              <button
                onClick={(e) => { e.stopPropagation(); onShare(program); }}
                className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center active:bg-blue-500/25 transition-colors"
                title="Share program"
              >
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
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

        {/* Split summary */}
        {program.templates && program.templates.length > 0 && program.templates.length <= 7 && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold mb-1.5">Weekly Split</p>
            <div className="flex gap-1 flex-wrap">
              {program.templates.slice(0, 7).map((t, i) => (
                <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.isRest ? 'bg-white/5 text-wf-gray-600' : 'bg-wf-red/10 text-wf-red'}`}>
                  {t.isRest ? 'Rest' : t.name.length > 15 ? t.name.substring(0, 15) + '…' : t.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Workout preview dots — unique names only, max 6 shown */}
        {(() => {
          const entries = [...program.colorMap.entries()];
          const shown = entries.slice(0, 6);
          const extra = entries.length - 6;
          return (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {shown.map(([name, color]) => (
                <div key={name} className="flex items-center gap-1.5 max-w-[25ch]">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} />
                  <span className="text-xs text-wf-gray-400 font-medium capitalize truncate">{name}</span>
                </div>
              ))}
              {extra > 0 && (
                <span className="text-[10px] text-wf-gray-500 font-medium">+{extra} more</span>
              )}
            </div>
          );
        })()}

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

// Featured hero counter — tweens from 0 to target over `duration`ms when `visible` is true.
// Remove along with the animated featured hero card if reverting.
function AnimatedCounter({ target, visible, duration = 1200 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let rafId;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, visible, duration]);
  return <>{val}</>;
}

export default function Workouts() {
  const { user } = useAuth();
  const { tutorial, startTutorial, completeTutorialAction, skipTutorial } = useTutorial();
  const isPremium = user?.plan && user.plan !== 'Free';
  const [showPremiumGate, setShowPremiumGate] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [challengeTab, setChallengeTab] = useState('active');
  const [challengeAccordion, setChallengeAccordion] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null); // 'browse' | 'my' | 'partners' | 'featured' | null
  const [featuredTransition, setFeaturedTransition] = useState(null); // 'card' | 'full' | 'logo' | 'fade' | null
  const [featuredCardRect, setFeaturedCardRect] = useState(null);
  const featuredCardRef = useRef(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [previewWorkout, setPreviewWorkout] = useState(null); // template object for detail view
  const [bioExpanded, setBioExpanded] = useState(false);
  const [expandedWorkoutCard, setExpandedWorkoutCard] = useState(null);
  const [expandedExercises, setExpandedExercises] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseFilter, setBrowseFilter] = useState('all');
  // Set of programIds whose library card is showing its back face. Tap toggles.
  const [flippedLibraryCards, setFlippedLibraryCards] = useState(() => new Set());
  const toggleLibraryFlip = (id) => setFlippedLibraryCards((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [streak, setStreak] = useState(0);
  const [streakPhase, setStreakPhase] = useState(0);
  const [prStats, setPrStats] = useState(null);
  const [bodyPartPRs, setBodyPartPRs] = useState([]);
  const [allPRsByMuscle, setAllPRsByMuscle] = useState([]);
  const [expandedPR, setExpandedPR] = useState(null); // key: `${muscle}::${exercise}`
  const [prSortMode, setPrSortMode] = useState('weight'); // 'weight' | 'volume'
  const [lastWorkout, setLastWorkout] = useState(null);
  const [currentProgram, setCurrentProgram] = useState(null); // { name, week }
  const [featuredEnrollment, setFeaturedEnrollment] = useState({ enrolled: false });
  // Featured hero card — counter-roll visibility (animates once when card enters viewport)
  // Uses a callback ref because the Featured view is conditionally rendered —
  // useEffect with ref.current fires too early (before the node exists).
  const [heroStatsVisible, setHeroStatsVisible] = useState(false);
  const heroStatsObserverRef = useRef(null);
  const setHeroStatsRef = useCallback((node) => {
    if (heroStatsObserverRef.current) {
      heroStatsObserverRef.current.disconnect();
      heroStatsObserverRef.current = null;
    }
    if (!node) return;
    // If already in viewport at mount (common for this hero), fire immediately.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setHeroStatsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHeroStatsVisible(true); },
      { threshold: 0.3 }
    );
    observer.observe(node);
    heroStatsObserverRef.current = observer;
  }, []);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(null); // week number (1-based)
  // Begin Program modal state
  const [beginModal, setBeginModal] = useState(null); // program object
  const [beginDateInput, setBeginDateInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [conflictInfo, setConflictInfo] = useState(null); // { conflicts: string[], pendingEntries: [] }
  const [beginSaving, setBeginSaving] = useState(false);
  // Add Workout modal state
  const [addWorkoutModal, setAddWorkoutModal] = useState(null); // template object
  const [addDateInput, setAddDateInput] = useState('');
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const [addConflictInfo, setAddConflictInfo] = useState(null);
  // Share program state
  const [shareModal, setShareModal] = useState(null); // program object
  const [shareInput, setShareInput] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareResult, setShareResult] = useState(null); // { success, message }
  // Invite (share browse workout) state
  const [inviteModal, setInviteModal] = useState(null); // template object
  const [inviteInput, setInviteInput] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [pendingShares, setPendingShares] = useState([]);
  const [undoToast, setUndoToast] = useState(null); // { message, undoFn, commitFn }
  const [acceptedSharesMap, setAcceptedSharesMap] = useState({}); // { programId: { senderName, senderUsername, senderPhoto } }
  const [shareUsers, setShareUsers] = useState([]); // all users for share picker
  const [shareUserSearch, setShareUserSearch] = useState('');
  // Trainer application state
  const [trainerApp, setTrainerApp] = useState(null); // { status, message, created_at } | null
  const [trainerAppLoading, setTrainerAppLoading] = useState(false);
  const [trainerAppMsg, setTrainerAppMsg] = useState('');
  const [showTrainerForm, setShowTrainerForm] = useState(false);
  const [trainerAppSubmitting, setTrainerAppSubmitting] = useState(false);
  // Next workout card state
  const [nextWorkoutInfo, setNextWorkoutInfo] = useState(null);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [workoutsThisMonth, setWorkoutsThisMonth] = useState(0); // { status, templateName, templateId, date, dayLabel }
  const navigate = useNavigate();
  const location = useLocation();
  const beginDateRef = useRef(null);
  const addDateRef = useRef(null);
  const [tutorialPointer, setTutorialPointer] = useState(null); // 'create' | null
  const [pointerRect, setPointerRect] = useState(null);

  // Open a specific section when navigated to with state (e.g. from FeaturedWorkoutSession back button)
  useEffect(() => {
    if (location.state?.openSection) {
      setSelectedGroup(location.state.openSection);
      // Clear the state so it doesn't re-trigger on re-render
      window.history.replaceState({}, '');
    }
  }, [location.key]);

  // Featured video ref
  const featuredVideoRef = useRef(null);
  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const pullDist = useRef(0);
  const [pullOffset, setPullOffset] = useState(0);

  // Check for tutorial pointer in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tutorialPointer') === 'create') {
      setTutorialPointer('create');
      // Clean up URL
      navigate('/', { replace: true });
    }
  }, [location.search]);

  // Measure pointer target after loading completes
  useEffect(() => {
    if (!tutorialPointer || loading) return;
    const tryMeasure = () => {
      const el = document.querySelector('[data-tutorial="create-btn"]');
      if (!el) return;
      requestAnimationFrame(() => {
        setPointerRect(el.getBoundingClientRect());
      });
    };
    const timerId = setTimeout(tryMeasure, 300);
    return () => clearTimeout(timerId);
  }, [tutorialPointer, loading]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Fetch trainer application status when viewing partners page
  useEffect(() => {
    if (selectedGroup !== 'partners' || user?.role === 'trainer') return;
    setTrainerAppLoading(true);
    api('/auth/trainer-application')
      .then(data => { setTrainerApp(data.application); })
      .catch(() => {})
      .finally(() => setTrainerAppLoading(false));
  }, [selectedGroup, user?.role]);

  async function fetchData(opts = {}) {
    // Use local date parts to avoid UTC timezone shift
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const [progs, tmpls, sessions, shares, accepted, prStatsData, scheduleData, completedData, bodyPartPRData, allPRsByMuscleData] = await Promise.all([
      api('/programs', opts), api('/templates', opts), api('/sessions', opts),
      api('/sharing/pending', opts).catch(() => []), api('/sharing/accepted', opts).catch(() => ({})),
      api('/pbs/stats', opts).catch(() => null),
      api(`/schedule?from=${todayStr}&to=${tomorrowStr}`, opts).catch(() => []),
      api('/sessions/completed', opts).catch(() => []),
      api('/pbs/by-body-part', opts).catch(() => []),
      api('/pbs/all-by-muscle', opts).catch(() => []),
    ]);

    // Lazy-fetch featured enrollment — only if a featured program exists
    let fullScheduleData = null;
    const featuredProg = progs.find(p => p.isFeatured);
    if (featuredProg) {
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 90);
      const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
      fullScheduleData = await api(`/schedule?from=${todayStr}&to=${futureDateStr}`, opts).catch(() => []);
    }
    setPrStats(prStatsData);
    setBodyPartPRs(bodyPartPRData || []);
    setAllPRsByMuscle(allPRsByMuscleData || []);
    const restTemplateIds = new Set(tmpls.filter(t => t.isRest).map(t => t.id));
    const nonRestCompleted = completedData.filter(c => !restTemplateIds.has(c.templateId));
    setTotalWorkouts(nonRestCompleted.length);
    const monthPrefix = todayStr.slice(0, 7); // "YYYY-MM"
    setWorkoutsThisMonth(nonRestCompleted.filter(c => c.date && c.date.startsWith(monthPrefix)).length);

    // Compute last workout
    if (nonRestCompleted.length > 0) {
      const sorted = [...nonRestCompleted].sort((a, b) => b.date.localeCompare(a.date));
      const last = sorted[0];
      const tmpl = tmpls.find(t => t.id === last.templateId);
      const daysAgo = Math.floor((today - new Date(last.date + 'T00:00:00')) / 86400000);
      const ago = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
      setLastWorkout({ name: tmpl?.name || 'Workout', ago });
    }

    setPrograms(progs);
    setTemplates(tmpls);
    setPendingShares(shares || []);
    setAcceptedSharesMap(accepted || {});

    // Compute next workout info
    const todaySchedule = scheduleData.find(s => s.date === todayStr);
    const tomorrowSchedule = scheduleData.find(s => s.date === tomorrowStr);
    const todayCompleted = todaySchedule && todaySchedule.templateId
      ? completedData.some(c => c.templateId === todaySchedule.templateId && c.date === todayStr)
      : false;
    const todayStarted = todaySchedule && todaySchedule.templateId && !todaySchedule.isRest
      ? sessions.some(s => s.templateId === todaySchedule.templateId && s.date === todayStr)
      : false;

    if (todaySchedule && todaySchedule.templateId && !todaySchedule.isRest && !todayCompleted) {
      // Today has an active workout that's not completed
      setNextWorkoutInfo({
        status: todayStarted ? 'resume' : 'start',
        templateName: todaySchedule.templateName,
        templateId: todaySchedule.templateId,
        date: todayStr,
        dayLabel: 'Today',
      });
    } else if (todaySchedule && todaySchedule.isRest && !todayCompleted) {
      // Today is a rest day — show that first before looking at tomorrow
      setNextWorkoutInfo({ status: 'rest', dayLabel: 'Today' });
    } else {
      // Today is done/empty — look at tomorrow
      if (tomorrowSchedule && tomorrowSchedule.templateId && !tomorrowSchedule.isRest) {
        setNextWorkoutInfo({
          status: 'upcoming',
          templateName: tomorrowSchedule.templateName,
          templateId: tomorrowSchedule.templateId,
          date: tomorrowStr,
          dayLabel: 'Tomorrow',
        });
      } else if (tomorrowSchedule && tomorrowSchedule.isRest) {
        setNextWorkoutInfo({ status: 'rest', dayLabel: 'Tomorrow' });
      } else {
        setNextWorkoutInfo({ status: 'none' });
      }
    }

    // Compute current program from today's or tomorrow's scheduled template
    const activeSchedule = todaySchedule?.templateId ? todaySchedule : (tomorrowSchedule?.templateId ? tomorrowSchedule : null);
    if (activeSchedule) {
      const tmpl = tmpls.find(t => t.id === activeSchedule.templateId);
      if (tmpl && tmpl.programId) {
        const prog = progs.find(p => p.id === tmpl.programId);
        if (prog) {
          // Compute week from sortOrder (7 days per week, 0-indexed)
          const week = Math.floor((tmpl.sortOrder || 0) / 7) + 1;
          setCurrentProgram({ name: prog.name, week });
        } else {
          setCurrentProgram(null);
        }
      } else {
        setCurrentProgram(null);
      }
    } else {
      setCurrentProgram(null);
    }

    // Compute featured program enrollment — check if user has scheduled featured workouts
    if (featuredProg) {
      const featuredTemplateIds = new Set(tmpls.filter(t => t.programId === featuredProg.id).map(t => t.id));
      const completedTemplateIds = new Set(completedData.map(c => `${c.templateId}-${c.date}`));
      // Find scheduled featured workouts from today onwards that are not completed and not rest days
      const upcomingFeatured = (fullScheduleData || [])
        .filter(s => s.templateId && featuredTemplateIds.has(s.templateId) && !s.isRest)
        .filter(s => !completedTemplateIds.has(`${s.templateId}-${s.date}`))
        .sort((a, b) => a.date.localeCompare(b.date));

      const hasAnyScheduled = (fullScheduleData || []).some(s => featuredTemplateIds.has(s.templateId));

      if (hasAnyScheduled && upcomingFeatured.length > 0) {
        const next = upcomingFeatured[0];
        const nextTmpl = tmpls.find(t => t.id === next.templateId);
        const groupToDay = {
          wills_hypertrophy_chest_a: 'chest', wills_hypertrophy_chest_b: 'chest',
          wills_hypertrophy_bis_rds_a: 'bis-rds', wills_hypertrophy_bis_rds_b: 'bis-rds',
          wills_hypertrophy_quads_a: 'quads', wills_hypertrophy_quads_b: 'quads',
          wills_hypertrophy_tris_shoulders_a: 'tris-shoulders', wills_hypertrophy_tris_shoulders_b: 'tris-shoulders',
          wills_hypertrophy_back_traps_a: 'back-traps', wills_hypertrophy_back_traps_b: 'back-traps',
          wills_hypertrophy_glutes_hams_a: 'glutes-hams', wills_hypertrophy_glutes_hams_b: 'glutes-hams',
        };
        const dayKey = nextTmpl ? (groupToDay[nextTmpl.groupId] || null) : null;
        const week = nextTmpl ? Math.floor((nextTmpl.sortOrder || 0) / 7) + 1 : 1;
        setFeaturedEnrollment({ enrolled: true, nextTemplateId: next.templateId, nextDate: next.date, nextDay: dayKey, nextWeek: week });
      } else if (hasAnyScheduled) {
        // Enrolled but all workouts completed
        setFeaturedEnrollment({ enrolled: true, nextTemplateId: null, nextDate: null, nextDay: null, nextWeek: null });
      } else {
        setFeaturedEnrollment({ enrolled: false });
      }
    } else {
      setFeaturedEnrollment({ enrolled: false });
    }

    // Calculate streak — consecutive days with a session going back from today (exclude rest days)
    const nonRestSessions = sessions.filter(s => !restTemplateIds.has(s.templateId));
    const sessionDates = new Set(nonRestSessions.map((s) => s.date));
    let count = 0;
    // Start from today; if today has no session, start from yesterday
    let startDay = new Date(today);
    if (!sessionDates.has(todayStr)) {
      startDay.setDate(startDay.getDate() - 1);
    }
    for (let d = startDay; ; d.setDate(d.getDate() - 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (sessionDates.has(dateStr)) {
        count++;
      } else {
        break;
      }
    }
    setStreak(count);
  }

  async function markRestDay() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ date: todayStr, isRest: true }] }),
      });
      await fetchData();
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to mark rest day:', err);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchData({ signal: controller.signal })
      .catch((err) => { if (err.name !== 'AbortError') setLoadError('Failed to load workouts'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Refresh data when user returns to page (e.g. after completing a workout)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchData().catch(() => {});
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Breathing blob animation for streak card + featured waveform
  const [wavePhase, setWavePhase] = useState(0);
  useEffect(() => {
    if (streak <= 0 && selectedGroup !== 'featured') return;
    const interval = setInterval(() => {
      setStreakPhase(p => (p + 1) % 100);
      setWavePhase(p => (p + 1) % 1000);
    }, 80);
    return () => clearInterval(interval);
  }, [streak, selectedGroup]);

  async function openBeginProgram(e, program) {
    e.stopPropagation();
    setBeginModal(program);
    setBeginDateInput('');
    setConflictInfo(null);
    completeTutorialAction('begin-program-tapped');
  }

  function closeBeginModal() {
    setBeginModal(null);
    setBeginDateInput('');
    setShowDatePicker(false);
    setConflictInfo(null);
  }

  function buildEntries(program, startDate) {
    // Schedule every template in the program. Library programs ship with
    // unique templates per week (e.g. Nippard PPL = 16 weeks × 7 days =
    // 112 templates), so anything less than .templates clips the calendar
    // to a partial program. User-built programs with only a handful of
    // templates still get every template scheduled — same behavior as
    // before for that case.
    const templatesToSchedule = program.templates;
    return templatesToSchedule.map((t, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { date: dateStr, templateId: t.id, isRest: t.isRest || false, displayDate: date };
    });
  }

  async function tryApply(program, startDate) {
    if (!program || beginSaving) return;
    const programId = program.id;
    const entries = buildEntries(program, startDate);
    if (tutorial.active) {
      await applyEntries(entries);
      return;
    }
    setBeginSaving(true);
    try {
      const fromDate = entries[0].date;
      const toDate = entries[entries.length - 1].date;
      const schedule = await api(`/schedule?from=${fromDate}&to=${toDate}`);
      if (beginModal?.id !== programId) return;
      const conflicts = entries
        .filter((e) => schedule.some((s) => s.date === e.date && s.templateId))
        .map((e) => {
          const existing = schedule.find((s) => s.date === e.date && s.templateId);
          const dayLabel = `${DAY_NAMES_FULL[e.displayDate.getDay()]}, ${e.displayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
          return { dayLabel, workoutName: existing?.templateName || 'Unknown workout' };
        });
      if (conflicts.length > 0) {
        setConflictInfo({ conflicts, pendingEntries: entries });
      } else {
        await applyEntries(entries);
      }
    } catch (err) {
      alert(err.message || 'Failed to load schedule. Please try again.');
    } finally {
      setBeginSaving(false);
    }
  }

  async function applyEntries(entries) {
    try {
      if (!tutorial.active) {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: entries.map(({ date, templateId, isRest }) => ({ date, templateId, isRest: isRest || false })) }),
        });
      }
      completeTutorialAction('begin-confirmed');
      closeBeginModal();
      navigate(tutorial.active ? '/calendar?tutorialDone=1' : '/calendar');
    } catch (err) {
      alert(err.message || 'Failed to save schedule. Please try again.');
    }
  }

  async function handleStartToday() {
    if (!beginModal) return;
    await tryApply(beginModal, new Date());
  }

  async function handleBeginDate() {
    if (!beginModal || !beginDateInput) return;
    await tryApply(beginModal, new Date(beginDateInput + 'T00:00:00'));
  }

  function renderExternalShareButtons(workoutName) {
    const text = `I'm doing ${workoutName || 'a workout'} today on RepLab and want you to join! 💪 Check it out at https://will-fit.shop`;
    return (
      <>
        <div className="flex items-center gap-3 mt-4 mb-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] text-wf-gray-500 uppercase tracking-widest font-semibold">Or share externally</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (navigator.share) {
                try { await navigator.share({ text }); } catch {}
              } else {
                try { await navigator.clipboard.writeText(text); alert('Copied to clipboard!'); } catch {}
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 active:bg-blue-500/20 transition-colors"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            <span className="text-xs font-semibold text-blue-400">Share</span>
          </button>
          <button
            onClick={() => {
              const encoded = encodeURIComponent(text);
              window.open(`fb-messenger://share?link=${encodeURIComponent('https://will-fit.shop')}`, '_blank');
              setTimeout(() => window.open(`sms:?&body=${encoded}`, '_blank'), 300);
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 active:bg-purple-500/20 transition-colors"
          >
            <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.908 1.438 5.503 3.688 7.2V22l3.405-1.868c.907.252 1.87.388 2.907.388 5.523 0 10-4.145 10-9.243S17.523 2 12 2zm.997 12.442l-2.548-2.717-4.972 2.717 5.47-5.806 2.612 2.717 4.908-2.717-5.47 5.806z"/>
            </svg>
            <span className="text-xs font-semibold text-purple-400">Messenger</span>
          </button>
          <button
            onClick={() => {
              const encoded = encodeURIComponent(text);
              window.open(`https://ig.me/m?text=${encoded}`, '_blank');
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-pink-500/10 border border-pink-500/20 active:bg-pink-500/20 transition-colors"
          >
            <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
            <span className="text-xs font-semibold text-pink-400">Instagram</span>
          </button>
        </div>
      </>
    );
  }

  // Guard: api() can resolve to {} if the response is 2xx but empty/unparseable
  // (e.g. Vite dev SPA-fallback HTML when the backend is briefly unreachable,
  // or an empty 204). Coerce anything non-array to [] before storing.
  const setShareUsersSafe = (v) => setShareUsers(Array.isArray(v) ? v : []);

  function openShareModal(program) {
    setShareResult(null); setShareInput(''); setShareUserSearch(''); setShareUsers([]); setShareModal(program);
    api('/sharing/users').then(setShareUsersSafe).catch(() => setShareUsers([]));
  }

  function openInviteModal(template) {
    setInviteResult(null); setInviteInput(''); setShareUserSearch(''); setShareUsers([]); setInviteModal(template);
    api('/sharing/users').then(setShareUsersSafe).catch(() => setShareUsers([]));
  }

  async function handleShareProgram() {
    if (!shareInput.trim() || !shareModal) return;
    setShareLoading(true);
    setShareResult(null);
    try {
      const data = await api('/sharing/send', { method: 'POST', body: JSON.stringify({ programId: shareModal.id, recipientIdentifier: shareInput.trim() }) });
      setShareResult({ success: true, message: `Shared with ${data.recipientName}!` });
      setShareInput('');
    } catch (err) {
      setShareResult({ success: false, message: err.message || 'Failed to share' });
    } finally {
      setShareLoading(false);
    }
  }

  async function handleSendInvite() {
    if (!inviteInput.trim() || !inviteModal) return;
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const data = await api('/sharing/invite', { method: 'POST', body: JSON.stringify({ templateId: inviteModal.id, recipientIdentifier: inviteInput.trim() }) });
      setInviteResult({ success: true, message: `Invited ${data.recipientName}!` });
      setInviteInput('');
    } catch (err) {
      setInviteResult({ success: false, message: err.message || 'Failed to invite' });
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleAcceptShare(shareId) {
    try {
      const result = await api(`/sharing/${shareId}/accept`, { method: 'POST' });
      const share = pendingShares.find(s => s.id === shareId);
      setPendingShares(prev => prev.filter(s => s.id !== shareId));

      if (result.type === 'invite' && share) {
        // For workout invites, open the add-to-calendar modal with the template
        const tmpls = await api('/templates');
        setTemplates(tmpls);
        const template = tmpls.find(t => t.id === share.templateId);
        if (template) {
          openAddWorkout(template);
        }
      } else {
        // For program shares, refresh programs and templates
        const [progs, tmpls] = await Promise.all([api('/programs'), api('/templates')]);
        setPrograms(progs);
        setTemplates(tmpls);
      }
    } catch (err) {
      alert(err.message || 'Failed to accept');
    }
  }

  function handleDeclineShare(shareId) {
    const share = pendingShares.find(s => s.id === shareId);
    setPendingShares(prev => prev.filter(s => s.id !== shareId));
    setUndoToast({
      message: `Declined ${share?.programName || share?.templateName || 'workout'}`,
      undoFn: () => {
        if (share) setPendingShares(prev => [...prev, share]);
      },
      commitFn: async () => {
        try {
          await api(`/sharing/${shareId}/decline`, { method: 'POST' });
        } catch (err) {
          // Restore on error
          if (share) setPendingShares(prev => [...prev, share]);
        }
      },
    });
  }

  async function submitTrainerApplication() {
    setTrainerAppSubmitting(true);
    try {
      await api('/auth/apply-trainer', { method: 'POST', body: JSON.stringify({ message: trainerAppMsg }) });
      setTrainerApp({ status: 'pending', message: trainerAppMsg, created_at: new Date().toISOString() });
      setShowTrainerForm(false);
      setTrainerAppMsg('');
    } catch (err) {
      alert(err.message || 'Failed to submit application');
    } finally {
      setTrainerAppSubmitting(false);
    }
  }

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
    if (!template) return;
    try {
      // User-local YYYY-MM-DD — avoids the UTC rollover bug where a user in
      // Sydney logging at 11pm Monday would send Tuesday's date.
      const dateStr = date.toLocaleDateString('en-CA');
      const schedule = await api(`/schedule?from=${dateStr}&to=${dateStr}`);
      const existing = schedule.find((s) => s.date === dateStr && s.templateId);
      if (existing) {
        setAddConflictInfo({
          dayName: `${DAY_NAMES_FULL[date.getDay()]}, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
          workoutName: existing.templateName || 'Unknown workout',
          entry: { date: dateStr, templateId: template.id },
        });
      } else {
        await applyAddWorkout({ date: dateStr, templateId: template.id });
      }
    } catch (err) {
      alert(err.message || 'Failed to add workout. Please try again.');
    }
  }

  async function applyAddWorkout(entry) {
    try {
      if (!tutorial.active) {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: [entry] }),
        });
      }
      closeAddWorkoutModal();
      if (tutorial.active) {
        skipTutorial();
        navigate('/calendar?tutorialDone=1');
      } else {
        navigate('/calendar');
      }
    } catch (err) {
      alert(err.message || 'Failed to save. Please try again.');
    }
  }

  async function handleAddToday() {
    if (!addWorkoutModal) return;
    await tryAddWorkout(addWorkoutModal, new Date());
  }

  async function handleAddDate() {
    if (!addWorkoutModal || !addDateInput) return;
    await tryAddWorkout(addWorkoutModal, new Date(addDateInput + 'T00:00:00'));
  }

  // Build enriched program list by matching templates to their programId
  function getEnrichedPrograms() {
    return programs.map((p) => {
      const programTemplates = (templates || [])
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
  // Browse list excludes featured programs — Will's Hypertrophy lives in the
  // dedicated Featured Workouts card on the homepage instead. Re-include later
  // by dropping the !isFeatured guard.
  // Client-side ordering pin for the Browse Library. Programs not listed
  // here fall to the bottom and keep their existing sort_order. Match by
  // case-insensitive substring so quote/character variants don't break the
  // mapping.
  const BROWSE_LIBRARY_ORDER = [
    'nippard',          // Jeff Nippard's Push Pull Legs
    '5000 rep',         // Muscle & Fitness 5000 Rep Arm Specialization
    'stoppani',         // Jim Stoppani's Shortcut to Shred
    'smolov',           // Smolov Squat & Bench Program
    'mentzer',          // Mike Mentzer Workout
    'summer shred',     // Summer Shred
    'gallant',          // Robin Gallant's Intensive Max Glute Hypertrophy
  ];
  const browseLibraryRank = (p) => {
    const n = (p.name || '').toLowerCase();
    const idx = BROWSE_LIBRARY_ORDER.findIndex((needle) => n.includes(needle));
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  const browsePrograms = enrichedPrograms
    .filter((p) => p.userId === null && !p.isFeatured)
    .slice()
    .sort((a, b) => {
      const ra = browseLibraryRank(a);
      const rb = browseLibraryRank(b);
      if (ra !== rb) return ra - rb;
      // Tie-break for unlisted programs: preserve existing sort_order, then id.
      return (a.sortOrder || 0) - (b.sortOrder || 0) || (a.id - b.id);
    });
  const myPrograms = enrichedPrograms.filter((p) => p.userId !== null);

  // If the active browse-library filter no longer matches any program (e.g., the
  // category was emptied), drop back to 'All' so the user isn't stuck on an
  // invisible filter with zero results.
  const browseAvailableTypes = useMemo(
    () => new Set(browsePrograms.map((p) => p.programType).filter(Boolean)),
    [browsePrograms],
  );
  useEffect(() => {
    if (browseFilter !== 'all' && !browseAvailableTypes.has(browseFilter)) {
      setBrowseFilter('all');
    }
  }, [browseFilter, browseAvailableTypes]);

  // Navigate to the right workout flow based on whether the template belongs to a featured program
  function navigateToWorkout(templateId, date) {
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl && tmpl.programId) {
      const prog = programs.find(p => p.id === tmpl.programId);
      if (prog && prog.isFeatured) {
        // Featured Workout Flow — find the day key from the template's group_id
        const groupToDay = {
          wills_hypertrophy_chest_a: 'chest', wills_hypertrophy_chest_b: 'chest',
          wills_hypertrophy_bis_rds_a: 'bis-rds', wills_hypertrophy_bis_rds_b: 'bis-rds',
          wills_hypertrophy_quads_a: 'quads', wills_hypertrophy_quads_b: 'quads',
          wills_hypertrophy_tris_shoulders_a: 'tris-shoulders', wills_hypertrophy_tris_shoulders_b: 'tris-shoulders',
          wills_hypertrophy_back_traps_a: 'back-traps', wills_hypertrophy_back_traps_b: 'back-traps',
          wills_hypertrophy_glutes_hams_a: 'glutes-hams', wills_hypertrophy_glutes_hams_b: 'glutes-hams',
        };
        const dayKey = groupToDay[tmpl.groupId] || null;
        const week = Math.floor((tmpl.sortOrder || 0) / 7) + 1;
        navigate('/featured-session', { state: { week, day: dayKey, templateId, date } });
        return;
      }
    }
    // Normal Workout Session
    navigate(`/session/${templateId}/${date}`);
  }

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
        if (import.meta.env.DEV) console.error(err);
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
        <StickyHeader title={pw.name} titleStyle={{ fontSize: '26.4px' }} />

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
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${pwColor.dot}`} />
                <h2 className="text-xl font-black text-white">{pw.name}</h2>
              </div>
              <button
                onClick={() => openAddWorkout(pw)}
                className="btn-gradient active:scale-[0.98] text-white font-medium px-3 py-2 rounded-xl text-xs transition-all shrink-0"
              >
                Add Workout
              </button>
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

                {(ex.sets || []).map((set, setIdx) => (
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
          <StickyHeader title={program.shortName || program.name} titleStyle={{ fontSize: '26.4px' }}>
            {program.workoutCount > 0 && (
              <button
                data-tutorial="begin-program-btn"
                onClick={(e) => openBeginProgram(e, program)}
                className="shrink-0 text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.2)' }}
              >
                Begin Program
              </button>
            )}
          </StickyHeader>

          {/* Back button row — Download PDF (when available) sits on the right
              edge so it doesn't overlap any hero copy. */}
          <div className="px-4 mb-3 flex items-center justify-between gap-3">
            <button
              onClick={() => { setSelectedProgram(null); setSelectedWeek(null); }}
              className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              {selectedGroup === 'browse' ? 'Workout Library' : selectedGroup === 'my' ? 'My Workouts' : 'All Workouts'}
            </button>
            {program.programDetails?.PDF && (
              <a
                href={encodeURI(program.programDetails.PDF)}
                download
                target="_blank"
                rel="noreferrer"
                className="active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase px-3.5 py-2 whitespace-nowrap"
                style={{
                  letterSpacing: '0.15em',
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                ↓ Download PDF
              </a>
            )}
          </div>

          <div className="px-4">
            <ProgramOverviewHero program={program} weekCount={weeks.length} />
            {program.programDetails && Object.keys(program.programDetails).length > 0 && (
              <ProgramDetailsCard details={program.programDetails} />
            )}
            <div className="space-y-4 pb-4">
              {(() => {
                // Track which phases have already appeared so we only show a
                // divider for their first occurrence. Programs whose phase
                // alternates every week (e.g. M&F 5000's Blast/Cruise) would
                // otherwise get a divider before every card.
                const phaseFirstSeen = new Set();
                return weeks.map((weekTemplates, wIdx) => {
                const weekNum = wIdx + 1;
                const weekWorkouts = weekTemplates.filter((t) => !t.isRest);
                // Get unique workout color dots for this week
                const uniqueNames = [];
                weekWorkouts.forEach((t) => {
                  const key = t.name.toLowerCase().replace(/\s*\(week\s*\d+\)\s*/gi, '').trim();
                  if (!uniqueNames.includes(key)) uniqueNames.push(key);
                });

                // Phase label — surface as (a) an inline tag on every week
                // card that has a phase and (b) a divider above the first
                // week where this phase appears in the program.
                const thisPhase = weekWorkouts.find((t) => t.phase)?.phase
                  || weekTemplates.find((t) => t.phase)?.phase
                  || null;
                const showPhaseHeader = thisPhase && !phaseFirstSeen.has(thisPhase);
                if (thisPhase) phaseFirstSeen.add(thisPhase);

                return (
                  <div key={`week-${wIdx}`} className="space-y-3">
                  {showPhaseHeader && (
                    <div className={wIdx === 0 ? '' : 'pt-3'}>
                      <div className="flex items-center gap-3 px-1">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-wf-red/50 to-wf-red/50" />
                        <span className="text-[10px] font-black tracking-[0.3em] uppercase text-wf-red">
                          {thisPhase}
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-wf-red/50 to-wf-red/50" />
                      </div>
                    </div>
                  )}
                  {/*
                    NEW (2026-04-25): week cards restyled to match the
                    Featured Program (Will's Hypertrophy) week cards. Removed
                    the colored top strip + ambient red spotlight + 44px week
                    number block; replaced with the featured-style compact
                    "WEEK X" header + workout-names list + chevron. The
                    previous "classic" style is preserved in git history —
                    revert this hunk on commit/branch to restore.
                  */}
                  <div
                    key={wIdx}
                    data-tutorial={wIdx === 0 ? 'week-card' : undefined}
                    onClick={() => { setSelectedWeek(weekNum); if (tutorial.active) completeTutorialAction('week-selected'); }}
                    style={{
                      animationDelay: `${wIdx * 60}ms`,
                      background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                      borderRadius: '2px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    className="w-full text-left active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
                  >
                    <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div className="min-w-0">
                        <div className="text-[18px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui' }}>
                          WEEK {weekNum}
                        </div>
                        {thisPhase && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-wf-red mt-0.5" style={{ letterSpacing: '0.2em' }}>
                            {thisPhase}
                          </p>
                        )}
                        <div className="text-[11px] text-white/25 font-light mt-1 truncate">
                          {weekTemplates
                            .filter((t) => !t.isRest)
                            .map((t) => t.name.replace(/\s*\(week\s*\d+\)\s*/gi, '').trim())
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedGroup === 'my' && weeks.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteWeek(program, wIdx); }}
                            className="w-8 h-8 flex items-center justify-center active:bg-red-500/25 transition-colors"
                            style={{ borderRadius: '2px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                            title="Delete week"
                          >
                            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        )}
                        <svg className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  </div>
                );
                });
              })()}
            </div>
          </div>

          {renderBeginModals()}
        </div>
      );
    }

    // Show workouts for selected week
    const weekTemplates = weeks[selectedWeek - 1] || [];
    const weekTitle = `${program.shortName || program.name} — Week ${selectedWeek}`;

    return (
      <div>
        <StickyHeader title={editMode ? '' : weekTitle} titleStyle={{ fontSize: '26.4px' }}>
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
              {program.userId !== null && (
                <button
                  onClick={() => enterEditMode(program)}
                  aria-label="Edit program"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
                >
                  <svg className="w-4.5 h-4.5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              {program.workoutCount > 0 && (
                <button
                  data-tutorial="begin-program-btn"
                  onClick={(e) => openBeginProgram(e, program)}
                  className="shrink-0 text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.2)' }}
                >
                  Begin Program
                </button>
              )}
              {program.userId !== null && (
                <button
                  onClick={() => navigate(`/clientworkouts/create?programId=${program.id}`)}
                  className="btn-gradient active:scale-[0.98] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shrink-0"
                >
                  Add Workout
                </button>
              )}
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
            {program.shortName || program.name}
          </button>
        </div>

        <div className="px-4">
          <div className="space-y-3 pb-4">
            {weekTemplates.map((t, idx) => {
              const isExpanded = expandedWorkoutCard === t.id;
              return (
                <div
                  key={t.id}
                  style={{
                    animationDelay: `${idx * 60}ms`,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '2px',
                    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                  className="transition-transform fade-slide-up"
                >
                  {/*
                    NEW (2026-04-25): day cards restyled to match the
                    Featured Program week-card aesthetic. Removed the
                    workout-color top strip + ambient colored spotlight
                    + 40px exercise-count number block. Action buttons
                    (Add / Share / Edit / Invite / Delete) and the
                    expand-to-show-exercises behavior are preserved.
                  */}
                  <div
                    onClick={() => {
                      if (editMode || t.isRest) return;
                      setExpandedWorkoutCard(isExpanded ? null : t.id);
                    }}
                    className={(editMode || t.isRest) ? '' : 'cursor-pointer active:scale-[0.99] transition-transform'}
                    style={{ padding: '16px 20px' }}
                  >
                    {/* Title spans the full card width — overlaps the buttons row below visually but truncates safely if too long. */}
                    <div className="text-[17.1px] font-black text-white tracking-tight uppercase truncate" style={{ fontFamily: 'system-ui' }}>
                      {t.name}
                    </div>
                    {/* Bottom row — exercise-count subtitle on the left, action buttons on the right. */}
                    <div className="flex items-center justify-between gap-3 mt-1">
                      <div className="text-[11px] text-white/25 font-light shrink-0">
                        {t.isRest ? 'Rest day' : `${(t.exercises || []).length} ${(t.exercises || []).length === 1 ? 'exercise' : 'exercises'}`}
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {editMode ? (
                      <>
                        <button
                          onClick={() => handleMoveTemplate(program, idx, -1)}
                          disabled={idx === 0}
                          aria-label="Move up"
                          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center disabled:opacity-25 active:bg-white/20 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveTemplate(program, idx, 1)}
                          disabled={idx === weekTemplates.length - 1}
                          aria-label="Move down"
                          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center disabled:opacity-25 active:bg-white/20 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                    {/* Right: action buttons (only when not in editMode and not a rest day) */}
                    {editMode ? (
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        aria-label="Delete workout"
                        className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 active:bg-red-500/40 transition-colors"
                      >
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : !t.isRest ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          data-tutorial={idx === weekTemplates.findIndex(w => !w.isRest) ? 'week-add-btn' : undefined}
                          onClick={() => openAddWorkout(t)}
                          className="active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase px-3.5 py-2 whitespace-nowrap shrink-0"
                          style={{
                            letterSpacing: '0.15em',
                            borderRadius: '2px',
                            background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                            boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                          }}
                        >
                          + Add
                        </button>
                        {program.userId !== null ? (
                          <>
                            <button
                              onClick={() => { openShareModal(program); }}
                              className="active:scale-[0.97] transition-all flex items-center justify-center px-3.5 py-2 whitespace-nowrap shrink-0"
                              style={{
                                borderRadius: '2px',
                                background: 'linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(37,99,235,0.9) 100%)',
                                boxShadow: '0 4px 14px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                              }}
                              title="Share workout"
                            >
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => navigate(`/clientworkouts/edit/${t.id}`)}
                              aria-label="Edit workout"
                              className="w-9 h-9 rounded-lg bg-wf-red/20 flex items-center justify-center shrink-0 active:bg-wf-red/40 transition-colors"
                            >
                              <svg className="w-4 h-4 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { openInviteModal(t); }}
                            className="w-9 h-9 flex items-center justify-center shrink-0 active:bg-blue-500/25 transition-colors"
                            style={{
                              borderRadius: '2px',
                              background: 'rgba(59,130,246,0.12)',
                              border: '1px solid rgba(59,130,246,0.3)',
                            }}
                            title="Invite a friend"
                          >
                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Exercise accordion cards — primary accordion (hidden in edit mode, shown when card expanded) */}
                  {!editMode && !t.isRest && expandedWorkoutCard === t.id && (t.exercises || []).length > 0 && (
                    <div className="relative border-t border-white/10 px-4 py-4 space-y-2">
                      {t.exercises.map((ex, exIdx) => {
                        if (ex.isSectionHeader) {
                          return (
                            <div key={`section-${exIdx}`} className="rounded-xl overflow-hidden border border-white/10 bg-gradient-to-r from-wf-red/10 via-transparent to-transparent">
                              <div className="px-4 py-3 flex items-center gap-3">
                                <div className="w-1 h-6 rounded-full bg-wf-red shrink-0" />
                                <span className="text-[9px] text-wf-red uppercase tracking-widest font-bold shrink-0">Section</span>
                                <span className="text-sm font-black text-white uppercase tracking-wide">{ex.name}</span>
                              </div>
                              {ex.sectionNotes && (
                                <div className="px-4 pb-3 pl-8">
                                  <div className="ml-0.5 pl-3 border-l border-white/10">
                                    <p className="text-xs text-wf-gray-400 leading-relaxed">{ex.sectionNotes}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        const exKey = `${t.id}-${ex.name}`;
                        const isExpanded = expandedExercises.has(exKey);
                        const sets = ex.sets || [];
                        const topWeight = Math.max(...sets.map(s => s.suggestedWeight || 0), 0);
                        const reps = ex.repRange || sets[0]?.plannedReps || '—';
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
                                  {sets.length} sets{topWeight > 0 ? ` · ${topWeight} lbs` : ''}{reps !== '—' ? ` · ${reps} reps` : ''}
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
                                {sets.map((set, sIdx) => {
                                  const typeLabel = set.setType === 'warm_up' ? 'WU' : set.setType === 'touch_up' ? 'TU' : set.setType === 'drop' ? 'DS' : set.setType === 'rest_pause' ? 'RP' : set.setType === 'superset' ? 'SS' : set.setType === 'alternating' ? 'Alt' : set.setType === 'pre_exhaust' ? 'PrEx' : 'REG';
                                  const isWarmup = set.setType === 'warm_up' || set.setType === 'touch_up';
                                  return (
                                    <div key={sIdx} className="flex items-center justify-between py-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-wf-gray-500 font-bold w-8">Set {sIdx + 1}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isWarmup ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/5 text-wf-gray-400'}`}>{typeLabel}</span>
                                      </div>
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
                                  );
                                })}
                                {ex.exerciseDescription && (
                                  <div className="pt-2 mt-1 border-t border-white/5">
                                    <p className="text-[11px] text-wf-gray-500 italic leading-relaxed">{ex.exerciseDescription}</p>
                                  </div>
                                )}
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
        {/* Invite Workout Modal (week detail view) */}
        {inviteModal && (
          <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setInviteModal(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative flex-1 flex flex-col mt-12 overflow-hidden animate-drop-down"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red accent line */}
              <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute top-0 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="relative shrink-0 pt-5 pb-4 px-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Partner Up</p>
                    <h3 className="text-[22px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>INVITE TO WORKOUT</h3>
                  </div>
                  <button
                    onClick={() => setInviteModal(null)}
                    aria-label="Close"
                    className="w-7 h-7 flex items-center justify-center active:scale-90 transition-all shrink-0"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="relative flex-1 overflow-y-auto px-6 pb-24">
              <p className="text-[12px] text-white/50 font-light leading-relaxed mb-4">
                Invite someone to do <span className="text-white font-semibold">{inviteModal.name}</span> with you today.
              </p>
              <input
                type="text"
                value={shareUserSearch}
                onChange={(e) => { setShareUserSearch(e.target.value); setInviteResult(null); }}
                placeholder="Search users..."
                className="w-full px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none mb-3"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '2px',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                autoFocus
              />
              {inviteResult && (
                <p className={`text-sm mb-3 ${inviteResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {inviteResult.message}
                </p>
              )}
              <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                {shareUsers
                  .filter(u => !shareUserSearch.trim() || u.name.toLowerCase().includes(shareUserSearch.toLowerCase()) || u.username.toLowerCase().includes(shareUserSearch.toLowerCase()))
                  .map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setInviteInput(u.username || u.name); setInviteResult(null); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${inviteInput === (u.username || u.name) ? 'border' : 'hover:bg-white/5 active:bg-white/10 border border-transparent'}`}
                      style={inviteInput === (u.username || u.name) ? {
                        background: 'rgba(239,68,68,0.12)',
                        borderColor: 'rgba(239,68,68,0.4)',
                        borderRadius: '2px',
                      } : { borderRadius: '2px' }}
                    >
                      {u.photo ? (
                        <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-wf-red to-orange-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-sm font-bold">{(u.name || 'U')[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                        {u.username && <p className="text-xs text-white/50">@{u.username}</p>}
                      </div>
                      {inviteInput === (u.username || u.name) && (
                        <svg className="w-5 h-5 shrink-0 ml-auto" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                {shareUsers.length === 0 && (
                  <p className="text-center text-white/50 text-sm py-4">Loading users...</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteModal(null)}
                  className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all border"
                  style={{
                    background: 'transparent',
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.5)',
                    borderRadius: '2px',
                    letterSpacing: '0.2em',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={inviteLoading || !inviteInput.trim()}
                  className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                    color: '#000',
                    borderRadius: '2px',
                    letterSpacing: '0.2em',
                    boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                  }}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
              {renderExternalShareButtons(inviteModal?.name)}
              </div>
            </div>
          </div>
        )}
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
          {/* Nike-style card — sharp 2px corners, dark gradient, red accent
              line, ambient red spotlight, big tracked eyebrow + title.
              Mirrors the "Your Next Workout" / "My Workouts" cards. */}
          <div
            className="relative overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
            <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

            <div className="relative px-5 pt-5 pb-3">
              <p className="text-[10px] text-white/30 uppercase font-light" style={{ letterSpacing: '0.3em' }}>Create</p>
              <h2 className="text-[26px] font-black text-white tracking-tight mt-1" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                NEW WORKOUT
              </h2>
            </div>
            <div className="border-t border-white/10" />

            <div className="relative p-2 space-y-0.5">
              <button
                onClick={() => { setShowCreateMenu(false); navigate('/clientworkouts/create?quick=1'); }}
                className="w-full text-left p-3 flex items-center gap-3.5 active:scale-[0.98] transition-all hover:bg-white/5 active:bg-white/10"
                style={{ borderRadius: '2px' }}
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: '2px', background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)', boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 20L11 4h2l3 16" />
                    <line x1="9.5" y1="12" x2="14.5" y2="12" />
                    <line x1="8.8" y1="16" x2="15.2" y2="16" />
                    <circle cx="12" cy="8" r="1.8" />
                    <circle cx="10" cy="12" r="1.8" />
                    <circle cx="14" cy="12" r="1.8" />
                    <circle cx="8.8" cy="16.5" r="2" />
                    <circle cx="15.2" cy="16.5" r="2" />
                    <line x1="3" y1="21" x2="21" y2="21" />
                    <circle cx="3" cy="21" r="1" fill="currentColor" />
                    <circle cx="21" cy="21" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11.05px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>Create a Workout</h4>
                  <p className="text-[9.35px] text-white/40 font-light mt-0.5">Build a standalone workout</p>
                </div>
                <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              <div className="border-t border-white/5 mx-3" />
              <button
                onClick={() => { setShowCreateMenu(false); navigate('/programs/create'); }}
                className="w-full text-left p-3 flex items-center gap-3.5 active:scale-[0.98] transition-all hover:bg-white/5 active:bg-white/10"
                style={{ borderRadius: '2px' }}
              >
                <div className="w-10 h-10 bg-wf-blue/20 flex items-center justify-center shrink-0" style={{ borderRadius: '2px' }}>
                  <svg className="w-5 h-5 text-wf-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11.05px] font-bold uppercase text-white tracking-wider" style={{ letterSpacing: '0.1em' }}>New Program</h4>
                  <p className="text-[9.35px] text-white/40 font-light mt-0.5">Create a group of workouts</p>
                </div>
                <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              <div className="border-t border-white/5 mx-3" />
              {/* AI workout generation is shipped behind "Coming soon" until
                  the backend is ready — disabled + grayed out for now.
                  Heroicons cpu-chip used as the AI/circuit-board icon. */}
              <button
                disabled
                aria-disabled="true"
                className="w-full text-left p-3 flex items-center gap-3.5 opacity-50 cursor-not-allowed"
                style={{ borderRadius: '2px' }}
              >
                <div className="btn-liquid w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: '2px' }}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-[11.05px] font-bold uppercase text-white/60 tracking-wider" style={{ letterSpacing: '0.1em' }}>Create a Workout for Me</h4>
                    <span className="btn-liquid text-[7.65px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-[9.35px] text-white/40 font-light mt-0.5">AI-powered personalized workout</p>
                </div>
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
          <div className={`fixed inset-0 flex items-center justify-center px-5 ${tutorial.active ? 'z-[200]' : 'z-50'}`} onClick={closeBeginModal}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              data-tutorial="begin-modal"
              className="relative w-full max-w-sm overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red accent line */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Schedule</p>
                    <h3 className="text-[22px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>BEGIN PROGRAM</h3>
                  </div>
                  <button
                    onClick={closeBeginModal}
                    aria-label="Close"
                    className="w-7 h-7 flex items-center justify-center active:scale-90 transition-all shrink-0"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-[12px] text-white/50 font-light leading-relaxed mb-5">
                  {beginModal.isFeatured
                    ? <>Schedule the full <span className="text-white font-semibold">{beginModal.weekCount}-week {beginModal.name}</span> to your calendar. This will add {beginModal.templates.length} days of workouts and rest days.</>
                    : <>Schedule <span className="text-white font-semibold">{beginModal.name}</span> starting from a day of your choice.</>}
                </p>
                {!showDatePicker ? (
                  <div className="flex gap-3">
                    <button
                      data-tutorial="start-today-btn"
                      onClick={handleStartToday}
                      disabled={beginSaving}
                      className={`flex-1 py-3.5 text-[11px] font-bold uppercase active:scale-[0.97] transition-all ${beginSaving ? 'opacity-50 pointer-events-none' : ''}`}
                      style={{
                        background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                        color: '#000',
                        borderRadius: '2px',
                        letterSpacing: '0.2em',
                        boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                      }}
                    >
                      {beginSaving ? 'Saving...' : 'Start Today'}
                    </button>
                    <button
                      onClick={() => {
                        // flushSync renders the input synchronously so showPicker()
                        // still runs inside the user-gesture window the browser needs.
                        flushSync(() => setShowDatePicker(true));
                        const el = beginDateRef.current;
                        if (el) {
                          el.focus();
                          try { el.showPicker?.(); } catch {}
                        }
                      }}
                      className="flex-1 py-3.5 text-[11px] font-bold uppercase active:scale-[0.97] transition-all border"
                      style={{
                        background: 'transparent',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.5)',
                        borderRadius: '2px',
                        letterSpacing: '0.2em',
                      }}
                    >
                      Choose Date
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="date"
                      value={beginDateInput}
                      min={new Date().toLocaleDateString('en-CA')}
                      onChange={(e) => setBeginDateInput(e.target.value)}
                      className="flex-1 px-3 py-3 text-white text-sm focus:outline-none"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '2px',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      ref={beginDateRef}
                    />
                    <button
                      onClick={handleBeginDate}
                      disabled={!beginDateInput || beginSaving}
                      className="px-5 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all disabled:opacity-40"
                      style={{
                        background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                        color: '#000',
                        borderRadius: '2px',
                        letterSpacing: '0.2em',
                        boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                      }}
                    >
                      Schedule
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {conflictInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setConflictInfo(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-sm overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red accent line */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="relative p-6">
                <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Warning</p>
                <h3 className="text-[22px] font-black text-white tracking-tight mb-3" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>OVERWRITE<br/>WORKOUTS?</h3>
                <p className="text-[12px] text-white/50 font-light leading-relaxed mb-4">
                  {beginModal?.isFeatured
                    ? 'You already have workouts for these dates. Beginning this program will remove them from the calendar:'
                    : 'This will overwrite your current workout on:'}
                </p>
                <ul className="mb-5 space-y-2 max-h-48 overflow-y-auto">
                  {(conflictInfo.conflicts.length > 10 ? conflictInfo.conflicts.slice(0, 8) : conflictInfo.conflicts).map((c) => (
                    <li key={c.dayLabel} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-wf-red mt-1.5 shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-wf-red">{c.dayLabel}</span>
                        <span className="text-xs text-white/50 ml-1">({c.workoutName})</span>
                      </div>
                    </li>
                  ))}
                  {conflictInfo.conflicts.length > 10 && (
                    <li className="text-xs text-white/50 pl-3.5">
                      ...and {conflictInfo.conflicts.length - 8} more workouts
                    </li>
                  )}
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConflictInfo(null)}
                    className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all border"
                    style={{
                      background: 'transparent',
                      borderColor: 'rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.5)',
                      borderRadius: '2px',
                      letterSpacing: '0.2em',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => applyEntries(conflictInfo.pendingEntries)}
                    className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                      color: '#fff',
                      borderRadius: '2px',
                      letterSpacing: '0.2em',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.25)',
                    }}
                  >
                    Overwrite
                  </button>
                </div>
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
          <div className={`fixed inset-0 flex ${tutorial.active ? 'z-[200] items-center justify-center px-5' : 'z-50 items-start justify-center pt-24 px-5'}`} onClick={closeAddWorkoutModal}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className={`relative w-full max-w-sm overflow-hidden ${tutorial.active ? '' : 'animate-drop-down'}`}
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red accent line */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Calendar</p>
                    <h3 className="text-[22px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>ADD WORKOUT</h3>
                  </div>
                  <button
                    onClick={closeAddWorkoutModal}
                    aria-label="Close"
                    className="w-7 h-7 flex items-center justify-center active:scale-90 transition-all shrink-0"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-[12px] text-white/50 font-light leading-relaxed mb-5">
                  Add <span className="text-white font-semibold">{addWorkoutModal.name}</span> to your calendar.
                </p>
                {!showAddDatePicker ? (
                  <div className="flex gap-3">
                    <button
                      onClick={handleAddToday}
                      className="flex-1 py-3.5 text-[11px] font-bold uppercase active:scale-[0.97] transition-all"
                      style={{
                        background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                        color: '#000',
                        borderRadius: '2px',
                        letterSpacing: '0.2em',
                        boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                      }}
                    >
                      Begin Today
                    </button>
                    <button
                      onClick={() => {
                        flushSync(() => setShowAddDatePicker(true));
                        const el = addDateRef.current;
                        if (el) {
                          el.focus();
                          try { el.showPicker?.(); } catch {}
                        }
                      }}
                      className="flex-1 py-3.5 text-[11px] font-bold uppercase active:scale-[0.97] transition-all border"
                      style={{
                        background: 'transparent',
                        borderColor: 'rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.5)',
                        borderRadius: '2px',
                        letterSpacing: '0.2em',
                      }}
                    >
                      Choose Date
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="date"
                      value={addDateInput}
                      min={new Date().toLocaleDateString('en-CA')}
                      onChange={(e) => setAddDateInput(e.target.value)}
                      className="flex-1 px-3 py-3 text-white text-sm focus:outline-none"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '2px',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      ref={addDateRef}
                    />
                    <button
                      onClick={handleAddDate}
                      disabled={!addDateInput}
                      className="px-5 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all disabled:opacity-40"
                      style={{
                        background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                        color: '#000',
                        borderRadius: '2px',
                        letterSpacing: '0.2em',
                        boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                      }}
                    >
                      Schedule
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {addConflictInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={() => setAddConflictInfo(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-sm overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red accent line */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="relative p-6">
                <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Warning</p>
                <h3 className="text-[22px] font-black text-white tracking-tight mb-3" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>OVERWRITE<br/>WORKOUT?</h3>
                <p className="text-[12px] text-white/50 font-light leading-relaxed mb-3">
                  This will replace the current workout on:
                </p>
                <div className="flex items-start gap-2 mb-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-wf-red mt-1.5 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-wf-red">{addConflictInfo.dayName}</span>
                    <span className="text-xs text-white/50 ml-1">({addConflictInfo.workoutName})</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddConflictInfo(null)}
                    className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all border"
                    style={{
                      background: 'transparent',
                      borderColor: 'rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.5)',
                      borderRadius: '2px',
                      letterSpacing: '0.2em',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => applyAddWorkout(addConflictInfo.entry)}
                    className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                      color: '#fff',
                      borderRadius: '2px',
                      letterSpacing: '0.2em',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.25)',
                    }}
                  >
                    Overwrite
                  </button>
                </div>
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
        if (import.meta.env.DEV) console.error(err);
        return;
      }
      // User-local "today" so a user in Asia logging at 11pm doesn't roll over to tomorrow (UTC).
      const dateStr = new Date().toLocaleDateString('en-CA');
      const schedule = await api(`/schedule?from=${dateStr}&to=${dateStr}`);
      const existing = schedule.find((s) => s.date === dateStr && s.templateId);
      if (existing) {
        setAddConflictInfo({
          dayName: `${DAY_NAMES_FULL[new Date().getDay()]}, ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
          workoutName: existing.templateName || 'Unknown workout',
          entry: { date: dateStr, templateId },
        });
      } else {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: [{ date: dateStr, templateId }] }),
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
        if (import.meta.env.DEV) console.error(err);
        return;
      }
      const date = new Date(addDateInput + 'T00:00:00');
      const dateStr = addDateInput;
      const schedule = await api(`/schedule?from=${dateStr}&to=${dateStr}`);
      const existing = schedule.find((s) => s.date === dateStr && s.templateId);
      if (existing) {
        setAddConflictInfo({
          dayName: `${DAY_NAMES_FULL[date.getDay()]}, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
          workoutName: existing.templateName || 'Unknown workout',
          entry: { date: dateStr, templateId },
        });
      } else {
        await api('/schedule', {
          method: 'PUT',
          body: JSON.stringify({ schedule: [{ date: dateStr, templateId }] }),
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
      <div className="pb-24">
        <StickyHeader title="CHALLENGES" titleStyle={{ fontSize: '26.4px' }} />
        <div className="px-4 mb-3">
          <button
            onClick={() => { setSelectedGroup(null); setChallengeTab('active'); setChallengeAccordion(null); }}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All Workouts
          </button>
        </div>

        <div className="px-4">
          {/* Segmented Control — Nike style */}
          <div
            className="flex p-[3px] mb-4"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {['active', 'upcoming', 'completed'].map(tab => {
              const isActive = challengeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => { setChallengeTab(tab); setChallengeAccordion(null); }}
                  className="flex-1 text-[11px] font-bold uppercase py-2.5 active:scale-[0.97] transition-all"
                  style={{
                    borderRadius: '2px',
                    letterSpacing: '0.2em',
                    background: isActive ? 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)' : 'transparent',
                    color: isActive ? '#000' : 'rgba(255,255,255,0.45)',
                    boxShadow: isActive ? '0 4px 14px rgba(255,255,255,0.1)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Active Tab */}
          {challengeTab === 'active' && (
            <div className="space-y-4">
              {/* Challenge Card 1: Max Push-Ups */}
              <div style={{
                borderRadius: '20px', overflow: 'hidden', position: 'relative',
                background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0808 50%, #1a0505 100%)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 40%, rgba(239,68,68,0.2) 0%, transparent 60%)', filter: 'blur(20px)' }} />
                <div style={{ position: 'relative', zIndex: 1, padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontSize: '9px', color: 'rgba(239,68,68,0.7)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700 }}>Active Challenge</div>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(239,68,68,0.8)', letterSpacing: '2px', textTransform: 'uppercase', background: 'rgba(239,68,68,0.12)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>Live</span>
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Max Push-Ups</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>60 seconds — how many can you do?</div>

                  {/* Stats */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '28px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-2px' }}>47</span>
                      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Your Best</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '28px', fontWeight: 200, color: '#ef4444', fontFamily: 'system-ui', letterSpacing: '-2px' }}>63</span>
                      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>#1 Spot</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '28px', fontWeight: 200, color: '#fbbf24', fontFamily: 'system-ui', letterSpacing: '-2px' }}>#3</span>
                      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Your Rank</div>
                    </div>
                  </div>

                  {/* Countdown */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
                    {[{ val: '2', label: 'Days' }, { val: '14', label: 'Hours' }, { val: '23', label: 'Min' }].map((t, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: '18px', fontWeight: 200, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px' }}>{t.val}</div>
                        <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>{t.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Accordion sections */}
                  <div style={{ borderRadius: '14px', overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {[
                      { key: 'rules', title: 'Rules & Scoring', icon: '📋', content: 'Complete as many push-ups as possible in 60 seconds. Must have full range of motion. Record a video for verification. Top 3 win prizes.' },
                      { key: 'submit', title: 'Submit Your Entry', icon: '🎯', content: 'Record yourself doing push-ups for 60 seconds. Count your total and submit with video proof. You can submit multiple times — only your best counts.' },
                      { key: 'leaders', title: 'Leaderboard', icon: '🏆', content: '1. Will M. — 63 push-ups\n2. ZJ — 58 push-ups\n3. You — 47 push-ups\n4. Mike T. — 42 push-ups\n5. Sarah K. — 38 push-ups' },
                    ].map((row) => (
                      <div key={row.key}>
                        <button onClick={() => setChallengeAccordion(challengeAccordion === row.key ? null : row.key)} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '14px 16px', background: 'transparent', border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                        }}>
                          <span style={{ fontSize: '16px' }}>{row.icon}</span>
                          <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'white', textAlign: 'left' }}>{row.title}</span>
                          <svg style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.4)', transform: challengeAccordion === row.key ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                        </button>
                        {challengeAccordion === row.key && (
                          <div style={{ padding: '12px 16px 16px 44px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, whiteSpace: 'pre-line', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {row.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Submit button — Nike dark variant */}
                  <button
                    style={{
                      width: '100%', padding: '14px', borderRadius: '2px', border: 'none', marginTop: '16px',
                      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
                      color: '#9ca3af',
                      fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                      letterSpacing: '0.2em', textTransform: 'uppercase',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                    className="active:scale-[0.98] transition-all"
                  >
                    Submit Your Entry
                  </button>
                </div>
              </div>

              {/* Challenge Card 2: Plank Hold (Coming Soon) */}
              <div style={{
                borderRadius: '20px', overflow: 'hidden',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                padding: '24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(249,115,22,0.6)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 700 }}>Coming Soon</div>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(249,115,22,0.7)', background: 'rgba(249,115,22,0.1)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(249,115,22,0.2)' }}>Upcoming</span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>Plank Hold Challenge</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>How long can you hold a plank? Starts next Monday.</div>
              </div>

              {/* Timeline / Activity Feed */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '14px' }}>
                  Activity
                </div>
                {[
                  { time: 'Just now', text: 'You submitted 47 push-ups', color: '#22c55e' },
                  { time: '2h ago', text: 'ZJ beat your record with 58', color: '#ef4444' },
                  { time: '5h ago', text: 'Mike T. submitted 42 push-ups', color: '#3b82f6' },
                  { time: 'Yesterday', text: 'Challenge started — 128 participants', color: '#f97316' },
                  { time: '2 days ago', text: 'You joined Max Push-Ups Challenge', color: '#8b5cf6' },
                ].map((event, i, arr) => (
                  <div key={i} style={{ display: 'flex', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: event.color, flexShrink: 0 }} />
                      {i < arr.length - 1 && <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: '4px' }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? '16px' : '0' }}>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>{event.time}</div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{event.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Tab */}
          {challengeTab === 'upcoming' && (
            <div className="space-y-4">
              <div style={{ borderRadius: '20px', padding: '40px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>Plank Hold Challenge</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>How long can you hold a plank?</div>
                <div style={{ fontSize: '11px', color: 'rgba(239,68,68,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Starts next Monday</div>
              </div>
              <div style={{ borderRadius: '20px', padding: '40px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏋️</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>1-Rep Max Week</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>Test your limits on the big 3</div>
                <div style={{ fontSize: '11px', color: 'rgba(249,115,22,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>Coming in 3 weeks</div>
              </div>
            </div>
          )}

          {/* Completed Tab */}
          {challengeTab === 'completed' && (
            <div className="space-y-4">
              <div style={{ borderRadius: '20px', padding: '24px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>✓</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>1-Rep Max Week</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Completed Oct 12, 2025</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 200, color: 'white', fontFamily: 'system-ui' }}>225</div>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Your Max</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 200, color: '#fbbf24', fontFamily: 'system-ui' }}>#5</div>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Final Rank</div>
                  </div>
                  <div style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 200, color: 'white', fontFamily: 'system-ui' }}>42</div>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '2px' }}>Participants</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Featured Workouts view
  if (selectedGroup === 'featured') {
    return (
      <div>
        <StickyHeader title="FEATURED WORKOUTS" titleStyle={{ fontSize: '26.4px' }} />

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
          {/* ----- Original Will's Hypertrophy Program card — kept so you can swap back (flip `false` → `true` below, and flip the animated version off) ----- */}
          {false && (
          <div
            onClick={() => {
              track('featured_program_viewed', {
                program: 'wills_hypertrophy',
                enrolled: !!featuredEnrollment.enrolled,
                source: 'hero_card',
              });
              navigate('/featured-session');
            }}
            className="fade-slide-up cursor-pointer active:scale-[0.98] transition-transform"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* Studio backdrop gradient */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a1a1a 0%, #252525 30%, #2a2a2a 50%, #1a1a1a 80%, #0d0d0d 100%)', borderRadius: '4px' }} />
            {/* Spotlight glow behind subject */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
            {/* Secondary warm glow */}
            <div style={{ position: 'absolute', top: '30%', left: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(239,68,68,0.05) 0%, transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '24px', paddingBottom: '32px' }}>
              {/* Program label */}
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 300, marginBottom: '8px' }}>Featured Program</p>
              <h2 style={{ fontSize: '26px', fontWeight: 900, color: 'white', lineHeight: 1, letterSpacing: '-0.5px', marginBottom: '24px', textAlign: 'center', textShadow: '0 2px 20px rgba(0,0,0,0.5)', fontFamily: 'system-ui' }}>
                WILL'S HYPERTROPHY PROGRAM
              </h2>

              {/* Floating photo */}
              <div style={{ position: 'relative' }}>
                {/* Floor shadow */}
                <div style={{ position: 'absolute', bottom: '-16px', left: '50%', transform: 'translateX(-50%)', width: '70%', height: '32px', background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)', filter: 'blur(8px)' }} />
                <img
                  src="/RepLabPhotoShoot.png"
                  alt="Will training"
                  style={{ position: 'relative', width: '280px', maxWidth: '75vw', objectFit: 'contain', filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))' }}
                />
              </div>

              {/* Text + CTA below photo */}
              <div style={{ marginTop: '24px', textAlign: 'center', padding: '0 32px' }}>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 300, marginBottom: '10px' }}>12 weeks. 6 workouts per week. Built for growth.</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 300, marginBottom: '20px' }}>
                  Chest · Bis/RDs · Quads · Tris/Shoulders · Back/Traps · Glutes/Hams · Rest
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (featuredEnrollment.enrolled && featuredEnrollment.nextDay) {
                      // Enrolled with upcoming workouts — go directly to next workout
                      navigate('/featured-session', { state: { week: featuredEnrollment.nextWeek, day: featuredEnrollment.nextDay } });
                    } else if (featuredEnrollment.enrolled && !featuredEnrollment.nextDay) {
                      // All workouts completed — open scheduling modal to restart
                      const fp = enrichedPrograms.find(p => p.isFeatured);
                      if (fp) openBeginProgram(e, fp);
                      else navigate('/featured-session');
                    } else {
                      // Not enrolled — open scheduling modal to pick start date
                      const fp = enrichedPrograms.find(p => p.isFeatured);
                      if (fp) openBeginProgram(e, fp);
                      else navigate('/featured-session');
                    }
                  }}
                  className="active:bg-white/10 transition-colors"
                  style={{ padding: '12px 40px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.7)', background: 'transparent', color: 'white', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                >
                  {featuredEnrollment.enrolled
                    ? (featuredEnrollment.nextDay ? 'Resume Program' : 'Restart Program')
                    : 'Start Program'}
                </button>
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/featured-session');
                    }}
                    className="active:bg-white/10 transition-colors"
                    style={{ padding: '12px 40px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.7)', background: 'transparent', color: 'white', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                  >
                    Program Overview
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Will's Hypertrophy Program — Nike-style animated hero (Ken Burns photo + shimmer accent + counter roll) */}
          <div
            onClick={() => {
              track('featured_program_viewed', {
                program: 'wills_hypertrophy',
                enrolled: !!featuredEnrollment.enrolled,
                source: 'hero_card',
              });
              navigate('/featured-session');
            }}
            className="fade-slide-up cursor-pointer active:scale-[0.98] transition-transform"
            style={{ position: 'relative', overflow: 'hidden', borderRadius: '4px' }}
          >
            {/* Shimmering red accent bar at top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px', zIndex: 3,
              background: 'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,1) 45%, rgba(255,255,255,0.8) 50%, rgba(239,68,68,1) 55%, rgba(239,68,68,0.15) 100%)',
              backgroundSize: '200% 100%',
              animation: 'heroAccentShimmer 8s linear infinite',
            }} />
            {/* Studio backdrop gradient */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a1a1a 0%, #252525 30%, #2a2a2a 50%, #1a1a1a 80%, #0d0d0d 100%)', borderRadius: '4px' }} />
            {/* Spotlight glow behind subject */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
            {/* Secondary warm glow */}
            <div style={{ position: 'absolute', top: '30%', left: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(239,68,68,0.05) 0%, transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '24px', paddingBottom: '32px' }}>
              {/* Program label */}
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 300, marginBottom: '8px' }}>Featured Program</p>
              <h2 style={{ fontSize: '26px', fontWeight: 900, color: 'white', lineHeight: 1, letterSpacing: '-0.5px', marginBottom: '24px', textAlign: 'center', textShadow: '0 2px 20px rgba(0,0,0,0.5)', fontFamily: 'system-ui' }}>
                WILL'S HYPERTROPHY PROGRAM
              </h2>

              {/* Floating photo — Ken Burns slow zoom */}
              <div style={{ position: 'relative' }}>
                {/* Floor shadow */}
                <div style={{ position: 'absolute', bottom: '-16px', left: '50%', transform: 'translateX(-50%)', width: '70%', height: '32px', background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)', filter: 'blur(8px)' }} />
                <img
                  src="/RepLabPhotoShoot.png"
                  alt="Will training"
                  style={{
                    position: 'relative', width: '280px', maxWidth: '75vw', objectFit: 'contain',
                    filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))',
                    animation: 'kenBurns 18s ease-in-out infinite',
                    transformOrigin: 'center center',
                  }}
                />
              </div>

              {/* Counter-roll stats row (replaces the static "12 weeks. 6 workouts per week" line) */}
              <div ref={setHeroStatsRef} style={{ marginTop: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '30px', fontWeight: 900, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px', lineHeight: '0.9' }}>
                    <AnimatedCounter target={12} visible={heroStatsVisible} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Weeks</div>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.12)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '30px', fontWeight: 900, color: 'white', fontFamily: 'system-ui', letterSpacing: '-1px', lineHeight: '0.9' }}>
                    <AnimatedCounter target={6} visible={heroStatsVisible} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Per Week</div>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.12)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '30px', fontWeight: 900, color: '#ef4444', fontFamily: 'system-ui', letterSpacing: '-1px', lineHeight: '0.9' }}>
                    <AnimatedCounter target={72} visible={heroStatsVisible} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Sessions</div>
                </div>
              </div>

              {/* Text + CTA below counter row */}
              <div style={{ marginTop: '20px', textAlign: 'center', padding: '0 32px' }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 500, marginBottom: '10px' }}>Built for growth</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontWeight: 300, marginBottom: '20px' }}>
                  Chest · Bis/RDs · Quads · Tris/Shoulders · Back/Traps · Glutes/Hams · Rest
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (featuredEnrollment.enrolled && featuredEnrollment.nextDay) {
                      navigate('/featured-session', { state: { week: featuredEnrollment.nextWeek, day: featuredEnrollment.nextDay } });
                    } else if (featuredEnrollment.enrolled && !featuredEnrollment.nextDay) {
                      const fp = enrichedPrograms.find(p => p.isFeatured);
                      if (fp) openBeginProgram(e, fp);
                      else navigate('/featured-session');
                    } else {
                      const fp = enrichedPrograms.find(p => p.isFeatured);
                      if (fp) openBeginProgram(e, fp);
                      else navigate('/featured-session');
                    }
                  }}
                  className="active:bg-white/10 transition-colors"
                  style={{ padding: '12px 40px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.7)', background: 'transparent', color: 'white', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                >
                  {featuredEnrollment.enrolled
                    ? (featuredEnrollment.nextDay ? 'Resume Program' : 'Restart Program')
                    : 'Start Program'}
                </button>
                <div style={{ marginTop: '12px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/featured-session');
                    }}
                    className="active:bg-white/10 transition-colors"
                    style={{ padding: '12px 40px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.7)', background: 'transparent', color: 'white', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                  >
                    Program Overview
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* More coming soon */}
          <div className="fade-slide-up" style={{
            animationDelay: '80ms',
            marginTop: '50px',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0808 50%, #0a0606 100%)',
            borderRadius: '24px',
            padding: '28px 24px',
            position: 'relative',
            overflow: 'hidden',
            border: '0.75px solid rgba(255,255,255,0.15)',
          }}>
            <div style={{ position: 'absolute', top: '40%', left: '50%', width: '160px', height: '160px', transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)', filter: 'blur(25px)' }} />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'rgba(239,68,68,0.5)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                Coming Soon
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>More featured programs dropping soon</p>
            </div>
          </div>

        </div>

        {renderBeginModals()}

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

          {/* Become a Trainer */}
          {user?.role !== 'trainer' && (
            <div className="glass-card rounded-xl overflow-hidden fade-slide-up" style={{ animationDelay: `${getTrainers().length * 80}ms` }}>
              <div className="h-1.5 bg-gradient-to-r from-wf-cyan to-purple-500" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-wf-cyan/15 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-wf-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Become a Trainer</h3>
                    <p className="text-xs text-wf-gray-500">Share your workouts with the community</p>
                  </div>
                </div>

                {trainerAppLoading ? (
                  <p className="text-sm text-wf-gray-500">Loading...</p>
                ) : trainerApp?.status === 'pending' ? (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      <span className="text-sm font-semibold text-yellow-400">Application Pending</span>
                    </div>
                    <p className="text-xs text-wf-gray-400">Your application is being reviewed. We'll notify you once a decision is made.</p>
                  </div>
                ) : trainerApp?.status === 'rejected' ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-sm font-semibold text-red-400">Application Not Approved</span>
                    </div>
                    <p className="text-xs text-wf-gray-400 mb-3">Your previous application was not approved. You can submit a new one.</p>
                    <button
                      onClick={() => { setShowTrainerForm(true); setTrainerApp(null); }}
                      className="text-sm font-semibold text-wf-cyan active:opacity-70 transition-opacity"
                    >
                      Apply Again
                    </button>
                  </div>
                ) : showTrainerForm ? (
                  <div className="space-y-3">
                    <p className="text-sm text-wf-gray-400">Tell us about your fitness experience and why you'd like to be a trainer on RepLab.</p>
                    <textarea
                      value={trainerAppMsg}
                      onChange={(e) => setTrainerAppMsg(e.target.value)}
                      placeholder="Your experience, certifications, specialties..."
                      rows={4}
                      className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white placeholder:text-wf-gray-600 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowTrainerForm(false); setTrainerAppMsg(''); }}
                        className="flex-1 glass-card text-wf-gray-400 font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitTrainerApplication}
                        disabled={trainerAppSubmitting}
                        className="flex-1 btn-gradient text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {trainerAppSubmitting ? 'Submitting...' : 'Submit Application'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTrainerForm(true)}
                    className="w-full btn-gradient text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Group list view — programs within Browse or My Workouts
  if (selectedGroup && !selectedProgram) {
    const isBrowse = selectedGroup === 'browse';
    const groupPrograms = isBrowse ? browsePrograms : myPrograms;
    const groupTitle = isBrowse ? 'WORKOUT LIBRARY' : 'MY WORKOUTS';

    return (
      <div>
        <StickyHeader title={groupTitle} titleStyle={{ fontSize: '26.4px' }}>
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
                  aria-label="Clear search"
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

        {/* Filter toggles (browse only) — fully dynamic: pills are derived
            from the programType values that actually exist in the DB. Any
            new type added server-side appears here automatically.
            LABEL_OVERRIDES only handles cases where the snake_case key reads
            poorly (e.g. "strength_conditioning" → "Shred"); anything else is
            auto-titlecased on display. */}
        {isBrowse && (() => {
          const LABEL_OVERRIDES = {
            strength_conditioning: 'Shred',
            hypertrophy_strength: 'Hypertrophy & Strength',
            glute_focused: 'Glute-Focused',
          };
          const titleCase = (s) =>
            String(s)
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
          // Explicit display order: All → Hypertrophy → Glute-Focused →
          // Strength → Shred → anything else (alphabetical fallback for new
          // types that haven't been pinned yet).
          const PINNED_ORDER = ['hypertrophy', 'glute_focused', 'strength', 'strength_conditioning'];
          const orderedTypes = [
            ...PINNED_ORDER.filter((t) => browseAvailableTypes.has(t)),
            ...Array.from(browseAvailableTypes)
              .filter((t) => !PINNED_ORDER.includes(t))
              .sort(),
          ];
          const dynamicFilters = [
            { value: 'all', label: 'All' },
            ...orderedTypes.map((value) => ({
              value,
              label: LABEL_OVERRIDES[value] || titleCase(value),
            })),
          ];
          return (
            <div className="px-4">
              <FilterPillsRow
                value={browseFilter}
                onChange={setBrowseFilter}
                filters={dynamicFilters}
              />
            </div>
          );
        })()}

        <div className="px-4">
          {(() => {
            const typeFiltered = isBrowse && browseFilter !== 'all'
              ? groupPrograms.filter((p) => p.programType === browseFilter)
              : groupPrograms;
            const filtered = isBrowse && browseSearch.trim()
              ? typeFiltered.filter((p) => p.name.toLowerCase().includes(browseSearch.toLowerCase()))
              : typeFiltered;

            // Split into own programs and shared programs (My Workouts only)
            const ownPrograms = isBrowse ? filtered : filtered.filter((p) => !acceptedSharesMap[p.id]);
            const sharedPrograms = isBrowse ? [] : filtered.filter((p) => acceptedSharesMap[p.id]);

            if (ownPrograms.length === 0 && sharedPrograms.length === 0 && browseSearch.trim()) {
              return (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <p className="text-wf-gray-400 text-sm">No programs matching "{browseSearch}"</p>
                </div>
              );
            }
            if (ownPrograms.length === 0 && sharedPrograms.length === 0 && pendingShares.length === 0) {
              return (
                <div className="glass-card rounded-2xl p-8 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-wf-red/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">No Workouts Yet</h3>
                  <p className="text-wf-gray-400 text-sm mb-4">Create your first workout or browse the library to find a program that fits your goals.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowCreateMenu(true)} className="btn-gradient text-white font-semibold px-5 py-3 rounded-xl text-sm active:scale-[0.98] transition-all">
                      Create Workout
                    </button>
                    <button onClick={() => setSelectedGroup('browse')} className="glass-card text-white font-semibold px-5 py-3 rounded-xl text-sm active:scale-[0.98] transition-all">
                      Browse Library
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <>
                {ownPrograms.length > 0 && (
                  isBrowse ? (
                    <div
                      className="flex flex-col gap-4 overflow-y-auto scrollbar-hide snap-y snap-mandatory pb-4"
                      style={{ WebkitOverflowScrolling: 'touch', maxHeight: 'calc(100vh - 260px)' }}
                    >
                      {ownPrograms.map((program, idx) => {
                        const BROWSE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7'];
                        const programColor = BROWSE_COLORS[idx % BROWSE_COLORS.length];
                        return (
                          <LibraryFlipCard
                            key={program.id}
                            program={program}
                            programColor={programColor}
                            idx={idx}
                            isFlipped={flippedLibraryCards.has(program.id)}
                            onFlip={toggleLibraryFlip}
                            onView={(id) => {
                              setSelectedProgram(id);
                              setSelectedWeek(null);
                              setBrowseSearch('');
                              completeTutorialAction('program-selected');
                            }}
                            navigate={navigate}
                            openBeginProgram={openBeginProgram}
                            dataTutorial={idx === 0 ? 'program-card' : undefined}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-4 pb-4">
                      {ownPrograms.map((program, idx) => (
                        <ProgramCard key={program.id} program={program} idx={idx} dataTutorial={idx === 0 ? 'program-card' : undefined} onSelect={(id) => { setSelectedProgram(id); setSelectedWeek(null); setBrowseSearch(''); completeTutorialAction('program-selected'); }} onBegin={openBeginProgram} onDelete={!isBrowse ? handleDeleteProgram : undefined} onShare={!isBrowse ? (p) => { setShareResult(null); setShareInput(''); setShareModal(p); } : undefined} onNavigateFeatured={program.isFeatured ? () => navigate('/featured-session') : undefined} />
                      ))}
                    </div>
                  )
                )}

                {/* Shared With Me — accepted programs */}
                {!isBrowse && sharedPrograms.length > 0 && (
                  <div className="mt-6 pb-4">
                    <h3 className="text-sm font-semibold text-wf-gray-400 uppercase tracking-wider mb-3">Shared With Me</h3>
                    <div className="space-y-4">
                      {sharedPrograms.map((program, idx) => {
                        const sender = acceptedSharesMap[program.id];
                        return (
                          <div key={program.id} className="fade-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
                            <div className="flex items-center gap-2 mb-2">
                              {sender?.senderPhoto ? (
                                <img src={sender.senderPhoto} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                  <span className="text-white text-[10px] font-bold">{(sender?.senderName || 'U')[0].toUpperCase()}</span>
                                </div>
                              )}
                              <span className="text-xs text-wf-gray-500">From <span className="text-blue-400 font-semibold">{sender?.senderName || 'a user'}{sender?.senderUsername ? ` (@${sender.senderUsername})` : ''}</span></span>
                            </div>
                            <ProgramCard program={program} idx={idx} onSelect={(id) => { setSelectedProgram(id); setSelectedWeek(null); setBrowseSearch(''); }} onBegin={openBeginProgram} onDelete={handleDeleteProgram} onShare={(p) => openShareModal(p)} onNavigateFeatured={program.isFeatured ? () => navigate('/featured-session') : undefined} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pending shares — awaiting accept/decline */}
                {!isBrowse && pendingShares.length > 0 && (
                  <div className="mt-6 pb-4">
                    <h3 className="text-sm font-semibold text-wf-gray-400 uppercase tracking-wider mb-3">Pending</h3>
                    <div className="space-y-3">
                      {pendingShares.map((share) => (
                        <div key={share.id} className="glass-card rounded-2xl overflow-hidden fade-slide-up">
                          <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {share.senderPhoto ? (
                                  <img src={share.senderPhoto} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
                                    <span className="text-white text-sm font-bold">{(share.senderName || 'U')[0].toUpperCase()}</span>
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4 className="text-base font-bold text-white">{share.type === 'invite' ? share.templateName : share.programName}</h4>
                                  {share.type === 'invite' && share.message ? (
                                    <p className="text-xs text-wf-gray-400 mt-0.5 leading-relaxed">{share.message}</p>
                                  ) : (
                                    <p className="text-xs text-wf-gray-500 mt-0.5">From <span className="text-blue-400 font-semibold">{share.senderName || 'a user'}{share.senderUsername ? ` (@${share.senderUsername})` : ''}</span></p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleAcceptShare(share.id)}
                                  className="text-white font-semibold text-xs px-3 py-2 rounded-xl active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.2)' }}
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleDeclineShare(share.id)}
                                  className="text-wf-gray-400 font-semibold text-xs px-3 py-2 rounded-xl bg-white/5 active:bg-white/10 transition-colors"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {renderBeginModals()}
        {showCreateMenu && renderCreateMenu()}

        {/* Share Program Modal */}
        {shareModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShareModal(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-full overflow-hidden animate-drop-down"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red accent line */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="relative p-6 pb-24">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Share</p>
                    <h3 className="text-[22px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>SHARE PROGRAM</h3>
                  </div>
                  <button
                    onClick={() => setShareModal(null)}
                    aria-label="Close"
                    className="w-7 h-7 flex items-center justify-center active:scale-90 transition-all shrink-0"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-[12px] text-white/50 font-light leading-relaxed mb-4">
                  Share <span className="text-white font-semibold">{shareModal.name}</span> with a friend.
                </p>
                <input
                  type="text"
                  value={shareUserSearch}
                  onChange={(e) => { setShareUserSearch(e.target.value); setShareResult(null); }}
                  placeholder="Search users..."
                  className="w-full px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none mb-3"
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                  autoFocus
                />
                {shareResult && (
                  <p className={`text-sm mb-3 ${shareResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {shareResult.message}
                  </p>
                )}
                <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                  {shareUsers
                    .filter(u => !shareUserSearch.trim() || u.name.toLowerCase().includes(shareUserSearch.toLowerCase()) || u.username.toLowerCase().includes(shareUserSearch.toLowerCase()))
                    .map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setShareInput(u.username || u.name); setShareResult(null); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${shareInput === (u.username || u.name) ? 'border' : 'hover:bg-white/5 active:bg-white/10 border border-transparent'}`}
                        style={shareInput === (u.username || u.name) ? {
                          background: 'rgba(239,68,68,0.12)',
                          borderColor: 'rgba(239,68,68,0.4)',
                          borderRadius: '2px',
                        } : { borderRadius: '2px' }}
                      >
                        {u.photo ? (
                          <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-wf-red to-orange-500 flex items-center justify-center shrink-0">
                            <span className="text-white text-sm font-bold">{(u.name || 'U')[0].toUpperCase()}</span>
                          </div>
                        )}
                        <div className="text-left min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                          {u.username && <p className="text-xs text-white/50">@{u.username}</p>}
                        </div>
                        {shareInput === (u.username || u.name) && (
                          <svg className="w-5 h-5 shrink-0 ml-auto" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  {shareUsers.length === 0 && (
                    <p className="text-center text-white/50 text-sm py-4">Loading users...</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShareModal(null)}
                    className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all border"
                    style={{
                      background: 'transparent',
                      borderColor: 'rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.5)',
                      borderRadius: '2px',
                      letterSpacing: '0.2em',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleShareProgram}
                    disabled={shareLoading || !shareInput.trim()}
                    className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                      color: '#000',
                      borderRadius: '2px',
                      letterSpacing: '0.2em',
                      boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                    }}
                  >
                    {shareLoading ? 'Sharing...' : 'Share'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invite Workout Modal (browse library) */}
        {inviteModal && (
          <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setInviteModal(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative flex-1 flex flex-col mt-12 overflow-hidden animate-drop-down"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Red accent line */}
              <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
              {/* Ambient red spotlight */}
              <div className="absolute top-0 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              <div className="relative shrink-0 pt-5 pb-4 px-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase font-light mb-2" style={{ letterSpacing: '0.3em', color: 'rgba(239,68,68,0.8)' }}>Partner Up</p>
                    <h3 className="text-[22px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>INVITE TO WORKOUT</h3>
                  </div>
                  <button
                    onClick={() => setInviteModal(null)}
                    aria-label="Close"
                    className="w-7 h-7 flex items-center justify-center active:scale-90 transition-all shrink-0"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="relative flex-1 overflow-y-auto px-6 pb-24">
              <p className="text-[12px] text-white/50 font-light leading-relaxed mb-4">
                Invite someone to do <span className="text-white font-semibold">{inviteModal.name}</span> with you today.
              </p>
              <input
                type="text"
                value={shareUserSearch}
                onChange={(e) => { setShareUserSearch(e.target.value); setInviteResult(null); }}
                placeholder="Search users..."
                className="w-full px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none mb-3"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '2px',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.6)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                autoFocus
              />
              {inviteResult && (
                <p className={`text-sm mb-3 ${inviteResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {inviteResult.message}
                </p>
              )}
              <div className="max-h-64 overflow-y-auto space-y-1 mb-3">
                {shareUsers
                  .filter(u => !shareUserSearch.trim() || u.name.toLowerCase().includes(shareUserSearch.toLowerCase()) || u.username.toLowerCase().includes(shareUserSearch.toLowerCase()))
                  .map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setInviteInput(u.username || u.name); setInviteResult(null); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${inviteInput === (u.username || u.name) ? 'border' : 'hover:bg-white/5 active:bg-white/10 border border-transparent'}`}
                      style={inviteInput === (u.username || u.name) ? {
                        background: 'rgba(239,68,68,0.12)',
                        borderColor: 'rgba(239,68,68,0.4)',
                        borderRadius: '2px',
                      } : { borderRadius: '2px' }}
                    >
                      {u.photo ? (
                        <img src={u.photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-wf-red to-orange-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-sm font-bold">{(u.name || 'U')[0].toUpperCase()}</span>
                        </div>
                      )}
                      <div className="text-left min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                        {u.username && <p className="text-xs text-white/50">@{u.username}</p>}
                      </div>
                      {inviteInput === (u.username || u.name) && (
                        <svg className="w-5 h-5 shrink-0 ml-auto" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                {shareUsers.length === 0 && (
                  <p className="text-center text-white/50 text-sm py-4">Loading users...</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setInviteModal(null)}
                  className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all border"
                  style={{
                    background: 'transparent',
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.5)',
                    borderRadius: '2px',
                    letterSpacing: '0.2em',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendInvite}
                  disabled={inviteLoading || !inviteInput.trim()}
                  className="flex-1 py-3 text-[11px] font-bold uppercase active:scale-[0.97] transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)',
                    color: '#000',
                    borderRadius: '2px',
                    letterSpacing: '0.2em',
                    boxShadow: '0 4px 14px rgba(255,255,255,0.1)',
                  }}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
              {renderExternalShareButtons(inviteModal?.name)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Pull-to-refresh handlers
  function handlePullStart(e) {
    if (window.scrollY === 0) {
      pullStartY.current = e.touches[0].clientY;
      pullDist.current = 0;
    } else {
      pullStartY.current = 0;
    }
  }
  function handlePullMove(e) {
    if (!pullStartY.current) return;
    const dist = e.touches[0].clientY - pullStartY.current;
    if (dist > 0) {
      pullDist.current = dist;
      setPullOffset(Math.min(dist * 0.5, 80));
    }
  }
  function handlePullEnd() {
    if (pullOffset > 50 && !refreshing) {
      setRefreshing(true);
      fetchData()
        .catch(() => {})
        .finally(() => { setRefreshing(false); setPullOffset(0); });
    } else {
      setPullOffset(0);
    }
    pullStartY.current = 0;
    pullDist.current = 0;
  }

  // Top-level view — two group cards
  return (
    <div
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
    >
      {/* Featured Workouts zoom-in transition */}
      {featuredTransition && featuredCardRect && (() => {
        const r = featuredCardRect;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // 2x size centered on card
        const growW = r.width * 2;
        const growH = r.height * 2;
        const growLeft = cx - growW / 2;
        const growTop = cy - growH / 2;

        let cardStyle;
        if (featuredTransition === 'card') {
          cardStyle = { top: r.top, left: r.left, width: r.width, height: r.height, borderRadius: '16px' };
        } else if (featuredTransition === 'grow') {
          cardStyle = { top: growTop, left: growLeft, width: growW, height: growH, borderRadius: '24px' };
        } else {
          cardStyle = { top: 0, left: 0, width: '100%', height: '100%', borderRadius: '0px' };
        }

        return (
          <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
            {/* Black backdrop that fades in */}
            <div style={{
              position: 'absolute', inset: 0,
              background: '#000',
              opacity: featuredTransition === 'card' ? 0 : featuredTransition === 'grow' ? 0.5 : 1,
              transition: 'opacity 0.6s ease',
            }} />
            {/* Expanding card with video */}
            <div style={{
              position: 'absolute',
              ...cardStyle,
              transition: featuredTransition === 'card' ? 'none' : 'top 0.8s cubic-bezier(0.4, 0, 0.2, 1), left 0.8s cubic-bezier(0.4, 0, 0.2, 1), width 0.8s cubic-bezier(0.4, 0, 0.2, 1), height 0.8s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.8s ease',
              overflow: 'hidden',
            }}>
              {/* Video background — continues playing from the card */}
              <video
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay loop muted playsInline
                src="/Gym cinematic promotion video.mp4"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              {/* Text overlay — fades out as it grows */}
              <div style={{
                position: 'absolute', bottom: '20px', left: '20px', zIndex: 1,
                opacity: (featuredTransition === 'card' || featuredTransition === 'grow') ? 1 : 0,
                transition: 'opacity 0.4s ease',
              }}>
                <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>Featured Workouts</h2>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>Guided sessions · Custom coaching</p>
              </div>
            </div>
            {/* Logo — appears after card fills screen */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/RepLabLogo2.jpg"
                alt="RepLab"
                style={{
                  width: '16rem', borderRadius: '24px',
                  opacity: featuredTransition === 'logo' ? 1 : 0,
                  transform: featuredTransition === 'logo' ? 'scale(1)' : 'scale(0.9)',
                  transition: 'opacity 0.5s ease, transform 0.5s ease',
                }}
              />
            </div>
          </div>
        );
      })()}
      {pullOffset > 0 && (
        <div className="flex justify-center py-2" style={{ height: pullOffset, transition: refreshing ? 'none' : 'height 0.2s' }}>
          <svg className={`w-5 h-5 text-wf-red ${refreshing ? 'animate-spin' : ''}`} style={{ opacity: Math.min(pullOffset / 50, 1), transform: `rotate(${pullOffset * 4}deg)` }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
        </div>
      )}
      <StickyHeader title="WORKOUTS" titleStyle={{ fontSize: '26.4px' }}>
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
            data-tutorial="create-btn"
            onClick={() => setShowCreateMenu(true)}
            className="active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase px-3.5 py-2 whitespace-nowrap shrink-0"
            style={{
              letterSpacing: '0.15em',
              borderRadius: '2px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            + Create
          </button>
          {pendingShares.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center active:scale-90 transition-all shrink-0"
              >
                <svg className="w-5 h-5 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </button>
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-blue-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 pointer-events-none">
                {pendingShares.length}
              </span>
            </div>
          )}
        </div>
      </StickyHeader>

      {/* Notifications Dropdown */}
      {showNotifications && pendingShares.length > 0 && (
        <div className="fixed inset-0 z-50" onClick={() => setShowNotifications(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute top-16 right-4 w-[calc(100%-2rem)] max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              <button onClick={() => setShowNotifications(false)} className="text-wf-gray-500 active:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {pendingShares.map((share) => (
                <button
                  key={share.id}
                  onClick={() => { setShowNotifications(false); setSelectedGroup('workouts'); }}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 active:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                >
                  {share.senderPhoto ? (
                    <img src={share.senderPhoto} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
                      <span className="text-white text-sm font-bold">{(share.senderName || 'U')[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      {share.type === 'invite' && share.message
                        ? share.message
                        : <><span className="font-semibold text-blue-400">{share.senderName || 'A user'}{share.senderUsername ? ` (@${share.senderUsername})` : ''}</span> shared a workout with you</>
                      }
                    </p>
                    <p className="text-xs text-wf-gray-500 mt-0.5">{share.type === 'invite' ? share.templateName : share.programName}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                </button>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-white/10">
              <button
                onClick={() => { setShowNotifications(false); navigate('/profile'); }}
                className="w-full text-center text-xs text-wf-gray-400 font-semibold active:text-white transition-colors"
              >
                View Profile
              </button>
            </div>
          </div>
        </div>
      )}

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
            const matchedTemplates = (templates || []).filter((t) => t.name.toLowerCase().includes(q));
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
                        onClick={() => { setShowSearch(false); setSearchQuery(''); setSelectedGroup(p.userId ? 'my' : 'browse'); setSelectedProgram(p.id); setSelectedWeek(null); }}
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
                          onClick={() => { setShowSearch(false); setSearchQuery(''); setSelectedGroup(program?.userId ? 'my' : 'browse'); setSelectedProgram(t.programId); setSelectedWeek(null); }}
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
          <>
            <div className="space-y-4 mt-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-2/3 rounded-lg bg-white/10" />
                      <div className="h-3 w-1/2 rounded-lg bg-white/5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <LoadingSpinnerOverlay />
          </>
        ) : loadError ? (
          <div className="text-center py-16 fade-slide-up">
            <p className="text-red-400 mb-3">{loadError}</p>
            <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
          </div>
        ) : (myPrograms.length === 0 && !featuredEnrollment.enrolled) ? (
          /* Users with no programs yet — show a loading spinner (same style
             as the Brainstorm /brainstorm page's Loading Button). Replaces
             the old "Welcome to WillFit" empty-state card. */
          <div className="flex justify-center items-center fade-slide-up" style={{ minHeight: '70vh' }}>
            <span className="replab-spinner-gradient w-16 h-16" style={{ animationDuration: '0.91s' }} />
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {/* Your Next Workout — Nike style */}
            <div className="fade-slide-up mx-2" style={{ animationDelay: '0ms' }}>
              <div className="relative overflow-hidden" style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                borderRadius: '2px',
              }}>
                {/* Red accent line */}
                <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
                {/* Accent spotlight */}
                <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

                <div className="relative p-3.5">
                  <p className="text-[10px] text-white/30 uppercase font-light mb-2" style={{ letterSpacing: '0.3em' }}>Up Next</p>
                  <h2 className="text-[28px] font-black text-white tracking-tight mb-1" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                    YOUR NEXT<br/>WORKOUT
                  </h2>

                  {/* Workout info */}
                  <div className="mt-3 mb-4">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[15px] font-semibold text-white">
                        {nextWorkoutInfo?.templateName || (nextWorkoutInfo?.status === 'rest' ? 'Rest Day' : nextWorkoutInfo?.status === 'none' ? 'Nothing scheduled' : 'Loading...')}
                      </span>
                      {nextWorkoutInfo?.dayLabel && (
                        <>
                          <span className="w-px h-3.5 bg-white/10" />
                          <span className="text-[13px] text-white/35 font-light">{nextWorkoutInfo.dayLabel}</span>
                        </>
                      )}
                    </div>
                    {currentProgram && (
                      <p className="text-[12px] text-white/25 font-light">{currentProgram.name} — Week {currentProgram.week}</p>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (nextWorkoutInfo?.templateId) {
                          navigateToWorkout(nextWorkoutInfo.templateId, nextWorkoutInfo.date);
                        } else {
                          setSelectedGroup('browse');
                        }
                      }}
                      className={`${nextWorkoutInfo?.status === 'resume' ? 'btn-liquid' : ''} flex-1 py-3.5 rounded-full text-[11px] font-bold uppercase active:scale-[0.97] transition-transform`}
                      style={nextWorkoutInfo?.status === 'resume'
                        ? { letterSpacing: '0.15em' }
                        : { background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)', color: '#000', letterSpacing: '0.15em', boxShadow: '0 6px 20px rgba(255,255,255,0.1)' }}
                    >
                      {nextWorkoutInfo?.templateId
                        ? (nextWorkoutInfo.status === 'resume' ? 'Resume' : nextWorkoutInfo.status === 'upcoming' ? 'Preview' : 'Start Now')
                        : 'Add a Workout'}
                    </button>
                    <button
                      onClick={() => setSelectedGroup('browse')}
                      className="flex-1 py-3.5 rounded-full border border-white/15 text-white/50 text-[11px] font-medium uppercase active:bg-white/5 transition-colors"
                      style={{ letterSpacing: '0.15em' }}
                    >
                      Browse
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats row — Odometer style (matches brainstorm demo #5).
                Negative top/bottom margins cancel the parent's space-y-4 gap so
                this row butts directly against the cards above and below. */}
            {(streak > 0 || totalWorkouts > 0 || workoutsThisMonth > 0) && (
              <div className="grid grid-cols-3 gap-4 fade-slide-up -mt-4 -mb-4" style={{ animationDelay: '100ms' }}>
                {[
                  { value: streak,            labelTop: 'Day',      labelBottom: 'Streak' },
                  { value: totalWorkouts,     labelTop: 'Total',    labelBottom: 'Workouts' },
                  { value: workoutsThisMonth, labelTop: 'Workouts', labelBottom: 'This Month' },
                ].map((stat, i) => (
                  <OdometerStat key={i} value={stat.value} labelTop={stat.labelTop} labelBottom={stat.labelBottom} delay={100 + i * 80} />
                ))}
              </div>
            )}

            {/* (Legacy Your Next Workout card — hidden for reference) */}
            <div className="fade-slide-up hidden" style={{
              animationDelay: '0ms',
              borderRadius: '24px',
              overflow: 'hidden',
              position: 'relative',
              minHeight: '220px',
              background: '#0a0a0a',
              ...CARD_BORDER_STYLE,
            }}>
              {/* Border shimmer sweep */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '24px', overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
                <div style={{
                  position: 'absolute', top: '-50%', left: '-50%', width: '40%', height: '200%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
                  animation: 'borderShimmer 4s ease-in-out infinite',
                  animationDelay: '1.5s',
                }} />
              </div>
              {/* Mesh gradient blobs */}
              <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239,68,68,0.35) 0%, transparent 70%)', filter: 'blur(30px)' }} />
              <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)', filter: 'blur(30px)' }} />
              <div style={{ position: 'absolute', top: '30%', right: '20%', width: '40%', height: '50%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, transparent 70%)', filter: 'blur(25px)' }} />
              <div style={{ position: 'relative', zIndex: 1, padding: '22px 24px 28px', display: 'flex', gap: '16px' }}>
                {/* Left side — workout info + button */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'clamp(16px, 4.5vw, 26px)', fontWeight: 700, color: 'white', lineHeight: 1.1, marginBottom: '8px', whiteSpace: 'nowrap', letterSpacing: '2px', textTransform: 'uppercase', textShadow: '0 0 8px rgba(255,255,255,0.05)' }}>
                    {nextWorkoutInfo?.status === 'resume' ? 'Resume Workout' : 'Your Next Workout'}
                  </div>
                  {nextWorkoutInfo?.status === 'rest' ? (
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
                      {nextWorkoutInfo.dayLabel} is a rest day
                    </div>
                  ) : nextWorkoutInfo?.status === 'none' ? (
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                      No workouts scheduled
                    </div>
                  ) : nextWorkoutInfo?.templateName ? (
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
                      {nextWorkoutInfo.dayLabel} — {nextWorkoutInfo.templateName}
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>Loading...</div>
                  )}
                  {(nextWorkoutInfo?.templateId || nextWorkoutInfo?.status === 'none' || nextWorkoutInfo?.status === 'rest') && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (nextWorkoutInfo.templateId) {
                          navigateToWorkout(nextWorkoutInfo.templateId, nextWorkoutInfo.date);
                        } else {
                          setSelectedGroup('browse');
                        }
                      }}
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.15) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px',
                        padding: '12px 24px', color: 'white', fontSize: '10px', fontWeight: 600,
                        cursor: 'pointer', letterSpacing: '3px', textTransform: 'uppercase',
                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      {nextWorkoutInfo.templateId
                        ? (nextWorkoutInfo.status === 'resume' ? 'Resume →' : nextWorkoutInfo.status === 'upcoming' ? 'Preview →' : 'Start Now →')
                        : 'Add a Workout →'}
                    </button>
                    </div>
                  )}
                  {currentProgram && (
                    <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                      Current Program: <span style={{ color: 'rgba(239,68,68,0.7)', fontWeight: 600 }}>{currentProgram.name}</span> — Week {currentProgram.week}
                    </div>
                  )}
                  <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', marginTop: '16px' }} />
                  {bodyPartPRs.length === 0 && (
                    <div style={{ marginTop: '12px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <div style={{
                        display: 'inline-block',
                        animation: 'prTicker 20s linear infinite',
                        fontSize: '11px', fontWeight: 500,
                      }}>
                        {[
                          'Complete your first workout to start tracking PRs',
                          'Add a program to get started',
                          'Schedule workouts in the calendar',
                          'Tap a workout to start a session',
                        ].map((hint, i) => (
                          <span key={i}>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{hint}</span>
                            <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 12px' }}>|</span>
                          </span>
                        ))}
                        {[
                          'Complete your first workout to start tracking PRs',
                          'Add a program to get started',
                          'Schedule workouts in the calendar',
                          'Tap a workout to start a session',
                        ].map((hint, i) => (
                          <span key={`dup-${i}`}>
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{hint}</span>
                            <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 12px' }}>|</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {bodyPartPRs.length > 0 && (() => {
                    const prContent = bodyPartPRs.map((pr, i) => (
                      <span key={pr.muscle_group}>
                        <span style={{ color: 'rgba(239,68,68,0.6)', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '8px', fontWeight: 600 }}>{pr.muscle_group} PR</span>
                        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>-</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{pr.exercise_name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>-</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>{Number(pr.best_weight)} LBS × {pr.best_reps} REPS</span>
                        <span style={{ color: 'rgba(255,255,255,0.1)', margin: '0 12px' }}>|</span>
                      </span>
                    ));
                    return (
                      <div style={{ marginTop: '12px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <div style={{
                          display: 'inline-block',
                          animation: `prTicker ${Math.max(18.4, bodyPartPRs.length * 6.44)}s linear infinite`,
                          fontSize: '11px', fontWeight: 500,
                        }}>
                          {prContent}{prContent}
                        </div>
                      </div>
                    );
                  })()}
                  {lastWorkout && (
                    <div style={{ marginTop: '6px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <div style={{
                        display: 'inline-block',
                        animation: 'prTicker 16s linear infinite',
                        fontSize: '11px', fontWeight: 500,
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '8px', fontWeight: 600, marginRight: '8px' }}>Last Session</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{lastWorkout.name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: '40px' }}>{lastWorkout.ago}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '8px', fontWeight: 600, marginRight: '8px' }}>Last Session</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{lastWorkout.name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>{lastWorkout.ago}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Right side — mini stats */}
                {(streak > 0 || totalWorkouts > 0 || workoutsThisMonth > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '16px' }}>
                    {streak > 0 && (
                      <StatNumber to={streak} duration={800} delay={200} pulse color="rgba(249,115,22,0.6)" label="Streak" />
                    )}
                    {streak > 0 && totalWorkouts > 0 && (
                      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                    )}
                    {totalWorkouts > 0 && (
                      <StatNumber to={totalWorkouts} duration={1000} delay={500} color="rgba(239,68,68,0.6)" label="Workouts" topLabel="Total" />
                    )}
                    {totalWorkouts > 0 && workoutsThisMonth > 0 && (
                      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                    )}
                    {workoutsThisMonth > 0 && (
                      <StatNumber to={workoutsThisMonth} duration={1200} delay={800} color="rgba(34,197,94,0.6)" label="This Mo" topLabel="Workouts" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Featured Workouts card */}
            <div
              ref={featuredCardRef}
              onClick={() => {
                const rect = featuredCardRef.current?.getBoundingClientRect();
                if (rect) setFeaturedCardRect(rect);
                setFeaturedTransition('card');
                // Phase 1: grow to 2x size
                requestAnimationFrame(() => setTimeout(() => setFeaturedTransition('grow'), 50));
                // Phase 2: expand to full screen
                setTimeout(() => setFeaturedTransition('full'), 900);
                // Phase 3: show logo
                setTimeout(() => setFeaturedTransition('logo'), 1600);
                // Phase 4: fade out
                setTimeout(() => setFeaturedTransition('fade'), 3100);
                // Done
                setTimeout(() => { setFeaturedTransition(null); setFeaturedCardRect(null); setSelectedGroup('featured'); }, 3600);
              }}
              className="w-full rounded-2xl overflow-hidden fade-slide-up relative cursor-pointer active:scale-[0.98] transition-transform"
              style={{ animationDelay: '0ms', minHeight: '107px' }}
            >
              <video
                ref={featuredVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                webkit-playsinline=""
                preload="auto"
                src="/Gym cinematic promotion video.mp4"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              <div className="relative z-10 p-5 flex flex-col justify-end h-full" style={{ minHeight: '126px' }}>
                <div className="mt-auto">
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-lg">Featured Workouts</h2>
                  <p className="text-white/60 text-xs mt-1 drop-shadow">Guided sessions · Custom coaching</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Tap to start</span>
                    <svg className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Browse Workout Library card — Nike style */}
            <div
              data-tutorial="browse-library"
              onClick={() => { setSelectedGroup('browse'); completeTutorialAction('browse-library-tap'); }}
              className="w-full text-left active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{
                animationDelay: '0ms',
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {/* Red accent line (matches Your Next Workout card) */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              {/* Header row — "Browse Workout Library" spans as a single tracked uppercase line */}
              <div className="relative px-6 pt-5 pb-4 border-b border-white/10">
                <p className="text-[14px] text-white uppercase font-bold text-center" style={{ letterSpacing: '0.3em' }}>
                  Browse Workout Library
                </p>
              </div>

              <div className="relative px-6 py-5 flex items-center justify-between gap-5">
                <div>
                  <div className="text-[44px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.9' }}>
                    {browsePrograms.length}
                  </div>
                  <div className="text-[10px] text-white/30 uppercase font-semibold mt-1" style={{ letterSpacing: '0.3em' }}>
                    Programs
                  </div>
                </div>
                {/* 2x2 grid driven by the programType values that actually
                    exist in browsePrograms (browseAvailableTypes). Labels
                    are mapped to display strings; 'other' is skipped. The
                    preferred-order array fixes the visual sequence so the
                    grid layout is stable across DB additions/removals. */}
                {(() => {
                  const TYPE_DISPLAY = {
                    hypertrophy: 'Hypertrophy',
                    strength: 'Strength',
                    hybrid: 'Hybrid',
                    conditioning: 'Conditioning',
                    strength_conditioning: 'Shred',
                    hypertrophy_strength: 'Hyp & Str',
                    glute_focused: 'Glute-Focused',
                  };
                  const TYPE_ORDER = [
                    'hypertrophy', 'strength', 'hybrid', 'conditioning',
                    'strength_conditioning', 'hypertrophy_strength',
                    'glute_focused',
                  ];
                  const visible = TYPE_ORDER.filter((t) => browseAvailableTypes.has(t));
                  if (visible.length === 0) return null;
                  return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1 justify-items-end text-right">
                      {visible.map((type) => (
                        <span
                          key={type}
                          className="text-[10px] font-bold uppercase whitespace-nowrap"
                          style={{ color: 'rgba(239,68,68,0.75)', letterSpacing: '0.25em' }}
                        >
                          {TYPE_DISPLAY[type] || type}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ----- Original My Workouts card (Organic Blob style) — kept so you can swap back ----- */}
            {/*
            <div
              data-tutorial="my-workouts"
              onClick={() => setSelectedGroup('my')}
              className="w-full text-left active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{
                animationDelay: '0ms',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0808 50%, #0a0606 100%)',
                borderRadius: '24px',
                padding: '28px 24px',
                position: 'relative',
                overflow: 'hidden',
                ...CARD_BORDER_STYLE,
              }}
            >
              <div style={{ position: 'absolute', top: '50%', left: '70%', width: '160px', height: '160px',
                transform: `translate(-50%, -50%) scale(${0.8 + Math.sin((streakPhase + 25) * 0.063) * 0.2})`,
                borderRadius: `${45 + Math.sin((streakPhase + 25) * 0.04) * 15}% ${55 - Math.sin((streakPhase + 25) * 0.04) * 15}% ${50 + Math.cos((streakPhase + 25) * 0.05) * 10}% ${50 - Math.cos((streakPhase + 25) * 0.05) * 10}%`,
                background: 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, rgba(239,68,68,0.2) 50%, transparent 70%)',
                filter: 'blur(20px)', transition: 'all 0.08s linear' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'white', letterSpacing: '2px', textTransform: 'uppercase', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  My Workouts
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '16px' }}>
                  <div>
                    <div style={{ fontSize: '40px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui' }}>{myPrograms.length}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>{myPrograms.length === 1 ? 'Program' : 'Programs'}</div>
                  </div>
                  <div style={{ flex: 1, marginLeft: '16px', textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(239,68,68,0.6)', letterSpacing: '3px', textTransform: 'uppercase' }}>Your Custom Workouts</span>
                  </div>
                </div>
              </div>
            </div>
            */}

            {/* My Workouts card — Nike style (matches Browse Library) */}
            <div
              data-tutorial="my-workouts"
              onClick={() => setSelectedGroup('my')}
              className="w-full text-left active:scale-[0.98] transition-transform fade-slide-up cursor-pointer"
              style={{
                animationDelay: '0ms',
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                borderRadius: '2px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {/* Red accent line (matches Your Next Workout card) */}
              <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
              {/* Ambient red spotlight */}
              <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

              {/* Header row */}
              <div className="relative px-6 pt-5 pb-4 border-b border-white/10 flex items-center gap-2">
                <p className="text-[11px] text-white/40 uppercase font-light" style={{ letterSpacing: '0.3em' }}>
                  My Workouts
                </p>
                {pendingShares.length > 0 && (
                  <span className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#ef4444' }}>{pendingShares.length}</span>
                )}
              </div>

              <div className="relative px-6 py-5 flex items-end justify-between gap-5">
                <div>
                  <div className="text-[44px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.9' }}>
                    {myPrograms.length}
                  </div>
                  <div className="text-[10px] text-white/30 uppercase font-semibold mt-1" style={{ letterSpacing: '0.3em' }}>
                    {myPrograms.length === 1 ? 'Program' : 'Programs'}
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-end gap-3">
                  <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(239,68,68,0.75)', letterSpacing: '0.25em' }}>
                    Your Custom Workouts
                  </span>
                  {myPrograms.length === 0 && (
                    <div className="text-[11px] text-white/40 -mt-2">
                      Create your first workout
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowCreateMenu(true); }}
                    className="active:scale-[0.97] transition-all text-white text-[11px] font-bold uppercase px-3.5 py-2 whitespace-nowrap"
                    style={{
                      letterSpacing: '0.15em',
                      borderRadius: '2px',
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                      boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                    }}
                  >
                    + Create Workout
                  </button>
                </div>
              </div>
            </div>

            {/* Personal Records — sticky-header list (cards test #38 pattern) */}
            {allPRsByMuscle.length > 0 && (() => {
              // Group rows: muscle → exercise → [{ weight, reps, volume, ... }]
              // Sort lifts within each exercise by the active metric (desc).
              const byVolume = prSortMode === 'volume';
              const sortKey = (lift) => (byVolume ? lift.volume : lift.weight);
              const grouped = {};
              for (const row of allPRsByMuscle) {
                const muscle = row.muscle_group || 'Other';
                const exercise = row.exercise_name;
                const weight = Number(row.best_weight);
                const reps = Number(row.best_reps) || 0;
                if (!grouped[muscle]) grouped[muscle] = {};
                if (!grouped[muscle][exercise]) grouped[muscle][exercise] = [];
                grouped[muscle][exercise].push({
                  weight,
                  reps,
                  volume: weight * reps,
                  achievedAt: row.achieved_at,
                });
              }
              // Re-sort each exercise's lifts by the active metric.
              for (const muscle of Object.keys(grouped)) {
                for (const ex of Object.keys(grouped[muscle])) {
                  grouped[muscle][ex].sort((a, b) => sortKey(b) - sortKey(a));
                }
              }
              const preferredOrder = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Core', 'Calves', 'Forearms'];
              const muscles = Object.keys(grouped).sort((a, b) => {
                const ai = preferredOrder.findIndex((m) => m.toLowerCase() === a.toLowerCase());
                const bi = preferredOrder.findIndex((m) => m.toLowerCase() === b.toLowerCase());
                if (ai === -1 && bi === -1) return a.localeCompare(b);
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              });
              const toggleBtnBase = {
                flex: 1, padding: '6px 0', borderRadius: '100px',
                fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em',
                textTransform: 'uppercase', cursor: 'pointer',
                border: 'none', transition: 'all 0.18s ease',
              };
              return (
                <div className="fade-slide-up" style={{
                  borderRadius: '20px', overflow: 'hidden',
                  background: '#111', border: '1px solid rgba(255,255,255,0.06)',
                  maxHeight: '400px', overflowY: 'auto',
                }}>
                  <div style={{
                    // top: -1px overshoots the scroll port by 1px so content
                    // that's about to slide under the sticky doesn't peek
                    // through a sub-pixel gap above it. Padding bumped by 1px
                    // so the visible inner spacing stays the same.
                    padding: '17px 20px 10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '12px',
                    position: 'sticky', top: '-1px', zIndex: 2, background: '#111',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <p style={{
                      fontSize: '9px', color: 'rgba(255,255,255,0.3)',
                      letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600,
                      margin: 0,
                    }}>
                      Personal Records by:
                    </p>
                    {/* Weight / Volume toggle */}
                    <div style={{
                      display: 'flex',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '100px',
                      padding: '2px',
                      gap: '2px',
                      minWidth: '150px',
                    }}>
                      <button
                        onClick={() => setPrSortMode('weight')}
                        style={{
                          ...toggleBtnBase,
                          background: !byVolume ? 'rgba(239,68,68,0.9)' : 'transparent',
                          color: !byVolume ? 'white' : 'rgba(255,255,255,0.45)',
                          boxShadow: !byVolume ? '0 2px 8px rgba(239,68,68,0.3)' : 'none',
                        }}
                      >
                        Weight
                      </button>
                      <button
                        onClick={() => setPrSortMode('volume')}
                        style={{
                          ...toggleBtnBase,
                          background: byVolume ? 'rgba(239,68,68,0.9)' : 'transparent',
                          color: byVolume ? 'white' : 'rgba(255,255,255,0.45)',
                          boxShadow: byVolume ? '0 2px 8px rgba(239,68,68,0.3)' : 'none',
                        }}
                      >
                        Volume
                      </button>
                    </div>
                  </div>
                  {muscles.map((muscle) => {
                    const exercises = Object.keys(grouped[muscle]).sort((a, b) => {
                      // Rank exercises within a muscle by top lift of the active metric.
                      const aTop = grouped[muscle][a][0] ? sortKey(grouped[muscle][a][0]) : 0;
                      const bTop = grouped[muscle][b][0] ? sortKey(grouped[muscle][b][0]) : 0;
                      return bTop - aTop;
                    });
                    return (
                      <div key={muscle}>
                        <div style={{
                          position: 'sticky', top: '54px', zIndex: 1,
                          background: '#1a1a1a',
                          padding: '8px 20px',
                          fontSize: '11px', fontWeight: 700,
                          color: 'rgba(239,68,68,0.7)',
                          letterSpacing: '1px', textTransform: 'uppercase',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}>
                          {muscle}
                        </div>
                        {exercises.map((exercise) => {
                          const key = `${muscle}::${exercise}`;
                          const isOpen = expandedPR === key;
                          const lifts = grouped[muscle][exercise];
                          const topLift = lifts[0];
                          return (
                            <div key={exercise}>
                              <div
                                onClick={() => setExpandedPR(isOpen ? null : key)}
                                style={{
                                  padding: '14px 20px',
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  cursor: 'pointer',
                                }}
                                className="active:bg-white/5 transition-colors"
                              >
                                <div>
                                  <div style={{ fontSize: '14px', color: 'white', fontWeight: 500 }}>{exercise}</div>
                                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                                    Top: {topLift.weight} lbs × {topLift.reps}
                                    {byVolume && (
                                      <span style={{ color: 'rgba(239,68,68,0.7)', marginLeft: '8px', fontWeight: 700 }}>
                                        = {topLift.volume.toLocaleString()} vol
                                      </span>
                                    )}
                                    {lifts.length > 1 && <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: '8px' }}>· {lifts.length} PRs</span>}
                                  </div>
                                </div>
                                <svg style={{
                                  width: '16px', height: '16px',
                                  color: 'rgba(255,255,255,0.3)',
                                  transform: isOpen ? 'rotate(90deg)' : 'none',
                                  transition: 'transform 0.18s ease',
                                }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                              </div>
                              {isOpen && (
                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '4px 0' }}>
                                  {lifts.map((lift, i) => (
                                    <div key={i} style={{
                                      padding: '10px 20px 10px 36px',
                                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                      borderBottom: i < lifts.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                          fontSize: '10px', fontWeight: 800,
                                          color: i === 0 ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.2)',
                                          letterSpacing: '1px',
                                          width: '20px', textAlign: 'center',
                                        }}>
                                          {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                          {lift.weight} lbs × {lift.reps}
                                          {byVolume && (
                                            <span style={{ color: 'rgba(239,68,68,0.7)', marginLeft: '8px', fontWeight: 700 }}>
                                              = {lift.volume.toLocaleString()}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {lift.achievedAt && (
                                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                            {new Date(lift.achievedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                          </span>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            sharePR({
                                              muscle,
                                              exercise,
                                              weight: lift.weight,
                                              reps: lift.reps,
                                              achievedAt: lift.achievedAt,
                                            });
                                          }}
                                          title="Share PR"
                                          aria-label="Share PR"
                                          style={{
                                            width: '28px', height: '28px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            borderRadius: '6px',
                                            background: 'rgba(239,68,68,0.12)',
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Personal Records ticker moved to Profile page (between Member Info and Alpha banner). */}

            {/* ----- Original Tutorial card (glass style) — kept so you can swap back ----- */}
            {/*
            <div
              onClick={() => startTutorial(null)}
              className="w-full text-left glass-card rounded-2xl overflow-hidden fade-slide-up cursor-pointer active:scale-[0.98] transition-transform"
              style={{ animationDelay: '240ms' }}
            >
              <div className="h-1.5 bg-gradient-to-r from-wf-cyan to-wf-blue" />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-wf-cyan/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-wf-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white">Tutorial</h3>
                    <p className="text-xs text-wf-gray-400 mt-1">Step-by-step walkthrough to pick your first program, schedule workouts, and track your progress.</p>
                  </div>
                  <svg className="w-4 h-4 text-wf-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>
            */}

            {/* Tutorial card — Nike style */}
            <div
              onClick={() => startTutorial(null)}
              className="cursor-pointer active:scale-[0.98] transition-transform fade-slide-up"
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '2px',
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                animationDelay: '240ms',
              }}
            >
              {/* Cyan accent bar */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #06b6d4, rgba(6,182,212,0.5), transparent)' }} />

              {/* Cyan glow spotlight */}
              <div style={{
                position: 'absolute',
                top: '-30%', right: '-20%',
                width: '70%', height: '160%',
                background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 60%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative', padding: '24px' }}>
                <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(6,182,212,0.7)', letterSpacing: '0.3em' }}>
                  Get Started
                </p>
                <h3
                  className="text-[28px] font-black text-white leading-[0.9] tracking-tight"
                  style={{ fontFamily: 'system-ui', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
                >
                  TUTORIAL
                </h3>
                <p className="text-[11px] text-white/40 font-light mt-3 max-w-[300px] leading-relaxed">
                  Step-by-step walkthrough to pick your first program, schedule workouts, and track your progress.
                </p>
                <div className="flex items-center gap-1.5 mt-4">
                  <span className="text-[10px] text-white/40 uppercase font-medium" style={{ letterSpacing: '0.2em' }}>Begin</span>
                  <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* ----- Original Challenges card (glass style) — kept so you can swap back ----- */}
            {/*
            <div
              onClick={() => setSelectedGroup('challenges')}
              className="w-full text-left glass-card rounded-2xl overflow-hidden fade-slide-up cursor-pointer active:scale-[0.98] transition-transform"
              style={{ animationDelay: '0ms' }}
            >
              <div className="h-1.5 bg-wf-orange" />
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white tracking-tight">Challenges</h2>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-[10px] font-bold text-orange-400 uppercase tracking-wider">
                    Coming Soon
                  </span>
                </div>
                <p className="text-wf-gray-400 text-sm mt-1">Compete, push your limits, and earn rewards</p>
              </div>
            </div>
            */}

            {/* Challenges card — Nike style */}
            <div
              onClick={() => setSelectedGroup('challenges')}
              className="cursor-pointer active:scale-[0.98] transition-transform fade-slide-up"
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '2px',
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                animationDelay: '0ms',
              }}
            >
              {/* Orange accent bar */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #f97316, rgba(249,115,22,0.5), transparent)' }} />

              {/* Warm glow spotlight */}
              <div style={{
                position: 'absolute',
                top: '-30%', right: '-20%',
                width: '70%', height: '160%',
                background: 'radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 60%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative', padding: '24px' }}>
                <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(249,115,22,0.7)', letterSpacing: '0.3em' }}>
                  Coming Soon
                </p>
                <h3
                  className="text-[28px] font-black text-white leading-[0.9] tracking-tight"
                  style={{ fontFamily: 'system-ui', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
                >
                  CHALLENGES
                </h3>
                <p className="text-[11px] text-white/40 font-light mt-3 max-w-[280px] leading-relaxed">
                  Compete, push your limits, and earn rewards.
                </p>
                <div className="flex items-center gap-1.5 mt-4">
                  <span className="text-[10px] text-white/40 uppercase font-medium" style={{ letterSpacing: '0.2em' }}>Explore</span>
                  <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Stats & Streak card moved to Profile page. */}
            {/* Stacked Paper PR Cards moved to the Brainstorm page. */}

            {/* Heaviest Lifts — mesh gradient card (drifting aurora blobs).
                Always renders so brand-new users see the muscle structure +
                a "set your first PR" prompt. */}
            {(
              <div
                className="fade-slide-up"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '2px',
                  background: '#0a0a0a',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {/* Red accent bar (kept for category continuity with the rest of the page) */}
                <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.5), transparent)', position: 'relative', zIndex: 2 }} />

                {/* Drifting mesh gradient blobs */}
                <div style={{
                  position: 'absolute', top: '-10%', left: '-10%',
                  width: '320px', height: '320px', borderRadius: '50%',
                  background: '#ef4444', filter: 'blur(60px)', opacity: 0.55,
                  animation: 'wf-meshDrift1 14s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', top: '40%', right: '-20%',
                  width: '380px', height: '380px', borderRadius: '50%',
                  background: '#3b82f6', filter: 'blur(60px)', opacity: 0.45,
                  animation: 'wf-meshDrift2 16s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', bottom: '-15%', left: '30%',
                  width: '320px', height: '320px', borderRadius: '50%',
                  background: '#a855f7', filter: 'blur(60px)', opacity: 0.40,
                  animation: 'wf-meshDrift3 18s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />

                {/* Dark scrim overlay so the body-parts list stays readable
                    against the bright drifting blobs. */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.45) 100%)',
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1, padding: '24px' }}>
                  <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.3em', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                    Personal Records
                  </p>
                  <h3
                    className="text-[28px] font-black text-white leading-[0.9] tracking-tight mb-6"
                    style={{ fontFamily: 'system-ui', textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}
                  >
                    HEAVIEST LIFTS
                  </h3>
                  {bodyPartPRs.length === 0 && (
                    <p
                      className="mb-4"
                      style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 300, lineHeight: 1.5, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                    >
                      You haven't set any PRs yet. Start your first workout to set some PRs!!
                    </p>
                  )}
                  {['Chest', 'Back', 'Shoulders', 'Quads', 'Biceps', 'Triceps'].map((muscle, i, arr) => {
                    const pr = bodyPartPRs.find((p) => p.muscle_group?.toLowerCase() === muscle.toLowerCase());
                    return (
                      <div key={muscle} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: i < arr.length - 1 ? '10px' : '0' }}>
                        <span style={{ flex: '0 0 33.333%', fontSize: '11px', color: 'rgba(255,255,255,0.55)', letterSpacing: '1px', textTransform: 'uppercase', paddingTop: '1px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{muscle}</span>
                        {pr ? (
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'white', textShadow: '0 0 10px rgba(239,68,68,0.5), 0 1px 4px rgba(0,0,0,0.7)', wordBreak: 'break-word' }}>
                            {pr.exercise_name} — {Number(pr.best_weight)} lbs × {pr.best_reps} reps
                          </span>
                        ) : (
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                            No PR set
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {renderBeginModals()}
      {renderCreateMenu()}

      {/* Tutorial pointer — spotlight cutout with glowing pulse ring */}
      {tutorialPointer === 'create' && pointerRect && (() => {
        const pad = 8;
        return (
        <div className="fixed inset-0 z-[90]" onClick={() => setTutorialPointer(null)}>
          {/* Dark overlay with spotlight cutout */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            <defs>
              <mask id="create-pointer-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={pointerRect.left - pad}
                  y={pointerRect.top - pad}
                  width={pointerRect.width + pad * 2}
                  height={pointerRect.height + pad * 2}
                  rx="16"
                  fill="black"
                />
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#create-pointer-mask)" />
          </svg>
          {/* Glowing pulse ring */}
          <div
            className="absolute rounded-2xl border-2 border-wf-cyan/60 shadow-[0_0_20px_rgba(0,200,255,0.3),0_0_40px_rgba(0,200,255,0.1)] animate-pulse"
            style={{
              top: pointerRect.top - pad,
              left: pointerRect.left - pad,
              width: pointerRect.width + pad * 2,
              height: pointerRect.height + pad * 2,
              pointerEvents: 'none',
            }}
          />
          {/* Second ring for depth */}
          <div
            className="absolute rounded-2xl border border-wf-cyan/20"
            style={{
              top: pointerRect.top - 12,
              left: pointerRect.left - 12,
              width: pointerRect.width + 24,
              height: pointerRect.height + 24,
              pointerEvents: 'none',
              animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
          {/* Tooltip */}
          <div
            className="absolute w-[calc(100%-32px)] max-w-sm bg-wf-gray-900 border border-white/10 rounded-2xl p-4 shadow-2xl"
            style={{
              top: pointerRect.bottom + 24,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-1">Create a Workout</h3>
            <p className="text-sm text-wf-gray-400 leading-relaxed">
              Tap the <span className="text-white font-semibold">+ Create</span> button to build your own workout, create a new program, or add a workout to an existing program.
            </p>
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                onClick={() => { setTutorialPointer(null); setShowCreateMenu(true); }}
                className="text-sm font-semibold text-white btn-gradient py-2 px-5 rounded-xl active:scale-[0.97] transition-transform"
              >
                Got it
              </button>
              <button
                onClick={() => setTutorialPointer(null)}
                className="text-sm font-semibold text-white/70 bg-white/10 hover:bg-white/15 active:bg-white/20 transition-colors py-2 px-5 rounded-xl border border-white/10"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
        );
      })()}
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
      .catch(() => {})
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

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          onUndo={() => { undoToast.undoFn(); setUndoToast(null); }}
          onExpire={() => { undoToast.commitFn?.(); setUndoToast(null); }}
        />
      )}
    </div>
  );
}
