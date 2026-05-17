import { useEffect, useState } from 'react';
import { BAR_OPTIONS, PLATES, QUICK_PLATES, computePlatesPerSide } from '../utils/plateMath';

// In-session plate calculator. Opens pre-filled with whatever weight the
// user was editing (long-pressed the weight input OR tapped the ⚖ icon
// next to it). Layout mirrors the /plate-calculator page exactly — same
// sections, same chips, same plate visual — so users get one mental
// model.
//
// Plate math (denominations + greedy-fill) lives in
// client/src/utils/plateMath.js so this modal and the page version stay
// in lockstep.
//
// "Use {N} lbs" pushes the chosen target back into the source input.

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

// Stylized leg press machine — sits between the two plate stacks when
// the user picks "Machine" (plate-loaded machine setup).
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
      <line x1="6" y1="56" x2="58" y2="56" />
      <rect x="14" y="48" width="36" height="8" rx="1" fill="#1f2937" />
      <line x1="18" y1="48" x2="40" y2="20" />
      <line x1="22" y1="48" x2="44" y2="20" />
      <rect x="22" y="28" width="14" height="9" rx="1" fill="#374151" transform="rotate(-50 29 32)" />
      <rect x="38" y="14" width="14" height="3" rx="1" fill="#6b7280" transform="rotate(-50 45 15)" />
      <line x1="14" y1="40" x2="14" y2="48" />
      <rect x="10" y="38" width="6" height="10" rx="1" fill="#374151" />
    </svg>
  );
}

export default function PlateCalculatorModal({ open, initialWeight = 0, onUse, onClose }) {
  const [bar, setBar] = useState(45);
  // When no weight was passed in (set hasn't been entered yet), open at
  // the current bar weight so the visual shows just the bare bar — no
  // plates per side. The user adds plates from there via the +/- buttons
  // or by typing a new target.
  const [target, setTarget] = useState(() => String(initialWeight > 0 ? initialWeight : 45));
  const [mode, setMode] = useState('both');
  const [selectedPlate, setSelectedPlate] = useState(45);

  // Reset target whenever the modal is freshly opened with a new initial
  // weight. Same bar-only fallback as the initial useState above.
  useEffect(() => {
    if (open) setTarget(String(initialWeight > 0 ? initialWeight : (bar || 45)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialWeight]);

  if (!open) return null;

  const targetNum = Number(target) || 0;
  const overBar = targetNum - bar;
  const valid = overBar >= 0;
  const perSide = valid ? (mode === 'one' ? overBar : overBar / 2) : 0;
  const { plates, leftover } = valid ? computePlatesPerSide(perSide) : { plates: [], leftover: 0 };

  // +/- bumps target by (selectedPlate × sides). Floors at the bar weight
  // so the user can't subtract below an empty bar (or 0 in machine mode).
  const canDecrement = targetNum > bar;
  function adjustTarget(direction) {
    const sides = mode === 'both' ? 2 : 1;
    const delta = direction * selectedPlate * sides;
    const next = Math.max(bar, targetNum + delta);
    setTarget(String(Number(next.toFixed(2))));
  }

  const handleUse = () => {
    if (onUse) onUse(Number(target) || 0);
    if (onClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plate-calc-modal-title"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          borderRadius: '2px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        {/* Close X — absolute so it doesn't disturb the title row */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 text-wf-gray-400 active:opacity-70"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Body — scrolls if content exceeds modal height. Layout below
            mirrors the /plate-calculator page section-for-section. */}
        <div className="relative flex-1 overflow-y-auto p-5 pt-4 pr-7">
          {/* Header: TOTAL WEIGHT + editable target inline */}
          <div className="flex items-baseline mb-2">
            <h2 id="plate-calc-modal-title" className="text-[20px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              TOTAL WEIGHT
            </h2>
            <div className="flex-1 flex items-baseline justify-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="2.5"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="bg-transparent font-black tracking-tight focus:outline-none tabular-nums text-center"
                style={{
                  // Inline fontSize required — same reason as the page
                  // version: index.css's input[type=number] { font-size: 16px }
                  // wins against Tailwind text-[Xpx].
                  fontSize: 34,
                  lineHeight: 0.95,
                  fontFamily: 'system-ui',
                  letterSpacing: '-0.02em',
                  color: '#ef4444',
                  width: `${Math.max(2, String(target || '0').length) * 0.62}em`,
                  minWidth: '1.5em',
                }}
                placeholder="0"
              />
              <span className="text-[12px] text-white/40 font-light">lbs</span>
            </div>
          </div>

          {/* Per-side sub-section starts here, mirroring the page divider */}
          <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            {/* Both Sides / One Side / Machine toggle — full-width row */}
            <div className="flex gap-1.5 mb-4">
              {[
                { v: 'both',  label: 'Both Sides', kind: 'mode' },
                { v: 'one',   label: 'One Side',   kind: 'mode' },
                { v: 'nobar', label: 'Machine',    kind: 'nobar' },
              ].map((opt) => {
                const on = opt.kind === 'nobar' ? bar === 0 : (bar > 0 && mode === opt.v);
                return (
                  <button
                    key={opt.v}
                    onClick={() => {
                      if (opt.kind === 'nobar') { setBar(0); setMode('both'); }
                      else { if (bar === 0) setBar(45); setMode(opt.v); }
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

            {/* Per Side display */}
            <div className="mb-3">
              <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em' }}>
                {mode === 'one' ? 'One Side' : 'Per Side'}
              </p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-[24px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                  {valid ? perSide.toFixed(perSide % 1 ? 1 : 0) : '—'}
                </h2>
                <span className="text-[12px] text-white/40 font-light">
                  {mode === 'one' ? 'lbs loaded' : 'lbs / side'}
                </span>
              </div>
            </div>

            {/* Bar + plates visual with +/- pinned at the RIGHT edge, to
                match the /plate-calculator page exactly. Right padding
                (52px) clears the button column with a 16px gap to the
                bar; left padding (16px) mirrors the gap on the opposite
                side. */}
            {valid && (
              <div className="my-4 relative" style={{ minHeight: 100 }}>
                {/* +/- adjust column — anchored to the RIGHT edge */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 shrink-0 z-10">
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
                    disabled={!canDecrement}
                    aria-label={`Remove ${selectedPlate} lb plate`}
                    className={`w-9 h-9 flex items-center justify-center transition-transform ${canDecrement ? 'text-white/80 active:scale-90' : 'text-white/25 cursor-not-allowed'}`}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                      borderRadius: '2px',
                      opacity: canDecrement ? 1 : 0.4,
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                    </svg>
                  </button>
                </div>

                {/* Centered bar + plates visual */}
                <div className="flex items-center justify-center gap-2 h-full" style={{ paddingLeft: 16, paddingRight: 52, minHeight: 100 }}>
                  {(mode === 'both' || bar === 0) && (
                    <div className="flex items-center" style={{ gap: 2 }}>
                      {plates.slice().reverse().map((p, i) =>
                        Array.from({ length: p.count }).map((_, n) => (
                          <PlateBlock key={`L-${i}-${n}`} plate={p} />
                        ))
                      )}
                    </div>
                  )}
                  {bar > 0 ? (
                    <div className="flex items-center" style={{ height: 14 }}>
                      {mode === 'both' && <div style={{ width: 8, height: 14, background: '#9ca3af', borderRadius: '1px 0 0 1px' }} />}
                      <div style={{ width: mode === 'both' ? 50 : 25, height: 6, background: '#6b7280' }} />
                      <div style={{ width: 8, height: 14, background: '#9ca3af', borderRadius: '0 1px 1px 0' }} />
                    </div>
                  ) : (
                    <LegPressIcon />
                  )}
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
              <div className="space-y-1.5">
                {plates.map((p) => (
                  <div key={p.lb} className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-flex items-center justify-center text-[10px] font-black"
                        style={{
                          width: 20, height: 20,
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

          {/* Plate picker — drives the +/- buttons */}
          <div className="mt-4 pt-4 border-t border-white/10">
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

          {/* Bar Weight selector — hidden in Machine mode */}
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
        </div>

        {/* Footer — Use button + Cancel */}
        <div className="relative px-4 pb-4 pt-2 space-y-2 shrink-0 border-t border-white/5">
          <button
            onClick={handleUse}
            className="w-full text-white font-bold uppercase active:scale-[0.98] transition-all"
            style={{
              letterSpacing: '0.15em',
              fontSize: '11px',
              padding: '14px',
              borderRadius: '2px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
              boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            Use {Number(target) || 0} lbs
          </button>
          <button
            onClick={onClose}
            className="w-full font-bold uppercase active:scale-[0.98] transition-all border border-white/15"
            style={{
              letterSpacing: '0.15em',
              fontSize: '11px',
              padding: '14px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
