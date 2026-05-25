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
//
// Visual treatment mirrors the marketing landing (LandingPageTest.jsx):
// black bg with subtle red glow, REPLAB wordmark + back arrow nav, Anton
// uppercase headline, 160deg-gradient Nike panels with 2px corners + red
// top accent stripe, .btn-liquid primary CTA matching the landing's Pro
// section button.
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

  // Shared visual tokens that match the landing page panels.
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

  // ─── Success state ─────────────────────────────────────────────────────
  if (state === 'success-loggedin' || state === 'success-email') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md w-full">
          <div className="relative overflow-hidden" style={NIKE_PANEL}>
            <div className="h-[3px]" style={{ background: RED_STRIPE }} />
            <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={RED_SPOT} />
            <div className="relative p-8 text-center">
              <div
                className="w-14 h-14 mx-auto mb-6 flex items-center justify-center"
                style={{
                  background: 'rgba(34,197,94,0.12)',
                  border: '1px solid rgba(34,197,94,0.45)',
                  borderRadius: '2px',
                }}
              >
                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <p
                className="text-[10px] uppercase font-light mb-3"
                style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}
              >
                REPLAB Pro
              </p>
              <h1
                className="text-[44px] md:text-[56px] font-black tracking-tight uppercase mb-4"
                style={{ fontFamily: 'Anton, sans-serif', lineHeight: '0.95', letterSpacing: '-0.02em' }}
              >
                You're On The List.
              </h1>
              <p className="text-white/55 text-[14px] leading-relaxed mb-8">
                {state === 'success-loggedin'
                  ? `We'll email ${user?.email || 'you'} the moment Pro opens up.`
                  : `We'll email ${email.trim()} the moment Pro opens up. No account created — you can sign up later.`}
              </p>
              <button
                onClick={() => navigate('/')}
                className="text-white font-bold uppercase active:scale-[0.98] transition-all border border-white/15 px-6 py-3"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.04)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Default state — two-card chooser ─────────────────────────────────
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
            onClick={() => navigate(-1)}
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
          {/* Spacer to keep the wordmark centered against the back button */}
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
        <div className="max-w-3xl mx-auto text-center mb-12 relative">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[400px] h-[400px] pointer-events-none -z-10" style={RED_SPOT} />
          <p
            className="text-[10px] uppercase font-light mb-4"
            style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}
          >
            REPLAB Pro
          </p>
          <h1
            className="font-black uppercase tracking-tight"
            style={{
              fontFamily: 'Anton, sans-serif',
              fontSize: 'clamp(44px, 8vw, 88px)',
              lineHeight: '0.95',
              letterSpacing: '-0.02em',
            }}
          >
            Join The<br />Waiting List.
          </h1>
          <p className="text-white/55 max-w-xl mx-auto leading-relaxed mt-6 text-[15px]">
            We'll email you the moment AI workout generation, advanced progress charts, and trainer features go live.
          </p>
        </div>

        {error && (
          <div
            className="max-w-2xl mx-auto mb-6 px-4 py-3 text-sm text-red-300 text-center"
            style={{
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '2px',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ─── Card A — has an account ─── */}
          <div className="relative overflow-hidden" style={NIKE_PANEL}>
            <div className="h-[3px]" style={{ background: RED_STRIPE }} />
            <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={RED_SPOT} />
            <div className="relative p-6 flex flex-col h-full">
              <p
                className="text-[10px] uppercase font-light mb-2"
                style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}
              >
                Existing User
              </p>
              <h2
                className="font-black uppercase tracking-tight mb-3"
                style={{ fontFamily: 'Anton, sans-serif', fontSize: '26px', lineHeight: '0.95', letterSpacing: '-0.01em' }}
              >
                I Have An Account
              </h2>
              <p className="text-[13px] text-white/55 leading-relaxed mb-6 flex-1">
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
                className="btn-liquid w-full font-bold uppercase active:scale-[0.98] transition-all disabled:opacity-50"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {submitting && isAuthenticated ? 'Adding…' : (isAuthenticated ? 'Add Me to the List' : 'Log In to Join')}
              </button>
            </div>
          </div>

          {/* ─── Card B — email-only ─── */}
          <form onSubmit={joinByEmail} className="relative overflow-hidden" style={NIKE_PANEL}>
            <div className="h-[3px]" style={{ background: RED_STRIPE }} />
            <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={RED_SPOT} />
            <div className="relative p-6 flex flex-col h-full">
              <p
                className="text-[10px] uppercase font-light mb-2"
                style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' }}
              >
                No Account Needed
              </p>
              <h2
                className="font-black uppercase tracking-tight mb-3"
                style={{ fontFamily: 'Anton, sans-serif', fontSize: '26px', lineHeight: '0.95', letterSpacing: '-0.01em' }}
              >
                Just Take My Email
              </h2>
              <p className="text-[13px] text-white/55 leading-relaxed mb-4">
                We'll only email you about Pro. Sign up later when it's ready.
              </p>
              <label
                htmlFor="waitlist-email"
                className="block uppercase mb-1.5"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
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
                className="w-full px-3 py-2.5 mb-4 text-white text-sm focus:outline-none disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '2px',
                }}
              />
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full font-bold uppercase active:scale-[0.98] transition-all disabled:opacity-40"
                style={{
                  letterSpacing: '0.15em',
                  fontSize: '11px',
                  padding: '14px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {submitting && state === 'idle' ? 'Adding…' : 'Add My Email'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
