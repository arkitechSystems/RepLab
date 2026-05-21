import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

// Public web surface for account deletion (Google Play 2024 policy: users
// without the app installed must be able to request deletion from a public
// page). Active in-app users are pointed back to Profile → Delete Account
// for the password-confirmed flow. This page intentionally requires only an
// email — server emails a single-use confirmation link that performs the
// actual cascade delete on click.
export default function DeleteAccountWeb() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/request-deletion', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      // Server always returns ok:true to preserve enumeration safety; this
      // catch only fires on transport failures. Show a generic message.
      setError('Something went wrong. Please try again or email support.');
    } finally {
      setLoading(false);
    }
  }

  const sectionPanelStyle = {
    background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
    borderRadius: '2px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  };
  const inputClass = 'w-full glass-input rounded-[2px] px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all';
  const labelClass = 'text-[10px] uppercase font-bold mb-1.5 block';
  const labelStyle = { color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' };

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
            Account
          </p>
          <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
            DELETE YOUR REPLAB ACCOUNT
          </h1>
          <p className="text-[13px] text-wf-gray-300 mt-4 leading-relaxed">
            Use this page to request deletion of your REPLAB account from the web.
            This is intended for users who no longer have the REPLAB app installed.
          </p>
        </div>
      </div>

      {/* What gets deleted */}
      <section className="relative overflow-hidden mb-4" style={sectionPanelStyle}>
        <div className="relative p-6">
          <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>What Gets Deleted</h2>
          <div className="border-t border-white/5 pt-3 text-sm text-wf-gray-300 leading-relaxed">
            <p>Confirming deletion will <strong className="text-white">permanently remove</strong> your REPLAB account and all of the following data from our systems:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your account profile (email, phone, username, name, profile photo, body metrics)</li>
              <li>Every workout you have logged, including sets, reps, weights, cardio, and notes</li>
              <li>Personal records (PRs) and progress history</li>
              <li>Your programs, custom workouts, schedule, and any custom exercises you created</li>
              <li>Subscription history, push-notification tokens, and login history</li>
              <li>Workout shares you sent or received</li>
            </ul>
            <p className="mt-3 text-white"><strong>This action cannot be undone.</strong> Once your account is deleted there is no way for us to recover any of the above.</p>
          </div>
        </div>
      </section>

      {/* In-app pointer */}
      <section className="relative overflow-hidden mb-4" style={sectionPanelStyle}>
        <div className="relative p-6">
          <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>Already Have the App?</h2>
          <div className="border-t border-white/5 pt-3 text-sm text-wf-gray-300 leading-relaxed">
            <p>You can also delete your account from inside the REPLAB app: <strong className="text-white">Profile &gt; Delete Account</strong>. That flow confirms your password and takes effect immediately — no email round-trip required.</p>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="relative overflow-hidden mb-6" style={sectionPanelStyle}>
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
        <div className="relative p-6">
          <h2 className="text-[11px] uppercase font-semibold text-white mb-3" style={{ letterSpacing: '0.25em' }}>
            {sent ? 'Check Your Inbox' : 'Request Deletion'}
          </h2>
          <div className="border-t border-white/5 pt-4">
            {sent ? (
              <div>
                <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-wf-gray-300 text-sm leading-relaxed">
                  If <strong className="text-white">{email}</strong> matches a REPLAB account, we've sent a confirmation link to that inbox. Click the link to permanently delete your account. The link expires in <strong className="text-white">24 hours</strong>.
                </p>
                <p className="text-wf-gray-400 text-xs leading-relaxed mt-3">
                  Didn't receive an email? Check your spam folder. If the email address you entered isn't registered with REPLAB, no email will arrive — try a different address.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-900/30 border border-red-800 rounded-[2px] px-4 py-3 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="delete-email" className={labelClass} style={labelStyle}>Account Email</label>
                  <input
                    id="delete-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform mt-2 disabled:opacity-60"
                  style={{
                    letterSpacing: '0.15em',
                    borderRadius: '2px',
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center h-5">
                      <span className="replab-spinner inline-block" style={{ width: 20, height: 20 }} />
                    </span>
                  ) : (
                    'Send Deletion Link'
                  )}
                </button>

                <p className="text-[12px] text-wf-gray-500 mt-3 leading-relaxed">
                  We'll email you a confirmation link. Your account isn't deleted until you click the link in that email.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs text-wf-gray-500 text-center">
        Questions? Email <a href="mailto:support@replab-fitness.com" className="text-wf-red underline">support@replab-fitness.com</a>.
      </p>
    </div>
  );
}
