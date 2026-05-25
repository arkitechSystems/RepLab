import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StickyHeader from '../components/StickyHeader';
import { BAR_OPTIONS, PLATES, QUICK_PLATES, expandPlatesPerSide, countPlatesFromStack } from '../utils/plateMath';

// Helper: seed a per-side stack from a target weight + bar + mode. Used
// when the user types a target, toggles mode, or changes bar weight.
// The +/- chip never re-greedy-fills — it pushes/pops the user-built
// stack directly so a 35 stays a 35.
function seedStack(targetNum, bar, mode) {
  const overBar = targetNum - bar;
  if (!Number.isFinite(overBar) || overBar < 0) return [];
  const perSide = mode === 'one' ? overBar : overBar / 2;
  return expandPlatesPerSide(perSide).stack;
}

// Nike-styled plate calculator. Greedy-fills standard plate denominations
// per side until the requested weight is reached. Doesn't handle kilo
// plates or unusual sets (e.g. fractional 1.25/0.5) — keep this minimal
// for now; iterate if users ask for more.
//
// Plate denominations + expandPlatesPerSide / countPlatesFromStack
// helpers live in client/src/utils/plateMath.js so the same math drives
// both this page and the in-session PlateCalculatorModal popup. The
// in-session modal mirrors the same stack-based +/- behavior to keep
// the two surfaces in lockstep.

export default function PlateCalculator() {
  const navigate = useNavigate();
  // Default to an empty Olympic bar (target = bar weight → 0 plates per side).
  // User starts at "empty bar" and loads plates with +/-, which feels more
  // natural than booting with a magic 135 pre-loaded.
  const [target, setTarget] = useState('45');
  const [bar, setBar] = useState(45);
  // Selected manual-add plate. The +/- buttons on the bar push/pop this
  // denomination from the per-side stack below.
  const [selectedPlate, setSelectedPlate] = useState(45);
  // 'both' = standard barbell (plates loaded on both ends, default)
  // 'one'  = one-side / landmine setup (only show + load one end)
  const [mode, setMode] = useState('both');
  // Stack-based plate model: flat per-side array (e.g. [45, 25, 10]).
  // The +/- chip pushes/pops entries here directly so a user-added 35 lb
  // plate stays a 35 lb plate — it doesn't get re-greedy-filled into a
  // 45 + 10 combo just because the new total happens to factor that way.
  const [manualPlates, setManualPlates] = useState(() => seedStack(45, 45, 'both'));

  // Stack is the source of truth — total + per-side both derive from it.
  // The `target` input string only mirrors the total for display and for
  // the Quick Set / typed-input reseed path.
  const sides = mode === 'both' ? 2 : 1;
  const perSideWeight = manualPlates.reduce((sum, lb) => sum + lb, 0);
  const stackTotal = bar + perSideWeight * sides;
  // Validity comes from the typed target (which may be below the bar
  // while the user is mid-edit). Stack total alone is always >= bar.
  const typedNum = Number(target);
  const valid = !Number.isFinite(typedNum) || typedNum >= bar;
  const perSide = mode === 'one' ? perSideWeight * sides : perSideWeight;
  const { plates, leftover } = countPlatesFromStack(manualPlates);

  // + handler — pushes the selected denomination onto the stack. No
  // greedy fill: a manually-added 35 stays a 35 on the visualization.
  function addPlate() {
    setManualPlates((prev) => {
      const next = [...prev, selectedPlate];
      const total = bar + next.reduce((sum, lb) => sum + lb, 0) * sides;
      setTarget(String(Number(total.toFixed(2))));
      return next;
    });
  }

  // - handler — removes ONE occurrence of the selected denomination.
  // Gated by canDecrement, so this is mostly defensive.
  function removePlate() {
    setManualPlates((prev) => {
      const idx = prev.lastIndexOf(selectedPlate);
      if (idx < 0) return prev;
      const next = prev.slice();
      next.splice(idx, 1);
      const total = bar + next.reduce((sum, lb) => sum + lb, 0) * sides;
      setTarget(String(Number(total.toFixed(2))));
      return next;
    });
  }

  // Typed target — reseed the stack via greedy fill so the visualization
  // matches the new number. Same path is used by Quick Set chips. If the
  // typed value is below the bar, empty the stack so the visual matches.
  function onTargetTextChange(text) {
    setTarget(text);
    const num = Number(text);
    if (!Number.isFinite(num)) return;
    if (num < bar) {
      setManualPlates([]);
    } else {
      setManualPlates(seedStack(num, bar, mode));
    }
  }

  // Disable - when there's no plate of the selected denomination on the
  // stack. Per-denomination check, not "is bar loaded".
  const canDecrement = manualPlates.includes(selectedPlate);

  return (
    <div className="pb-24">
      <StickyHeader
        title="PLATE CALCULATOR"
        titleStyle={{
          fontFamily: 'Anton, sans-serif',
          fontSize: '26.4px',
          textTransform: 'uppercase',
          letterSpacing: '0.01em',
          lineHeight: 1,
        }}
      >
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
          <div className="relative p-5 pt-2.5">
            {/* Header: title + current bar config subtitle (read-only;
                the bar selector chips lower change the value). Matches
                the in-session PlateCalculatorModal so the two surfaces
                read as one calculator. */}
            <div className="mb-4 text-center">
              <h2
                className="font-black text-white uppercase"
                style={{
                  fontFamily: 'Anton, sans-serif',
                  fontSize: 22,
                  lineHeight: 1,
                  letterSpacing: '0.01em',
                }}
              >
                Plate Calculator
              </h2>
              <p
                className="text-white/30 mt-1.5"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                {bar > 0 ? `Barbell · ${bar} LB` : 'Machine · no bar'}
              </p>
            </div>

            {/* Target weight — big Anton number with - on the left and +
                on the right. Buttons drive addPlate / removePlate which
                push or pop the currently-selected plate denomination
                from a flat per-side stack (so on Both Sides, +1 tap adds
                one plate to each side, total moves by 2 × the plate).
                Typing a number reseeds the stack via greedy fill. */}
            <div className="mb-4">
              <p className="text-[10px] uppercase font-bold text-white/40 text-center mb-2" style={{ letterSpacing: '0.3em' }}>
                Target Weight
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={removePlate}
                  disabled={!canDecrement}
                  aria-label={`Remove ${selectedPlate} lb plate`}
                  className={`shrink-0 w-11 h-11 flex items-center justify-center transition-transform ${canDecrement ? 'text-white/80 active:scale-90' : 'text-white/25 cursor-not-allowed'}`}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                    borderRadius: '2px',
                    opacity: canDecrement ? 1 : 0.4,
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                  </svg>
                </button>

                <div className="relative flex items-baseline" style={{ lineHeight: 0.95 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="2.5"
                    value={target}
                    onChange={(e) => onTargetTextChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="bg-transparent font-black tracking-tight focus:outline-none tabular-nums text-center text-white"
                    style={{
                      // Inline fontSize defeats index.css's
                      // input[type=number] { font-size: 16px } default.
                      fontFamily: "'Anton', system-ui, sans-serif",
                      fontSize: 64,
                      lineHeight: 0.95,
                      letterSpacing: '0.01em',
                      width: `${Math.max(2, String(target || '0').length) * 0.58}em`,
                      minWidth: '1.5em',
                    }}
                    placeholder="0"
                  />
                  <span className="text-[18px] text-white/45 font-medium ml-1" style={{ fontFamily: "'Anton', system-ui, sans-serif", letterSpacing: '0.04em' }}>
                    LB
                  </span>
                </div>

                <button
                  onClick={addPlate}
                  aria-label={`Add ${selectedPlate} lb plate`}
                  className="shrink-0 w-11 h-11 flex items-center justify-center text-white active:scale-90 transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                    boxShadow: '0 4px 12px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.15)',
                    borderRadius: '2px',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Per-side section — visualization, +/- adjustment, plate
                count list. Divider above matches the Bar Weight divider
                so the panel reads as two stacked sub-sections. */}
            <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            {/* Both Sides / One Side / Machine toggle — full-width horizontal
                row directly under the divider. The first two pick the loading
                mode; "Machine" sets bar weight to 0 for plate-loaded machines. */}
            <div className="flex gap-1.5 mb-4">
              {[
                { v: 'both', label: 'Both Sides', kind: 'mode' },
                { v: 'one',  label: 'One Side',   kind: 'mode' },
                { v: 'nobar', label: 'Machine',   kind: 'nobar' },
              ].map((opt) => {
                const on = opt.kind === 'nobar' ? bar === 0 : (bar > 0 && mode === opt.v);
                return (
                  <button
                    key={opt.v}
                    onClick={() => {
                      if (opt.kind === 'nobar') {
                        setBar(0);
                        // Plate-loaded machines load on both sides, so
                        // force both-side visual when entering machine
                        // mode regardless of where the user was before.
                        setMode('both');
                        // Reset to a blank machine — user adds plates from
                        // zero rather than inheriting whatever target was
                        // set for the previous bar config.
                        setTarget('0');
                        setManualPlates([]);
                      } else {
                        // Restore a default bar weight if user is coming
                        // back from Machine; otherwise just flip mode.
                        if (bar === 0) {
                          setBar(45);
                          setTarget('45');
                          setManualPlates([]);
                          setMode(opt.v);
                        } else {
                          // Reseed stack from the current target against
                          // the new mode — per-side splitting changes
                          // between Both and One Side.
                          setMode(opt.v);
                          setManualPlates(seedStack(Number(target) || 0, bar, opt.v));
                        }
                      }
                    }}
                    className="flex-1 text-[10px] font-bold uppercase whitespace-nowrap py-2 px-2 active:scale-[0.97] transition-transform"
                    style={{
                      letterSpacing: '0.18em',
                      borderRadius: '2px',
                      background: on
                        ? 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)'
                        : 'rgba(255,255,255,0.05)',
                      boxShadow: on
                        ? '0 4px 14px rgba(239,68,68,0.30), inset 0 1px 0 rgba(255,255,255,0.15)'
                        : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                      color: on ? '#fff' : 'rgba(255,255,255,0.65)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em' }}>
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

            {/* Bar + plates visual — +/- moved up to flank the target
                weight, so the visualization centers freely. In one-side
                mode the left half of the bar hides for landmine / T-bar
                loads. In no-bar (machine) mode a leg press icon stands
                in for the bar. */}
            {valid && (
              <div className="my-5 relative" style={{ minHeight: 110 }}>
                <div className="flex items-center justify-center gap-2 h-full" style={{ paddingLeft: 16, paddingRight: 16, minHeight: 110 }}>
                  {/* Left side plates — hidden in one-side mode (landmine
                      / single-end load). Always visible in machine mode
                      (bar === 0) since plate-loaded machines load on
                      both sides. */}
                  {(mode === 'both' || bar === 0) && (
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

            {/* Plate picker — drives the +/- buttons on the bar visual
                above. Selecting a plate makes one tap of the +/- buttons
                add or remove that plate (per side in Both Sides mode,
                one-side only in One Side mode). Sits above Bar Weight
                because it's the most-used picker after the +/- buttons. */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
                Choose a plate to add/remove
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

            {/* Bar Weight selector — sits below the plate picker since
                bar choice changes the least during a session (set once,
                then adjust target). Hidden in No Bar mode. */}
            {bar > 0 && (
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
                      onClick={() => {
                        // Bar change re-seeds plate stack against the
                        // new bar weight, using the existing target as
                        // the floor — keeps the visualization honest
                        // (no stale plates carrying over from a 45 → 35
                        // bar switch).
                        setBar(b.value);
                        const curTarget = Number(target) || 0;
                        const nextTarget = Math.max(curTarget, b.value);
                        setTarget(String(nextTarget));
                        setManualPlates(seedStack(nextTarget, b.value, mode));
                      }}
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

        {/* Quick-set chips — common 1RM-ish jumps */}
        <div className="fade-slide-up" style={{ animationDelay: '120ms' }}>
          <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
            Quick Set
          </p>
          <div className="flex flex-wrap gap-2">
            {[95, 135, 185, 225, 275, 315, 365, 405].map((w) => (
              <button
                key={w}
                onClick={() => onTargetTextChange(String(w))}
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
        width: 14,
        height: plate.height,
        background: plate.color,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)',
        borderRadius: '1px',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'Anton, sans-serif',
        fontSize: 9,
        lineHeight: 1,
        color: plate.text,
        overflow: 'hidden',
      }}
      aria-label={`${plate.label} pound plate`}
    >
      {plate.label}
    </div>
  );
}
