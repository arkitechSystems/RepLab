import { Link } from 'react-router-dom';

export default function Support() {
  const sectionPanelStyle = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  const SUPPORT_EMAIL = 'support@replab-fitness.com';

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-2xl mx-auto">
      <Link to="/" className="text-wf-gray-400 text-sm mb-6 inline-flex items-center gap-1 hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      <div className="relative overflow-hidden mb-6 mt-4" style={sectionPanelStyle}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative p-6">
          <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
            Help
          </p>
          <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
            SUPPORT
          </h1>
          <p className="text-[13px] text-white/55 mt-3 leading-relaxed">
            Questions, bug reports, feature requests, or anything else — we read every message.
          </p>
        </div>
      </div>

      <div className="space-y-4 text-sm text-wf-gray-300 leading-relaxed">
        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>Contact Us</h2>
            <div className="border-t border-white/5 pt-3">
              <p className="mb-3">
                The fastest way to get a response is email. Reach the REPLAB team at:
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-block text-[16px] font-semibold text-wf-red hover:text-red-400 transition-colors"
              >
                {SUPPORT_EMAIL}
              </a>
              <p className="mt-3 text-wf-gray-400 text-[13px]">
                We aim to reply within 1-2 business days.
              </p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>Common Questions</h2>
            <div className="border-t border-white/5 pt-3 space-y-4">
              <div>
                <h3 className="text-white font-semibold mb-1">How do I log a workout?</h3>
                <p className="text-wf-gray-400">
                  Open the Workouts tab, pick a program or tap "Add a Workout" to browse the library, then tap any day on your calendar to schedule it. Tap into the day to start logging sets.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">How do I create a custom workout?</h3>
                <p className="text-wf-gray-400">
                  From the home page, hit "+ Create" to build a workout from scratch. Add exercises, set rep targets, and save it to My Workouts.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">How do I cancel my account?</h3>
                <p className="text-wf-gray-400">
                  REPLAB is free to use — there's no subscription to cancel. To delete your account and all associated data, go to Profile → Settings → Delete Account, or email us at the address above.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">Where is my data stored?</h3>
                <p className="text-wf-gray-400">
                  Your workout history, programs, and personal records are stored on REPLAB's servers and sync across your devices. See our <Link to="/privacy" className="text-wf-red hover:text-red-400 transition-colors">Privacy Policy</Link> for details.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden" style={sectionPanelStyle}>
          <div className="relative p-6">
            <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>Legal</h2>
            <div className="border-t border-white/5 pt-3 flex gap-4">
              <Link to="/privacy" className="text-wf-red hover:text-red-400 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-wf-red hover:text-red-400 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </section>

        <p className="text-center text-[11px] text-white/30 uppercase tracking-wider pt-4 pb-2">
          REPLAB &middot; Developed by ArkiTech Systems, LLC
        </p>
      </div>
    </div>
  );
}
