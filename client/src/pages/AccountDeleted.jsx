import { Link } from 'react-router-dom';

// Success landing after the deletion confirmation link is clicked.
// Reached via redirect from GET /auth/confirm-deletion.
export default function AccountDeleted() {
  const sectionPanelStyle = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-16 max-w-2xl mx-auto">
      <div className="relative overflow-hidden" style={sectionPanelStyle}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

        <div className="relative p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
            Account
          </p>
          <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
            ACCOUNT DELETED
          </h1>

          <p className="text-wf-gray-300 text-sm leading-relaxed mt-5">
            Your REPLAB account and all associated data have been permanently deleted from our systems.
          </p>
          <p className="text-wf-gray-400 text-sm leading-relaxed mt-3">
            Thank you for trying REPLAB. If you'd ever like to come back, you're welcome to create a new account anytime.
          </p>

          <div className="mt-8">
            <Link
              to="/"
              className="inline-block px-8 py-3 text-white font-bold uppercase text-sm transition-transform active:scale-[0.98]"
              style={{
                letterSpacing: '0.15em',
                borderRadius: '2px',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              Back to REPLAB
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
