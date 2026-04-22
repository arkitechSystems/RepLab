import { useNavigate } from 'react-router-dom';

const SHELL = {
  background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
  borderRadius: '2px',
  position: 'relative',
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
};

const AccentBar = ({ color }) => (
  <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}40 60%, transparent)` }} />
);

const Spotlight = ({ color }) => (
  <div
    className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none"
    style={{ background: `radial-gradient(circle, ${color}14 0%, transparent 60%)`, filter: 'blur(40px)' }}
  />
);

const Label = ({ children, color = 'rgba(255,255,255,0.4)' }) => (
  <p className="text-[11px] uppercase font-light" style={{ letterSpacing: '0.3em', color }}>
    {children}
  </p>
);

const CardFrame = ({ id, title, description, children }) => (
  <div className="space-y-2">
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-bold text-white/30 tabular-nums" style={{ letterSpacing: '0.2em' }}>
        {String(id).padStart(2, '0')}
      </span>
      <span className="text-[11px] font-semibold text-white/70 uppercase" style={{ letterSpacing: '0.15em' }}>{title}</span>
    </div>
    {children}
    <p className="text-[11px] text-white/40 font-light leading-relaxed">{description}</p>
  </div>
);

const CalFrame = ({ id, title, description, children }) => (
  <div className="space-y-3">
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-bold text-wf-red tabular-nums" style={{ letterSpacing: '0.2em' }}>
        M{String(id).padStart(2, '0')}
      </span>
      <span className="text-[12px] font-bold text-white uppercase" style={{ letterSpacing: '0.15em' }}>{title}</span>
    </div>
    {children}
    <p className="text-[11px] text-white/40 font-light leading-relaxed">{description}</p>
  </div>
);

// Sample April 2026 month (today = 21st). 35 cells: Sun → Sat, 5 weeks.
const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CAL_COLORS = {
  Chest: '#ef4444', Back: '#3b82f6', Legs: '#22c55e', Shoulders: '#a855f7', Arms: '#f97316',
};
const SAMPLE_MONTH = [
  { n: 29, inMonth: false },
  { n: 30, inMonth: false },
  { n: 31, inMonth: false },
  { n: 1, inMonth: true, status: 'complete', workout: 'Legs' },
  { n: 2, inMonth: true, status: 'complete', workout: 'Shoulders' },
  { n: 3, inMonth: true, status: 'complete', workout: 'Arms' },
  { n: 4, inMonth: true, status: 'rest' },
  { n: 5, inMonth: true, status: 'rest' },
  { n: 6, inMonth: true, status: 'complete', workout: 'Chest' },
  { n: 7, inMonth: true, status: 'complete', workout: 'Back' },
  { n: 8, inMonth: true, status: 'complete', workout: 'Legs' },
  { n: 9, inMonth: true, status: 'complete', workout: 'Shoulders' },
  { n: 10, inMonth: true, status: 'complete', workout: 'Arms' },
  { n: 11, inMonth: true, status: 'rest' },
  { n: 12, inMonth: true, status: 'rest' },
  { n: 13, inMonth: true, status: 'complete', workout: 'Chest' },
  { n: 14, inMonth: true, status: 'skipped', workout: 'Back' },
  { n: 15, inMonth: true, status: 'complete', workout: 'Legs' },
  { n: 16, inMonth: true, status: 'complete', workout: 'Shoulders' },
  { n: 17, inMonth: true, status: 'complete', workout: 'Arms' },
  { n: 18, inMonth: true, status: 'rest' },
  { n: 19, inMonth: true, status: 'rest' },
  { n: 20, inMonth: true, status: 'complete', workout: 'Chest' },
  { n: 21, inMonth: true, status: 'today', workout: 'Back' },
  { n: 22, inMonth: true, status: 'scheduled', workout: 'Legs' },
  { n: 23, inMonth: true, status: 'scheduled', workout: 'Shoulders' },
  { n: 24, inMonth: true, status: 'scheduled', workout: 'Arms' },
  { n: 25, inMonth: true, status: 'rest' },
  { n: 26, inMonth: true, status: 'rest' },
  { n: 27, inMonth: true, status: 'scheduled', workout: 'Chest' },
  { n: 28, inMonth: true, status: 'scheduled', workout: 'Back' },
  { n: 29, inMonth: true, status: 'scheduled', workout: 'Legs' },
  { n: 30, inMonth: true, status: 'scheduled', workout: 'Shoulders' },
  { n: 1, inMonth: false },
  { n: 2, inMonth: false },
];

const MonthHeader = ({ color = 'rgba(239,68,68,0.9)', gap = 'gap-1' }) => (
  <div className={`grid grid-cols-7 ${gap} mb-2`}>
    {DAY_LETTERS.map((d) => (
      <div key={d} className="text-center text-[9px] uppercase font-light py-1" style={{ letterSpacing: '0.25em', color }}>{d}</div>
    ))}
  </div>
);

export default function NikeCardsTest() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black">
      <div className="px-4 pt-6 pb-24 max-w-[480px] mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        <h1 className="text-2xl font-black text-white tracking-tight">Nike Cards</h1>
        <p className="text-[12px] text-white/40 mt-1 mb-8">20 reusable Nike-style card patterns. Mix accents and contents as needed.</p>

        {/* ===== Monthly Calendar Explorations ===== */}
        <div className="mb-10">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] font-bold text-wf-red uppercase" style={{ letterSpacing: '0.25em' }}>Monthly Calendars</span>
          </div>
          <h2 className="text-[18px] font-black text-white tracking-tight mb-1">5 Directions</h2>
          <p className="text-[11px] text-white/40 mb-6 leading-relaxed">Each variant uses April 2026 sample data (today = 21st). Pick one — or mix.</p>

          <div className="space-y-10">

            {/* M01 — Shell Grid (current /calendar style) */}
            <CalFrame
              id={1}
              title="Shell Grid"
              description="Each day is its own Nike card with a light-gray top line. Uniform, structured, reads like a grid of tiles. Current /calendar style."
            >
              <MonthHeader />
              <div className="grid grid-cols-7 gap-1">
                {SAMPLE_MONTH.map((d, i) => {
                  const accent = d.workout ? CAL_COLORS[d.workout] : null;
                  const isToday = d.status === 'today';
                  const isDone = d.status === 'complete';
                  return (
                    <div
                      key={i}
                      className={`relative overflow-hidden min-h-[66px] ${!d.inMonth ? 'opacity-20' : ''}`}
                      style={{
                        borderRadius: '2px',
                        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                        boxShadow: isToday
                          ? '0 4px 12px rgba(239,68,68,0.25), inset 0 0 0 1px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
                          : isDone
                            ? '0 4px 12px rgba(34,197,94,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'
                            : '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ height: '2px', background: 'linear-gradient(90deg, #9ca3af, rgba(156,163,175,0.5), transparent)' }} />
                      <div className="p-1.5 text-center">
                        <div className={`text-[13px] font-black tracking-tight ${isToday ? 'text-wf-red' : isDone ? 'text-green-400' : 'text-white'}`}>{d.n}</div>
                        {d.inMonth && d.workout && (
                          <div className="text-[8px] font-bold uppercase mt-0.5 truncate" style={{ color: isDone ? 'rgba(34,197,94,0.85)' : `${accent}cc`, letterSpacing: '0.1em' }}>
                            {d.workout}
                          </div>
                        )}
                        {d.inMonth && d.workout && (
                          <div className="flex justify-center mt-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: isDone ? '#22c55e' : accent }} />
                          </div>
                        )}
                        {d.inMonth && d.status === 'rest' && (
                          <div className="text-[8px] font-light uppercase mt-0.5 text-white/25" style={{ letterSpacing: '0.2em' }}>Rest</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CalFrame>

            {/* M02 — Minimal Hairlines */}
            <CalFrame
              id={2}
              title="Minimal Hairlines"
              description="One big Nike shell. No per-cell cards — just thin hairline dividers. Big centered date numbers. Today is a red pill. Workouts show as a colored dot under the date."
            >
              <MonthHeader color="rgba(255,255,255,0.4)" gap="gap-0" />
              <div style={SHELL}>
                <AccentBar color="#ef4444" />
                <div className="grid grid-cols-7" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {SAMPLE_MONTH.map((d, i) => {
                    const accent = d.workout ? CAL_COLORS[d.workout] : null;
                    const isToday = d.status === 'today';
                    const isDone = d.status === 'complete';
                    const rightEdge = (i % 7) !== 6;
                    const bottomEdge = i < 28;
                    return (
                      <div
                        key={i}
                        className={`py-3 text-center ${!d.inMonth ? 'opacity-20' : ''}`}
                        style={{
                          borderRight: rightEdge ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          borderBottom: bottomEdge ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                      >
                        <div className="relative inline-flex items-center justify-center w-7 h-7">
                          {isToday && (
                            <div className="absolute inset-0 rounded-full" style={{ background: '#ef4444', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }} />
                          )}
                          <span className={`relative text-[14px] font-black tracking-tight ${isToday ? 'text-white' : isDone ? 'text-green-400' : 'text-white/85'}`}>{d.n}</span>
                        </div>
                        <div className="flex justify-center mt-1 h-[6px]">
                          {d.inMonth && d.workout && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: isDone ? '#22c55e' : accent, boxShadow: `0 0 6px ${isDone ? 'rgba(34,197,94,0.6)' : `${accent}99`}` }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CalFrame>

            {/* M03 — Heatmap Blocks */}
            <CalFrame
              id={3}
              title="Heatmap Blocks"
              description="Each cell is a colored block — workout tint at low alpha, completed glows green, today is red outlined, rest is dark. Date number small in the top-left. Reads like a training map at a glance."
            >
              <MonthHeader />
              <div className="grid grid-cols-7 gap-[3px]">
                {SAMPLE_MONTH.map((d, i) => {
                  const accent = d.workout ? CAL_COLORS[d.workout] : null;
                  const isToday = d.status === 'today';
                  const isDone = d.status === 'complete';
                  const isSkipped = d.status === 'skipped';
                  let bg = 'rgba(255,255,255,0.02)'; // empty/rest
                  if (d.inMonth && isDone) bg = 'rgba(34,197,94,0.32)';
                  else if (d.inMonth && d.workout && !isSkipped) bg = `${accent}28`;
                  else if (d.inMonth && isSkipped) bg = 'rgba(255,255,255,0.03)';

                  return (
                    <div
                      key={i}
                      className={`relative min-h-[56px] ${!d.inMonth ? 'opacity-20' : ''}`}
                      style={{
                        borderRadius: '4px',
                        background: bg,
                        boxShadow: isToday ? `inset 0 0 0 2px #ef4444, 0 0 20px rgba(239,68,68,0.3)` : 'inset 0 0 0 1px rgba(255,255,255,0.04)',
                      }}
                    >
                      <div className="absolute top-1 left-1.5 text-[10px] font-black tracking-tight" style={{ color: isToday ? '#ef4444' : d.inMonth ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)' }}>
                        {d.n}
                      </div>
                      {d.inMonth && d.workout && (
                        <div className="absolute bottom-1 right-1.5 text-[7px] font-bold uppercase" style={{ color: isDone ? 'rgba(34,197,94,0.9)' : `${accent}ee`, letterSpacing: '0.05em' }}>
                          {d.workout.slice(0, 3)}
                        </div>
                      )}
                      {isSkipped && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-px" style={{ background: 'rgba(255,255,255,0.3)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CalFrame>

            {/* M04 — Display Typography */}
            <CalFrame
              id={4}
              title="Display Typography"
              description="No cell backgrounds or borders — just the dates and workout names in an editorial hierarchy. Big heavy numbers dominate. Today is red + underlined. Feels like a printed magazine page."
            >
              <div className="grid grid-cols-7 gap-1 mb-3 pb-2 border-b border-white/10">
                {DAY_LETTERS.map((d) => (
                  <div key={d} className="text-center text-[9px] uppercase font-light py-1" style={{ letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)' }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                {SAMPLE_MONTH.map((d, i) => {
                  const accent = d.workout ? CAL_COLORS[d.workout] : null;
                  const isToday = d.status === 'today';
                  const isDone = d.status === 'complete';
                  return (
                    <div key={i} className={`text-center min-h-[54px] ${!d.inMonth ? 'opacity-15' : ''}`}>
                      <div className="relative inline-block">
                        <div
                          className={`text-[22px] font-black tracking-tight leading-none ${isToday ? 'text-wf-red' : isDone ? 'text-green-400' : d.inMonth ? 'text-white' : 'text-white/30'}`}
                          style={{ fontFamily: 'system-ui' }}
                        >
                          {d.n}
                        </div>
                        {isToday && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full h-[2px]" style={{ background: '#ef4444' }} />
                        )}
                      </div>
                      {d.inMonth && d.workout && (
                        <div className="text-[7px] font-bold uppercase mt-1 truncate" style={{ color: isDone ? 'rgba(34,197,94,0.85)' : `${accent}cc`, letterSpacing: '0.1em' }}>
                          {d.workout.slice(0, 5)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CalFrame>

            {/* M05 — Color-Coded Tiles */}
            <CalFrame
              id={5}
              title="Color-Coded Tiles"
              description="Each cell is its own Nike card, but the top accent bar matches the workout — turning the whole grid into a rainbow of training days. Premium, varied, most visually expressive."
            >
              <MonthHeader gap="gap-1.5" />
              <div className="grid grid-cols-7 gap-1.5">
                {SAMPLE_MONTH.map((d, i) => {
                  const accent = d.workout ? CAL_COLORS[d.workout] : null;
                  const today = d.status === 'today';
                  const isDone = d.status === 'complete';
                  const topHex = d.inMonth
                    ? today ? '#ef4444' : d.workout ? accent : 'rgba(255,255,255,0.15)'
                    : 'rgba(255,255,255,0.08)';
                  return (
                    <div
                      key={i}
                      className={`relative overflow-hidden min-h-[72px] ${!d.inMonth ? 'opacity-20' : ''}`}
                      style={{
                        borderRadius: '2px',
                        background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                        boxShadow: today
                          ? '0 6px 16px rgba(239,68,68,0.3), inset 0 0 0 1px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
                          : '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ height: '3px', background: `linear-gradient(90deg, ${topHex}, ${topHex}80, transparent)` }} />
                      {d.workout && d.inMonth && (
                        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at top right, ${isDone ? 'rgba(34,197,94,0.18)' : `${accent}1f`} 0%, transparent 60%)` }} />
                      )}
                      <div className="relative p-1.5 text-center">
                        <div className={`text-[15px] font-black tracking-tight leading-none mt-0.5 ${today ? 'text-wf-red' : isDone ? 'text-green-400' : 'text-white'}`}>{d.n}</div>
                        {d.inMonth && d.workout && (
                          <div className="text-[8px] font-bold uppercase mt-1.5 truncate" style={{ color: isDone ? 'rgba(34,197,94,0.9)' : `${accent}ee`, letterSpacing: '0.1em' }}>
                            {d.workout}
                          </div>
                        )}
                        {d.inMonth && d.status === 'rest' && (
                          <div className="text-[8px] font-light uppercase mt-1.5 text-white/25" style={{ letterSpacing: '0.2em' }}>Rest</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CalFrame>

          </div>
        </div>

        <div className="space-y-8">

          {/* 01 — Single Stat Tile */}
          <CardFrame id={1} title="Single Stat Tile" description="Compact single-metric pill. Use inline in a row or as a solo hero number.">
            <div className="text-center py-4 px-2 relative overflow-hidden" style={SHELL}>
              <div className="text-[26px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>12</div>
              <div className="text-[7px] uppercase font-light mt-1" style={{ color: 'rgba(249,115,22,0.6)', letterSpacing: '0.25em' }}>Day Streak</div>
            </div>
          </CardFrame>

          {/* 02 — Triple Stat Row */}
          <CardFrame id={2} title="Triple Stat Row" description="Three side-by-side stats. Default homepage/profile header pattern.">
            <div className="flex gap-3">
              {[
                { value: 12, label: 'Day Streak', color: 'rgba(249,115,22,0.6)' },
                { value: 84, label: 'Total', color: 'rgba(239,68,68,0.6)' },
                { value: 7, label: 'This Month', color: 'rgba(34,197,94,0.6)' },
              ].map((s, i) => (
                <div key={i} className="flex-1 text-center py-4 px-2 relative overflow-hidden" style={SHELL}>
                  <div className="text-[26px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
                  <div className="text-[7px] uppercase font-light mt-1" style={{ color: s.color, letterSpacing: '0.25em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </CardFrame>

          {/* 03 — Program Count + Categories */}
          <CardFrame id={3} title="Program Summary" description="Count + category chips on the right. Works for library, saved, favorites.">
            <div style={SHELL}>
              <AccentBar color="#22c55e" />
              <Spotlight color="#22c55e" />
              <div className="relative px-6 pt-5 pb-4 border-b border-white/10">
                <Label>Browse Workout Library</Label>
              </div>
              <div className="relative px-6 py-5 flex items-center justify-between gap-5">
                <div>
                  <div className="text-[44px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.9' }}>24</div>
                  <div className="text-[10px] text-white/30 uppercase font-semibold mt-1" style={{ letterSpacing: '0.3em' }}>Programs</div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 flex-1 justify-items-end text-right">
                  {['Hypertrophy', 'Strength', 'Hybrid', 'Conditioning'].map((t) => (
                    <span key={t} className="text-[10px] font-bold uppercase whitespace-nowrap" style={{ color: 'rgba(34,197,94,0.75)', letterSpacing: '0.25em' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 04 — Up Next hero */}
          <CardFrame id={4} title="Hero — Up Next" description="Two-line display title + primary/secondary pill CTAs. Homepage hero.">
            <div style={SHELL}>
              <AccentBar color="#ef4444" />
              <Spotlight color="#ef4444" />
              <div className="relative p-6">
                <Label color="rgba(255,255,255,0.3)">Up Next</Label>
                <h2 className="text-[28px] font-black text-white tracking-tight mt-2 mb-1" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                  YOUR NEXT<br/>WORKOUT
                </h2>
                <div className="mt-4 mb-5">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[15px] font-semibold text-white">Chest One</span>
                    <span className="w-px h-3.5 bg-white/10" />
                    <span className="text-[13px] text-white/35 font-light">Monday</span>
                  </div>
                  <p className="text-[12px] text-white/25 font-light">Will's Hypertrophy — Week 3</p>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 py-3.5 rounded-full text-[11px] font-bold uppercase active:scale-[0.97] transition-all" style={{ background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)', color: '#000', letterSpacing: '0.15em', boxShadow: '0 6px 20px rgba(255,255,255,0.1)' }}>Start Now</button>
                  <button className="flex-1 py-3.5 rounded-full border border-white/15 text-white/50 text-[11px] font-medium uppercase active:bg-white/5 transition-colors" style={{ letterSpacing: '0.15em' }}>Browse</button>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 05 — CTA Card */}
          <CardFrame id={5} title="CTA Card" description="Accent eyebrow + display title + paragraph + inline arrow. Secondary entry point.">
            <div className="cursor-pointer active:scale-[0.98] transition-transform" style={SHELL}>
              <AccentBar color="#06b6d4" />
              <Spotlight color="#06b6d4" />
              <div className="relative p-6">
                <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(6,182,212,0.7)', letterSpacing: '0.3em' }}>Get Started</p>
                <h3 className="text-[28px] font-black text-white leading-[0.9] tracking-tight" style={{ fontFamily: 'system-ui', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>TUTORIAL</h3>
                <p className="text-[11px] text-white/40 font-light mt-3 max-w-[300px] leading-relaxed">Step-by-step walkthrough to pick your first program, schedule workouts, and track your progress.</p>
                <div className="flex items-center gap-1.5 mt-4">
                  <span className="text-[10px] text-white/40 uppercase font-medium" style={{ letterSpacing: '0.2em' }}>Begin</span>
                  <svg className="w-3 h-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 06 — Badge Card */}
          <CardFrame id={6} title="Badge Card" description="Header label + status pill (e.g. 'Coming Soon', 'New', 'Beta').">
            <div style={SHELL}>
              <AccentBar color="#f97316" />
              <Spotlight color="#f97316" />
              <div className="relative px-6 pt-5 pb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-[22px] font-black text-white tracking-tight">CHALLENGES</h3>
                  <p className="text-[11px] text-white/35 font-light mt-1">Compete, push limits, earn rewards</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(249,115,22,0.15)', color: 'rgba(249,115,22,0.9)', border: '1px solid rgba(249,115,22,0.3)', letterSpacing: '0.2em' }}>Soon</span>
              </div>
            </div>
          </CardFrame>

          {/* 07 — Trend Metric */}
          <CardFrame id={7} title="Trend Metric" description="Value + up/down delta. Use for weekly volume, bodyweight, heart rate trend.">
            <div style={SHELL}>
              <AccentBar color="#22c55e" />
              <Spotlight color="#22c55e" />
              <div className="relative p-6">
                <Label>Weekly Volume</Label>
                <div className="flex items-end gap-3 mt-3">
                  <div className="text-[40px] font-black text-white tracking-tight leading-none" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>18,420</div>
                  <span className="text-[10px] text-white/30 font-light uppercase pb-2" style={{ letterSpacing: '0.2em' }}>lbs</span>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                  <span className="text-[11px] font-bold" style={{ color: '#22c55e' }}>+12.4%</span>
                  <span className="text-[10px] text-white/30 font-light">vs last week</span>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 08 — Progress Bar */}
          <CardFrame id={8} title="Progress Card" description="Title + percentage + bar. Use for program progress, monthly goals, level-ups.">
            <div style={SHELL}>
              <AccentBar color="#a855f7" />
              <Spotlight color="#a855f7" />
              <div className="relative p-6">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <Label>Program Progress</Label>
                    <h3 className="text-[17px] font-bold text-white mt-1">Will's Hypertrophy</h3>
                  </div>
                  <div className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>62<span className="text-[14px] text-white/30">%</span></div>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: '62%', background: 'linear-gradient(90deg, #a855f7, #d946ef)' }} />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-white/30 font-light uppercase" style={{ letterSpacing: '0.2em' }}>Week 5 / 8</span>
                  <span className="text-[10px] text-white/30 font-light">3 weeks left</span>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 09 — Streak */}
          <CardFrame id={9} title="Streak Flame" description="Day streak hero with flame. More prominent than the stat tile.">
            <div style={SHELL}>
              <AccentBar color="#f97316" />
              <Spotlight color="#f97316" />
              <div className="relative p-6 flex items-center justify-between">
                <div>
                  <Label color="rgba(249,115,22,0.6)">Current Streak</Label>
                  <div className="flex items-baseline gap-2 mt-2">
                    <div className="text-[56px] font-black text-white tracking-tight leading-none" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>12</div>
                    <span className="text-[14px] text-white/40 font-light uppercase" style={{ letterSpacing: '0.2em' }}>days</span>
                  </div>
                  <p className="text-[11px] text-white/30 font-light mt-2">Keep it going — 3 more for a new PB</p>
                </div>
                <div className="text-[64px]" style={{ filter: 'drop-shadow(0 0 24px rgba(249,115,22,0.4))' }}>🔥</div>
              </div>
            </div>
          </CardFrame>

          {/* 10 — PR Highlight */}
          <CardFrame id={10} title="PR Highlight" description="Personal record call-out. Shows muscle group, lift, weight, date.">
            <div style={SHELL}>
              <AccentBar color="#ef4444" />
              <Spotlight color="#ef4444" />
              <div className="relative p-6">
                <div className="flex items-center gap-2">
                  <Label color="rgba(239,68,68,0.7)">Chest PR</Label>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-[10px] text-white/30 font-light">2 days ago</span>
                </div>
                <h3 className="text-[22px] font-black text-white tracking-tight mt-2">Barbell Bench Press</h3>
                <div className="flex items-baseline gap-6 mt-3 pt-3 border-t border-white/5">
                  <div>
                    <div className="text-[32px] font-black text-white leading-none" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>225</div>
                    <div className="text-[9px] text-white/30 font-semibold uppercase mt-1" style={{ letterSpacing: '0.25em' }}>lbs</div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <div className="text-[32px] font-black text-white leading-none" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>6</div>
                    <div className="text-[9px] text-white/30 font-semibold uppercase mt-1" style={{ letterSpacing: '0.25em' }}>reps</div>
                  </div>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 11 — Workout Preview */}
          <CardFrame id={11} title="Workout Preview" description="Template summary: name + duration + top exercises list.">
            <div style={SHELL}>
              <AccentBar color="#3b82f6" />
              <Spotlight color="#3b82f6" />
              <div className="relative p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Label color="rgba(59,130,246,0.7)">Monday</Label>
                    <h3 className="text-[22px] font-black text-white tracking-tight mt-1">Chest & Triceps</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-white/40 font-light">~58 min</div>
                    <div className="text-[10px] text-white/30 uppercase font-semibold mt-0.5" style={{ letterSpacing: '0.2em' }}>6 exercises</div>
                  </div>
                </div>
                <div className="space-y-1.5 pt-3 border-t border-white/5">
                  {['Barbell Bench Press', 'Incline DB Press', 'Cable Flyes', 'Tricep Pushdown'].map((ex, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[12px] text-white/60 font-light">{ex}</span>
                      <span className="text-[10px] text-white/25 font-semibold tabular-nums">4 × 8-12</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-white/25 font-light pt-1">+ 2 more</div>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 12 — Timer Chip */}
          <CardFrame id={12} title="Timer / Action Chip" description="Compact action bar: count + primary pill button. Rest timers, quick-starts.">
            <div style={SHELL}>
              <AccentBar color="#eab308" />
              <Spotlight color="#eab308" />
              <div className="relative p-5 flex items-center justify-between gap-4">
                <div>
                  <Label color="rgba(234,179,8,0.7)">Rest Timer</Label>
                  <div className="text-[28px] font-black text-white tracking-tight mt-1" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>01:30</div>
                </div>
                <button className="py-3 px-6 rounded-full text-[11px] font-bold uppercase active:scale-[0.97] transition-all" style={{ background: 'linear-gradient(135deg, #fff 0%, #e0e0e0 100%)', color: '#000', letterSpacing: '0.15em', boxShadow: '0 6px 20px rgba(255,255,255,0.1)' }}>Start</button>
              </div>
            </div>
          </CardFrame>

          {/* 13 — Dual-Stat Split */}
          <CardFrame id={13} title="Dual-Stat Split" description="Two related numbers with a divider. Best → latest, weight → reps, etc.">
            <div style={SHELL}>
              <AccentBar color="#ec4899" />
              <Spotlight color="#ec4899" />
              <div className="relative p-6 grid grid-cols-2 gap-4">
                <div>
                  <Label color="rgba(236,72,153,0.65)">Best Squat</Label>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-[34px] font-black text-white leading-none tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>315</span>
                    <span className="text-[11px] text-white/30 uppercase" style={{ letterSpacing: '0.2em' }}>lbs</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1.5">3 months ago</p>
                </div>
                <div className="pl-4 border-l border-white/10">
                  <Label color="rgba(236,72,153,0.65)">Latest</Label>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-[34px] font-black text-white leading-none tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>295</span>
                    <span className="text-[11px] text-white/30 uppercase" style={{ letterSpacing: '0.2em' }}>lbs</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1.5">Yesterday</p>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 14 — Leaderboard Row */}
          <CardFrame id={14} title="Leaderboard Row" description="Rank + avatar placeholder + name + score. Stack several for full boards.">
            <div className="space-y-2">
              {[
                { rank: 1, name: 'Will M.', score: '18,420', accent: '#eab308' },
                { rank: 2, name: 'Jess K.', score: '16,180', accent: '#94a3b8' },
                { rank: 3, name: 'Alex R.', score: '15,720', accent: '#f97316' },
              ].map((r) => (
                <div key={r.rank} style={SHELL} className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: r.accent }} />
                  <div className="relative px-5 py-3.5 flex items-center gap-4">
                    <div className="text-[24px] font-black text-white/70 w-6" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>{r.rank}</div>
                    <div className="w-9 h-9 rounded-full" style={{ background: `linear-gradient(135deg, ${r.accent}, ${r.accent}60)` }} />
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-white">{r.name}</div>
                      <div className="text-[9px] text-white/30 uppercase font-semibold mt-0.5" style={{ letterSpacing: '0.25em' }}>volume · lbs</div>
                    </div>
                    <div className="text-[17px] font-black text-white tracking-tight tabular-nums" style={{ fontFamily: 'system-ui' }}>{r.score}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardFrame>

          {/* 15 — Quick Action Grid */}
          <CardFrame id={15} title="Quick Action Grid" description="2×2 shortcut tiles. Icon + label. Nav or utility hub.">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Log Workout', accent: '#ef4444', icon: 'M12 4v16m8-8H4' },
                { label: 'Schedule', accent: '#3b82f6', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                { label: 'Progress', accent: '#22c55e', icon: 'M3 3v18h18M7 14l4-4 4 4 6-6' },
                { label: 'Library', accent: '#a855f7', icon: 'M4 6h16M4 12h16M4 18h10' },
              ].map((a, i) => (
                <div key={i} className="cursor-pointer active:scale-[0.97] transition-transform" style={SHELL}>
                  <div className="h-[2px]" style={{ background: a.accent }} />
                  <div className="relative p-4">
                    <svg className="w-5 h-5 mb-3" fill="none" viewBox="0 0 24 24" stroke={a.accent} strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={a.icon} />
                    </svg>
                    <div className="text-[11px] font-bold text-white uppercase" style={{ letterSpacing: '0.15em' }}>{a.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardFrame>

          {/* 16 — Tag Stack */}
          <CardFrame id={16} title="Tag Stack" description="Header + row of filter pills. Muscle groups, equipment, tags.">
            <div style={SHELL}>
              <AccentBar color="#14b8a6" />
              <Spotlight color="#14b8a6" />
              <div className="relative p-6">
                <Label color="rgba(20,184,166,0.7)">Targets</Label>
                <h3 className="text-[18px] font-bold text-white mt-1 mb-4">Full Body Workout</h3>
                <div className="flex flex-wrap gap-2">
                  {['Chest', 'Back', 'Legs', 'Shoulders', 'Core'].map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full text-[10px] font-bold uppercase" style={{ background: 'rgba(20,184,166,0.1)', color: 'rgba(20,184,166,0.9)', border: '1px solid rgba(20,184,166,0.25)', letterSpacing: '0.2em' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 17 — Category Banner */}
          <CardFrame id={17} title="Category Banner" description="Wide, heavy-display banner. Section headers inside a list or a program hero.">
            <div style={SHELL}>
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 8px)' }} />
              <Spotlight color="#a855f7" />
              <div className="relative px-6 py-7">
                <Label color="rgba(168,85,247,0.7)">Featured Program</Label>
                <h2 className="text-[40px] font-black text-white tracking-tight leading-[0.9] mt-2" style={{ fontFamily: 'system-ui' }}>
                  WILL'S<br/>HYPERTROPHY
                </h2>
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-[10px] font-bold uppercase" style={{ color: 'rgba(168,85,247,0.8)', letterSpacing: '0.25em' }}>8 Weeks</span>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span className="text-[10px] font-bold uppercase text-white/50" style={{ letterSpacing: '0.25em' }}>Intermediate</span>
                </div>
              </div>
            </div>
          </CardFrame>

          {/* 18 — Medal / Achievement */}
          <CardFrame id={18} title="Achievement Card" description="Medal + title + descriptor. Use for badges, milestones, unlocks.">
            <div style={SHELL}>
              <AccentBar color="#eab308" />
              <Spotlight color="#eab308" />
              <div className="relative p-6 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-[28px]" style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.25) 0%, rgba(234,179,8,0.05) 60%, transparent 100%)', border: '1px solid rgba(234,179,8,0.4)' }}>🏆</div>
                <div className="flex-1">
                  <Label color="rgba(234,179,8,0.8)">Achievement Unlocked</Label>
                  <h3 className="text-[17px] font-black text-white tracking-tight mt-1">Century Club</h3>
                  <p className="text-[11px] text-white/35 font-light mt-0.5">100 workouts completed</p>
                </div>
                <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </CardFrame>

          {/* 19 — Countdown */}
          <CardFrame id={19} title="Countdown Card" description="Days/hours until an event. Challenges start, program end, rest end.">
            <div style={SHELL}>
              <AccentBar color="#ef4444" />
              <Spotlight color="#ef4444" />
              <div className="relative p-6">
                <Label color="rgba(239,68,68,0.7)">Challenge Starts In</Label>
                <div className="flex items-end gap-4 mt-3">
                  {[
                    { v: '02', u: 'days' },
                    { v: '14', u: 'hrs' },
                    { v: '32', u: 'min' },
                  ].map((t) => (
                    <div key={t.u}>
                      <div className="text-[36px] font-black text-white leading-none tracking-tight" style={{ fontFamily: 'system-ui', fontVariantNumeric: 'tabular-nums' }}>{t.v}</div>
                      <div className="text-[9px] text-white/30 uppercase font-semibold mt-1" style={{ letterSpacing: '0.25em' }}>{t.u}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-white/50 font-medium mt-4">April Push-Up Challenge</p>
              </div>
            </div>
          </CardFrame>

          {/* 20 — Announcement with dismiss */}
          <CardFrame id={20} title="Announcement" description="Banner with title + body + dismiss. New feature callouts, updates, tips.">
            <div style={SHELL}>
              <AccentBar color="#06b6d4" />
              <Spotlight color="#06b6d4" />
              <div className="relative p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(6,182,212,0.15)', color: 'rgba(6,182,212,0.95)', letterSpacing: '0.2em' }}>New</span>
                    <h3 className="text-[13px] font-bold text-white">Video exercise demos</h3>
                  </div>
                  <button className="text-white/30 hover:text-white/60 active:scale-95 transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-[12px] text-white/45 font-light leading-relaxed">Every exercise now includes a reference video. Tap any exercise card to see form demos before you lift.</p>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className="text-[10px] uppercase font-medium" style={{ color: 'rgba(6,182,212,0.9)', letterSpacing: '0.2em' }}>Learn More</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="rgba(6,182,212,0.9)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </CardFrame>

        </div>
      </div>
    </div>
  );
}
