import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Real data pulled from Wmartin (id 37) — same exercise + same weight,
// observed across 2+ different dates. Built via a one-off dump script
// against production sessions / session_entries on 2026-04-28.
// `bodyPart` matches the muscle-group convention used on the Workouts
// home page (Chest, Back, Shoulders, Quads, Biceps, Triceps, etc.).
const FIXTURES = [
  {
    exercise: 'Leg Press',
    weight: 630,
    bodyPart: 'Quads',
    occurrences: [
      { date: '2026-03-29', reps: 6, setNumber: 4 },
      { date: '2026-03-29', reps: 6, setNumber: 5 },
      { date: '2026-03-29', reps: 6, setNumber: 6 },
      { date: '2026-04-25', reps: 8, setNumber: 1 },
      { date: '2026-04-25', reps: 8, setNumber: 1 },
      { date: '2026-04-25', reps: 8, setNumber: 2 },
      { date: '2026-04-25', reps: 8, setNumber: 2 },
    ],
  },
  {
    exercise: 'Pull Ups',
    weight: 45,
    bodyPart: 'Back',
    occurrences: [
      { date: '2026-03-28', reps: 6, setNumber: 1 },
      { date: '2026-03-28', reps: 6, setNumber: 2 },
      { date: '2026-03-28', reps: 4, setNumber: 3 },
      { date: '2026-04-06', reps: 7, setNumber: 1 },
      { date: '2026-04-06', reps: 5, setNumber: 2 },
      { date: '2026-04-06', reps: 5, setNumber: 3 },
    ],
  },
  {
    exercise: 'Banded DB Shoulder Press',
    weight: 50,
    bodyPart: 'Shoulders',
    occurrences: [
      { date: '2026-03-28', reps: 6, setNumber: 1 },
      { date: '2026-03-28', reps: 6, setNumber: 2 },
      { date: '2026-03-28', reps: 4, setNumber: 3 },
      { date: '2026-04-06', reps: 8, setNumber: 1 },
      { date: '2026-04-06', reps: 7, setNumber: 2 },
    ],
  },
  {
    exercise: 'Cable Tri Pushdown',
    weight: 66,
    bodyPart: 'Triceps',
    occurrences: [
      { date: '2026-03-28', reps: 13, setNumber: 3 },
      { date: '2026-04-06', reps: 12, setNumber: 1 },
      { date: '2026-04-06', reps: 8, setNumber: 2 },
      { date: '2026-04-06', reps: 8, setNumber: 3 },
    ],
  },
];

// Group occurrences by date and compute summary stats per session-date.
// Output: [{ exercise, weight, weeks: [{ date, sets: [reps], best, avg, total }] }]
function groupByWeek(fixtures) {
  return fixtures.map((f) => {
    const byDate = new Map();
    for (const o of f.occurrences) {
      if (!byDate.has(o.date)) byDate.set(o.date, []);
      byDate.get(o.date).push(o.reps);
    }
    const weeks = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sets]) => ({
        date,
        sets,
        best: Math.max(...sets),
        avg: sets.reduce((s, r) => s + r, 0) / sets.length,
        total: sets.reduce((s, r) => s + r, 0),
      }));
    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    const trend = last.best > first.best ? 'up' : last.best < first.best ? 'down' : 'same';
    return { ...f, weeks, trend, delta: last.best - first.best };
  });
}

const COLORS = {
  up:   { bg: 'rgba(34,197,94,0.15)',  ring: 'rgba(34,197,94,0.45)',  text: '#86efac', solid: '#22c55e' },
  down: { bg: 'rgba(239,68,68,0.15)',  ring: 'rgba(239,68,68,0.45)',  text: '#fca5a5', solid: '#ef4444' },
  same: { bg: 'rgba(251,191,36,0.15)', ring: 'rgba(251,191,36,0.45)', text: '#fcd34d', solid: '#eab308' },
};

function fmtDate(s) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function trendOfReps(prev, curr) {
  if (curr > prev) return 'up';
  if (curr < prev) return 'down';
  return 'same';
}

// Section wrapper used between every approach.
function Section({ index, title, tag, children }) {
  return (
    <div className="mb-8">
      <div className="px-4 mb-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[11px] text-wf-red font-mono">{String(index).padStart(2, '0')}</span>
          <h2 className="text-white text-base font-black tracking-tight">{title}</h2>
          <span className="text-[10px] text-wf-gray-500 uppercase tracking-[0.2em]">{tag}</span>
        </div>
      </div>
      <div className="rounded-2xl mx-2 p-4" style={{
        background: 'linear-gradient(160deg, #1c1c1c 0%, #111 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   01. VERDICT CARD — Big arrow + IMPROVED / FLAT / DECLINED label
   ================================================================ */
function VerdictCard({ rows }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const c = COLORS[r.trend];
        const arrow = r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→';
        const label = r.trend === 'up' ? 'IMPROVED' : r.trend === 'down' ? 'DECLINED' : 'FLAT';
        return (
          <div key={r.exercise} className="flex items-center gap-4 p-4 rounded-xl" style={{
            background: c.bg, boxShadow: `inset 0 0 0 1px ${c.ring}`,
          }}>
            <div className="text-[44px] font-black leading-none" style={{ color: c.text, fontFamily: 'system-ui' }}>{arrow}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[15px] font-bold tracking-tight truncate">{r.exercise}</p>
              <p className="text-white/40 text-[11px]">{r.weight} lbs · best set {r.weeks[0].best} → {r.weeks[r.weeks.length-1].best} reps</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: c.text }}>{label}</p>
              <p className="text-[24px] font-black leading-none" style={{ color: c.text }}>{r.delta > 0 ? '+' : ''}{r.delta}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   02. SET-BY-SET PILLS — Each set as a colored chip
   ================================================================ */
function SetByPills({ rows }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.exercise}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-white text-sm font-bold">{r.exercise}</span>
            <span className="text-white/40 text-[11px]">{r.weight} lbs</span>
          </div>
          {r.weeks.map((w, wi) => {
            const prevBest = wi === 0 ? null : r.weeks[wi - 1].best;
            return (
              <div key={w.date} className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-white/40 w-12 shrink-0">{fmtDate(w.date)}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {w.sets.map((reps, si) => {
                    const t = prevBest === null ? 'same' : trendOfReps(prevBest, reps);
                    const c = wi === 0 ? COLORS.same : COLORS[t];
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
      ))}
    </div>
  );
}

/* ================================================================
   03. SPARKLINE — Mini line chart of best reps across dates
   ================================================================ */
function Sparkline({ rows }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const c = COLORS[r.trend];
        const w = 160, h = 40;
        const max = Math.max(...r.weeks.map((x) => x.best));
        const min = Math.min(...r.weeks.map((x) => x.best));
        const range = max - min || 1;
        const pts = r.weeks.map((wk, i) => {
          const x = (i / Math.max(1, r.weeks.length - 1)) * w;
          const y = h - ((wk.best - min) / range) * h;
          return [x, y];
        });
        const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        return (
          <div key={r.exercise} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-bold truncate">{r.exercise}</p>
              <p className="text-white/40 text-[10px]">{r.weight} lbs</p>
            </div>
            <svg width={w} height={h} className="shrink-0">
              <path d={d} stroke={c.solid} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="3" fill={c.solid} />
              ))}
            </svg>
            <span className="w-10 text-right text-[13px] font-black tabular-nums" style={{ color: c.text }}>
              {r.delta > 0 ? '+' : ''}{r.delta}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   04. BAR CHART — Grouped vertical bars per date, rep counts
   ================================================================ */
function BarChart({ rows }) {
  const all = rows.flatMap((r) => r.weeks.flatMap((w) => w.sets));
  const max = Math.max(...all);
  return (
    <div className="space-y-5">
      {rows.map((r) => (
        <div key={r.exercise}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-white text-[13px] font-bold">{r.exercise}</span>
            <span className="text-white/40 text-[10px]">{r.weight} lbs</span>
          </div>
          <div className="flex items-end gap-3" style={{ height: 80 }}>
            {r.weeks.map((w, wi) => {
              const prevBest = wi === 0 ? null : r.weeks[wi - 1].best;
              return (
                <div key={w.date} className="flex-1">
                  <div className="flex items-end gap-1 h-[60px]">
                    {w.sets.map((reps, si) => {
                      const t = prevBest === null ? 'same' : trendOfReps(prevBest, reps);
                      const c = wi === 0 ? COLORS.same : COLORS[t];
                      const hh = (reps / max) * 60;
                      return (
                        <div key={si} className="flex-1 flex flex-col items-center justify-end">
                          <span className="text-[9px] tabular-nums mb-1" style={{ color: c.text }}>{reps}</span>
                          <div className="w-full rounded-t-sm" style={{ height: hh, background: c.solid, opacity: 0.85 }} />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-white/30 text-center mt-2">{fmtDate(w.date)}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   05. HEATMAP GRID — Sets x weeks, cell color by reps trend
   ================================================================ */
function HeatmapGrid({ rows }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const maxSets = Math.max(...r.weeks.map((w) => w.sets.length));
        return (
          <div key={r.exercise}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-white text-[13px] font-bold">{r.exercise}</span>
              <span className="text-white/40 text-[10px]">{r.weight} lbs</span>
            </div>
            <div className="flex gap-1">
              <div className="flex flex-col gap-1 mr-2">
                {r.weeks.map((w) => (
                  <span key={w.date} className="text-[9px] text-white/40 h-6 flex items-center">{fmtDate(w.date)}</span>
                ))}
              </div>
              <div className="flex-1">
                {r.weeks.map((w, wi) => {
                  const prevBest = wi === 0 ? null : r.weeks[wi - 1].best;
                  return (
                    <div key={w.date} className="flex gap-1 mb-1">
                      {Array.from({ length: maxSets }).map((_, si) => {
                        const reps = w.sets[si];
                        if (reps === undefined) return <div key={si} className="flex-1 h-6 rounded-sm" style={{ background: 'rgba(255,255,255,0.02)' }} />;
                        const t = prevBest === null ? 'same' : trendOfReps(prevBest, reps);
                        const c = wi === 0 ? COLORS.same : COLORS[t];
                        return (
                          <div key={si} className="flex-1 h-6 rounded-sm flex items-center justify-center text-[10px] font-black tabular-nums"
                            style={{ background: c.bg, color: c.text, boxShadow: `inset 0 0 0 1px ${c.ring}` }}>
                            {reps}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   06. BEFORE / AFTER — Big numbers with delta arrow between
   ================================================================ */
function BeforeAfter({ rows }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const c = COLORS[r.trend];
        const a = r.weeks[0];
        const b = r.weeks[r.weeks.length - 1];
        return (
          <div key={r.exercise} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', boxShadow: `inset 0 0 0 1px ${c.ring}` }}>
            <p className="text-white text-[13px] font-bold mb-1 truncate">{r.exercise} <span className="text-white/40 font-light">· {r.weight} lbs</span></p>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-center flex-1">
                <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1">{fmtDate(a.date)}</p>
                <p className="text-[28px] font-black text-white tabular-nums leading-none">{a.best}</p>
                <p className="text-[9px] text-white/30 mt-1">best reps</p>
              </div>
              <div className="text-[20px] font-black" style={{ color: c.text }}>
                {r.trend === 'up' ? '→' : r.trend === 'down' ? '→' : '='}
              </div>
              <div className="text-center flex-1">
                <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: c.text }}>{fmtDate(b.date)}</p>
                <p className="text-[28px] font-black tabular-nums leading-none" style={{ color: c.text }}>{b.best}</p>
                <p className="text-[9px] text-white/30 mt-1">{r.delta > 0 ? '+' : ''}{r.delta} reps</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   07. STACKED VOLUME BARS — Total reps per date as horizontal bars
   ================================================================ */
function StackedVolume({ rows }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const max = Math.max(...r.weeks.map((w) => w.total));
        return (
          <div key={r.exercise}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-white text-[13px] font-bold truncate">{r.exercise}</span>
              <span className="text-white/40 text-[10px]">{r.weight} lbs · total reps</span>
            </div>
            {r.weeks.map((w, wi) => {
              const prevTotal = wi === 0 ? null : r.weeks[wi - 1].total;
              const t = prevTotal === null ? 'same' : trendOfReps(prevTotal, w.total);
              const c = wi === 0 ? COLORS.same : COLORS[t];
              const pct = (w.total / max) * 100;
              return (
                <div key={w.date} className="flex items-center gap-2 mb-1.5">
                  <span className="w-12 shrink-0 text-[10px] text-white/40">{fmtDate(w.date)}</span>
                  <div className="flex-1 h-5 rounded-sm relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: c.solid, opacity: 0.7 }} />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[10px] font-black tabular-nums text-white">{w.total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   08. WEEK STRIP — Set chips connected by colored arrows per row
   ================================================================ */
function WeekStrip({ rows }) {
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.exercise} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.025)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}>
          <p className="text-white text-[13px] font-bold mb-2">{r.exercise} <span className="text-white/40 font-light text-[10px]">· {r.weight} lbs</span></p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {r.weeks.map((w, wi) => {
              const prevBest = wi === 0 ? null : r.weeks[wi - 1].best;
              const t = prevBest === null ? 'same' : trendOfReps(prevBest, w.best);
              const c = wi === 0 ? COLORS.same : COLORS[t];
              return (
                <div key={w.date} className="flex items-center gap-2 shrink-0">
                  {wi > 0 && (
                    <span className="text-[16px] font-black" style={{ color: c.text }}>
                      {t === 'up' ? '↗' : t === 'down' ? '↘' : '→'}
                    </span>
                  )}
                  <div className="rounded-lg px-3 py-2 min-w-[68px] text-center" style={{
                    background: c.bg, boxShadow: `inset 0 0 0 1px ${c.ring}`,
                  }}>
                    <p className="text-[8px] text-white/50 uppercase tracking-widest">{fmtDate(w.date)}</p>
                    <p className="text-[18px] font-black tabular-nums leading-none mt-0.5" style={{ color: c.text }}>{w.best}</p>
                    <p className="text-[8px] text-white/40 mt-0.5">{w.sets.length} sets</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   09. STAT BLOCKS — Nike-style eyebrow + delta + label, in a grid
   ================================================================ */
function StatBlocks({ rows }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => {
        const c = COLORS[r.trend];
        const sign = r.delta > 0 ? '+' : '';
        return (
          <div key={r.exercise} className="rounded-xl p-3 relative overflow-hidden" style={{
            background: 'linear-gradient(160deg, #161616 0%, #0d0d0d 100%)',
            boxShadow: `inset 0 0 0 1px ${c.ring}`,
          }}>
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: c.solid }} />
            <p className="text-[8px] uppercase tracking-[0.25em]" style={{ color: c.text }}>{r.exercise}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{r.weight} lbs</p>
            <p className="text-[36px] font-black leading-none mt-2 tabular-nums" style={{ color: c.text, fontFamily: 'system-ui' }}>{sign}{r.delta}</p>
            <p className="text-[9px] text-white/40 mt-1">reps · {fmtDate(r.weeks[0].date)} → {fmtDate(r.weeks[r.weeks.length-1].date)}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   10. WEEKLY STACK TABLE — All exercises in one dense table.
   Rows = exercise+weight, columns = each date, cells = best/avg/total.
   ================================================================ */
function WeeklyStackTable({ rows }) {
  const allDates = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => r.weeks.forEach((w) => s.add(w.date)));
    return [...s].sort();
  }, [rows]);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-[11px] tabular-nums" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="text-left text-[9px] uppercase tracking-[0.2em] text-white/40 pb-2 pr-3 font-medium">Lift</th>
            {allDates.map((d) => (
              <th key={d} className="text-center text-[9px] uppercase tracking-[0.15em] text-white/40 pb-2 px-1.5 font-medium">{fmtDate(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.exercise} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <td className="py-2 pr-3 text-white align-top">
                <p className="text-[12px] font-bold leading-tight">{r.exercise}</p>
                <p className="text-[10px] text-white/40">{r.weight} lbs</p>
              </td>
              {allDates.map((d) => {
                const w = r.weeks.find((x) => x.date === d);
                if (!w) return <td key={d} className="text-center text-white/15 px-1.5">—</td>;
                const idx = r.weeks.findIndex((x) => x.date === d);
                const prevBest = idx === 0 ? null : r.weeks[idx - 1].best;
                const t = prevBest === null ? 'same' : trendOfReps(prevBest, w.best);
                const c = idx === 0 ? COLORS.same : COLORS[t];
                return (
                  <td key={d} className="px-1.5 py-1.5 align-middle">
                    <div className="rounded-md py-1.5 px-1 text-center" style={{
                      background: c.bg, boxShadow: `inset 0 0 0 1px ${c.ring}`,
                    }}>
                      <p className="text-[15px] font-black leading-none" style={{ color: c.text }}>{w.best}</p>
                      <p className="text-[8px] text-white/40 mt-0.5">{w.sets.length}×</p>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-white/35 mt-3">Cells show <strong>best reps</strong> achieved that date · ×N = number of sets at that weight · color compares vs prior dated row.</p>
    </div>
  );
}

/* ================================================================
   PAGE
   ================================================================ */
// Stable display order for body-part chips, matching the home page's
// Heaviest Lifts list. Anything else gets appended in alphabetical order.
const BODY_PART_ORDER = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Core'];

export default function ProgressiveOverloadTest() {
  const navigate = useNavigate();
  const allRows = useMemo(() => groupByWeek(FIXTURES), []);

  // All body parts that appear in the data, ordered.
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

  // Default to 'All' so users see the full picture; tap a chip to narrow.
  const [selectedBodyPart, setSelectedBodyPart] = useState('All');
  const rows = useMemo(() => {
    if (selectedBodyPart === 'All') return allRows;
    return allRows.filter((r) => r.bodyPart === selectedBodyPart);
  }, [allRows, selectedBodyPart]);

  return (
    <div className="min-h-screen" style={{ background: '#000' }}>
      <div className="px-4 pt-6 pb-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-black text-white mt-4">Progressive Overload Summaries</h1>
        <p className="text-xs text-wf-gray-500 mt-1">10 ways to visualize the same data: did I hit more reps the second time I lifted this weight?</p>
        <p className="text-[10px] text-white/30 mt-1 font-mono">Source: Wmartin (id 37) · 4 lifts with same-weight repeats</p>
        <div className="flex items-center gap-3 mt-3 text-[10px] uppercase tracking-[0.2em]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.up.solid }} /><span style={{ color: COLORS.up.text }}>Improved</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.same.solid }} /><span style={{ color: COLORS.same.text }}>Flat</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.down.solid }} /><span style={{ color: COLORS.down.text }}>Declined</span></span>
        </div>

        {/* Body-part filter — pick a muscle group to scope every viz below.
            "All" shows every lift; per-part chips narrow to that group only. */}
        <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mt-5 mb-2">Body Part</p>
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

      <div className="pt-4 pb-16">
        {rows.length === 0 && (
          <div className="mx-2 mb-8 p-6 rounded-2xl text-center" style={{
            background: 'linear-gradient(160deg, #1c1c1c 0%, #111 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p className="text-white/50 text-sm">No same-weight repeats logged yet for {selectedBodyPart}.</p>
          </div>
        )}
        <Section index={1} title="Verdict Card" tag="Static · Plain-English summary">
          <VerdictCard rows={rows} />
        </Section>
        <Section index={2} title="Set-by-Set Pills" tag="Each set as a colored chip">
          <SetByPills rows={rows} />
        </Section>
        <Section index={3} title="Sparkline Trendline" tag="Mini line chart of best reps">
          <Sparkline rows={rows} />
        </Section>
        <Section index={4} title="Bar Chart" tag="Vertical bars per set, grouped by date">
          <BarChart rows={rows} />
        </Section>
        <Section index={5} title="Heatmap Grid" tag="Sets × weeks, color-coded cells">
          <HeatmapGrid rows={rows} />
        </Section>
        <Section index={6} title="Before / After" tag="Big-number comparison">
          <BeforeAfter rows={rows} />
        </Section>
        <Section index={7} title="Volume Bars" tag="Total reps logged at that weight">
          <StackedVolume rows={rows} />
        </Section>
        <Section index={8} title="Week Strip" tag="Best reps node per date, arrow between">
          <WeekStrip rows={rows} />
        </Section>
        <Section index={9} title="Stat Blocks Grid" tag="Nike-style 2-up tile grid">
          <StatBlocks rows={rows} />
        </Section>
        <Section index={10} title="Weekly Stack Table" tag="All lifts, dense table — week stacked">
          <WeeklyStackTable rows={rows} />
        </Section>
      </div>
    </div>
  );
}
