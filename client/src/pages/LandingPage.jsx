import { useNavigate } from 'react-router-dom';
import AppStoreBadges from '../components/AppStoreBadges';

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
            Get 1% better everyday. REPLAB is the lifter's logbook. Built to help you track for progressive overloading and break plateaus — across iOS, Android, and the web.
          </p>

          {/* Hero feature bullets — concise pitch above the CTAs. Mirrors
              the more detailed "Why REPLAB" grid further down the page. */}
          <ul className="text-left max-w-md mx-auto mb-10 space-y-2">
            {[
              'Log every workout',
              'PRs by lift, weight, and volume',
              'Workout summaries and insights',
              'Share programs with friends',
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

          <div className="flex flex-col gap-4 justify-center items-center mt-8">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Get the mobile app</p>
            <AppStoreBadges />
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
