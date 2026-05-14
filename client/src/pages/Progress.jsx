import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import StickyHeader from '../components/StickyHeader';
import { classifyExercise } from '../utils/muscleGroup';

const HERO_WINDOW_DAYS = 30;

// Computes the four hero numbers from the raw progress-overload payload.
// Returns null when nothing has been logged inside the window — the card
// then hides instead of showing a row of zeros.
function computeHeroStats(raw, days = HERO_WINDOW_DAYS) {
  if (!raw || raw.length === 0) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const sessionDates = new Set();
  const exercises = new Set();
  let totalRepsGained = 0;
  let biggestJump = null;

  for (const g of raw) {
    const recent = g.occurrences.filter((o) => o.date >= cutoffStr);
    if (recent.length === 0) continue;
    exercises.add(g.exercise);
    for (const o of recent) sessionDates.add(o.date);

    // Per-(exercise, weight): max reps on the earliest in-window date vs the
    // latest. A positive delta counts toward Reps Gained and competes for
    // Biggest Jump. Negative deltas don't subtract — we only celebrate gains.
    const byDate = new Map();
    for (const o of recent) {
      byDate.set(o.date, Math.max(byDate.get(o.date) || 0, o.reps));
    }
    const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length >= 2) {
      const delta = sorted[sorted.length - 1][1] - sorted[0][1];
      if (delta > 0) {
        totalRepsGained += delta;
        if (!biggestJump || delta > biggestJump.delta) {
          biggestJump = { exercise: g.exercise, weight: g.weight, delta };
        }
      }
    }
  }

  if (sessionDates.size === 0) return null;
  return {
    sessions: sessionDates.size,
    exercises: exercises.size,
    repsGained: totalRepsGained,
    biggestJump,
  };
}

// Count-up animator. When `value` arrives (or changes), tween from the
// current displayed number to the target over `duration` ms using an
// ease-out cubic so the early frames feel snappy and the tail settles.
function useCountUp(value, duration = 900) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    const start = performance.now();
    const from = fromRef.current;
    const to = value;
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function StatNumber({ value, prefix = '', accent = 'rgba(255,255,255,0.95)' }) {
  const display = useCountUp(value);
  return (
    <span
      className="text-[26px] font-black tracking-tight"
      style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontFamily: 'system-ui', letterSpacing: '-0.02em' }}
    >
      {prefix}{display.toLocaleString()}
    </span>
  );
}

// Color tokens shared with the Progressive Overload test page so the
// production view matches the pill design the user picked.
const COLORS = {
  up:      { bg: 'rgba(34,197,94,0.15)',  ring: 'rgba(34,197,94,0.45)',  text: '#86efac', solid: '#22c55e' },
  down:    { bg: 'rgba(239,68,68,0.15)',  ring: 'rgba(239,68,68,0.45)',  text: '#fca5a5', solid: '#ef4444' },
  same:    { bg: 'rgba(251,191,36,0.15)', ring: 'rgba(251,191,36,0.45)', text: '#fcd34d', solid: '#eab308' },
  // Used when a lift has been logged on only one date so far — no comparison
  // yet. Reverts to up/down/same once the same (exercise, weight) is repeated.
  neutral: { bg: 'rgba(255,255,255,0.05)', ring: 'rgba(255,255,255,0.20)', text: 'rgba(255,255,255,0.55)', solid: '#9ca3af' },
};

// Same display order as the home page's Heaviest Lifts list.
const BODY_PART_ORDER = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Traps'];

function fmtDate(s) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function trendOfReps(prev, curr) {
  if (curr > prev) return 'up';
  if (curr < prev) return 'down';
  return 'same';
}

// Server returns: [{ exercise, weight, occurrences: [{ date, reps, setNumber }] }]
// We collapse occurrences down to per-date {sets, best, total} and tag each
// row with its body-part bucket via the shared classifier.
function shapeRows(raw) {
  return raw.map((g) => {
    const byDate = new Map();
    for (const o of g.occurrences) {
      if (!byDate.has(o.date)) byDate.set(o.date, []);
      byDate.get(o.date).push(o.reps);
    }
    const weeks = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sets]) => ({
        date,
        sets,
        best: Math.max(...sets),
        total: sets.reduce((s, r) => s + r, 0),
      }));
    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    const trend = last.best > first.best ? 'up' : last.best < first.best ? 'down' : 'same';
    return {
      exercise: g.exercise,
      weight: Number(g.weight),
      bodyPart: classifyExercise(g.exercise) || 'Other',
      weeks,
      trend,
      delta: last.best - first.best,
    };
  });
}

export default function Progress() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedBodyPart, setSelectedBodyPart] = useState('All');

  useEffect(() => {
    const controller = new AbortController();
    api('/sessions/progress-overload', { signal: controller.signal })
      .then(setRaw)
      .catch((err) => { if (err.name !== 'AbortError') setLoadError('Failed to load progress data'); });
    return () => controller.abort();
  }, []);

  const allRows = useMemo(() => raw ? shapeRows(raw) : [], [raw]);

  const bodyParts = useMemo(() => {
    const present = [...new Set(allRows.map((r) => r.bodyPart))];
    return present.sort((a, b) => {
      const ai = BODY_PART_ORDER.indexOf(a);
      const bi = BODY_PART_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [allRows]);

  const rows = useMemo(() => {
    if (selectedBodyPart === 'All') return allRows;
    return allRows.filter((r) => r.bodyPart === selectedBodyPart);
  }, [allRows, selectedBodyPart]);

  const heroStats = useMemo(() => computeHeroStats(raw), [raw]);

  return (
    <div className="pb-24">
      <StickyHeader title="PROGRESS" titleStyle={{ fontSize: '26.4px' }}>
        <button
          onClick={() => navigate(-1)}
          className="text-[11px] uppercase font-bold text-wf-gray-400 active:text-white"
          style={{ letterSpacing: '0.2em' }}
        >
          Back
        </button>
      </StickyHeader>

      <div className="px-4 pt-1 space-y-4">
        {/* Hero stats card — shown once data has loaded and the user has
            logged something in the window. Numbers tween up on first render
            via useCountUp; the tile divs use staggered fade-slide-up classes
            so they cascade in after the card itself slides in. */}
        {heroStats && (
          <div
            className="relative overflow-hidden fade-slide-up"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.25), transparent)' }} />
            <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
            <div className="relative p-5">
              <p className="text-[10px] uppercase font-light mb-4" style={{ color: 'rgba(34,197,94,0.85)', letterSpacing: '0.3em' }}>
                Last {HERO_WINDOW_DAYS} Days
              </p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="fade-slide-up" style={{ animationDelay: '60ms' }}>
                  <StatNumber value={heroStats.sessions} />
                  <p className="text-[9px] uppercase mt-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>Sessions</p>
                </div>
                <div className="fade-slide-up" style={{ animationDelay: '140ms' }}>
                  <StatNumber value={heroStats.exercises} />
                  <p className="text-[9px] uppercase mt-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>Exercises</p>
                </div>
                <div className="fade-slide-up" style={{ animationDelay: '220ms' }}>
                  <StatNumber value={heroStats.repsGained} prefix={heroStats.repsGained > 0 ? '+' : ''} accent={heroStats.repsGained > 0 ? COLORS.up.text : 'rgba(255,255,255,0.95)'} />
                  <p className="text-[9px] uppercase mt-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>Reps Gained</p>
                </div>
              </div>
              <div
                className="fade-slide-up"
                style={{
                  animationDelay: '300ms',
                  background: heroStats.biggestJump
                    ? 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.02) 100%)'
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${heroStats.biggestJump ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '2px',
                  padding: '10px 14px',
                }}
              >
                <p className="text-[9px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>Biggest Jump</p>
                {heroStats.biggestJump ? (
                  <p className="text-[13px] font-bold text-white truncate">
                    {heroStats.biggestJump.exercise}
                    <span className="ml-2 text-[11px] font-light" style={{ color: COLORS.up.text }}>
                      +{heroStats.biggestJump.delta} reps · {heroStats.biggestJump.weight} lbs
                    </span>
                  </p>
                ) : (
                  <p className="text-[12px] text-white/40">Log the same weight again to start a comparison.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Intro panel — explains what the page tracks. Same Nike panel
            shell used by Plate Calculator etc. */}
        <div
          className="relative overflow-hidden fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-5">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(34,197,94,0.85)', letterSpacing: '0.3em' }}>
              Progressive Overload
            </p>
            <h2 className="text-[24px] font-black text-white tracking-tight mb-2" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              SAME WEIGHT.<br/>MORE REPS?
            </h2>
            <p className="text-[12px] text-white/50 mt-2 leading-relaxed">
              Every lift you've logged. Greener = more reps than last time. Yellow = flat. Red = fewer. Gray = no comparison yet — log the same weight on another day to start the trend.
            </p>
            <div className="flex items-center gap-3 mt-3 text-[10px] uppercase tracking-[0.2em] flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.up.solid }} /><span style={{ color: COLORS.up.text }}>Up</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.same.solid }} /><span style={{ color: COLORS.same.text }}>Flat</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.down.solid }} /><span style={{ color: COLORS.down.text }}>Down</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.neutral.solid }} /><span style={{ color: COLORS.neutral.text }}>New</span></span>
            </div>
          </div>
        </div>

        {/* Body-part filter */}
        {allRows.length > 0 && (
          <div>
            <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
              Body Part
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {['All', ...bodyParts].map((bp) => {
                const on = selectedBodyPart === bp;
                const count = bp === 'All' ? allRows.length : allRows.filter((r) => r.bodyPart === bp).length;
                return (
                  <button
                    key={bp}
                    onClick={() => setSelectedBodyPart(bp)}
                    className="text-[10px] font-bold uppercase whitespace-nowrap py-2 px-3 active:scale-[0.97] transition-transform"
                    style={{
                      letterSpacing: '0.18em',
                      borderRadius: '2px',
                      background: on
                        ? 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)'
                        : 'rgba(255,255,255,0.05)',
                      boxShadow: on
                        ? '0 4px 14px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.15)'
                        : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                      color: on ? '#fff' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {bp} <span className="opacity-60 font-normal ml-0.5">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading + error + empty states */}
        {raw === null && !loadError && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl h-24" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        )}
        {loadError && (
          <div className="text-center py-8">
            <p className="text-red-400 mb-3 text-sm">{loadError}</p>
            <button onClick={() => window.location.reload()} className="text-wf-cyan text-sm">Tap to retry</button>
          </div>
        )}
        {raw !== null && allRows.length === 0 && (
          <div className="rounded-2xl p-6 text-center" style={{
            background: 'linear-gradient(160deg, #1c1c1c 0%, #111 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p className="text-white/70 text-sm font-bold mb-1">Nothing logged yet</p>
            <p className="text-white/40 text-xs">Complete a workout and your lifts will show up here.</p>
          </div>
        )}
        {raw !== null && allRows.length > 0 && rows.length === 0 && (
          <div className="rounded-2xl p-6 text-center" style={{
            background: 'linear-gradient(160deg, #1c1c1c 0%, #111 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p className="text-white/50 text-sm">No lifts logged yet for {selectedBodyPart}.</p>
          </div>
        )}

        {/* Set-by-Set Pills — chosen viz from the test page. Each set shown
            as a colored chip; row 1 is gray (baseline), subsequent rows
            color each chip vs prior date's best. */}
        {rows.length > 0 && (
          <div className="rounded-2xl p-4" style={{
            background: 'linear-gradient(160deg, #1c1c1c 0%, #111 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div className="space-y-5">
              {rows.map((r) => {
                // No prior date to compare against → render every chip in
                // neutral gray. As soon as the user logs the same
                // (exercise, weight) on a second date this flips to the
                // baseline/flat yellow on row 1 and trend colors after.
                const noComparison = r.weeks.length === 1;
                return (
                  <div key={`${r.exercise}-${r.weight}`}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-white text-sm font-bold truncate">{r.exercise}</span>
                      <span className="text-white/40 text-[11px] shrink-0 ml-2">{r.weight} lbs</span>
                    </div>
                    {r.weeks.map((w, wi) => {
                      const prevBest = wi === 0 ? null : r.weeks[wi - 1].best;
                      return (
                        <div key={w.date} className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] text-white/40 w-12 shrink-0">{fmtDate(w.date)}</span>
                          <div className="flex gap-1.5 flex-wrap">
                            {w.sets.map((reps, si) => {
                              const t = prevBest === null ? 'same' : trendOfReps(prevBest, reps);
                              const c = noComparison
                                ? COLORS.neutral
                                : (wi === 0 ? COLORS.same : COLORS[t]);
                              return (
                                <span key={si} className="text-[12px] font-bold tabular-nums px-2.5 py-1 rounded-md"
                                  style={{ background: c.bg, color: c.text, boxShadow: `inset 0 0 0 1px ${c.ring}` }}>
                                  {reps}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
