import { useEffect, useMemo, useState } from 'react';

// Splash / loading screen — Tactile system.
//
// Replaces the prior conic-gradient ring spinner with a full-screen
// brand reveal: wordmark mask-in, italic tagline, animated red rule,
// and a mono status pill cycling through 3 phrases. Designed in
// Claude Design and handed off 2026-05-22. Keyframes live in
// `src/index.css` under "Splash / loading screen — Tactile system".
//
// Props:
//   - onDone():  fired once the fade completes; no-op when persistent
//   - persistent: when true, suppresses the auto-dismiss timer (used
//                 by Profile > Load Screen preview)
//
// Visible-time budget is 2.2s so the 1.4s wordmark reveal can settle
// before the fade. With the 0.5s fade, total occupancy is 2.7s.
export default function SplashScreen({ onDone, persistent }) {
  const phrases = useMemo(
    () => ['LOADING SESSION', 'SYNCING PROGRAMS', 'PREPARING WORKOUT'],
    []
  );
  const [fading, setFading] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (persistent) return;
    const showTimer = setTimeout(() => setFading(true), 2200);
    const doneTimer = setTimeout(() => onDone?.(), 2700);
    return () => { clearTimeout(showTimer); clearTimeout(doneTimer); };
  }, [onDone, persistent]);

  useEffect(() => {
    const t = setInterval(
      () => setPhraseIdx((p) => (p + 1) % phrases.length),
      1800
    );
    return () => clearInterval(t);
  }, [phrases.length]);

  // Footer telemetry. NET is live so the chrome reflects real connectivity.
  // SYNC + WK/D are derived once on mount — they're decorative, not data.
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const { week, day } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diffDays = Math.floor((now - start) / 86400000);
    const wk = Math.ceil((diffDays + start.getDay() + 1) / 7);
    // ISO weekday: Mon=1 … Sun=7
    const d = ((now.getDay() + 6) % 7) + 1;
    return { week: wk, day: d };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] transition-opacity duration-500"
      style={{
        background: '#0c0c0b',
        color: '#fff',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'auto',
      }}
      role="status"
      aria-label="Loading REPLAB"
    >
      {/* Ambient red glow centered behind the wordmark */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Center stack — wordmark, tagline, rule, status pill */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
        {/* Wordmark: REP white, LAB red, terminating period red.
            Mask-reveals left→right via .splash-wordmark. */}
        <div
          className="splash-wordmark"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 60,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            display: 'inline-flex',
          }}
        >
          <span style={{ color: '#fff' }}>REP</span>
          <span style={{ color: '#ef4444' }}>LAB</span>
          <span style={{ color: '#ef4444', marginLeft: 2 }}>.</span>
        </div>

        {/* Tagline — italic serif for editorial contrast against the heavy wordmark */}
        <div
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 14.5,
            color: 'rgba(255,255,255,0.55)',
            marginTop: 14,
            letterSpacing: '0.01em',
          }}
        >
          Outlift yesterday, every day.
        </div>

        {/* Animated rule — 200px track, red fill grows left→right and oscillates */}
        <div
          style={{
            marginTop: 36,
            width: 200,
            height: 2,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            className="splash-line"
            style={{ width: '100%', height: '100%', background: '#ef4444', borderRadius: 2 }}
          />
        </div>

        {/* Status pill — mono phrase cycles every 1.8s; 3 dots stagger */}
        <div
          style={{
            marginTop: 22,
            padding: '9px 16px',
            borderRadius: 100,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* `key` on the phrase span re-runs the splash-tick animation on each change */}
          <span
            key={phraseIdx}
            className="splash-tick"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: '0.28em',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {phrases[phraseIdx]}
          </span>
          <span style={{ display: 'inline-flex', gap: 3 }} aria-hidden="true">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="splash-dot"
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.7)',
                  animationDelay: `${d * 0.18}s`,
                }}
              />
            ))}
          </span>
        </div>
      </div>

      {/* Footer telemetry — 3-column mono row with a hairline above */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 22px 28px' }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 8.5,
            letterSpacing: '0.28em',
            color: 'rgba(255,255,255,0.28)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 14,
          }}
        >
          <span>NET ● {online ? 'ONLINE' : 'OFFLINE'}</span>
          <span style={{ textAlign: 'center' }}>SYNC</span>
          <span style={{ textAlign: 'right' }}>WK {week} · D{day}</span>
        </div>
      </div>
    </div>
  );
}
