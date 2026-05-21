import { Link, useSearchParams } from 'react-router-dom';

// Failure landing for the deletion confirmation flow. Reached via redirect
// from GET /auth/confirm-deletion when the token is invalid, expired, or
// already used. The reason is in the query string so we can show a friendly,
// specific message rather than a generic error.
export default function AccountDeletionFailed() {
  const [params] = useSearchParams();
  const reason = params.get('reason') || 'invalid';

  const messages = {
    expired: {
      title: 'Link Expired',
      body: 'This deletion link has expired. Deletion links are valid for 24 hours after they\'re requested. Please start over and we\'ll send you a fresh link.',
    },
    used: {
      title: 'Link Already Used',
      body: 'This deletion link has already been used. If your account is still active, request a new link below.',
    },
    invalid: {
      title: 'Invalid Link',
      body: 'This deletion link isn\'t valid. It may have been mistyped, truncated by your email client, or never issued. Please start over from the deletion page.',
    },
  };
  const { title, body } = messages[reason] || messages.invalid;

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
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zm0 13.036h.008v.008H12v-.008z" />
            </svg>
          </div>

          <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
            Account
          </p>
          <h1 className="text-[28px] font-black text-white tracking-tight uppercase" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
            {title}
          </h1>

          <p className="text-wf-gray-300 text-sm leading-relaxed mt-5">
            {body}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/delete-account"
              className="inline-block px-8 py-3 text-white font-bold uppercase text-sm transition-transform active:scale-[0.98]"
              style={{
                letterSpacing: '0.15em',
                borderRadius: '2px',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              Try Again
            </Link>
            <Link
              to="/"
              className="inline-block px-8 py-3 text-wf-gray-300 font-bold uppercase text-sm transition-colors hover:text-white border border-white/10"
              style={{
                letterSpacing: '0.15em',
                borderRadius: '2px',
              }}
            >
              Back to REPLAB
            </Link>
          </div>

          <p className="text-xs text-wf-gray-500 text-center mt-6">
            Need help? Email <a href="mailto:support@replab-fitness.com" className="text-wf-red underline">support@replab-fitness.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
