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

// Plate denominations available for the manual +/- chip — common gym
// plates only. Note these don't include 2.5 since users rarely "+5lb"
// per side using fractionals.
const QUICK_PLATES = [5, 10, 25, 35, 45];

export default function PlateCalculator() {
  const navigate = useNavigate();
  const [target, setTarget] = useState('135');
  const [bar, setBar] = useState(45);
  // Selected manual-add plate. The +/- buttons on the bar use this value
  // to bump the target weight up or down.
  const [selectedPlate, setSelectedPlate] = useState(45);
  // 'both' = standard barbell (plates loaded on both ends, default)
  // 'one'  = one-side / landmine setup (only show + load one end)
  const [mode, setMode] = useState('both');

  const targetNum = Number(target) || 0;

  const { plates, leftover, perSide, valid } = useMemo(() => {
    const overBar = targetNum - bar;
    if (overBar < 0) return { plates: [], leftover: 0, perSide: 0, valid: false };
    // In one-side mode the user is only loading + lifting one end of the
    // bar (e.g. landmine row), so all the "over-bar" weight sits on that
    // single side. In both-sides mode the over-bar weight splits 50/50.
    const ps = mode === 'one' ? overBar : overBar / 2;
    const { plates, leftover } = computePlatesPerSide(ps);
    return { plates, leftover, perSide: ps, valid: true };
  }, [targetNum, bar, mode]);

  // +/- adjust target by N × selected plate value. Both-sides mode
  // multiplies by 2 (one plate per side), one-side mode multiplies by 1.
  function adjustTarget(direction) {
    const sides = mode === 'both' ? 2 : 1;
    const delta = direction * selectedPlate * sides;
    const next = Math.max(0, targetNum + delta);
    // Strip trailing .0 so the input doesn't render "225.0"
    setTarget(String(Number(next.toFixed(2))));
  }

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
        {/* One unified Nike panel: header (TOTAL WEIGHT + red live total),
            then bar weight chips, then the per-side section with the
            +/- adjustment buttons, plate visual, and Both/One toggle. */}
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
            {/* Header row: title on the left, live total weight (red,
                editable) on the right at the same display size as the
                title so they read as a balanced pair. */}
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <h2 className="text-[24px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                TOTAL WEIGHT
              </h2>
              <div className="flex items-baseline gap-1.5 shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="2.5"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="bg-transparent text-[49px] font-black tracking-tight focus:outline-none tabular-nums text-right"
                  style={{
                    fontFamily: 'system-ui',
                    letterSpacing: '-0.02em',
                    color: '#ef4444',
                    width: `${Math.max(2, String(target || '0').length) * 0.62}em`,
                    minWidth: '1.5em',
                  }}
                  placeholder="0"
                />
                <span className="text-[14px] text-white/40 font-light">lbs</span>
              </div>
            </div>

            {/* Per-side section — visualization, +/- adjustment, plate
                count list. Was a separate card; now a section in the
                merged panel. Subtle green divider above ties it back to
                the previous green-eyebrow treatment. */}
            <div className="pt-4" style={{ borderTop: '1px solid rgba(34,197,94,0.20)' }}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(34,197,94,0.85)', letterSpacing: '0.3em' }}>
                  {mode === 'one' ? 'One Side' : 'Per Side'}
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                    {valid ? perSide.toFixed(perSide % 1 ? 1 : 0) : '—'}
                  </h2>
                  <span className="text-[14px] text-white/40 font-light">
                    {mode === 'one' ? 'lbs loaded' : 'lbs / side'}
                  </span>
                </div>
              </div>
              {/* Both Sides / One Side / No Bar toggle — sits opposite the
                  +/- adjust buttons over the bar. The first two pick the
                  loading mode; "No Bar" sets bar weight to 0 for fixed-
                  weight setups (dumbbells, plate-loaded machines). */}
              <div className="flex flex-col gap-1 shrink-0">
                {[
                  { v: 'both', label: 'Both Sides', kind: 'mode' },
                  { v: 'one',  label: 'One Side',   kind: 'mode' },
                  { v: 'nobar', label: 'No Bar',    kind: 'nobar' },
                ].map((opt) => {
                  const on = opt.kind === 'nobar' ? bar === 0 : (bar > 0 && mode === opt.v);
                  return (
                    <button
                      key={opt.v}
                      onClick={() => {
                        if (opt.kind === 'nobar') {
                          setBar(0);
                        } else {
                          // Restore a default bar weight if user is coming
                          // back from "No Bar"; otherwise just flip mode.
                          if (bar === 0) setBar(45);
                          setMode(opt.v);
                        }
                      }}
                      className="text-[9px] font-bold uppercase whitespace-nowrap py-1.5 px-2.5 active:scale-[0.97] transition-transform"
                      style={{
                        letterSpacing: '0.18em',
                        borderRadius: '2px',
                        background: on
                          ? 'linear-gradient(135deg, rgba(34,197,94,0.9) 0%, rgba(22,163,74,0.9) 100%)'
                          : 'rgba(255,255,255,0.05)',
                        boxShadow: on
                          ? '0 4px 14px rgba(34,197,94,0.30), inset 0 1px 0 rgba(255,255,255,0.15)'
                          : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                        color: on ? '#fff' : 'rgba(255,255,255,0.65)',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bar + plates visual with +/- adjustment on the left.
                In one-side mode we hide the left half of the bar so the
                user can visualize a single-end load (landmine, T-bar).
                In no-bar mode we render a small leg press machine icon
                in the middle instead of the bar. */}
            {valid && (
              <div className="my-5 flex items-center justify-center gap-3" style={{ minHeight: 110 }}>
                {/* +/- adjust column — picks up the currently-selected
                    plate value from the Plates section below. */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => adjustTarget(+1)}
                    aria-label={`Add ${selectedPlate} lb plate`}
                    className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                      boxShadow: '0 4px 12px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.15)',
                      borderRadius: '2px',
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => adjustTarget(-1)}
                    aria-label={`Remove ${selectedPlate} lb plate`}
                    className="w-9 h-9 flex items-center justify-center text-white/80 active:scale-90 transition-transform"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                      borderRadius: '2px',
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                    </svg>
                  </button>
                </div>

                {/* Left side plates — hidden in one-side mode (and in
                    no-bar mode if the user wants to think of the load as
                    going onto a single horn — kept on for symmetry). */}
                {mode === 'both' && (
                  <div className="flex items-center" style={{ gap: 2 }}>
                    {plates.slice().reverse().map((p, i) =>
                      Array.from({ length: p.count }).map((_, n) => (
                        <PlateBlock key={`L-${i}-${n}`} plate={p} />
                      ))
                    )}
                  </div>
                )}
                {/* Center: bar (sleeve + center) when bar > 0, leg press
                    machine icon when bar === 0. */}
                {bar > 0 ? (
                  <div className="flex items-center" style={{ height: 14 }}>
                    {mode === 'both' && <div style={{ width: 8, height: 14, background: '#9ca3af', borderRadius: '1px 0 0 1px' }} />}
                    <div style={{ width: mode === 'both' ? 60 : 30, height: 6, background: '#6b7280' }} />
                    <div style={{ width: 8, height: 14, background: '#9ca3af', borderRadius: '0 1px 1px 0' }} />
                  </div>
                ) : (
                  <LegPressIcon />
                )}
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
            </div> {/* /per-side sub-section */}

            {/* Bar Weight selector — moved to the bottom of the card
                since the bar choice is the value that changes the least
                during a session (set the bar once, then adjust target).
                Hidden in No Bar mode since there's no bar to pick. */}
            {bar > 0 && (
            <div className="mt-5 pt-4 border-t border-white/10">
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
            )}
          </div> {/* /relative p-5 */}
        </div> {/* /merged panel */}

        {/* Plates picker — drives the +/- buttons on the bar visualization
            above. Selecting a plate makes one tap of the +/- buttons add
            or remove that plate (per side in Both Sides mode, or one-side
            only in One Side mode). */}
        <div className="fade-slide-up" style={{ animationDelay: '90ms' }}>
          <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
            Choose a Plate to Add
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PLATES.map((lb) => {
              const meta = PLATES.find((p) => p.lb === lb);
              const on = selectedPlate === lb;
              return (
                <button
                  key={lb}
                  onClick={() => setSelectedPlate(lb)}
                  className="flex items-center gap-2 text-[11px] font-bold py-2 px-3 active:scale-[0.97] transition-transform tabular-nums"
                  style={{
                    letterSpacing: '0.05em',
                    borderRadius: '2px',
                    background: on ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.05)',
                    boxShadow: on
                      ? 'inset 0 0 0 1px rgba(239,68,68,0.55), 0 4px 12px rgba(239,68,68,0.20)'
                      : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                    color: on ? '#fff' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  {/* Mini plate swatch in the chip color */}
                  <span
                    className="inline-block"
                    style={{
                      width: 6,
                      height: 14,
                      background: meta?.color || '#888',
                      borderRadius: '1px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)',
                    }}
                  />
                  {lb} lb
                </button>
              );
            })}
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

// Stylized leg press machine — sits between the two plate stacks when
// the user picks "No Bar" (plate-loaded machine setup). Side view: an
// angled seat + back, a sled, and a footplate. Stroked monochrome to
// match the existing minimal plate-stack aesthetic.
function LegPressIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      stroke="#9ca3af"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Leg press machine"
      style={{ flexShrink: 0 }}
    >
      {/* Floor rail */}
      <line x1="6" y1="56" x2="58" y2="56" />
      {/* Base block */}
      <rect x="14" y="48" width="36" height="8" rx="1" fill="#1f2937" />
      {/* Sled track (diagonal rail) */}
      <line x1="18" y1="48" x2="40" y2="20" />
      <line x1="22" y1="48" x2="44" y2="20" />
      {/* Sled / seat carriage on the rail */}
      <rect
        x="22"
        y="28"
        width="14"
        height="9"
        rx="1"
        fill="#374151"
        transform="rotate(-50 29 32)"
      />
      {/* Footplate at the top of the rail */}
      <rect x="38" y="14" width="14" height="3" rx="1" fill="#6b7280" transform="rotate(-50 45 15)" />
      {/* Backrest behind the sled */}
      <line x1="14" y1="40" x2="14" y2="48" />
      <rect x="10" y="38" width="6" height="10" rx="1" fill="#374151" />
    </svg>
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
