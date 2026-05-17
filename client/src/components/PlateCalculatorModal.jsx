import { useEffect, useState } from 'react';

// In-session plate calculator. Opens pre-filled with whatever weight the
// user was editing (long-pressed the weight input OR tapped the ⚖ icon
// next to it). They can adjust the target weight, see the breakdown, and
// tap "Use This Weight" to push the chosen value back into the input.
//
// The page version at /plate-calculator is the same math; this is the
// modal-shell variant. Logic kept self-contained so the page and the
// modal can evolve independently.

const BAR_OPTIONS = [45, 35, 25, 15, 0]; // 0 = machine / no bar
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

export default function PlateCalculatorModal({ open, initialWeight = 0, onUse, onClose }) {
  const [target, setTarget] = useState(String(initialWeight || 0));
  const [bar, setBar] = useState(45);
  const [mode, setMode] = useState('both'); // 'both' | 'one'

  // Reset target whenever the modal is freshly opened with a new initial weight.
  useEffect(() => {
    if (open) setTarget(String(initialWeight || 0));
  }, [open, initialWeight]);

  if (!open) return null;

  const targetNum = Number(target) || 0;
  const overBar = targetNum - bar;
  const valid = overBar >= 0;
  const perSide = valid ? (mode === 'one' ? overBar : overBar / 2) : 0;
  const { plates, leftover } = valid ? computePlatesPerSide(perSide) : { plates: [], leftover: 0 };

  const handleUse = () => {
    if (onUse) onUse(Number(target) || 0);
    if (onClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-12"
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
        <div className="h-[3px] shrink-0" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25))' }} />
        <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        {/* Header */}
        <div className="relative px-5 pt-5 pb-3 shrink-0 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] text-white/30 uppercase font-light" style={{ letterSpacing: '0.3em' }}>
              Calculator
            </p>
            <h2 id="plate-calc-modal-title" className="text-[20px] font-black text-white tracking-tight mt-1 uppercase" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
              Plate Loadout
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-wf-gray-400 active:opacity-70 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrolls if content exceeds modal height */}
        <div className="relative flex-1 overflow-y-auto px-5 pb-3">
          {/* Target weight */}
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <span className="text-[10px] uppercase font-light" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em' }}>
              Total
            </span>
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="2.5"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="bg-transparent font-black tracking-tight focus:outline-none tabular-nums text-right"
                style={{
                  fontSize: 32,
                  lineHeight: 1,
                  fontFamily: 'system-ui',
                  letterSpacing: '-0.02em',
                  color: '#ef4444',
                  width: '4em',
                }}
                placeholder="0"
              />
              <span className="text-[12px] text-white/40 font-light">lbs</span>
            </div>
          </div>

          {/* Mode toggle */}
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
                  className="flex-1 text-[10px] font-bold uppercase whitespace-nowrap py-2 px-1 active:scale-[0.97] transition-transform"
                  style={{
                    letterSpacing: '0.15em',
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

          {/* Per-side header */}
          <div className="mb-3">
            <p className="text-[10px] uppercase font-light" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em' }}>
              {mode === 'one' ? 'One Side' : 'Per Side'}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-[24px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95' }}>
                {valid ? perSide.toFixed(perSide % 1 ? 1 : 0) : '—'}
              </h3>
              <span className="text-[12px] text-white/40 font-light">
                {mode === 'one' ? 'lbs loaded' : 'lbs / side'}
              </span>
            </div>
          </div>

          {/* Bar + plates visual */}
          {valid && (
            <div className="my-3 flex items-center justify-center" style={{ minHeight: 100 }}>
              <div className="flex items-center" style={{ gap: 2 }}>
                {/* Left plates — only when bar > 0 + both-side, or bar === 0 (machine) */}
                {(mode === 'both' || bar === 0) && (
                  <div className="flex items-center" style={{ gap: 2 }}>
                    {plates.slice().reverse().map((p, i) =>
                      Array.from({ length: p.count }).map((_, n) => (
                        <PlateBlock key={`L-${i}-${n}`} plate={p} />
                      ))
                    )}
                  </div>
                )}
                {/* Bar */}
                {bar > 0 && (
                  <div className="flex items-center" style={{ height: 14 }}>
                    {mode === 'both' && <div style={{ width: 6, height: 14, background: '#9ca3af', borderRadius: '1px 0 0 1px' }} />}
                    <div style={{ width: mode === 'both' ? 40 : 20, height: 6, background: '#6b7280' }} />
                    <div style={{ width: 6, height: 14, background: '#9ca3af', borderRadius: '0 1px 1px 0' }} />
                  </div>
                )}
                {/* Right plates */}
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

          {/* Plate list */}
          {valid && plates.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {plates.map((p) => (
                <div key={p.lb} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
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
                    <span className="text-white/80">{p.lb} lb plate{p.count > 1 ? 's' : ''}</span>
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
            <p className="text-[11px] mt-2" style={{ color: 'rgba(251,191,36,0.85)' }}>
              {leftover} lb short per side with standard plates.
            </p>
          )}
          {!valid && (
            <p className="text-[12px] text-wf-red font-medium">
              Target weight is less than the bar.
            </p>
          )}

          {/* Bar weight selector */}
          {bar > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-[10px] uppercase font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
                Bar Weight
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BAR_OPTIONS.filter((v) => v > 0).map((v) => {
                  const on = v === bar;
                  return (
                    <button
                      key={v}
                      onClick={() => setBar(v)}
                      className="text-[10px] font-bold py-1.5 px-2.5 active:scale-[0.97] transition-transform tabular-nums"
                      style={{
                        letterSpacing: '0.05em',
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
                      {v} lb
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
