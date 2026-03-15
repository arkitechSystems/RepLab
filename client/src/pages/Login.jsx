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
  const { login, demo } = useAuth();
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
          <h1 className="text-4xl font-black tracking-wide text-white logo-glow">
            WILL<span className="text-wf-red">FIT</span>
          </h1>
          <p className="text-wf-gray-400 text-sm mt-2">Track your gains</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Email or Phone</label>
            <input
              type={phone ? 'tel' : 'email'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or phone number"
              required
              autoComplete={phone ? 'tel' : 'email'}
              className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
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
            className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-wf-gray-700" />
            <span className="text-wf-gray-500 text-xs uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-wf-gray-700" />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setError('');
              setLoading(true);
              try {
                await demo();
                navigate('/');
              } catch (err) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="w-full border border-wf-gray-700 active:scale-[0.98] text-wf-gray-300 font-semibold py-3.5 rounded-xl text-base transition-all disabled:opacity-50 hover:border-wf-gray-500 hover:text-white"
          >
            {loading ? 'Loading...' : 'Try Demo'}
          </button>
        </div>

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
