import { useState, useEffect, useMemo, useRef } from 'react';

// Monolith palette — white / red / steel / near-black — to match the black
// PR slab with its red outline.
const CONFETTI_COLORS = ['#FFFFFF', '#EF4444', '#9A9AA0', '#1A1816'];
const PARTICLE_COUNT = 30;

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const xStart = `${Math.random() * 100}vw`;
    const yStart = '-10px';
    const xEnd = `${(Math.random() - 0.5) * 40}vw`;
    const yEnd = `${60 + Math.random() * 40}vh`;
    const rotation = `${Math.random() * 720 - 360}deg`;
    const duration = `${1.5 + Math.random() * 1.5}s`;
    const delay = `${Math.random() * 0.6}s`;
    return { color, xStart, yStart, xEnd, yEnd, rotation, duration, delay };
  });
}

const PB_TUTORIAL_STORAGE_KEY = 'replab.pb-celebration-tutorial-seen';

const PB_MONO = "'JetBrains Mono', ui-monospace, monospace";
const PB_GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// Engraved seal: rotating tick ring + chrome ring + outlined "PR".
function MonolithSeal({ size = 66 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="pb-seal-spin" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2, r1 = 46, r2 = i % 5 === 0 ? 40 : 43;
          return <line key={i} x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)} x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)} stroke="rgba(255,255,255,0.35)" strokeWidth={i % 5 === 0 ? 1.2 : 0.6} />;
        })}
      </svg>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="pbRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" /><stop offset="0.45" stopColor="#6d6d73" />
            <stop offset="0.7" stopColor="#e9e9ee" /><stop offset="1" stopColor="#3a3a3f" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="37" fill="none" stroke="url(#pbRing)" strokeWidth="2.2" />
        <circle cx="50" cy="50" r="32" fill="#0b0b0d" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontWeight: 900, fontSize: size * 0.3, letterSpacing: '-0.04em', color: 'transparent', WebkitTextStroke: '1.4px #fff', textShadow: '0 0 14px rgba(255,255,255,0.35)' }}>PR</span>
      </div>
    </div>
  );
}

export default function PBCelebration({ prs, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);
  const particles = useMemo(() => generateParticles(), []);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Show the one-shot helper caption the very first time the celebration
  // fires for this user. Decide synchronously so the caption is present on
  // initial render, then write the flag so it never appears again.
  const [showCaption] = useState(() => {
    try {
      return !localStorage.getItem(PB_TUTORIAL_STORAGE_KEY);
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    if (showCaption) {
      try { localStorage.setItem(PB_TUTORIAL_STORAGE_KEY, '1'); } catch (_) {}
    }
  }, [showCaption]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDismissing(true);
      setTimeout(() => onDismissRef.current(), 300);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="confetti-container">
        {particles.map((p, i) => (
          <div
            key={i}
            className="confetti-particle"
            style={{
              backgroundColor: p.color,
              '--x-start': p.xStart,
              '--y-start': p.yStart,
              '--x-end': `calc(${p.xStart} + ${p.xEnd})`,
              '--y-end': p.yEnd,
              '--rotation': p.rotation,
              '--duration': p.duration,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Anchor the toast BELOW the global Layout header (RepLab wordmark
          + avatar bar at the top of every authed page), not at viewport
          top-0. Layout's header is safe-area-inset-top + ~44px tall on
          devices with a notch, so we add ~56px of clearance plus the
          safe-area inset and a small breathing gap. */}
      <div
        role="status"
        aria-live="polite"
        className="fixed left-0 right-0 z-[100] flex justify-center pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
      >
        <div className={`pb-toast ${dismissing ? 'dismissing' : ''} pointer-events-auto`}>
          {(() => {
            const hero = prs[0];
            const rest = prs.slice(1);
            const hasPrev = hero.prevWeight != null;
            const delta = hasPrev ? hero.weight - hero.prevWeight : 0;
            const prevPct = hasPrev ? Math.max(8, Math.min(96, (hero.prevWeight / hero.weight) * 100)) : 0;
            return (
              <div
                className="mx-4 pb-mono-enter"
                style={{
                  position: 'relative', overflow: 'hidden', borderRadius: 20, padding: '18px 18px 16px',
                  background: 'linear-gradient(180deg, #17171a 0%, #08080a 55%, #000 100%)',
                  border: '1.5px solid #ef4444',
                  boxShadow: '0 0 0 3px rgba(239,68,68,0.12), 0 0 22px rgba(239,68,68,0.25), 0 30px 60px rgba(0,0,0,0.7), 0 10px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14)',
                }}
              >
                {/* Texture layers: grain, top highlight, soft glow, light sweep */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: PB_GRAIN, mixBlendMode: 'overlay', opacity: 0.9, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: -80, left: -40, width: 260, height: 180, background: 'radial-gradient(closest-side, rgba(255,255,255,0.07), transparent)', pointerEvents: 'none' }} />
                <div className="pb-mono-shine" />

                {/* Dismiss button, top-right corner */}
                <button
                  onClick={() => { setDismissing(true); setTimeout(onDismiss, 300); }}
                  aria-label="Dismiss"
                  style={{ position: 'absolute', top: 6, right: 6, zIndex: 3, width: 26, height: 26, borderRadius: 9, padding: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.6" strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div style={{ position: 'relative', zIndex: 2 }}>
                  {/* Centred header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 30px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', boxShadow: '0 0 10px rgba(255,255,255,0.9)' }} />
                    <span style={{ fontFamily: PB_MONO, fontSize: 9, letterSpacing: '0.3em', color: '#fff', textTransform: 'uppercase' }}>
                      New Personal Record{prs.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Hero row: seal + big weight + reps/name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                    <MonolithSeal size={66} />
                    <div style={{ fontWeight: 900, fontSize: 56, lineHeight: 0.82, letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums', background: 'linear-gradient(180deg, #fff 0%, #fff 55%, #9a9aa0 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', flexShrink: 0 }}>
                      {hero.weight}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: PB_MONO, fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>LB × {hero.reps}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', marginTop: 4, letterSpacing: '-0.01em' }}>{hero.name}</div>
                    </div>
                  </div>

                  {/* Prev vs new bar (only when prevWeight exists) */}
                  {hasPrev && (
                    <div style={{ marginTop: 16, paddingTop: 13, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ position: 'relative', height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prevPct}%`, borderRadius: 4, background: 'rgba(255,255,255,0.28)' }} />
                        <div className="pb-mono-grow" style={{ position: 'absolute', inset: 0, borderRadius: 4, background: 'linear-gradient(90deg, rgba(255,255,255,0) 80%, #fff 100%)' }} />
                        <div style={{ position: 'absolute', right: -1, top: -4, width: 2, height: 12, background: '#fff', boxShadow: '0 0 8px #fff' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontFamily: PB_MONO, fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
                          Prev {hero.prevWeight}×{hero.prevReps ?? hero.reps}
                        </span>
                        <span style={{ fontFamily: PB_MONO, fontSize: 11, fontWeight: 600, color: '#fff' }}>+{delta} LB</span>
                      </div>
                    </div>
                  )}

                  {/* Additional PRs as compact rows */}
                  {rest.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {rest.map((pr, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{pr.name}</span>
                          <span style={{ fontFamily: PB_MONO, fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{pr.weight} × {pr.reps}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {showCaption && (
                    <p style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                      RepLab just tracked this as a personal record.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
