import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function isPhone(value) {
  return /^\+?\d[\d\s\-().]{6,}$/.test(value.trim());
}

// Inputs and labels mirror the admin dashboard login (server/dashboardCSS.js
// .field/label/input rules) so the two sign-in surfaces feel like one product.
const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const labelStyle = {
  display: 'block',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.3em',
  color: 'rgba(255,255,255,0.35)',
  marginBottom: 6,
  fontWeight: 700,
};

function focusInput(e) {
  e.target.style.borderColor = 'rgba(239,68,68,0.6)';
  e.target.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.15)';
}
function blurInput(e) {
  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
  e.target.style.boxShadow = 'none';
}

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const phone = isPhone(identifier);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 safe-top safe-bottom relative"
      style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 40%, #111 70%, #0a0a0a 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dotted pattern overlay — matches admin dashboard */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Red radial spotlight at top center — matches admin dashboard */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(239,68,68,0.08), transparent 60%)' }}
      />

      {/* Login card — same proportions as admin: max 380px, centered */}
      <div className="w-full relative z-10" style={{ maxWidth: 380 }}>
        {/* Logo */}
        <h1
          className="text-white text-center animate-logo-grow"
          style={{ fontSize: 36, fontWeight: 900, letterSpacing: '2px', lineHeight: 1, marginBottom: 8 }}
        >
          REP<span style={{ color: '#ef4444' }}>LAB</span>
        </h1>

        {/* Eyebrow */}
        <div
          className="text-center"
          style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.3em', color: 'rgba(255,255,255,0.35)',
            marginBottom: 24,
          }}
        >
          Sign In
        </div>

        {/* Glass form card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: 28,
          }}
        >
          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                color: '#f87171',
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Username/Email/Phone</label>
              <input
                type={phone ? 'tel' : 'text'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter username, email, or phone"
                required
                autoComplete={phone ? 'tel' : 'username'}
                onFocus={focusInput}
                onBlur={blurInput}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                onFocus={focusInput}
                onBlur={blurInput}
                style={inputStyle}
              />
            </div>

            {/* Liquid-pill sign-in button — keeps the prior loading
                animation. When idle, this is the admin .btn-login look:
                red gradient, sharp 2px corners, tracked uppercase text.
                On submit, btn-liquid takes over the paint and the spinner
                replaces the label. */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full active:scale-[0.97] transition-transform ${loading ? 'btn-liquid' : ''}`}
              style={loading ? {
                width: '100%', padding: '12px 14px', border: 'none',
                borderRadius: 2, fontSize: 11, fontWeight: 700,
                color: '#fff', textTransform: 'uppercase',
                letterSpacing: '0.15em', whiteSpace: 'nowrap', cursor: 'pointer',
                fontFamily: 'inherit',
              } : {
                width: '100%', padding: '12px 14px', border: 'none',
                borderRadius: 2, fontSize: 11, fontWeight: 700,
                color: '#fff', textTransform: 'uppercase',
                letterSpacing: '0.15em', whiteSpace: 'nowrap', cursor: 'pointer',
                fontFamily: 'inherit',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <span className="inline-flex items-center justify-center" style={{ height: 20 }}>
                  <span className="replab-spinner inline-block" style={{ width: 20, height: 20 }} />
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link
              to="/forgot-password"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Sign up link sits below the card so it doesn't compete with
            the primary Sign In CTA. */}
        <p
          className="text-center"
          style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 24 }}
        >
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#ef4444', fontWeight: 600, textDecoration: 'none' }}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
