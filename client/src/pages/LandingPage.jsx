import { useNavigate } from 'react-router-dom';

// Public marketing landing page. Rendered at `/` for unauthenticated browser
// visitors via HomeRoute in App.jsx. Mobile (Capacitor) users never see this
// page — they're routed straight to /login or the dashboard. Iterate on copy
// and styling in /test/landing first; this file is what ships to
// replab-fitness.com.
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top nav. No Back button — this is the root URL, there's nothing to
          go back to. Logo is centered, Log In CTA on the right. */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/70 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
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
          <h1
            className="text-5xl md:text-7xl font-black uppercase leading-[0.95] mb-6"
            style={{ letterSpacing: '0.25em' }}
          >
            Train.<br />
            <span className="text-wf-red">Track.</span><br />
            Share.
          </h1>
          <p className="text-base md:text-lg text-white/60 max-w-xl mx-auto mb-8 leading-relaxed">
            REPLAB is the lifter's logbook. Built for progressive overload — across iOS, Android, and the web.
          </p>

          {/* Hero feature bullets — concise pitch above the CTAs. Mirrors
              the more detailed "Why REPLAB" grid further down the page. */}
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

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-base uppercase tracking-wider text-white active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(135deg, #DC2626, #EF4444, #F97316)',
                boxShadow: '0 8px 30px rgba(239,68,68,0.4)',
              }}
            >
              Log In to Web App →
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold text-base uppercase tracking-wider border border-white/20 hover:border-white/40 active:scale-95 transition-all"
            >
              Create an Account
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-8">
            <p className="text-[10px] uppercase tracking-widest text-white/40 sm:mr-2">Get the mobile app</p>
            <button
              disabled
              className="px-6 py-3 rounded-xl border border-white/10 text-sm font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed"
              title="Coming soon to the App Store"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              App Store
            </button>
            <button
              disabled
              className="px-6 py-3 rounded-xl border border-white/10 text-sm font-semibold flex items-center gap-2 opacity-50 cursor-not-allowed"
              title="Coming soon to Google Play"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35zM16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27zM20.16 10.81c.34.27.54.69.54 1.19s-.2.92-.54 1.19l-2.62 1.51-2.61-2.61 2.61-2.61 2.62 1.33zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
              </svg>
              Google Play
            </button>
          </div>
        </div>
      </section>

      {/* Features grid — "Why REPLAB" replacement with a curated 9-card
          set covering the core differentiators. Card #9 is a coming-soon
          teaser with a slightly different visual treatment so it reads as
          roadmap rather than shipped. */}
      <section className="px-6 py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-3 text-center">Why REPLAB</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-12">Built for serious lifters.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Log Every Workout', body: 'Track sets, reps, weights, rest, and set types — every detail of every session.' },
              { title: 'Progressive Overload', body: 'Auto-suggest next-session weights from your last PR so you keep climbing.' },
              { title: 'Track PRs', body: 'By lift, by weight, and by volume — see every personal record.' },
              { title: 'Share Programs', body: 'Send any workout or program directly to a friend’s account.' },
              { title: 'Custom Programs', body: 'Build your own training splits and reorder exercises anytime.' },
              { title: 'Cross-Device Sync', body: 'iOS, Android, and the web — one logbook, all your devices.' },
              { title: 'Cardio Logging', body: '7 machine types with tailored fields for each piece of equipment.' },
              { title: '1RM Estimator', body: 'Calculate your one-rep max from any set you log.' },
              { title: 'Guided Workouts', body: 'Rep-by-rep audio guidance is coming soon to the Featured Workouts section.' },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 border"
                style={{
                  background: 'linear-gradient(160deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)',
                  borderColor: 'rgba(239,68,68,0.35)',
                }}
              >
                <h3 className="text-lg font-black tracking-tight mb-2">{f.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REPLAB Pro CTA */}
      <section className="px-6 py-20 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-3">REPLAB Pro</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">AI-generated workouts for smarter training.</h2>
          <p className="text-white/50 mb-8 max-w-xl mx-auto">
            Unlock AI workout generation, advanced progress charts, and trainer features.
          </p>
          <button
            onClick={() => navigate('/waiting-list')}
            className="px-8 py-4 rounded-full font-bold text-base uppercase tracking-wider text-white active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, #DC2626, #EF4444, #F97316)',
              boxShadow: '0 8px 30px rgba(239,68,68,0.4)',
            }}
          >
            Join the Waiting List
          </button>
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
