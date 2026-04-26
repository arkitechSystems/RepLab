import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';

// Nike-styled plate calculator. Greedy-fills standard plate denominations
// per side until the requested weight is reached. Doesn't handle kilo
// plates or unusual sets (e.g. fractional 1.25/0.5) — keep this minimal
// for now; iterate if users ask for more.

const BAR_OPTIONS = [
  { value: 45, label: '45 lb (Olympic)' },
  { value: 35, label: '35 lb' },
  { value: 25, label: '25 lb' },
  { value: 15, label: '15 lb' },
  { value: 0, label: 'No bar (DBs / fixed)' },
];

// Each plate has a color, a width (px) for the visual stack, and the lb
// denomination. Ordered heaviest → lightest for the greedy fill.
const PLATES = [
  { lb: 45,  color: '#1f2937', text: '#fff', height: 92, label: '45' },
  { lb: 35,  color: '#fbbf24', text: '#000', height: 78, label: '35' },
  { lb: 25,  color: '#16a34a', text: '#fff', height: 70, label: '25' },
  { lb: 10,  color: '#ffffff', text: '#000', height: 58, label: '10' },
  { lb: 5,   color: '#3b82f6', text: '#fff', height: 48, label: '5' },
  { lb: 2.5, color: '#ef4444', text: '#fff', height: 40, label: '2.5' },
];

function computePlatesPerSide(perSideWeight) {
  const out = [];
  let remaining = perSideWeight;
  for (const p of PLATES) {
    const count = Math.floor(remaining / p.lb);
    if (count > 0) {
      out.push({ ...p, count });
      remaining = +(remaining - count * p.lb).toFixed(3);
    }
  }
  return { plates: out, leftover: remaining };
}

export default function PlateCalculator() {
  const navigate = useNavigate();
  const [target, setTarget] = useState('135');
  const [bar, setBar] = useState(45);

  const targetNum = Number(target) || 0;

  const { plates, leftover, perSide, valid } = useMemo(() => {
    const overBar = targetNum - bar;
    if (overBar < 0) return { plates: [], leftover: 0, perSide: 0, valid: false };
    const ps = overBar / 2;
    const { plates, leftover } = computePlatesPerSide(ps);
    return { plates, leftover, perSide: ps, valid: true };
  }, [targetNum, bar]);

  return (
    <div className="pb-24">
      <StickyHeader title="PLATE CALCULATOR" titleStyle={{ fontSize: '26.4px' }}>
        <button
          onClick={() => navigate(-1)}
          className="text-[11px] uppercase font-bold text-wf-gray-400 active:text-white"
          style={{ letterSpacing: '0.2em' }}
        >
          Back
        </button>
      </StickyHeader>

      <div className="px-4 pt-1 space-y-4">
        {/* Target weight + bar — Nike-style panel */}
        <div
          className="relative overflow-hidden fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-5">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}>
              Target
            </p>
            <h2 className="text-[28px] font-black text-white tracking-tight mb-4" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
              TOTAL WEIGHT
            </h2>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="2.5"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-transparent text-white text-[44px] font-black tracking-tight focus:outline-none tabular-nums"
                  style={{ fontFamily: 'system-ui', letterSpacing: '-0.02em' }}
                  placeholder="0"
                />
              </div>
              <span className="text-[14px] text-white/40 font-light pb-3">lbs</span>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
                Bar Weight
              </p>
              <div className="flex flex-wrap gap-2">
                {BAR_OPTIONS.map((b) => {
                  const on = b.value === bar;
                  return (
                    <button
                      key={b.value}
                      onClick={() => setBar(b.value)}
                      className="text-[10px] font-bold uppercase whitespace-nowrap py-2 px-3 active:scale-[0.97] transition-transform"
                      style={{
                        letterSpacing: '0.15em',
                        borderRadius: '2px',
                        background: on
                          ? 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)'
                          : 'rgba(255,255,255,0.05)',
                        boxShadow: on
                          ? '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'
                          : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                        color: on ? '#fff' : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Result — visual bar + per-side stack */}
        <div
          className="relative overflow-hidden fade-slide-up"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            animationDelay: '60ms',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #22c55e, rgba(34,197,94,0.25), transparent)' }} />
          <div className="relative p-5">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(34,197,94,0.85)', letterSpacing: '0.3em' }}>
              Per Side
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <h2 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                {valid ? perSide.toFixed(perSide % 1 ? 1 : 0) : '—'}
              </h2>
              <span className="text-[14px] text-white/40 font-light">lbs / side</span>
            </div>

            {/* Bar + plates visual */}
            {valid && bar > 0 && (
              <div className="my-5 flex items-center justify-center" style={{ minHeight: 110 }}>
                {/* Left side plates (mirror order) */}
                <div className="flex items-center" style={{ gap: 2 }}>
                  {plates.slice().reverse().map((p, i) =>
                    Array.from({ length: p.count }).map((_, n) => (
                      <PlateBlock key={`L-${i}-${n}`} plate={p} />
                    ))
                  )}
                </div>
                {/* Bar (sleeve + center) */}
                <div className="flex items-center" style={{ height: 14 }}>
                  <div style={{ width: 8, height: 14, background: '#9ca3af', borderRadius: '1px 0 0 1px' }} />
                  <div style={{ width: 60, height: 6, background: '#6b7280' }} />
                  <div style={{ width: 8, height: 14, background: '#9ca3af', borderRadius: '0 1px 1px 0' }} />
                </div>
                {/* Right side plates */}
                <div className="flex items-center" style={{ gap: 2 }}>
                  {plates.map((p, i) =>
                    Array.from({ length: p.count }).map((_, n) => (
                      <PlateBlock key={`R-${i}-${n}`} plate={p} />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Plate count list */}
            {valid && plates.length > 0 && (
              <div className="space-y-2">
                {plates.map((p) => (
                  <div key={p.lb} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-flex items-center justify-center text-[10px] font-black"
                        style={{
                          width: 22, height: 22,
                          borderRadius: '50%',
                          background: p.color,
                          color: p.text,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                        }}
                      >
                        {p.label}
                      </span>
                      <span className="text-white/80 font-medium">{p.lb} lb plate{p.count > 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-white tabular-nums font-bold">× {p.count}</span>
                  </div>
                ))}
              </div>
            )}

            {valid && plates.length === 0 && (
              <p className="text-[12px] text-white/45 italic">Just the bar — no plates needed.</p>
            )}
            {valid && leftover > 0 && (
              <p className="text-[11px] mt-3" style={{ color: 'rgba(251,191,36,0.85)' }}>
                Closest match leaves {leftover} lb short per side. Add fractional or change-plate denominations to hit exactly.
              </p>
            )}
            {!valid && (
              <p className="text-[12px] text-wf-red font-medium">
                Target weight is less than the bar.
              </p>
            )}
          </div>
        </div>

        {/* Quick-set chips — common 1RM-ish jumps */}
        <div className="fade-slide-up" style={{ animationDelay: '120ms' }}>
          <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
            Quick Set
          </p>
          <div className="flex flex-wrap gap-2">
            {[95, 135, 185, 225, 275, 315, 365, 405].map((w) => (
              <button
                key={w}
                onClick={() => setTarget(String(w))}
                className="text-[11px] font-bold py-2 px-3 active:scale-[0.97] transition-transform tabular-nums"
                style={{
                  letterSpacing: '0.05em',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.05)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                {w} lb
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Visual block for a plate. Width is fixed (10px) so a heavy stack reads
// proportional to count, not denomination. Height varies by plate weight
// to match real plate diameters.
function PlateBlock({ plate }) {
  return (
    <div
      style={{
        width: 10,
        height: plate.height,
        background: plate.color,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)',
        borderRadius: '1px',
      }}
      aria-label={`${plate.label} pound plate`}
    />
  );
}
