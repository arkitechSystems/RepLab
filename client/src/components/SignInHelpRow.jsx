import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const SUPPORT_EMAIL = 'support@replab-fitness.com';

// Row under the password field on Sign In / Sign Up: "Forgot password?" on
// the left, "Sign In Help" on the right. Help opens a plain-language sheet
// about signing in with Google or Apple (how accounts link, why a password
// stops working after the first Google/Apple sign-in, Apple's Hide My Email).
export default function SignInHelpRow() {
  const [open, setOpen] = useState(false);
  const linkStyle = { color: 'rgba(255,255,255,0.45)', fontSize: 13, textDecoration: 'none', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Link to="/forgot-password" style={linkStyle}>Forgot password?</Link>
        <button type="button" onClick={() => setOpen(true)} style={linkStyle}>Sign In Help</button>
      </div>
      {open && <SignInHelpModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SignInHelpModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const h = { color: '#fff', fontSize: 14, fontWeight: 700, margin: '18px 0 6px' };
  const p = { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5, margin: '0 0 8px' };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-help-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 20px 8px' }}>
          <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}>
            Help
          </p>
          <h3 id="signin-help-title" className="text-xl font-black text-white leading-tight" style={{ letterSpacing: '-0.01em' }}>
            Signing In
          </h3>

          <p style={h}>Continue with Google or Apple</p>
          <p style={p}>
            Tap the button and sign in with your Google or Apple account. No new password needed.
            If you're new to RepLab, your account is created for you.
          </p>

          <p style={h}>Already have a RepLab account?</p>
          <p style={p}>
            If your Google or Apple email matches the email on your RepLab account, you'll be signed
            in to that same account. Your workouts, history and PRs are all still there.
          </p>

          <p style={h}>Using a password and Google or Apple together</p>
          <p style={p}>
            If your account has a password, you'll be asked for it once the first time you use Google
            or Apple. After that you can sign in either way, on any device.
          </p>
          <p style={p}>
            Forgot your password? You can still continue with Google or Apple. For your security, your
            password is turned off and any other devices are signed out. You can set a new one anytime
            in <strong style={{ color: '#fff' }}>Profile → Set a Password</strong>.
          </p>

          <p style={h}>Apple's "Hide My Email"</p>
          <p style={p}>
            If you choose Hide My Email, Apple gives RepLab a private address instead of your real
            one, so a new, separate account is created. To use your existing account, choose
            Share My Email instead.
          </p>

          <p style={h}>Still having trouble?</p>
          <p style={p}>
            Email us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#ef4444', textDecoration: 'none' }}>{SUPPORT_EMAIL}</a>
            {' '}and we'll help you get back in.
          </p>
        </div>
        <div style={{ padding: '8px 20px 20px' }}>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 btn-gradient text-sm font-semibold text-white active:scale-[0.98] transition-all"
            style={{ borderRadius: 2 }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
