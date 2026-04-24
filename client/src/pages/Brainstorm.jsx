import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// ==========================================================
// Inline keyframes + helpers used only by this page.
// Scoped to the page by prefixing class names with "bs-".
// ==========================================================
const PAGE_CSS = `
@keyframes bs-liquidFlow { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }
@keyframes bs-shimmer   { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
@keyframes bs-spin      { to { transform: rotate(360deg); } }
@keyframes bs-checkDraw { to { stroke-dashoffset: 0; } }
@keyframes bs-toastIn   { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
@keyframes bs-toastOut  { to   { transform: translate(-50%, -20px); opacity: 0; } }
@keyframes bs-popHeart  { 0% { transform: scale(1); } 40% { transform: scale(1.3); } 100% { transform: scale(1); } }
@keyframes bs-ripple    { to { transform: scale(4); opacity: 0; } }
@keyframes bs-meshDrift1{ 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,-40px) scale(1.15); } }
@keyframes bs-meshDrift2{ 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-50px,40px) scale(1.1); } }
@keyframes bs-meshDrift3{ 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,50px) scale(0.9); } }
@keyframes bs-barRise   { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes bs-fadeUp    { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.bs-liquidBtn {
  background: linear-gradient(90deg, #ef4444, #a855f7, #3b82f6, #22c55e, #ef4444);
  background-size: 400% 100%;
  animation: bs-liquidFlow 6s linear infinite;
  box-shadow: 0 8px 32px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.2);
}
.bs-skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 100%);
  background-size: 800px 100%;
  animation: bs-shimmer 1.6s linear infinite;
}
.bs-spinner { border: 2px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: bs-spin 0.7s linear infinite; }

/* 3D tilt */
.bs-tilt { transform-style: preserve-3d; transition: transform 0.1s ease-out; will-change: transform; }
.bs-tilt > * { transform: translateZ(40px); }

/* Flip card */
.bs-flipOuter { perspective: 1200px; }
.bs-flipInner { transform-style: preserve-3d; transition: transform 0.7s cubic-bezier(0.4,0,0.2,1); position: relative; width: 100%; height: 100%; }
.bs-flipInner.flipped { transform: rotateY(180deg); }
.bs-flipFace { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 1rem; overflow: hidden; }
.bs-flipBack { transform: rotateY(180deg); }

/* Wheel picker */
.bs-wheel { scroll-snap-type: y mandatory; -ms-overflow-style: none; scrollbar-width: none; mask-image: linear-gradient(180deg, transparent 0%, black 35%, black 65%, transparent 100%); -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 35%, black 65%, transparent 100%); }
.bs-wheel::-webkit-scrollbar { display: none; }
.bs-wheel > div { scroll-snap-align: center; }

/* Confetti particle */
.bs-confetti-piece { position: absolute; width: 8px; height: 14px; left: 50%; top: 50%; pointer-events: none; will-change: transform, opacity; }

/* Slider styling */
.bs-slider { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; }
.bs-slider::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: rgba(255,255,255,0.15); }
.bs-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; margin-top: -9px; border-radius: 50%; background: white; border: 3px solid #ef4444; box-shadow: 0 2px 12px rgba(239,68,68,0.6); cursor: pointer; }
.bs-slider::-moz-range-track { height: 4px; border-radius: 999px; background: rgba(255,255,255,0.15); }
.bs-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: white; border: 3px solid #ef4444; box-shadow: 0 2px 12px rgba(239,68,68,0.6); cursor: pointer; }

/* Mesh gradient blobs */
.bs-mesh { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.8; }

/* Noise overlay */
.bs-noise { background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.35'/></svg>"); }

/* Bottom sheet handle */
.bs-handle { width: 36px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.35); margin: 0 auto; }

/* Ripple container */
.bs-rippleBtn { position: relative; overflow: hidden; }
.bs-rippleSpan { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.5); transform: scale(0); animation: bs-ripple 0.6s linear; pointer-events: none; }

/* Horizontal scroll */
.bs-hscroll { scrollbar-width: none; }
.bs-hscroll::-webkit-scrollbar { display: none; }

/* Section enter anim */
.bs-enter > * { animation: bs-fadeUp 0.5s ease-out both; }
`;

// ==========================================================
// LABELS + SECTION WRAPPER (matches Nike-style aesthetic)
// ==========================================================
function SectionHeader({ id, name, description }) {
  return (
    <div className="flex items-baseline gap-3 mb-3">
      <span className="text-[10px] font-bold text-wf-red tabular-nums" style={{ letterSpacing: '0.2em' }}>
        {String(id).padStart(2, '0')}
      </span>
      <div>
        <h2 className="text-[12px] font-bold text-white uppercase" style={{ letterSpacing: '0.18em' }}>{name}</h2>
        {description && <p className="text-[11px] text-white/40 font-light mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function Panel({ children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl p-5 ${className}`}>{children}</div>
  );
}

// ==========================================================
// 01 — LIQUID GRADIENT CTA BUTTON
// ==========================================================
function LiquidButton() {
  return (
    <div className="flex flex-col items-center gap-3">
      <button className="bs-liquidBtn rounded-full px-10 py-4 text-white font-black uppercase tracking-widest text-sm active:scale-[0.97] transition-transform">
        Start Workout
      </button>
      <p className="text-[10px] text-white/40">Flowing multi-color gradient — great for the home-screen primary action.</p>
    </div>
  );
}

// ==========================================================
// 02 — MAGNETIC BUTTON (follows cursor)
// ==========================================================
function MagneticButton() {
  const ref = useRef(null);
  const [tx, setTx] = useState({ x: 0, y: 0 });
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    setTx({ x: x * 0.3, y: y * 0.4 });
  };
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div
        onMouseMove={onMove}
        onMouseLeave={() => setTx({ x: 0, y: 0 })}
        className="p-8"
      >
        <button
          ref={ref}
          style={{ transform: `translate(${tx.x}px, ${tx.y}px)`, transition: 'transform 0.2s cubic-bezier(0.2,0.9,0.2,1)' }}
          className="rounded-full w-20 h-20 flex items-center justify-center bg-wf-red text-white font-black shadow-[0_10px_30px_rgba(239,68,68,0.4)]"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
          </svg>
        </button>
      </div>
      <p className="text-[10px] text-white/40">Magnetic — subtle attraction toward cursor (desktop).</p>
    </div>
  );
}

// ==========================================================
// 03 — LOADING STATE BUTTON (idle → loading → done)
// ==========================================================
function LoadingButton() {
  const [state, setState] = useState('idle');
  const run = () => {
    setState('loading');
    setTimeout(() => setState('done'), 1400);
    setTimeout(() => setState('idle'), 2800);
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={run}
        disabled={state !== 'idle'}
        className="relative rounded-full h-12 px-8 bg-wf-red text-white font-black uppercase tracking-widest text-sm overflow-hidden min-w-[180px]"
      >
        <span className={`transition-opacity ${state === 'idle' ? 'opacity-100' : 'opacity-0'}`}>Save PR</span>
        {state === 'loading' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="bs-spinner w-5 h-5" />
          </span>
        )}
        {state === 'done' && (
          <span className="absolute inset-0 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"
                style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'bs-checkDraw 0.4s ease-out forwards' }} />
            </svg>
            <span className="text-xs">Saved</span>
          </span>
        )}
      </button>
      <p className="text-[10px] text-white/40">Three-state button — great for logging a set or saving a PR.</p>
    </div>
  );
}

// ==========================================================
// 04 — CONCENTRIC PROGRESS RINGS (Apple Fitness+)
// ==========================================================
function ProgressRings() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);
  const rings = [
    { color: '#ef4444', pct: 0.82, r: 62, label: 'VOLUME', value: '12.4k' },
    { color: '#22c55e', pct: 0.65, r: 48, label: 'SETS',   value: '18/28' },
    { color: '#3b82f6', pct: 0.95, r: 34, label: 'STREAK', value: '47d' },
  ];
  return (
    <div className="flex items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {rings.map((ring, i) => {
          const c = 2 * Math.PI * ring.r;
          return (
            <g key={i} transform="translate(80,80) rotate(-90)">
              <circle r={ring.r} fill="none" stroke={ring.color} strokeOpacity="0.15" strokeWidth="10" />
              <circle r={ring.r} fill="none" stroke={ring.color} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={mounted ? c * (1 - ring.pct) : c}
                style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.2,0.9,0.2,1)', filter: `drop-shadow(0 0 8px ${ring.color}80)` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="space-y-2">
        {rings.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }} />
            <span className="text-[10px] text-white/50 uppercase font-bold" style={{ letterSpacing: '0.15em' }}>{r.label}</span>
            <span className="ml-auto text-sm font-black text-white tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================================
// 05 — ODOMETER COUNT-UP
// ==========================================================
function useCountUp(target, duration = 1500) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}
function Odometer() {
  const volume = useCountUp(12450);
  const kcal = useCountUp(684);
  const time = useCountUp(52);
  return (
    <div className="grid grid-cols-3 gap-4">
      <Stat label="VOLUME" value={volume.toLocaleString()} suffix="LB" />
      <Stat label="KCAL" value={kcal} suffix="" />
      <Stat label="TIME" value={time} suffix="MIN" />
    </div>
  );
}
function Stat({ label, value, suffix }) {
  return (
    <div>
      <p className="text-[9px] text-white/40 uppercase font-bold" style={{ letterSpacing: '0.2em' }}>{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-3xl font-black text-white tabular-nums" style={{
          background: 'linear-gradient(180deg, #fff, #fff 50%, #888)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>{value}</span>
        {suffix && <span className="text-[10px] text-white/40 font-bold">{suffix}</span>}
      </div>
    </div>
  );
}

// ==========================================================
// 06 — ANIMATED BAR CHART
// ==========================================================
function BarChart() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);
  const days = [
    { d: 'M', v: 0.55 }, { d: 'T', v: 0.82 }, { d: 'W', v: 0.30 },
    { d: 'T', v: 0.95 }, { d: 'F', v: 0.70 }, { d: 'S', v: 0.45 }, { d: 'S', v: 0 },
  ];
  return (
    <div>
      <div className="flex items-end gap-2 h-32">
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full h-full flex items-end">
              <div
                className="w-full rounded-t origin-bottom"
                style={{
                  height: `${day.v * 100}%`,
                  minHeight: day.v > 0 ? 4 : 0,
                  background: day.v > 0.85 ? 'linear-gradient(180deg, #ef4444, #dc2626)' : 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.1))',
                  animation: mounted ? `bs-barRise 0.6s cubic-bezier(0.2,0.9,0.2,1) ${i * 80}ms both` : 'none',
                  boxShadow: day.v > 0.85 ? '0 0 14px rgba(239,68,68,0.5)' : 'none',
                }}
              />
            </div>
            <span className="text-[10px] text-white/40 font-bold">{day.d}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/40 mt-3">Staggered entrance — PR day highlighted in red with glow.</p>
    </div>
  );
}

// ==========================================================
// 07 — 3D TILT CARD
// ==========================================================
function TiltCard() {
  const [tx, setTx] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  const onMove = (e) => {
    const r = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTx({ x, y });
  };
  return (
    <div className="flex justify-center py-4" onMouseLeave={() => setTx({ x: 0, y: 0 })}>
      <div
        ref={cardRef}
        onMouseMove={onMove}
        className="bs-tilt rounded-2xl w-64 h-40 p-5 relative"
        style={{
          transform: `perspective(900px) rotateY(${tx.x * 18}deg) rotateX(${-tx.y * 18}deg)`,
          background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${(tx.x + 0.5) * 100}% ${(tx.y + 0.5) * 100}%, rgba(239,68,68,0.25), transparent 50%)`,
          }}
        />
        <p className="text-[10px] font-bold text-wf-red uppercase" style={{ letterSpacing: '0.2em' }}>Push Day</p>
        <p className="text-xl font-black text-white mt-1">Bench · Incline · Dips</p>
        <div className="absolute bottom-4 right-4">
          <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// 08 — FLIP CARD
// ==========================================================
function FlipCard() {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="flex justify-center">
      <div className="bs-flipOuter w-56 h-40 cursor-pointer" onClick={() => setFlipped(!flipped)}>
        <div className={`bs-flipInner ${flipped ? 'flipped' : ''}`}>
          <div className="bs-flipFace" style={{ background: 'linear-gradient(135deg, #ef4444, #7f1d1d)' }}>
            <div className="h-full p-4 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-white/70 uppercase" style={{ letterSpacing: '0.2em' }}>Bench Press</p>
              <div>
                <p className="text-4xl font-black text-white">225</p>
                <p className="text-[10px] text-white/70">8 REPS · TAP TO FLIP</p>
              </div>
            </div>
          </div>
          <div className="bs-flipFace bs-flipBack" style={{ background: 'linear-gradient(135deg, #1a1a1a, #000)' }}>
            <div className="h-full p-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-white/50 uppercase" style={{ letterSpacing: '0.2em' }}>History</p>
              {[
                { date: 'Apr 21', w: '225 × 8' },
                { date: 'Apr 14', w: '215 × 8' },
                { date: 'Apr 07', w: '215 × 6' },
                { date: 'Mar 31', w: '205 × 8' },
              ].map((r, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-white/50">{r.date}</span>
                  <span className="text-white font-bold tabular-nums">{r.w}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// 09 — EXPANDABLE / ACCORDION
// ==========================================================
function Accordion() {
  const [open, setOpen] = useState(0);
  const items = [
    { t: 'Warmup — 5 min', d: 'Dynamic stretches: arm circles, band pull-aparts, light bench bar only × 10.' },
    { t: 'Working Sets', d: 'Bench Press 4×8 @ 225lb, Incline DB 3×10, Cable Fly 3×12.' },
    { t: 'Finisher', d: 'Dips AMRAP + 60s rest × 3. Push to failure on last set.' },
  ];
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            className="w-full px-4 py-3 flex items-center justify-between"
          >
            <span className="text-sm font-bold text-white">{it.t}</span>
            <svg className="w-4 h-4 text-white/50 transition-transform" style={{ transform: open === i ? 'rotate(180deg)' : 'rotate(0)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: open === i ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <p className="px-4 pb-4 text-xs text-white/60 leading-relaxed">{it.d}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================================
// 10 — SEGMENTED CONTROL (sliding pill)
// ==========================================================
function Segmented() {
  const options = ['WEEK', 'MONTH', 'YEAR'];
  const [idx, setIdx] = useState(1);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex rounded-full p-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="absolute top-1 bottom-1 bg-wf-red rounded-full transition-transform duration-300 ease-out"
          style={{
            width: `calc(${100 / options.length}% - 4px)`,
            transform: `translateX(${idx * 100}%)`,
            boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
          }}
        />
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => setIdx(i)}
            className="relative z-10 px-6 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors"
            style={{ color: idx === i ? 'white' : 'rgba(255,255,255,0.5)' }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ==========================================================
// 11 — FILTER CHIPS (animated multi-select)
// ==========================================================
function FilterChips() {
  const tags = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
  const [selected, setSelected] = useState(new Set(['Chest', 'Legs']));
  const toggle = (t) => {
    const next = new Set(selected);
    next.has(t) ? next.delete(t) : next.add(t);
    setSelected(next);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const on = selected.has(t);
        return (
          <button
            key={t}
            onClick={() => toggle(t)}
            className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95"
            style={{
              background: on ? '#ef4444' : 'rgba(255,255,255,0.06)',
              color: on ? 'white' : 'rgba(255,255,255,0.6)',
              border: on ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
              boxShadow: on ? '0 4px 14px rgba(239,68,68,0.35)' : 'none',
              transform: on ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

// ==========================================================
// 12 — BOTTOM SHEET WITH SNAP POINTS
// ==========================================================
function BottomSheet() {
  const [snap, setSnap] = useState(0); // 0 = peek, 1 = half, 2 = full
  const [open, setOpen] = useState(false);
  const heights = ['20%', '55%', '90%'];
  const dragStart = useRef(null);
  const startSnap = useRef(0);

  // Pointer capture — without it, the pointer leaves the small handle
  // element as soon as the user starts dragging and the subsequent
  // pointerup fires on whatever is under the cursor, never here.
  const onPointerDown = (e) => {
    dragStart.current = e.clientY;
    startSnap.current = snap;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const finishDrag = (e) => {
    if (dragStart.current == null) return;
    const dy = e.clientY - dragStart.current;
    if (dy < -40) setSnap(Math.min(2, startSnap.current + 1));
    else if (dy > 40) setSnap(Math.max(0, startSnap.current - 1));
    dragStart.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-3 rounded-full bg-white text-black font-black uppercase tracking-widest text-xs active:scale-95"
      >
        Open Sheet
      </button>
      {open && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 pointer-events-auto transition-opacity"
            style={{ opacity: snap >= 1 ? 1 : 0.4 }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-3xl pointer-events-auto transition-[height] duration-300 ease-out"
            style={{
              height: heights[snap],
              background: 'linear-gradient(180deg, #1a1a1a, #0a0a0a)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              touchAction: 'none',
            }}
          >
            <div
              className="py-3 cursor-grab select-none"
              style={{ touchAction: 'none' }}
              onPointerDown={onPointerDown}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              <div className="bs-handle" />
            </div>
            <div className="px-6 pb-6">
              <h3 className="text-xl font-black text-white mb-1">Quick Log</h3>
              <p className="text-xs text-white/50">Drag the handle up/down to snap between sizes. Tap backdrop to close.</p>
              <div className="mt-4 space-y-2">
                {['Log Set', 'Rest Timer', 'Note', 'Swap Exercise'].map((o) => (
                  <div key={o} className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-sm font-bold text-white">{o}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setOpen(false)} className="mt-4 w-full py-3 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-widest">Close</button>
            </div>
          </div>
        </div>
      )}
      <p className="text-[10px] text-white/40">Three snap points: peek → half → full. Drag handle to change.</p>
    </div>
  );
}

// ==========================================================
// 27 — STACKED PAPER CARDS (swipe to advance)
// Ported from Workouts.jsx. Mock PR data so the pattern is self-contained.
// ==========================================================
function StackedPaperCards() {
  const SAMPLE = [
    { title: 'Chest PR',     top: 'Barbell Bench Press',     body: '245 lbs × 5 reps' },
    { title: 'Back PR',      top: 'Deadlift',                 body: '405 lbs × 3 reps' },
    { title: 'Shoulders PR', top: 'Overhead Press',           body: '135 lbs × 5 reps' },
    { title: 'Quads PR',     top: 'Back Squat',               body: '315 lbs × 5 reps' },
    { title: 'Hamstrings PR',top: 'Romanian Deadlift',        body: '275 lbs × 8 reps' },
    { title: 'Glutes PR',    top: 'Barbell Hip Thrust',       body: '365 lbs × 8 reps' },
    { title: 'Biceps PR',    top: 'Barbell Curl',             body: '95 lbs × 8 reps' },
    { title: 'Triceps PR',   top: 'Close-Grip Bench Press',   body: '185 lbs × 6 reps' },
  ];
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const total = SAMPLE.length;
  const visibleCount = Math.min(3, total);

  const start = (e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    startX.current = x;
    setDragging(true);
  };
  const move = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    setDragX(x - startX.current);
  };
  const end = () => {
    if (!dragging) return;
    if (Math.abs(dragX) > 100) {
      const dir = dragX > 0 ? 1 : -1;
      setDragX(dir * 600);
      setTimeout(() => {
        setIdx((i) => (i + 1) % total);
        setDragX(0);
      }, 250);
    } else {
      setDragX(0);
    }
    setDragging(false);
  };

  return (
    <div style={{ position: 'relative', height: '160px', userSelect: 'none' }}>
      {Array.from({ length: visibleCount }).map((_, depth) => {
        const cardIdx = (idx + depth) % total;
        const card = SAMPLE[cardIdx];
        const isTop = depth === 0;
        const baseTransform = depth === 0
          ? 'translate(0, 0) rotate(0deg)'
          : depth === 1
            ? 'translate(6px, 6px) rotate(1.5deg)'
            : 'translate(12px, 10px) rotate(-1deg)';
        const dragTransform = isTop && (dragX !== 0 || dragging)
          ? `translate(${dragX}px, 0) rotate(${dragX * 0.05}deg)`
          : baseTransform;
        const opacity = depth === 0 ? 1 : depth === 1 ? 0.85 : 0.7;
        const zIndex = visibleCount - depth;
        return (
          <div
            key={`${cardIdx}-${depth}`}
            onTouchStart={isTop ? start : undefined}
            onTouchMove={isTop ? move : undefined}
            onTouchEnd={isTop ? end : undefined}
            onMouseDown={isTop ? start : undefined}
            onMouseMove={isTop && dragging ? move : undefined}
            onMouseUp={isTop ? end : undefined}
            onMouseLeave={isTop && dragging ? end : undefined}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: depth === 0 ? '#111' : depth === 1 ? '#151515' : '#1a1a1a',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '20px',
              zIndex,
              opacity,
              transform: dragTransform,
              transition: dragging && isTop ? 'none' : 'transform 0.25s ease-out',
              cursor: isTop ? 'grab' : 'default',
              touchAction: isTop ? 'pan-y' : 'auto',
            }}
          >
            <p style={{ fontSize: '9px', color: 'rgba(239,68,68,0.6)', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
              {card.title}
            </p>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>
              {card.top}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              {card.body}
            </div>
            {isTop && (
              <div style={{ position: 'absolute', bottom: '12px', right: '16px', fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                Swipe →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==========================================================
// 13 — COMMAND PALETTE (⌘K style)
// ==========================================================
function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const commands = [
    { icon: '▶', label: 'Start Workout', shortcut: '⌘S' },
    { icon: '📊', label: 'View Stats', shortcut: '⌘D' },
    { icon: '📅', label: 'Open Calendar', shortcut: '⌘K' },
    { icon: '🏋️', label: 'New Program', shortcut: '⌘N' },
    { icon: '📖', label: 'Exercise Library', shortcut: '⌘L' },
    { icon: '⚙️', label: 'Settings', shortcut: '⌘,' },
  ];
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 px-4 py-2 rounded-xl glass-input text-white/60 text-sm min-w-[200px]"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="flex-1 text-left">Quick actions...</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[90%] max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1a1a1a, #0a0a0a)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Type a command..."
                className="bg-transparent text-sm text-white placeholder-white/30 flex-1 outline-none"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">ESC</kbd>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.map((c, i) => (
                <div key={i} className="px-3 py-2.5 rounded-lg hover:bg-white/5 flex items-center gap-3 cursor-pointer">
                  <span className="text-base">{c.icon}</span>
                  <span className="text-sm text-white flex-1">{c.label}</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono">{c.shortcut}</kbd>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-xs text-white/40 text-center py-6">No matches</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================
// 14 — WHEEL PICKER (iOS weight selector)
// ==========================================================
function WheelPicker() {
  const values = Array.from({ length: 50 }, (_, i) => i * 5 + 5); // 5 → 250 lb
  const [selected, setSelected] = useState(225);
  const ref = useRef(null);
  const itemH = 40;

  const onScroll = () => {
    const i = Math.round(ref.current.scrollTop / itemH);
    setSelected(values[i]);
  };

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = values.indexOf(selected) * itemH;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="relative" style={{ height: 200 }}>
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-10 pointer-events-none rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }} />
        <div
          ref={ref}
          onScroll={onScroll}
          className="bs-wheel h-full overflow-y-auto px-6"
          style={{ paddingTop: 80, paddingBottom: 80 }}
        >
          {values.map((v) => (
            <div
              key={v}
              className="h-10 flex items-center justify-center text-2xl font-black tabular-nums transition-all"
              style={{
                color: v === selected ? '#fff' : 'rgba(255,255,255,0.35)',
                transform: v === selected ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {v}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[9px] text-white/40 uppercase font-bold" style={{ letterSpacing: '0.2em' }}>Weight</p>
        <p className="text-5xl font-black text-white tabular-nums leading-none">{selected}</p>
        <p className="text-[10px] text-white/40 mt-1">lb</p>
      </div>
    </div>
  );
}

// ==========================================================
// 15 — EXPANDING SEARCH BAR
// ==========================================================
function ExpandingSearch() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center overflow-hidden rounded-full transition-all duration-300"
        style={{
          width: open ? 260 : 44,
          background: open ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <button onClick={() => setOpen(!open)} className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <input
          placeholder="Search exercises..."
          className="bg-transparent outline-none text-sm text-white placeholder-white/30 flex-1 pr-4"
          style={{ opacity: open ? 1 : 0, transition: 'opacity 0.2s 0.1s' }}
        />
      </div>
      <p className="text-[10px] text-white/40">Icon → full input on tap.</p>
    </div>
  );
}

// ==========================================================
// 16 — CUSTOM SLIDER with floating value bubble
// ==========================================================
function CustomSlider() {
  const [rpe, setRpe] = useState(7);
  const pct = ((rpe - 1) / 9) * 100;
  return (
    <div className="pt-8 pb-4 px-2">
      <div className="relative">
        <div
          className="absolute -top-10 -translate-x-1/2 bg-wf-red text-white text-xs font-black rounded-lg px-2 py-1 whitespace-nowrap"
          style={{ left: `${pct}%`, boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}
        >
          RPE {rpe}
          <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-wf-red rotate-45" />
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={rpe}
          onChange={(e) => setRpe(+e.target.value)}
          className="bs-slider"
          style={{ background: `linear-gradient(to right, #ef4444 ${pct}%, rgba(255,255,255,0.15) ${pct}%)`, borderRadius: 999 }}
        />
        <div className="flex justify-between mt-2 px-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="text-[9px] text-white/30 tabular-nums">{i + 1}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// 17 — CONFETTI BURST (PR celebration)
// ==========================================================
function Confetti() {
  const [burst, setBurst] = useState(0);
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const pieces = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    color: colors[i % colors.length],
    angle: Math.random() * Math.PI * 2,
    dist: 80 + Math.random() * 140,
    rotate: Math.random() * 720,
    delay: Math.random() * 100,
  })), [burst]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {burst > 0 && pieces.map((p, i) => (
          <span
            key={`${burst}-${i}`}
            className="bs-confetti-piece"
            style={{
              background: p.color,
              transform: 'translate(-50%, -50%)',
              animation: `bs-confetti-${burst}-${i} 1.1s ${p.delay}ms cubic-bezier(0.1,0.6,0.3,1) forwards`,
            }}
          />
        ))}
        <style>{burst > 0 && pieces.map((p, i) => {
          const x = Math.cos(p.angle) * p.dist;
          const y = Math.sin(p.angle) * p.dist;
          return `@keyframes bs-confetti-${burst}-${i} { from { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; } to { transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${p.rotate}deg); opacity: 0; } }`;
        }).join('\n')}</style>
        <button
          onClick={() => setBurst((b) => b + 1)}
          className="relative z-10 rounded-full px-8 py-3 bg-gradient-to-br from-wf-red to-wf-red-dark text-white font-black uppercase tracking-widest text-sm active:scale-95"
          style={{ boxShadow: '0 8px 24px rgba(239,68,68,0.4)' }}
        >
          New PR! 🏆
        </button>
      </div>
      <p className="text-[10px] text-white/40">Fire on PR detection — colored particles burst from the button.</p>
    </div>
  );
}

// ==========================================================
// 18 — TOAST NOTIFICATIONS
// ==========================================================
function Toasts() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, kind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };
  const kinds = {
    success: { bg: 'linear-gradient(135deg, #22c55e, #16a34a)', icon: '✓' },
    error:   { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: '!' },
    info:    { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'i' },
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <button onClick={() => add('Set logged', 'success')} className="px-4 py-2 rounded-lg bg-wf-green/20 text-wf-green text-xs font-bold uppercase">Success</button>
        <button onClick={() => add('Network offline', 'error')} className="px-4 py-2 rounded-lg bg-wf-red/20 text-wf-red text-xs font-bold uppercase">Error</button>
        <button onClick={() => add('Rest timer started', 'info')} className="px-4 py-2 rounded-lg bg-wf-blue/20 text-wf-blue text-xs font-bold uppercase">Info</button>
      </div>
      <div className="fixed top-6 left-1/2 z-50 flex flex-col items-center gap-2" style={{ transform: 'translateX(-50%)' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-xl px-4 py-3 flex items-center gap-3 text-white shadow-xl whitespace-nowrap"
            style={{ background: kinds[t.kind].bg, animation: 'bs-toastIn 0.3s cubic-bezier(0.2,0.9,0.2,1)', minWidth: 200 }}
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-black">{kinds[t.kind].icon}</span>
            <span className="text-sm font-bold">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================================
// 19 — SKELETON SHIMMER LOADER
// ==========================================================
function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center">
        <div className="bs-skeleton w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="bs-skeleton h-3 w-1/2 rounded" />
          <div className="bs-skeleton h-2.5 w-1/3 rounded" />
        </div>
      </div>
      <div className="bs-skeleton h-24 rounded-xl" />
      <div className="bs-skeleton h-3 w-4/5 rounded" />
      <div className="bs-skeleton h-3 w-2/3 rounded" />
    </div>
  );
}

// ==========================================================
// 20 — HEART / LIKE POP
// ==========================================================
function HeartLike() {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(247);
  const toggle = () => {
    setLiked((l) => {
      setCount((c) => c + (l ? -1 : 1));
      return !l;
    });
  };
  return (
    <div className="flex items-center gap-4 justify-center">
      <button
        onClick={toggle}
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)', animation: liked ? 'bs-popHeart 0.5s cubic-bezier(0.3,1.5,0.6,1)' : 'none' }}
      >
        <svg className="w-7 h-7 transition-colors" fill={liked ? '#ef4444' : 'none'} stroke={liked ? '#ef4444' : 'white'} strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364 4.318 12.682a4.5 4.5 0 010-6.364z" />
        </svg>
      </button>
      <div>
        <p className="text-2xl font-black text-white tabular-nums">{count}</p>
        <p className="text-[10px] text-white/40 uppercase font-bold" style={{ letterSpacing: '0.2em' }}>Kudos</p>
      </div>
    </div>
  );
}

// ==========================================================
// 21 — SWIPE TO REVEAL
// ==========================================================
function SwipeRow() {
  const [dx, setDx] = useState(0);
  const [startX, setStartX] = useState(null);
  const [deleted, setDeleted] = useState(false);
  const onDown = (e) => setStartX(e.clientX);
  const onMove = (e) => {
    if (startX == null) return;
    const d = Math.min(0, Math.max(-160, e.clientX - startX));
    setDx(d);
  };
  const onUp = () => {
    if (dx < -100) { setDeleted(true); } else { setDx(0); }
    setStartX(null);
  };

  if (deleted) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-white/50">Row deleted.</p>
        <button onClick={() => { setDeleted(false); setDx(0); }} className="mt-2 text-xs text-wf-red font-bold uppercase">Reset</button>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden select-none" style={{ background: '#dc2626' }}>
      <div className="absolute inset-y-0 right-0 w-40 flex items-center justify-center text-white font-bold uppercase tracking-wider text-xs">
        Delete
      </div>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="p-4 flex items-center gap-3 cursor-grab"
        style={{
          transform: `translateX(${dx}px)`,
          transition: startX == null ? 'transform 0.25s' : 'none',
          background: 'linear-gradient(180deg, #1a1a1a, #101010)',
        }}
      >
        <div className="w-10 h-10 rounded-lg bg-wf-red/20 flex items-center justify-center text-wf-red">💪</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-white">Bench Press</p>
          <p className="text-xs text-white/50">4 × 8 · 225 lb</p>
        </div>
        <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 12h16M4 16h16" />
        </svg>
      </div>
      <p className="text-[10px] text-white/40 mt-2 px-2">Drag the row left to reveal delete. Past threshold, it commits.</p>
    </div>
  );
}

// ==========================================================
// 22 — CONTRIBUTION HEATMAP
// ==========================================================
function Heatmap() {
  const weeks = 18;
  const days = ['M','T','W','T','F','S','S'];
  const data = useMemo(() => Array.from({ length: weeks * 7 }, () => {
    const r = Math.random();
    if (r < 0.35) return 0;
    if (r < 0.55) return 1;
    if (r < 0.75) return 2;
    if (r < 0.92) return 3;
    return 4;
  }), []);
  const colors = ['rgba(255,255,255,0.05)', 'rgba(239,68,68,0.25)', 'rgba(239,68,68,0.5)', 'rgba(239,68,68,0.75)', '#ef4444'];
  return (
    <div>
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-1">
          {days.map((d, i) => (
            <span key={i} className="h-3 text-[8px] text-white/30 leading-3">{i % 2 === 0 ? d : ''}</span>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-1 flex-1">
          {data.map((v, i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ background: colors[v], boxShadow: v === 4 ? '0 0 4px rgba(239,68,68,0.6)' : 'none' }} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[9px] text-white/40">Less</span>
        {colors.map((c, i) => <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />)}
        <span className="text-[9px] text-white/40">More</span>
      </div>
    </div>
  );
}

// ==========================================================
// 23 — VERTICAL TIMELINE
// ==========================================================
function Timeline() {
  const events = [
    { date: 'Today', title: 'Bench Press PR', detail: '225 × 8 — +10 lb from last', color: '#ef4444' },
    { date: 'Apr 21', title: 'Push Day Complete', detail: '52 min · 12.4k volume', color: '#22c55e' },
    { date: 'Apr 20', title: 'Rest Day', detail: 'Scheduled', color: '#555' },
    { date: 'Apr 19', title: 'Pull Day Complete', detail: '48 min · 10.1k volume', color: '#22c55e' },
  ];
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
      <div className="space-y-5">
        {events.map((e, i) => (
          <div key={i} className="relative">
            <div className="absolute -left-[22px] top-1 w-3 h-3 rounded-full" style={{ background: e.color, boxShadow: `0 0 10px ${e.color}80` }} />
            <p className="text-[10px] text-white/40 uppercase font-bold" style={{ letterSpacing: '0.15em' }}>{e.date}</p>
            <p className="text-sm font-bold text-white mt-0.5">{e.title}</p>
            <p className="text-xs text-white/50 mt-0.5">{e.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================================
// 24 — MESH GRADIENT BACKGROUND (aurora)
// ==========================================================
function MeshGradient() {
  return (
    <div className="relative h-48 rounded-2xl overflow-hidden" style={{ background: '#0a0a0a' }}>
      <div className="bs-mesh w-64 h-64 bs-noise" style={{ background: '#ef4444', top: '-20%', left: '-10%', animation: 'bs-meshDrift1 10s ease-in-out infinite' }} />
      <div className="bs-mesh w-72 h-72" style={{ background: '#3b82f6', top: '30%', right: '-15%', animation: 'bs-meshDrift2 12s ease-in-out infinite' }} />
      <div className="bs-mesh w-56 h-56" style={{ background: '#a855f7', bottom: '-20%', left: '25%', animation: 'bs-meshDrift3 14s ease-in-out infinite' }} />
      <div className="bs-noise absolute inset-0 opacity-30 mix-blend-overlay" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[10px] text-white/70 font-bold uppercase" style={{ letterSpacing: '0.3em' }}>This Week</p>
          <p className="text-4xl font-black text-white mt-1">New High</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// 25 — OTP / PIN INPUT
// ==========================================================
function PinInput() {
  const [digits, setDigits] = useState(['', '', '', '']);
  const refs = [useRef(), useRef(), useRef(), useRef()];
  const onChange = (i, v) => {
    if (v.length > 1) v = v.slice(-1);
    if (!/^\d*$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 3) refs[i + 1].current.focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current.focus();
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            value={d}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            className="w-12 h-14 rounded-xl text-center text-2xl font-black text-white glass-input outline-none focus:border-wf-red"
            maxLength="1"
            inputMode="numeric"
          />
        ))}
      </div>
      <p className="text-[10px] text-white/40">Auto-advance on entry, backspace to go back.</p>
    </div>
  );
}

// ==========================================================
// 26 — ICON MORPH (play ↔ pause)
// ==========================================================
function IconMorph() {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => setPlaying(!playing)}
        className="relative w-20 h-20 rounded-full bg-white text-black flex items-center justify-center active:scale-95 transition-transform"
        style={{ boxShadow: '0 10px 30px rgba(255,255,255,0.2)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24">
          <g fill="black">
            <rect
              x={playing ? 6 : 7}
              y={playing ? 5 : 5}
              width={playing ? 4 : 2}
              height="14"
              style={{ transition: 'all 0.35s cubic-bezier(0.7,0,0.3,1)' }}
            />
            <rect
              x={playing ? 14 : 11}
              y={playing ? 5 : 8}
              width={playing ? 4 : 2}
              height={playing ? 14 : 8}
              style={{ transition: 'all 0.35s cubic-bezier(0.7,0,0.3,1)' }}
            />
          </g>
        </svg>
      </button>
      <p className="text-[10px] text-white/40">Transforms pause bars → play triangle-ish on toggle.</p>
    </div>
  );
}

// ==========================================================
// 26 — STATS & STREAK CARD (Organic Blob)
// Moved from the Profile page. Uses mocked values here so the
// sandbox doesn't depend on real PR / session data.
// ==========================================================
function StatsStreakCard() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % 100), 80);
    return () => clearInterval(t);
  }, []);
  const streak = 12;
  const totalPRs = 34;
  const prsThisMonth = 5;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0e 50%, #0a0808 100%)',
      borderRadius: '24px',
      padding: '28px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated blob */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '180px',
        height: '180px',
        transform: `translate(-50%, -50%) scale(${0.8 + Math.sin(phase * 0.063) * 0.2})`,
        borderRadius: `${40 + Math.sin(phase * 0.04) * 15}% ${60 - Math.sin(phase * 0.04) * 15}% ${50 + Math.cos(phase * 0.05) * 10}% ${50 - Math.cos(phase * 0.05) * 10}%`,
        background: 'radial-gradient(circle, rgba(249,115,22,0.4) 0%, rgba(239,68,68,0.2) 50%, transparent 70%)',
        filter: 'blur(20px)',
        transition: 'all 0.08s linear',
      }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '0' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '42px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui' }}>{streak}</div>
          <div style={{ fontSize: '10px', color: 'rgba(249,115,22,0.6)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>Day Streak</div>
        </div>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '42px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui' }}>{totalPRs}</div>
          <div style={{ fontSize: '10px', color: 'rgba(239,68,68,0.6)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>Total PRs</div>
        </div>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '42px', fontWeight: 200, color: 'white', letterSpacing: '-2px', lineHeight: 1, fontFamily: 'system-ui' }}>{prsThisMonth}</div>
          <div style={{ fontSize: '10px', color: 'rgba(34,197,94,0.6)', marginTop: '4px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 600 }}>This Month</div>
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// NAVIGATION CHIPS (jump links)
// ==========================================================
function NavChips({ sections }) {
  return (
    <div className="bs-hscroll -mx-4 px-4 overflow-x-auto">
      <div className="flex gap-2 pb-2 w-max">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#bs-${s.id}`}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {String(s.id).padStart(2, '0')} · {s.name}
          </a>
        ))}
      </div>
    </div>
  );
}

// ==========================================================
// MAIN PAGE
// ==========================================================
export default function Brainstorm() {
  const navigate = useNavigate();

  const demos = [
    { id: 1,  name: 'Liquid Button',    desc: 'Flowing multi-color gradient CTA',           el: <LiquidButton /> },
    { id: 2,  name: 'Magnetic Button',  desc: 'Cursor-following button (desktop)',          el: <MagneticButton /> },
    { id: 3,  name: 'Loading Button',   desc: 'Idle → spinner → checkmark',                 el: <LoadingButton /> },
    { id: 4,  name: 'Progress Rings',   desc: 'Apple Fitness+ concentric rings',            el: <ProgressRings /> },
    { id: 5,  name: 'Odometer',         desc: 'Animated count-up for big stats',            el: <Odometer /> },
    { id: 6,  name: 'Bar Chart',        desc: 'Staggered weekly volume entry',              el: <BarChart /> },
    { id: 7,  name: '3D Tilt Card',     desc: 'Mouse-parallax depth on hover',              el: <TiltCard /> },
    { id: 8,  name: 'Flip Card',        desc: 'Front → back reveal on tap',                 el: <FlipCard /> },
    { id: 9,  name: 'Accordion',        desc: 'Smooth height animation (grid trick)',       el: <Accordion /> },
    { id: 10, name: 'Segmented',        desc: 'iOS-style sliding pill indicator',           el: <Segmented /> },
    { id: 11, name: 'Filter Chips',     desc: 'Animated multi-select chips',                el: <FilterChips /> },
    { id: 12, name: 'Command Palette',  desc: '⌘K-style quick actions modal',              el: <CommandPalette /> },
    { id: 13, name: 'Wheel Picker',     desc: 'iOS scroll-snap number picker',              el: <WheelPicker /> },
    { id: 14, name: 'Expanding Search', desc: 'Icon button → full input',                   el: <ExpandingSearch /> },
    { id: 15, name: 'Slider + Bubble',  desc: 'Custom range with floating value',           el: <CustomSlider /> },
    { id: 16, name: 'Confetti Burst',   desc: 'Particle burst for PR celebrations',         el: <Confetti /> },
    { id: 17, name: 'Toasts',           desc: 'Stackable top-center notifications',         el: <Toasts /> },
    { id: 18, name: 'Skeleton Shimmer', desc: 'Loading placeholder while data fetches',     el: <Skeleton /> },
    { id: 19, name: 'Heart / Kudos',    desc: 'Pop animation on tap',                       el: <HeartLike /> },
    { id: 20, name: 'Swipe to Delete',  desc: 'Drag row left to reveal action',             el: <SwipeRow /> },
    { id: 21, name: 'Heatmap',          desc: 'GitHub-style workout consistency',           el: <Heatmap /> },
    { id: 22, name: 'Timeline',         desc: 'Vertical activity feed',                     el: <Timeline /> },
    { id: 23, name: 'Mesh Gradient',    desc: 'Drifting aurora blobs + noise',              el: <MeshGradient /> },
    { id: 24, name: 'PIN Input',        desc: 'Auto-advance 4-digit code',                  el: <PinInput /> },
    { id: 25, name: 'Icon Morph',       desc: 'Play ↔ pause smooth transform',             el: <IconMorph /> },
    { id: 26, name: 'Stats & Streak',   desc: 'Organic blob card with streak / PRs / this month (mocked)', el: <StatsStreakCard /> },
    { id: 27, name: 'Bottom Sheet',     desc: 'Drag to snap between heights',               el: <BottomSheet /> },
    { id: 27, name: 'Stacked Paper',    desc: 'Swipe to advance a deck of layered cards',   el: <StackedPaperCards /> },
  ];

  return (
    <div className="min-h-screen relative" style={{ background: '#050505' }}>
      <style>{PAGE_CSS}</style>

      {/* Ambient background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.12), transparent 70%)', top: '-10%', left: '-10%', filter: 'blur(40px)' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08), transparent 70%)', bottom: '-10%', right: '-10%', filter: 'blur(40px)' }} />
      </div>

      <div className="relative z-10 px-4 pt-6 pb-24 max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-wf-red text-sm font-medium mb-6 active:opacity-70">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        <div className="mb-6">
          <p className="text-[10px] font-bold text-wf-red uppercase" style={{ letterSpacing: '0.3em' }}>Sandbox</p>
          <h1 className="text-4xl font-black text-white tracking-tight mt-1">Brainstorm</h1>
          <p className="text-sm text-white/50 mt-2">
            UI patterns pulled from Apple Fitness+, Strava, Linear, Duolingo, and Revolut. Tap through and pick what fits — each demo is standalone and drop-in ready.
          </p>
        </div>

        <div className="mb-6">
          <NavChips sections={demos} />
        </div>

        <div className="space-y-6">
          {demos.map((d) => (
            <section key={d.id} id={`bs-${d.id}`}>
              <SectionHeader id={d.id} name={d.name} description={d.desc} />
              <div className="px-1 pb-2">{d.el}</div>
            </section>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] text-white/30 uppercase" style={{ letterSpacing: '0.2em' }}>End of sandbox</p>
        </div>
      </div>
    </div>
  );
}
