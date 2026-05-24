import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Pre-launch interest capture for REPLAB Pro. Two paths to join:
//   A. Has an account → "Log In to Join" → /login?redirect=waitlist → comes
//      back here with ?auto=1 and we auto-POST /waitlist using the JWT.
//   B. No account → enter email → POST /waitlist with { email }.
//
// Re-submitting from the same email is idempotent on the server (ON CONFLICT
// upsert), so a user can switch paths without ending up with duplicate rows
// or seeing an error.
export default function WaitingList() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // 'idle' | 'success-loggedin' | 'success-email'
  const [state, setState] = useState('idle');

  // Returning from /login with redirect=waitlist — auto-add the now-authed
  // user. Runs once on mount.
  useEffect(() => {
    if (searchParams.get('auto') === '1' && isAuthenticated && state === 'idle') {
      joinAsLoggedInUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function joinAsLoggedInUser() {
    setError('');
    setSubmitting(true);
    try {
      await api('/waitlist', { method: 'POST', body: JSON.stringify({}) });
      setState('success-loggedin');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function joinByEmail(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter an email address.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setState('success-email');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success state ─────────────────────────────────────────────────────
  if (state === 'success-loggedin' || state === 'success-email') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.4)',
          }}>
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-3">REPLAB Pro</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">You're on the list.</h1>
          <p className="text-white/60 mb-8 leading-relaxed">
            {state === 'success-loggedin'
              ? `We'll email ${user?.email || 'you'} the moment Pro opens up.`
              : `We'll email ${email.trim()} the moment Pro opens up. No account created — you can sign up later.`}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 rounded-full font-bold text-sm uppercase tracking-wider border border-white/20 hover:border-white/40 active:scale-95 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ─── Default state — two-card chooser ─────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
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
          <div style={{ width: 60 }} /> {/* spacer */}
        </div>
      </nav>

      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-3">REPLAB Pro</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-4">
            Join the Waiting List
          </h1>
          <p className="text-white/60 max-w-xl mx-auto leading-relaxed">
            We'll email you the moment AI workout generation, advanced progress charts, and trainer features go live.
          </p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 text-center">
            {error}
          </div>
        )}

        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ─── Card A — has an account ─── */}
          <div
            className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col"
            style={{ background: 'linear-gradient(160deg, #1a1a1a 0%, #0d0d0d 100%)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-2">Existing User</p>
            <h2 className="text-lg font-black tracking-tight mb-2">I have an account</h2>
            <p className="text-sm text-white/55 leading-relaxed mb-6 flex-1">
              {isAuthenticated
                ? `You're signed in as ${user?.email || user?.username}. Tap below to add your account to the list.`
                : 'Log in and we’ll add your account to the list automatically.'}
            </p>
            <button
              onClick={() => {
                if (isAuthenticated) joinAsLoggedInUser();
                else navigate('/login?redirect=waitlist');
              }}
              disabled={submitting}
              className="w-full py-3 rounded-full font-bold text-sm uppercase tracking-wider text-white active:scale-95 transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #DC2626, #EF4444, #F97316)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
              }}
            >
              {submitting && isAuthenticated ? 'Adding…' : (isAuthenticated ? 'Add Me to the List' : 'Log In to Join')}
            </button>
          </div>

          {/* ─── Card B — email-only ─── */}
          <form
            onSubmit={joinByEmail}
            className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col"
            style={{ background: 'linear-gradient(160deg, #1a1a1a 0%, #0d0d0d 100%)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wf-red mb-2">No Account Needed</p>
            <h2 className="text-lg font-black tracking-tight mb-2">Just take my email</h2>
            <p className="text-sm text-white/55 leading-relaxed mb-4">
              We'll only email you about Pro. Sign up later when it's ready.
            </p>
            <label htmlFor="waitlist-email" className="block text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
              Email
            </label>
            <input
              id="waitlist-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 mb-4 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-wf-red/50 focus:outline-none focus:ring-1 focus:ring-wf-red/40"
            />
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="w-full py-3 rounded-full font-bold text-sm uppercase tracking-wider border border-white/20 hover:border-white/40 active:scale-95 transition-all disabled:opacity-40"
            >
              {submitting && state === 'idle' ? 'Adding…' : 'Add My Email'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
