import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDeviceInfo } from '../utils/deviceInfo';

function isPhone(value) {
  return /^\+?\d[\d\s\-().]{6,}$/.test(value.trim());
}

const REFERRAL_OPTIONS = [
  { value: '', label: 'Select one...' },
  { value: 'facebook', label: 'Facebook / Instagram Ad' },
  { value: 'youtube', label: 'YouTube Ad' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google Search' },
  { value: 'friend', label: 'Friend / Word of Mouth' },
  { value: 'other', label: 'Other' },
];

export default function Signup() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [username, setUsername] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralOther, setReferralOther] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const errorRef = useRef(null);

  const isPhoneIdentifier = isPhone(identifier);

  // Auto-scroll to error when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    // Password strength validation
    const pwErrors = [];
    if (password.length < 8) pwErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwErrors.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(password)) pwErrors.push('at least 1 number');
    if (/\s/.test(password)) pwErrors.push('no spaces');
    if (pwErrors.length > 0) {
      setError('Password must have: ' + pwErrors.join(', '));
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!zipCode.trim()) {
      setError('Zip code is required');
      return;
    }

    setLoading(true);
    try {
      const finalReferral = referralSource === 'other' ? `Other: ${referralOther}`
        : referralSource === 'friend' && referralOther.trim() ? `Friend: ${referralOther.trim()}`
        : referralSource;
      // Read stored UTM params
      let utm = {};
      try { utm = JSON.parse(localStorage.getItem('replab_utm') || '{}'); } catch {}

      // Get native device info if running in Capacitor
      const deviceInfo = await getDeviceInfo();

      // IANA timezone (e.g. "America/Los_Angeles") so the server can later
      // format dates in the user's local calendar instead of UTC.
      let timezone;
      try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { timezone = undefined; }

      await signup(identifier, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        username: username.trim() || undefined,
        referralSource: finalReferral || undefined,
        referralCode: referralCode.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        timezone: timezone || undefined,
        utmSource: utm.utm_source || undefined,
        utmMedium: utm.utm_medium || undefined,
        utmCampaign: utm.utm_campaign || undefined,
        utmContent: utm.utm_content || undefined,
        utmTerm: utm.utm_term || undefined,
        deviceInfo: deviceInfo || undefined,
      });

      // Clear UTM after successful signup
      try { localStorage.removeItem('replab_utm'); } catch {};
      // window.location.replace (not .href) avoids adding /signup to browser
      // back history. Full reload is intentional: PublicRoute wraps /signup
      // and would redirect authenticated users to / before React Router's
      // navigate() could land on /welcome, so we bypass the SPA here.
      window.location.replace('/welcome');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full glass-input rounded-[2px] px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all';
  const labelClass = 'text-[10px] uppercase font-bold mb-1.5 block';
  const labelStyle = { color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' };
  const sectionEyebrow = 'text-[10px] uppercase font-bold mb-3 pt-2 block';
  const sectionEyebrowStyle = { color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center px-4 safe-top safe-bottom relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10 py-8">
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors mb-5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>

        {/* Nike-style panel: black gradient, red accent stripe, ambient
            spotlight, eyebrow + heavy display title. */}
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

          <div className="relative p-6">
            {/* Header — REPLAB wordmark + heavy display title */}
            <div className="mb-6">
              <h1 className="text-[20px] font-black tracking-wide text-white logo-glow mb-3">
                REP<span className="text-wf-red">LAB</span>
              </h1>
              <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
                Welcome
              </p>
              <h2 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                CREATE ACCOUNT
              </h2>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <div ref={errorRef} className="bg-red-900/30 border border-red-800 rounded-[2px] px-4 py-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <span className={sectionEyebrow} style={sectionEyebrowStyle}>Account</span>

              {/* Email */}
              <div>
                <label htmlFor="signup-email" className={labelClass} style={labelStyle}>Email *</label>
                <input
                  id="signup-email"
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email address"
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="signup-password" className={labelClass} style={labelStyle}>Password *</label>
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password"
                  required
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="signup-password-confirm" className={labelClass} style={labelStyle}>Confirm Password *</label>
                <input
                  id="signup-password-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  required
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className={sectionEyebrow} style={sectionEyebrowStyle}>About You</span>
              </div>

              {/* First Name & Last Name */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="signup-first-name" className={labelClass} style={labelStyle}>First Name *</label>
                  <input
                    id="signup-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                    autoComplete="given-name"
                    className={inputClass}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="signup-last-name" className={labelClass} style={labelStyle}>Last Name *</label>
                  <input
                    id="signup-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                    autoComplete="family-name"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Phone (optional) */}
              <div>
                <label htmlFor="signup-phone" className={labelClass} style={labelStyle}>Phone <span className="text-wf-gray-600 normal-case font-normal" style={{ letterSpacing: '0' }}>(optional)</span></label>
                <input
                  id="signup-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                  className={inputClass}
                />
              </div>

              {/* Zip Code */}
              <div>
                <label htmlFor="signup-zip" className={labelClass} style={labelStyle}>Zip Code *</label>
                <input
                  id="signup-zip"
                  type="text"
                  inputMode="numeric"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="e.g. 02101"
                  required
                  maxLength={10}
                  autoComplete="postal-code"
                  className={inputClass}
                />
              </div>

              {/* Gender */}
              <div>
                <label className={labelClass} style={labelStyle}>Gender <span className="text-wf-gray-600 normal-case font-normal" style={{ letterSpacing: '0' }}>(optional)</span></label>
                <div className="flex gap-2">
                  {['Male', 'Female', 'Other'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(gender === g ? '' : g)}
                      className={`flex-1 py-3 rounded-[2px] text-[11px] font-bold uppercase tracking-wider transition-all ${
                        gender === g
                          ? 'text-white'
                          : 'glass-input text-wf-gray-400'
                      }`}
                      style={gender === g ? {
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                        boxShadow: '0 4px 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                      } : undefined}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Username */}
              <div>
                <label htmlFor="signup-username" className={labelClass} style={labelStyle}>Username <span className="text-wf-gray-600 normal-case font-normal" style={{ letterSpacing: '0' }}>(optional)</span></label>
                <input
                  id="signup-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Auto-generated if left blank"
                  autoComplete="username"
                  className={inputClass}
                />
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className={sectionEyebrow} style={sectionEyebrowStyle}>Referral</span>
              </div>

              {/* How did you hear about us */}
              <div>
                <label htmlFor="signup-referral-source" className={labelClass} style={labelStyle}>How did you hear about us?</label>
                <select
                  id="signup-referral-source"
                  value={referralSource}
                  onChange={(e) => setReferralSource(e.target.value)}
                  className={`${inputClass} bg-transparent appearance-none cursor-pointer`}
                >
                  {REFERRAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-wf-gray-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {referralSource === 'other' && (
                <div>
                  <label htmlFor="signup-referral-other" className={labelClass} style={labelStyle}>Please specify</label>
                  <input
                    id="signup-referral-other"
                    type="text"
                    value={referralOther}
                    onChange={(e) => setReferralOther(e.target.value)}
                    placeholder="How did you find us?"
                    className={inputClass}
                  />
                </div>
              )}

              {referralSource === 'friend' && (
                <div>
                  <label htmlFor="signup-referral-friend" className={labelClass} style={labelStyle}>Referral Name <span className="text-wf-gray-600 normal-case font-normal" style={{ letterSpacing: '0' }}>(optional)</span></label>
                  <input
                    id="signup-referral-friend"
                    type="text"
                    value={referralOther}
                    onChange={(e) => setReferralOther(e.target.value)}
                    placeholder="Who referred you?"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="signup-referral-code" className={labelClass} style={labelStyle}>Referral Code <span className="text-wf-gray-600 normal-case font-normal" style={{ letterSpacing: '0' }}>(optional)</span></label>
                <input
                  id="signup-referral-code"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Enter referral code"
                  className={inputClass}
                />
              </div>

              {/* Sign Up button — matches Sign In: red gradient default,
                  flips to btn-liquid + spinner while submitting. */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform mt-2 ${loading ? 'btn-liquid' : ''}`}
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
                  'Sign Up'
                )}
              </button>

              <p className="text-center text-wf-gray-500 text-[11px] leading-relaxed mt-3">
                By signing up, you agree to our{' '}
                <Link to="/terms" className="text-wf-gray-300 underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-wf-gray-300 underline">Privacy Policy</Link>.
              </p>
            </form>
          </div>
        </div>

        <p className="text-center text-wf-gray-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-wf-red font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
