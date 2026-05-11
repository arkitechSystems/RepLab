import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppStoreBadges from '../components/AppStoreBadges';
import { useAuth } from '../context/AuthContext';

// ───────────────────────────────────────────────────────────────────────
// Inline helpers — kept local so the rest of LandingPageTest stays in
// one file. useBreath / Orb / AuroraButton are ported from
// LandingPageAuroraTest (only used by the REPLAB Pro section below).
// TiltFeatureCard is the 3D-tilt-on-hover card from Brainstorm card #7,
// adapted to take title + body so it can power the Why REPLAB grid.
// ───────────────────────────────────────────────────────────────────────
function useBreath(speed = 50) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 1000), speed);
    return () => clearInterval(id);
  }, [speed]);
  return phase;
}

function Orb({ phase, top, left, right, bottom, size = 280, color = 'rgba(239,68,68,0.6)', blur = 50, freqA = 1, freqB = 1 }) {
  const t = phase * 0.05;
  const dx = Math.sin(t * freqA) * 12;
  const dy = Math.cos(t * freqB) * 10;
  const style = {
    position: 'absolute',
    pointerEvents: 'none',
    width: size,
    height: size,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
    filter: `blur(${blur}px)`,
    transition: 'all 0.4s linear',
  };
  if (top != null) style.top = `calc(${top}% + ${dy}px)`;
  if (bottom != null) style.bottom = `calc(${bottom}% + ${dy}px)`;
  if (left != null) style.left = `calc(${left}% + ${dx}px)`;
  if (right != null) style.right = `calc(${right}% + ${dx}px)`;
  return <div style={style} />;
}

function AuroraButton({ phase, onClick, children }) {
  const t = phase * 0.05;
  const glowSize = 20 + Math.sin(t * 2) * 10;
  return (
    <button
      onClick={onClick}
      className="w-full text-white font-bold py-3.5 text-[14px] active:scale-[0.98] transition-transform"
      style={{
        borderRadius: 999,
        boxShadow: `0 0 ${glowSize}px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.18)`,
        background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
        border: 'none',
      }}
    >
      {children}
    </button>
  );
}

function TiltFeatureCard({ title, body }) {
  const [tx, setTx] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  function onMove(e) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTx({ x, y });
  }
  function onLeave() { setTx({ x: 0, y: 0 }); }
  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="rounded-2xl p-6 relative"
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(900px) rotateY(${tx.x * 14}deg) rotateX(${-tx.y * 14}deg)`,
        transition: 'transform 0.1s ease-out',
        willChange: 'transform',
        // Red → dark-red gradient ported from Brainstorm flip card #8 face.
        // Tilt behavior, shadow, and hover hot-spot all preserved.
        background: 'linear-gradient(135deg, #ef4444, #7f1d1d)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${(tx.x + 0.5) * 100}% ${(tx.y + 0.5) * 100}%, rgba(255,255,255,0.18), transparent 55%)`,
        }}
      />
      {/* Title + body font treatment mirrors flip card #8's face — brutalist
          uppercase eyebrow with wide letterspacing for the title, slightly
          brighter body text to keep contrast against the red gradient. */}
      <h3
        className="text-lg font-black uppercase mb-2 relative text-white"
        style={{ letterSpacing: '0.2em' }}
      >
        {title}
      </h3>
      <p className="text-sm text-white/80 leading-relaxed relative">{body}</p>
    </div>
  );
}

// Sandbox for the future replab-fitness.com root marketing site. App users
// land here, then either log into the web app, download the mobile app,
// subscribe, or shop merch. Will be ported to a static site / separate
// Render service when the subdomain split happens.
export default function LandingPageTest() {
  const navigate = useNavigate();
  const phase = useBreath(50);
  // The landing now lives at '/' for every web visitor (refactor 2026-05).
  // Authed users get a CTA that takes them into /app; logged-out users get
  // the legacy "Log In / Create Account" pair.
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/70 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-wf-red text-sm font-medium active:opacity-70"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <div className="text-xl font-black tracking-widest">
            REP<span className="text-wf-red">LAB</span>
          </div>
          <button
            onClick={() => navigate(isAuthenticated ? '/app' : '/login')}
            className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full border border-white/20 hover:border-white/40 active:scale-95 transition-all"
          >
            {isAuthenticated ? 'Open App' : 'Log In'}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(239,68,68,0.18) 0%, transparent 50%), linear-gradient(180deg, #0a0a0a 0%, #050505 100%)',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)', filter: 'blur(60px)' }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-6">
            Train Smarter · Outlift Yesterday
          </p>
          {/* Headline typography matches the Nike Knockout "Sign In →" button
              from /test/login-screens #1 — font-black, uppercase, 0.25em
              letterspacing. Color treatment preserved (Logged. in wf-red). */}
          <h1
            className="text-5xl md:text-7xl font-black uppercase leading-[0.95] mb-6"
            style={{ letterSpacing: '0.25em' }}
          >
            Train.<br />
            <span className="text-wf-red">Track.</span><br />
            Share.
          </h1>
          <p className="text-base md:text-lg text-white/60 max-w-xl mx-auto mb-8 leading-relaxed">
            Get 1% better everyday. REPLAB is the lifter's logbook. Built to help you track for progressive overloading and breaking plateaus — across iOS, Android, and the web.
          </p>

          {/* Hero feature bullets — concise pitch above the CTAs. The fuller
              feature breakdown lives in the "Why REPLAB" grid below. */}
          <ul className="text-left max-w-md mx-auto mb-10 space-y-2">
            {[
              'Log every workout',
              'Track progressive overload',
              'Share programs with friends',
              'PRs by lift, weight, and volume',
            ].map((bullet) => (
              <li key={bullet} className="flex items-center gap-3 text-sm md:text-base text-white/75">
                <svg className="w-4 h-4 shrink-0 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {bullet}
              </li>
            ))}
          </ul>

          {/* Primary CTA: routes into /app if signed in, otherwise to /login.
              Visual treatment is identical in both states — only the label
              and target swap. The "Create an Account" secondary CTA is
              hidden for signed-in visitors (a logged-in user already has
              an account, so the prompt is nonsense). */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
            <button
              onClick={() => navigate(isAuthenticated ? '/app' : '/login')}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-base uppercase tracking-wider text-white active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(135deg, #DC2626, #EF4444, #F97316)',
                boxShadow: '0 8px 30px rgba(239,68,68,0.4)',
              }}
            >
              {isAuthenticated ? 'Go to Web App →' : 'Log In to Web App →'}
            </button>
            {!isAuthenticated && (
              <button
                onClick={() => navigate('/signup')}
                className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-base uppercase tracking-wider border border-white/20 hover:border-white/40 active:scale-95 transition-all"
              >
                Create an Account
              </button>
            )}
          </div>

          {/* App store badges — official-style black badges via shared component */}
          <div className="flex flex-col gap-4 justify-center items-center mt-8">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Get the mobile app</p>
            <AppStoreBadges />
          </div>
        </div>
      </section>

      {/* Features grid — "Why REPLAB" with 8 cards using the 3D-tilt
          treatment from Brainstorm card #7 (mouse-parallax depth on
          hover). Card count kept even so the grid lays out cleanly. */}
      <section className="px-6 py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-12 text-center">Why REPLAB</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Log Every Workout', body: 'Track sets, reps, weights, rest, and set types — every detail of every session.' },
              { title: 'Track PRs', body: 'By lift, by weight, and by volume — see every personal record.' },
              { title: 'Share Programs', body: 'Send any workout or program directly to a friend’s account.' },
              { title: 'Custom Programs', body: 'Build your own training splits and reorder exercises anytime.' },
              { title: 'Cross-Device Sync', body: 'iOS, Android, and the web — one logbook, all your devices.' },
              { title: '1RM Estimator', body: 'Calculate your one-rep max from any set you log.' },
              { title: 'Plate Calculator', body: 'Dial in exact plate loading for any target weight and bar setup.' },
              { title: 'Guided Workouts', body: 'Rep-by-rep audio guidance is coming soon to the Featured Workouts section.' },
            ].map((f) => (
              <TiltFeatureCard key={f.title} title={f.title} body={f.body} />
            ))}
          </div>
        </div>
      </section>

      {/* REPLAB Pro — Aurora treatment: floating red orbs with a breathing-
          glow CTA. Ported from LandingPageAuroraTest. */}
      <section className="relative px-5 py-20 overflow-hidden border-t border-white/5">
        <Orb phase={phase} top={10}    left={5}  size={300} color="rgba(220,38,38,0.45)" blur={55} freqA={1.2} freqB={0.9} />
        <Orb phase={phase} bottom={10} right={8} size={260} color="rgba(127,29,29,0.6)"  blur={50} freqA={0.9} freqB={1.3} />

        <div className="relative max-w-2xl mx-auto">
          <div className="px-6 sm:px-10 py-12 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-wf-red mb-3">REPLAB Pro</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">AI-generated workouts for smarter training.</h2>
            <p className="text-white/55 mb-8 max-w-xl mx-auto leading-relaxed">
              Unlock AI workout generation, advanced progress charts, and trainer features.
            </p>
            <div className="max-w-xs mx-auto">
              <AuroraButton phase={phase} onClick={() => navigate('/waiting-list')}>
                Join the Waiting List →
              </AuroraButton>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-xs font-black tracking-widest">
            REP<span className="text-wf-red">LAB</span>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-white/40">
            <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">Terms</button>
            <a href="mailto:support@replab-fitness.com" className="hover:text-white transition-colors">Support</a>
            <button onClick={() => navigate('/userguide')} className="hover:text-white transition-colors">User Guide</button>
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-widest">
            © {new Date().getFullYear()} ArkiTech Systems LLC
          </div>
        </div>
      </footer>
    </div>
  );
}
