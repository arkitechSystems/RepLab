import { useState, useEffect, useMemo } from 'react';

const CONFETTI_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#F97316'];
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

export default function PBCelebration({ prs, onDismiss }) {
  const [dismissing, setDismissing] = useState(false);
  const particles = useMemo(() => generateParticles(), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDismissing(true);
      setTimeout(onDismiss, 300);
    }, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

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

      <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pt-4 safe-top pointer-events-none">
        <div className={`pb-toast ${dismissing ? 'dismissing' : ''} pointer-events-auto`}>
          <div className="mx-4 glass-card !bg-amber-500/20 !border-amber-500/40 rounded-xl px-5 py-4 shadow-lg shadow-amber-500/20 relative">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 000 1.5h12.75a.75.75 0 000-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-amber-400 font-bold text-base">
                  New PR{prs.length > 1 ? 's' : ''}!
                </h3>
              </div>
              <button
                onClick={() => { setDismissing(true); setTimeout(onDismiss, 300); }}
                className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 active:bg-amber-500/40 transition-colors"
              >
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PR details */}
            <div className="space-y-1.5">
              {prs.map((pr, i) => (
                <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-500/10">
                  <span className="text-sm font-semibold text-white truncate mr-2">{pr.name}</span>
                  <span className="text-sm font-bold text-amber-400 font-mono-stat shrink-0">
                    {pr.weight} lbs x {pr.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
