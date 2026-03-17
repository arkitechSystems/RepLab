import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const pe = [];
    if (password.length < 8) pe.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pe.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(password)) pe.push('at least 1 number');
    if (/\s/.test(password)) pe.push('no spaces');
    if (pe.length > 0) {
      setError('Password must have: ' + pe.join(', '));
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
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
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-wide text-white logo-glow">
            WILL<span className="text-wf-red">FIT</span>
          </h1>
          <p className="text-wf-gray-400 text-sm mt-2">Set a new password</p>
        </div>

        {success ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Password updated</h2>
            <p className="text-wf-gray-400 text-sm">Your password has been reset. You can now sign in.</p>
            <Link
              to="/login"
              className="inline-block mt-6 btn-gradient text-white font-semibold px-6 py-3 rounded-xl text-sm"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
                className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
                className="w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all disabled:opacity-50"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <p className="text-center text-wf-gray-400 text-sm mt-4">
              <Link to="/login" className="text-wf-red font-medium">
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
