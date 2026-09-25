import { useEffect, useMemo, useState } from 'react';
import { version as appVersion } from '../../package.json';

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
// Verses shown under the version label, rotating one per app launch.
const SPLASH_VERSES = [
  { text: '“Whatever you do, work at it with all your heart, as working for the Lord.”', ref: 'Colossians 3:23' },
  { text: '“I can do all things through Christ who strengthens me.”', ref: 'Philippians 4:13' },
  { text: '“Whatever you do, do it all for the glory of God.”', ref: '1 Corinthians 10:31' },
  { text: '“Those who hope in the Lord will renew their strength.”', ref: 'Isaiah 40:31' },
  { text: '“Let us not become weary in doing good.”', ref: 'Galatians 6:9' },
  { text: '“Commit to the Lord whatever you do, and he will establish your plans.”', ref: 'Proverbs 16:3' },
  { text: '“Be strong and courageous. Do not be afraid; do not be discouraged.”', ref: 'Joshua 1:9' },
  { text: '“It is God who arms me with strength and keeps my way secure.”', ref: 'Psalm 18:32' },
  { text: '“Do not fear, for I am with you… I will strengthen you and help you.”', ref: 'Isaiah 41:10' },
  { text: '“For God gave us a spirit not of fear but of power, love and self-control.”', ref: '2 Timothy 1:7' },
  { text: '“Though the righteous fall seven times, they rise again.”', ref: 'Proverbs 24:16' },
  { text: '“The Lord is my strength and my shield.”', ref: 'Psalm 28:7' },
  { text: '“God is our refuge and strength, an ever-present help in trouble.”', ref: 'Psalm 46:1' },
  { text: '“Let us run with perseverance the race marked out for us.”', ref: 'Hebrews 12:1' },
];

// Advance the rotation once per page load (module-level cache, so React
// StrictMode's double render and repeat splash mounts — e.g. the Profile
// > Load Screen preview — don't skip ahead). Index persists across launches.
let splashVerseThisLoad = null;
function getSplashVerse() {
  if (splashVerseThisLoad) return splashVerseThisLoad;
  let idx = 0;
  try {
    const last = Number(localStorage.getItem('wf-splash-verse-idx'));
    if (Number.isInteger(last) && last >= 0) idx = (last + 1) % SPLASH_VERSES.length;
    localStorage.setItem('wf-splash-verse-idx', String(idx));
  } catch {}
  splashVerseThisLoad = SPLASH_VERSES[idx];
  return splashVerseThisLoad;
}

export default function SplashScreen({ onDone, persistent }) {
  // Respect Profile > Bible Verses (same key the post-workout verse uses).
  // When off, no verse renders and the rotation doesn't advance.
  let versesOn = true;
  try { versesOn = localStorage.getItem('wf-bible-verses') !== 'off'; } catch {}
  const verse = versesOn ? getSplashVerse() : null;
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

  // Footer — copyright line, typed out character by character (terminal-
  // style) with a blinking block cursor. Runs once on mount; the cursor
  // keeps blinking at the end even after typing finishes, matching a real
  // terminal's idle cursor. Fits well within the 2.2s visible-time budget
  // above at ~45ms/char (~1s for the full string).
  const COPYRIGHT_TEXT = '© 2026 ArkiTechSystems';
  const [typedLen, setTypedLen] = useState(0);
  useEffect(() => {
    if (typedLen >= COPYRIGHT_TEXT.length) return;
    const t = setTimeout(() => setTypedLen((n) => n + 1), 45);
    return () => clearTimeout(t);
  }, [typedLen]);

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
          Outwork yesterday, every day.
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

        {/* Version label — sits just under the status pill */}
        <div
          style={{
            marginTop: 14,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 9,
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.24)',
          }}
        >
          v{appVersion}
        </div>

        {/* Rotating Bible verse — same type treatment as the in-app
            BibleVerseOverlay (italic Georgia verse, uppercase spaced
            reference), scaled down to roughly the version label's size.
            Hidden when Profile > Bible Verses is off (wf-bible-verses). */}
        {verse && (
        <div style={{ marginTop: 14, maxWidth: 260, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: 10,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            {verse.text}
          </p>
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: '-apple-system, sans-serif',
              fontSize: 7.5,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            {verse.ref}
          </p>
        </div>
        )}
      </div>

      {/* Footer — centered, typed-out copyright line with a hairline above */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 22px 28px' }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 8.5,
            letterSpacing: '0.28em',
            color: 'rgba(255,255,255,0.28)',
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 14,
          }}
        >
          <span>{COPYRIGHT_TEXT.slice(0, typedLen)}</span>
          <span className="splash-cursor-block" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
