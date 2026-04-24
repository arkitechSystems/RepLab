import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VERSES } from '../data/verses';
import { getVerseAt } from '../utils/versePicker';

// Timing knobs — tuned for a slow, reverent reveal.
const WORD_STAGGER_MS = 110;   // delay between each word's start
const WORD_ANIM_MS    = 900;   // per-word animation duration
const REF_GAP_MS      = 600;   // delay after last word finishes, before reference fades in
const REF_ANIM_MS     = 1200;  // reference fade-in duration

// ─────────────────────────────────────────────────────────────────────────────
// Reusable full-screen overlay. Shown in production after every 7th workout;
// also used by the sandbox page below with prev/replay/next controls.
// ─────────────────────────────────────────────────────────────────────────────
export function BibleVerseOverlay({ verse, onClose, meta, runKey = 0 }) {
  const words = verse.text.split(' ');
  const refDelay = words.length * WORD_STAGGER_MS + WORD_ANIM_MS + REF_GAP_MS;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000',
      color: 'white',
      fontFamily: 'Georgia, serif',
      overflow: 'hidden',
      zIndex: 1000,
    }}>
      <style>{`
        @keyframes bv-word {
          0%   { opacity: 0; transform: translateX(-28px); filter: blur(6px); }
          60%  { filter: blur(0); }
          100% { opacity: 1; transform: translateX(0); filter: blur(0); }
        }
        @keyframes bv-ref {
          0%   { opacity: 0; transform: translateY(8px); letter-spacing: 0.4em; }
          100% { opacity: 0.55; transform: translateY(0); letter-spacing: 0.3em; }
        }
        @keyframes bv-headline {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bv-divider {
          0%   { opacity: 0; transform: scaleX(0); }
          100% { opacity: 0.4; transform: scaleX(1); }
        }
        @keyframes bv-glow {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 0.4; }
        }
      `}</style>

      {/* Subtle background vignette + drifting glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(30,30,30,0.6) 0%, #000 70%)',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 500, height: 500, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(239,68,68,0.05) 0%, transparent 70%)',
        animation: 'bv-glow 6s ease-in-out infinite',
      }} />

      {/* Top meta strip */}
      {meta && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '16px 20px',
          fontFamily: '-apple-system, sans-serif',
          zIndex: 10,
        }}>
          <p style={{ fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>
            {meta}
          </p>
        </div>
      )}

      {/* Close X — halfway between top and headline */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '22vh',
          right: 24,
          zIndex: 10,
          padding: 8,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.55)',
          cursor: 'pointer',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Main verse stage — keyed so prev/next fully remount and replay the animation */}
      <div
        key={runKey}
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '0 32px',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            fontWeight: 700,
            fontFamily: '-apple-system, sans-serif',
            marginBottom: 40,
            opacity: 0,
            animation: `bv-headline 1s 200ms ease-out forwards`,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, #ffffff 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          A Word for You
        </p>

        <p style={{
          fontSize: 'clamp(22px, 4.5vw, 36px)',
          lineHeight: 1.45,
          fontStyle: 'italic',
          fontWeight: 300,
          color: 'white',
          maxWidth: 720,
          textAlign: 'center',
          margin: 0,
          textShadow: '0 0 18px rgba(255,255,255,0.28), 0 0 42px rgba(255,255,255,0.12)',
        }}>
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: `bv-word ${WORD_ANIM_MS}ms ${i * WORD_STAGGER_MS}ms cubic-bezier(0.2, 0.75, 0.2, 1) forwards`,
                marginRight: '0.28em',
              }}
            >
              {w}
            </span>
          ))}
        </p>

        <div style={{
          width: 60, height: 1, background: 'rgba(255,255,255,0.4)',
          margin: '48px 0 20px',
          transformOrigin: 'left',
          opacity: 0,
          animation: `bv-divider 800ms ${refDelay}ms cubic-bezier(0.2, 0.75, 0.2, 1) forwards`,
        }} />
        <p style={{
          fontSize: 11,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          fontWeight: 600,
          fontFamily: '-apple-system, sans-serif',
          margin: 0,
          opacity: 0,
          animation: `bv-ref ${REF_ANIM_MS}ms ${refDelay + 200}ms cubic-bezier(0.2, 0.75, 0.2, 1) forwards`,
        }}>
          {verse.ref}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox page at /test/bible-verses — uses the overlay above + prev/replay/next.
// ─────────────────────────────────────────────────────────────────────────────
export default function BibleVerses() {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => { setRunKey((k) => k + 1); }, [idx]);

  const replay = () => setRunKey((k) => k + 1);
  const next   = () => setIdx((i) => (i + 1) % VERSES.length);
  const prev   = () => setIdx((i) => (i - 1 + VERSES.length) % VERSES.length);

  return (
    <>
      <BibleVerseOverlay
        verse={getVerseAt(idx)}
        onClose={() => navigate(-1)}
        meta={`After 7 workouts · ${idx + 1} / ${VERSES.length}`}
        runKey={runKey}
      />

      {/* Sandbox controls — not part of the production overlay */}
      <div style={{
        position: 'fixed', bottom: 24, left: 0, right: 0, zIndex: 1100,
        display: 'flex', justifyContent: 'center', gap: 12,
        fontFamily: '-apple-system, sans-serif',
      }}>
        <button onClick={prev} style={btnStyle}>‹ Prev</button>
        <button onClick={replay} style={{ ...btnStyle, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}>Replay</button>
        <button onClick={next} style={btnStyle}>Next ›</button>
      </div>
    </>
  );
}

const btnStyle = {
  padding: '10px 18px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
