import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function isPhone(value) {
  return /^\+?\d[\d\s\-().]{6,}$/.test(value.trim());
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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 safe-top safe-bottom relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-wide text-white logo-glow animate-logo-grow">
            REP<span className="text-wf-red">LAB</span>
          </h1>
          <p className="text-wf-gray-400 text-sm mt-2">Track Your Gains, Share Your Workouts, Level Up!</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div id="login-error" role="alert" className="bg-red-900/30 border border-red-800 rounded-[2px] px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-identifier" className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Email or Phone</label>
            <input
              id="login-identifier"
              type={phone ? 'tel' : 'email'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or phone number"
              required
              autoComplete={phone ? 'tel' : 'email'}
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-wf-gray-400 text-sm hover:text-white transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform ${loading ? 'btn-liquid' : ''}`}
            style={loading ? {
              letterSpacing: '0.15em',
              borderRadius: '2px',
            } : {
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
              'Sign In'
            )}
          </button>
        </form>


        <p className="text-center text-wf-gray-400 text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-wf-red font-medium">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
