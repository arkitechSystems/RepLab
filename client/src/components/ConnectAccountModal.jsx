import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Shown when "Continue with Google / Apple" finds an existing RepLab account
// (same verified email) that has a password. Entering that password once
// connects the provider and keeps the password, so both sign-in methods work
// on every device. "Forgot it?" connects anyway but turns the password off
// (the server can't confirm who set it) and signs out other devices.
export default function ConnectAccountModal({ linkToken, provider, email, onSignedIn, onCancel }) {
  const { socialLink, socialLinkWithoutPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmSkip, setConfirmSkip] = useState(false);
  const providerName = provider === 'apple' ? 'Apple' : 'Google';

  async function run(action) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await action();
      onSignedIn(data);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  const connect = () => {
    if (!password) { setError('Enter your RepLab password.'); return; }
    run(() => socialLink(linkToken, password, provider));
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      onClick={() => !busy && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-account-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <p className="text-[10px] uppercase font-bold mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}>
            Existing Account
          </p>
          <h3 id="connect-account-title" className="text-xl font-black text-white leading-tight" style={{ letterSpacing: '-0.01em' }}>
            Connect {providerName}
          </h3>

          {!confirmSkip ? (
            <>
              <p className="text-sm text-wf-gray-400 mt-2" style={{ lineHeight: 1.5 }}>
                An account with <span className="text-white font-medium">{email || 'this email'}</span> already exists.
                Enter your RepLab password to connect {providerName}. After this you can sign in either way.
              </p>
              {/* 16px so iOS Safari doesn't auto-zoom on focus. */}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                placeholder="RepLab password"
                aria-label="RepLab password"
                className="w-full mt-4 glass-input rounded-md px-3 py-2.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all"
                onKeyDown={(e) => { if (e.key === 'Enter') connect(); }}
              />
              {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-wf-gray-400 mt-2" style={{ lineHeight: 1.5 }}>
                This turns off your password and signs out other devices.
                You can set a new one anytime in Profile.
              </p>
              {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
            </>
          )}
        </div>

        <div className="px-5 pb-5 flex flex-col gap-3">
          {!confirmSkip ? (
            <>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className={`flex-1 py-3 bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                  style={{ borderRadius: 2 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={connect}
                  disabled={busy}
                  className={`flex-1 py-3 btn-gradient text-sm font-semibold text-white active:scale-[0.98] transition-all ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                  style={{ borderRadius: 2 }}
                >
                  {busy ? 'Connecting...' : 'Connect'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setError(''); setConfirmSkip(true); }}
                disabled={busy}
                className="text-sm text-wf-gray-400 py-2"
                style={{ background: 'none', border: 'none' }}
              >
                Forgot it? Continue with {providerName} instead
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setError(''); setConfirmSkip(false); }}
                disabled={busy}
                className={`flex-1 py-3 bg-white/10 text-sm font-semibold text-white active:scale-[0.98] transition-all ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ borderRadius: 2 }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => run(() => socialLinkWithoutPassword(linkToken, provider))}
                disabled={busy}
                className={`flex-1 py-3 btn-gradient text-sm font-semibold text-white active:scale-[0.98] transition-all ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ borderRadius: 2 }}
              >
                {busy ? 'Connecting...' : `Continue with ${providerName}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
