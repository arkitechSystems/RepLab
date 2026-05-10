import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Alternate landing-page treatment using the Aurora Pulse visual language
// from /test/login-screens (design #6). Floating red orbs at different
// speeds, pulsing conic-gradient rings around major cards, breathing glow
// on CTAs, rounded glass surfaces with backdrop-blur. Same content and
// CTAs as /test/landing — only the styling changes.

// Drives all glow + orb-position animations off a single phase counter so
// they stay loosely in sync. Honors prefers-reduced-motion: when set, phase
// stays at 0 and everything renders in its rest state.
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

// One floating orb. Position oscillates around `top`/`left` (or right/bottom
// when those props are passed) using sin/cos of the shared phase.
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

// Breathing glow CTA. Pill button with red gradient + glow that intensifies
// and recedes on the same phase. Falls back to a static glow when reduced
// motion is on (phase stays 0 → sin(0) = 0 → glow stays at the base value).
function AuroraButton({ phase, onClick, children, primary = true, full = true }) {
  const t = phase * 0.05;
  const glowSize = 20 + Math.sin(t * 2) * 10;
  const baseStyle = {
    borderRadius: 999,
    boxShadow: primary
      ? `0 0 ${glowSize}px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.18)`
      : 'inset 0 1px 0 rgba(255,255,255,0.06)',
    background: primary
      ? 'linear-gradient(135deg, #EF4444, #B91C1C)'
      : 'rgba(255,255,255,0.04)',
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.15)',
  };
  return (
    <button
      onClick={onClick}
      className={`text-white font-bold py-3.5 text-[14px] active:scale-[0.98] transition-transform ${full ? 'w-full' : ''}`}
      style={baseStyle}
    >
      {children}
    </button>
  );
}

export default function LandingPageAuroraTest() {
  const navigate = useNavigate();
  const phase = useBreath(50);
  const t = phase * 0.05;
  const logoGlow = 20 + Math.sin(t * 2) * 12;
  const logoOpacity = 0.5 + Math.sin(t * 2) * 0.25;

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: '#040404' }}>
      {/* Top nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/70 border-b border-white/5">
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
            onClick={() => navigate('/login')}
            className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full border border-white/20 hover:border-white/40 active:scale-95 transition-all"
          >
            Log In
          </button>
        </div>
      </nav>

      {/* HERO — three orbs + glowing aurora card */}
      <section className="relative px-5 pt-12 pb-16 overflow-hidden">
        {/* Hero-scoped orbs */}
        <Orb phase={phase} top={10}  left={8}   size={340} color="rgba(239,68,68,0.55)" blur={60} freqA={1}    freqB={1}   />
        <Orb phase={phase} top={45}  right={6}  size={280} color="rgba(220,38,38,0.5)"  blur={50} freqA={1.4}  freqB={1.1} />
        <Orb phase={phase} bottom={5} left={38} size={220} color="rgba(127,29,29,0.7)"  blur={45} freqA={0.8}  freqB={0.6} />

        <div className="relative max-w-2xl mx-auto">
            <div className="px-6 sm:px-10 py-10 sm:py-12 text-center">
              {/* Glowing R medallion */}
              <div className="inline-block relative mb-6" style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(239,68,68,0.35), rgba(0,0,0,0.7))',
                border: '1px solid rgba(239,68,68,0.5)',
                boxShadow: `0 0 ${logoGlow}px rgba(239,68,68,${logoOpacity})`,
                transition: 'box-shadow 0.4s linear',
              }}>
                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-3xl tracking-tight">R</span>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-wf-red mb-3">Train Smarter · Track Everything</p>
              <h1 className="font-black tracking-tight leading-[0.95]" style={{ fontSize: 'clamp(36px, 8vw, 64px)' }}>
                Your workouts.<br />
                <span className="text-wf-red">Logged.</span> Forever.
              </h1>
              <p className="text-base text-white/60 max-w-xl mx-auto mt-5 mb-8 leading-relaxed">
                REPLAB is the lifter's logbook. Track every set, every rep, every PR — across iOS, Android, and the web.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <AuroraButton phase={phase} primary onClick={() => navigate('/login')}>
                  Log In to Web App →
                </AuroraButton>
                <AuroraButton phase={phase} primary={false} onClick={() => navigate('/signup')}>
                  Create an Account
                </AuroraButton>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Get the Mobile App</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
                  <button
                    disabled
                    title="Coming soon to the App Store"
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold opacity-50 cursor-not-allowed"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    App Store
                  </button>
                  <button
                    disabled
                    title="Coming soon to Google Play"
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold opacity-50 cursor-not-allowed"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35zM16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27zM20.16 10.81c.34.27.54.69.54 1.19s-.2.92-.54 1.19l-2.62 1.51-2.61-2.61 2.61-2.61 2.62 1.33zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
                    </svg>
                    Google Play
                  </button>
                </div>
              </div>
            </div>
        </div>
      </section>

      {/* FEATURES — three aurora cards */}
      <section className="relative px-5 py-20 overflow-hidden border-t border-white/5">
        <Orb phase={phase} top={20} right={10} size={320} color="rgba(239,68,68,0.35)" blur={70} freqA={0.7} freqB={0.5} />

        <div className="relative max-w-6xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-wf-red text-center mb-3">Why REPLAB</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12">Built by lifters, for lifters.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { title: 'Track Every Lift', body: 'Log sets, reps, weights, and rest. Auto-detect personal bests. Cross-device sync.' },
              { title: "Will's Hypertrophy", body: '12-week resistance program from the ground up. Built for serious size and strength gains.' },
              { title: 'AI-Generated Workouts', body: 'Tell us your goal and equipment. Get a personalized program in seconds.' },
            ].map((f) => (
              <div key={f.title} className="px-6 py-7 text-center md:text-left">
                <h3 className="text-lg font-black tracking-tight mb-2">{f.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REPLAB PRO — full-width aurora card with breathing CTA */}
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
                <AuroraButton phase={phase} primary onClick={() => navigate('/waiting-list')}>
                  Join the Waiting List →
                </AuroraButton>
              </div>
            </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-6 py-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-base font-black tracking-widest">
            REP<span className="text-wf-red">LAB</span>
          </div>
          <div className="flex flex-wrap gap-5 text-white/40">
            <button onClick={() => navigate('/privacy')} className="hover:text-white transition-colors">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-white transition-colors">Terms</button>
            <a href="mailto:support@replab-fitness.com" className="hover:text-white transition-colors">Support</a>
            <button onClick={() => navigate('/userguide')} className="hover:text-white transition-colors">Guide</button>
          </div>
          <div className="text-[10px] text-white/30 uppercase tracking-widest">
            © {new Date().getFullYear()} ArkiTech Systems LLC
          </div>
        </div>
      </footer>
    </div>
  );
}
