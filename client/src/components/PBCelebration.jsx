import { useState, useEffect, useMemo, useRef } from 'react';

// On-brand palette — red / white / dark red / near-black — keeps the
// confetti tied to the new red PR card instead of fighting it with the
// previous rainbow (red/blue/green/amber/purple/orange).
const CONFETTI_COLORS = ['#EF4444', '#FFFFFF', '#B81B1B', '#1A1816'];
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

      {/* Anchor the toast BELOW the global Layout header (REPLAB wordmark
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
          <div
            className="mx-4 rounded-2xl px-5 py-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,91,91,0.90) 0%, rgba(239,68,68,0.86) 46%, rgba(184,27,27,0.90) 100%)',
              backdropFilter: 'blur(16px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow: '0 18px 44px rgba(0,0,0,0.45), 0 8px 24px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.30)',
            }}
          >
            {/* radial sheen */}
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 12% 0%, rgba(255,255,255,0.22), transparent 60%)' }} />

            {/* Header */}
            <div className="relative flex items-center gap-3 mb-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.35)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
              >
                {/* trophy (unchanged glyph) */}
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/90 font-mono-stat">New Personal Record</p>
                <h3 className="text-white font-extrabold text-lg leading-tight tracking-tight">
                  New PR{prs.length > 1 ? 's' : ''}!
                </h3>
              </div>
              <button
                onClick={() => { setDismissing(true); setTimeout(onDismiss, 300); }}
                aria-label="Dismiss"
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors active:bg-white/30"
                style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PR rows — white-tint chips instead of amber */}
            <div className="relative space-y-1.5">
              {prs.map((pr, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)' }}
                >
                  <span className="text-sm font-semibold text-white truncate mr-2">{pr.name}</span>
                  <span className="text-sm font-bold text-white font-mono-stat shrink-0">
                    {pr.weight} lb × {pr.reps}
                  </span>
                </div>
              ))}
            </div>

            {/* One-shot helper caption */}
            {showCaption && (
              <p className="relative mt-2.5 text-[11px] text-white/75 leading-snug">
                REPLAB just tracked this as a personal record.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
