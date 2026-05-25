import { Link, useNavigate } from 'react-router-dom';

const SUPPORT_EMAIL = 'support@replab-fitness.com';

// Visual treatment mirrors the marketing landing (LandingPageTest.jsx) and
// the restyled WaitingList: black bg with subtle red glow, REPLAB wordmark
// + logo mark nav, Anton uppercase headline, 160deg-gradient Nike panels
// with 2px corners + red top accent stripe.
export default function Support() {
  const navigate = useNavigate();

  const NIKE_PANEL = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };
  const RED_STRIPE = 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)';
  const RED_SPOT = {
    background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)',
    filter: 'blur(40px)',
  };
  const EYEBROW = {
    color: 'rgba(239,68,68,0.85)',
    letterSpacing: '0.3em',
  };
  const SECTION_LABEL = {
    color: 'rgba(239,68,68,0.85)',
    letterSpacing: '0.3em',
    fontFamily: "'JetBrains Mono', monospace",
  };
  const ANTON = {
    fontFamily: 'Anton, sans-serif',
    letterSpacing: '-0.01em',
    lineHeight: '0.95',
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav — mirrors the landing page's lp-nav (fixed, backdrop blur,
          REPLAB wordmark center, back arrow left). Safe-area padding so
          it sits below the iPhone status bar. */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-white/10"
        style={{
          background: 'rgba(10,10,10,0.72)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-10 h-[60px] md:h-[68px] flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-[11px] font-bold uppercase active:opacity-70"
            style={{ color: 'rgba(239,68,68,0.95)', letterSpacing: '0.18em' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/landing-logo-mark.png" alt="" className="w-7 h-7" />
            <span className="text-[18px] font-black tracking-widest">
              REP<span style={{ color: '#e10600' }}>LAB</span>
            </span>
          </div>
          <div className="w-[60px]" aria-hidden="true" />
        </div>
      </nav>

      <section
        className="px-6"
        style={{
          paddingTop: 'calc(120px + env(safe-area-inset-top, 0px))',
          paddingBottom: '64px',
        }}
      >
        {/* Hero — eyebrow + Anton headline + lede */}
        <div className="max-w-3xl mx-auto text-center mb-12 relative">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[400px] h-[400px] pointer-events-none -z-10" style={RED_SPOT} />
          <p className="text-[10px] uppercase font-light mb-4" style={{ ...EYEBROW, letterSpacing: '0.4em' }}>
            Help
          </p>
          <h1
            className="font-black uppercase tracking-tight"
            style={{
              ...ANTON,
              fontSize: 'clamp(44px, 8vw, 88px)',
              letterSpacing: '-0.02em',
            }}
          >
            Support.
          </h1>
          <p className="text-white/55 max-w-xl mx-auto leading-relaxed mt-6 text-[15px]">
            Questions, bug reports, feature requests, or anything else — we read every message.
          </p>
        </div>

        {/* Card grid — Contact + FAQ + Legal */}
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Contact card */}
          <div className="relative overflow-hidden" style={NIKE_PANEL}>
            <div className="h-[3px]" style={{ background: RED_STRIPE }} />
            <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={RED_SPOT} />
            <div className="relative p-6">
              <p className="text-[10px] uppercase font-light mb-3" style={SECTION_LABEL}>
                // Contact
              </p>
              <h2 className="font-black uppercase tracking-tight mb-4" style={{ ...ANTON, fontSize: '28px' }}>
                Email Us
              </h2>
              <p className="text-[14px] text-white/60 leading-relaxed mb-4">
                The fastest way to get a response is email. Reach the REPLAB team at:
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-block text-[18px] font-bold transition-colors"
                style={{ color: '#e10600', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em' }}
              >
                {SUPPORT_EMAIL}
              </a>
              <p className="mt-4 text-white/40 text-[12px]" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
                Reply within 1–2 business days.
              </p>
            </div>
          </div>

          {/* FAQ card */}
          <div className="relative overflow-hidden" style={NIKE_PANEL}>
            <div className="h-[3px]" style={{ background: RED_STRIPE }} />
            <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={RED_SPOT} />
            <div className="relative p-6">
              <p className="text-[10px] uppercase font-light mb-3" style={SECTION_LABEL}>
                // FAQ
              </p>
              <h2 className="font-black uppercase tracking-tight mb-5" style={{ ...ANTON, fontSize: '28px' }}>
                Common Questions
              </h2>

              <div className="space-y-5">
                <div>
                  <h3 className="font-bold uppercase mb-2 text-white" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
                    How do I log a workout?
                  </h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">
                    Open the Workouts tab, pick a program or tap "Add a Workout" to browse the library, then tap any day on your calendar to schedule it. Tap into the day to start logging sets.
                  </p>
                </div>

                <div className="border-t border-white/5 pt-5">
                  <h3 className="font-bold uppercase mb-2 text-white" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
                    How do I create a custom workout?
                  </h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">
                    From the home page, hit "+ Create" to build a workout from scratch. Add exercises, set rep targets, and save it to My Workouts.
                  </p>
                </div>

                <div className="border-t border-white/5 pt-5">
                  <h3 className="font-bold uppercase mb-2 text-white" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
                    How do I cancel my account?
                  </h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">
                    REPLAB is free to use — there's no subscription to cancel. To delete your account and all associated data, go to Profile → Settings → Delete Account, or email us at the address above.
                  </p>
                </div>

                <div className="border-t border-white/5 pt-5">
                  <h3 className="font-bold uppercase mb-2 text-white" style={{ fontSize: '13px', letterSpacing: '0.1em' }}>
                    Where is my data stored?
                  </h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">
                    Your workout history, programs, and personal records are stored on REPLAB's servers and sync across your devices. See our{' '}
                    <Link to="/privacy" className="transition-colors" style={{ color: '#e10600' }}>
                      Privacy Policy
                    </Link>{' '}
                    for details.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Legal links card */}
          <div className="relative overflow-hidden" style={NIKE_PANEL}>
            <div className="h-[3px]" style={{ background: RED_STRIPE }} />
            <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={RED_SPOT} />
            <div className="relative p-6">
              <p className="text-[10px] uppercase font-light mb-3" style={SECTION_LABEL}>
                // Legal
              </p>
              <div className="flex gap-6 mt-2">
                <Link
                  to="/privacy"
                  className="text-[12px] font-bold uppercase transition-colors"
                  style={{ color: '#e10600', letterSpacing: '0.15em', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Privacy Policy →
                </Link>
                <Link
                  to="/terms"
                  className="text-[12px] font-bold uppercase transition-colors"
                  style={{ color: '#e10600', letterSpacing: '0.15em', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Terms of Service →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer credit — small caps, muted, matches landing aesthetic */}
        <p
          className="text-center mt-12 uppercase"
          style={{
            fontSize: '10px',
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.30)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          REPLAB &middot; Developed by ArkiTech Systems, LLC
        </p>
      </section>
    </div>
  );
}
