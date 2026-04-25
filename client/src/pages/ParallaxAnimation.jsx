import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Parallax sandbox for Will's Hypertrophy Program. Pure scroll-driven
// transforms — every layer moves at its own rate against window.scrollY.
// Page-scoped CSS lives in PAGE_CSS so it doesn't leak.
const PAGE_CSS = `
@keyframes pa-pulse { 0%,100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.08); opacity: 0.85; } }
@keyframes pa-spin  { to { transform: rotate(360deg); } }
@keyframes pa-rise  { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pa-flicker { 0%,18%,22%,25%,53%,57%,100% { opacity: 1; } 20%,24%,55% { opacity: 0.55; } }
@keyframes pa-ringFloat { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(20px,-30px) rotate(180deg); } }
@keyframes pa-shimmer { 0% { background-position: -300% 0; } 100% { background-position: 300% 0; } }
@keyframes pa-bar { from { transform: scaleY(0); } to { transform: scaleY(1); } }

.pa-shimmer-text {
  background: linear-gradient(90deg, #fff 0%, #fff 35%, #ef4444 50%, #fff 65%, #fff 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: pa-shimmer 6s linear infinite;
}

.pa-grid {
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
}
`;

function useScrollY() {
  const [y, setY] = useState(0);
  const tickingRef = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        setY(window.scrollY);
        tickingRef.current = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return y;
}

// Animated count-up that triggers when in view (simple intersection check via scrollY).
function CountUp({ to, duration = 1400, triggerY }) {
  const [val, setVal] = useState(0);
  const startedRef = useRef(false);
  const y = useScrollY();
  useEffect(() => {
    if (startedRef.current) return;
    if (y < triggerY) return;
    startedRef.current = true;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * to));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [y, to, duration, triggerY]);
  return <>{val.toLocaleString()}</>;
}

export default function ParallaxAnimation() {
  const navigate = useNavigate();
  const y = useScrollY();

  // Mouse tilt for the hero photo — subtle 3D feel even before the user
  // starts scrolling.
  const photoRef = useRef(null);
  useEffect(() => {
    const el = photoRef.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      el.style.setProperty('--tx', `${-dx * 6}deg`);
      el.style.setProperty('--ty', `${dy * 6}deg`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Per-layer depth: bigger number = moves more = feels closer
  const back = y * 0.15;
  const mid = y * 0.4;
  const front = y * 0.7;
  const titleScale = Math.max(0.55, 1 - y / 1200);
  const titleOpacity = Math.max(0, 1 - y / 700);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#040405' }}>
      <style>{PAGE_CSS}</style>

      {/* ────── FIXED BACKGROUND LAYERS (slowest) ────── */}
      <div className="fixed inset-0 z-0 pointer-events-none pa-grid" style={{ transform: `translateY(${back * 0.3}px)` }} />
      <div
        className="fixed pointer-events-none z-0"
        style={{
          top: '20%', left: '15%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(239,68,68,0.18) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transform: `translate(${back * 0.2}px, ${back}px) scale(${1 + y / 4000})`,
        }}
      />
      <div
        className="fixed pointer-events-none z-0"
        style={{
          top: '60%', right: '10%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(255,140,30,0.12) 0%, transparent 70%)',
          filter: 'blur(70px)',
          transform: `translate(${-back * 0.4}px, ${back * 1.2}px)`,
        }}
      />

      {/* Back button — sits above everything */}
      <button
        onClick={() => navigate(-1)}
        className="fixed top-5 left-5 z-50 flex items-center gap-1 text-wf-red text-xs font-bold uppercase tracking-widest active:opacity-70"
        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </button>

      {/* ───────────────────── HERO (100vh) ───────────────────── */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Drifting accent rings — middle depth */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '15%', left: '8%',
            width: '180px', height: '180px',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '50%',
            transform: `translate(${-mid * 0.3}px, ${mid * 0.5}px)`,
            animation: 'pa-ringFloat 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: '60%', right: '12%',
            width: '120px', height: '120px',
            border: '2px solid rgba(255,140,30,0.35)',
            borderRadius: '50%',
            transform: `translate(${mid * 0.2}px, ${-mid * 0.4}px)`,
            animation: 'pa-ringFloat 18s ease-in-out infinite reverse',
          }}
        />

        {/* HUGE typography — slowest of the foreground layers, fades on scroll */}
        <div
          className="absolute inset-x-0 z-10 text-center pointer-events-none px-4"
          style={{
            top: '14%',
            transform: `translateY(${-mid * 0.3}px) scale(${titleScale})`,
            opacity: titleOpacity,
            transformOrigin: 'center top',
          }}
        >
          <p className="text-[10px] uppercase font-light text-white/60 mb-2" style={{ letterSpacing: '0.5em' }}>
            Featured Program
          </p>
          <h1
            className="font-black tracking-tight pa-shimmer-text"
            style={{
              fontFamily: 'system-ui',
              fontSize: 'clamp(64px, 14vw, 180px)',
              lineHeight: '0.85',
              letterSpacing: '-0.04em',
            }}
          >
            WILL'S<br />HYPERTROPHY
          </h1>
        </div>

        {/* The photo — front layer, scales + lifts on scroll, mouse-tilted */}
        <div
          ref={photoRef}
          className="absolute z-20 pointer-events-none"
          style={{
            bottom: `${-front * 0.4}px`,
            width: 'min(72vw, 520px)',
            transform: `perspective(1400px) rotateY(var(--tx, 0deg)) rotateX(var(--ty, 0deg)) translateY(${-front * 0.2}px)`,
            transition: 'transform 0.18s ease-out',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center 70%, rgba(239,68,68,0.55) 0%, transparent 60%)',
              filter: 'blur(40px)',
              transform: 'scale(1.25)',
            }}
          />
          <img
            src="/RepLabPhotoShoot.png"
            alt="Will training"
            className="relative w-full h-auto object-cover"
            style={{
              filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.75)) drop-shadow(0 -10px 40px rgba(239,68,68,0.35))',
            }}
          />
        </div>

        {/* Floating PR plates — fastest depth, drift up + fade out */}
        {[
          { top: '25%', left: '6%', label: 'BENCH', value: '275 LB', color: '#ef4444', delay: 0 },
          { top: '48%', right: '6%', label: 'SQUAT', value: '405 LB', color: '#f97316', delay: 0.2 },
          { top: '70%', left: '4%', label: 'DEAD', value: '475 LB', color: '#ef4444', delay: 0.4 },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute z-30 pointer-events-none"
            style={{
              ...(p.left ? { left: p.left } : { right: p.right }),
              top: p.top,
              transform: `translateY(${-front * (1 + p.delay)}px)`,
              opacity: Math.max(0, 1 - y / 600),
            }}
          >
            <div
              className="px-3 py-2 backdrop-blur-md"
              style={{
                background: `linear-gradient(135deg, ${p.color}44, ${p.color}11)`,
                border: `1px solid ${p.color}66`,
                borderRadius: '4px',
                animation: `pa-pulse ${3 + i}s ease-in-out infinite`,
                animationDelay: `${p.delay}s`,
              }}
            >
              <div className="text-[8px] uppercase font-bold tracking-widest" style={{ color: p.color, letterSpacing: '0.25em' }}>{p.label}</div>
              <div className="text-sm font-black text-white tabular-nums">{p.value}</div>
            </div>
          </div>
        ))}

        {/* Spinning weight plate — top right */}
        <div
          className="absolute z-15 pointer-events-none"
          style={{
            top: '8%', right: '12%',
            width: '90px', height: '90px',
            transform: `rotate(${y * 0.4}deg) translateY(${mid * 0.3}px)`,
          }}
        >
          <div
            className="w-full h-full rounded-full border-4"
            style={{
              borderColor: '#ef4444',
              background: 'radial-gradient(circle at 35% 35%, #1a1a1a 0%, #050505 100%)',
              boxShadow: '0 0 40px rgba(239,68,68,0.5), inset 0 0 20px rgba(0,0,0,0.8)',
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] font-black text-white/80">45</span>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 text-center"
          style={{ opacity: titleOpacity }}
        >
          <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-2" style={{ letterSpacing: '0.3em' }}>
            Scroll
          </p>
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent mx-auto" />
        </div>
      </section>

      {/* ───────────────────── STATS ───────────────────── */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-2xl mx-auto">
          <p
            className="text-[11px] uppercase font-bold tracking-[0.5em] text-wf-red mb-4"
            style={{
              transform: `translateX(${-front * 0.15}px)`,
              opacity: Math.min(1, Math.max(0, (y - 400) / 200)),
            }}
          >
            The Program
          </p>
          <h2
            className="text-white font-black tracking-tight"
            style={{
              fontFamily: 'system-ui',
              fontSize: 'clamp(40px, 8vw, 88px)',
              lineHeight: '0.9',
              transform: `translateY(${-mid * 0.2}px)`,
            }}
          >
            BUILD<br />MUSCLE.<br />
            <span className="text-wf-red">RELENTLESSLY.</span>
          </h2>

          <div
            className="grid grid-cols-3 gap-4 mt-12"
            style={{ transform: `translateY(${-front * 0.1}px)` }}
          >
            {[
              { num: 12, label: 'Weeks',    color: '#ef4444' },
              { num: 6,  label: 'Days/Wk',  color: '#f97316' },
              { num: 72, label: 'Sessions', color: '#fbbf24' },
            ].map((s, i) => (
              <div
                key={i}
                className="relative p-5 overflow-hidden"
                style={{
                  background: 'linear-gradient(160deg, #1a1a1a 0%, #0a0a0a 100%)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '2px',
                }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{ background: s.color, transform: 'scaleX(0)', animation: y > 600 ? 'pa-rise 0.8s forwards' : 'none' }}
                />
                <div className="text-[44px] font-black text-white tabular-nums" style={{ fontFamily: 'system-ui', lineHeight: '1' }}>
                  <CountUp to={s.num} triggerY={500} />
                </div>
                <div className="text-[9px] uppercase font-bold mt-2" style={{ color: s.color, letterSpacing: '0.25em' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── SPLIT (animated bars) ───────────────────── */}
      <section className="relative py-32 px-6 z-10 overflow-hidden">
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] uppercase font-bold tracking-[0.5em] text-wf-red mb-4">The Split</p>
          <h2 className="text-white font-black mb-10" style={{ fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: '0.9' }}>
            6-DAY<br /><span className="text-white/40">PUSH / PULL / LEGS x2</span>
          </h2>

          <div className="space-y-3">
            {[
              { day: 'MON', name: 'Chest',         vol: 92 },
              { day: 'TUE', name: 'Bis & RDLs',    vol: 78 },
              { day: 'WED', name: 'Quads',         vol: 88 },
              { day: 'THU', name: 'Tris & Delts',  vol: 75 },
              { day: 'FRI', name: 'Back & Traps',  vol: 95 },
              { day: 'SAT', name: 'Glutes & Hams', vol: 82 },
              { day: 'SUN', name: 'Rest',          vol: 0 },
            ].map((d, i) => {
              const trigger = 1100 + i * 30;
              const visible = y > trigger;
              return (
                <div key={d.day} className="flex items-center gap-4">
                  <span className="w-12 text-[11px] font-black text-white/35 tracking-widest">{d.day}</span>
                  <span className="w-32 text-sm text-white font-semibold">{d.name}</span>
                  <div className="flex-1 h-3 relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${d.vol}%`,
                        background: d.vol === 0 ? 'rgba(255,255,255,0.1)' : `linear-gradient(90deg, #ef4444, #f97316)`,
                        transform: visible ? 'scaleX(1)' : 'scaleX(0)',
                        transformOrigin: 'left',
                        transition: `transform 1s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.06}s`,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-white/50 tabular-nums">{d.vol}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────────── QUOTE — flickers like a neon sign ───────────────────── */}
      <section className="relative py-32 px-6 z-10 text-center">
        <div
          className="max-w-xl mx-auto"
          style={{
            transform: `translateY(${-front * 0.05}px)`,
          }}
        >
          <p
            className="font-black text-white"
            style={{
              fontFamily: 'system-ui',
              fontSize: 'clamp(28px, 5vw, 48px)',
              lineHeight: '1.05',
              letterSpacing: '-0.02em',
              animation: y > 1700 ? 'pa-flicker 3.5s ease-in-out 1' : 'none',
              textShadow: '0 0 30px rgba(239,68,68,0.4), 0 0 60px rgba(239,68,68,0.2)',
            }}
          >
            "EVERY REP IS A<br /><span className="text-wf-red">BRICK</span> IN THE WALL."
          </p>
          <p className="text-[11px] uppercase font-bold tracking-widest text-white/30 mt-6" style={{ letterSpacing: '0.4em' }}>
            — Will Martin
          </p>
        </div>
      </section>

      {/* ───────────────────── CTA ───────────────────── */}
      <section className="relative py-32 px-6 z-10 text-center">
        <button
          className="relative inline-block px-12 py-5 text-white font-black text-sm uppercase tracking-[0.3em] overflow-hidden active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            borderRadius: '2px',
            boxShadow: '0 8px 30px rgba(239,68,68,0.45), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
        >
          <span className="relative z-10">Begin Program</span>
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
              animation: 'pa-shimmer 2.5s linear infinite',
              backgroundSize: '300% 100%',
            }}
          />
        </button>
        <p className="text-[10px] uppercase tracking-widest text-white/30 mt-6" style={{ letterSpacing: '0.4em' }}>
          12 Weeks. 72 Sessions. One Goal.
        </p>
      </section>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" style={{ background: 'linear-gradient(to top, #040405, transparent)' }} />
    </div>
  );
}
