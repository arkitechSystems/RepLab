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
      setError('Email or phone number is required');
      return;
    }
    if (!isPhoneIdentifier && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim())) {
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

      await signup(identifier, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        username: username.trim() || undefined,
        referralSource: finalReferral || undefined,
        referralCode: referralCode.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        utmSource: utm.utm_source || undefined,
        utmMedium: utm.utm_medium || undefined,
        utmCampaign: utm.utm_campaign || undefined,
        utmContent: utm.utm_content || undefined,
        utmTerm: utm.utm_term || undefined,
        deviceInfo: deviceInfo || undefined,
      });

      // Clear UTM after successful signup
      try { localStorage.removeItem('replab_utm'); } catch {};
      // Use window.location since PublicRoute would redirect to / before navigate fires
      window.location.href = '/welcome';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full glass-input rounded-xl px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all';
  const labelClass = 'text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block';

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 safe-top safe-bottom relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10 py-10">
        <button
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-wide text-white logo-glow">
            REP<span className="text-wf-red">LAB</span>
          </h1>
          <p className="text-wf-gray-400 text-sm mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && (
            <div ref={errorRef} className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Email / Phone */}
          <div>
            <label className={labelClass}>Email or Phone</label>
            <input
              type={isPhoneIdentifier ? 'tel' : 'email'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or phone number"
              required
              autoComplete={isPhoneIdentifier ? 'tel' : 'email'}
              className={inputClass}
            />
          </div>

          {/* Password */}
          <div>
            <label className={labelClass}>Password</label>
            <input
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
            <label className={labelClass}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-wf-gray-700" />
            <span className="text-wf-gray-500 text-xs uppercase tracking-wider">About You</span>
            <div className="flex-1 h-px bg-wf-gray-700" />
          </div>

          {/* First Name & Last Name */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>First Name *</label>
              <input
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
              <label className={labelClass}>Last Name *</label>
              <input
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

          {/* Phone (optional — shown only if they signed up with email) */}
          {!isPhoneIdentifier && (
            <div>
              <label className={labelClass}>Phone Number <span className="text-wf-gray-600">(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                autoComplete="tel"
                className={inputClass}
              />
            </div>
          )}

          {/* Zip Code (optional) */}
          <div>
            <label className={labelClass}>Zip Code *</label>
            <input
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

          {/* Gender (optional) */}
          <div>
            <label className={labelClass}>Gender <span className="text-wf-gray-600">(optional)</span></label>
            <div className="flex gap-2">
              {['Male', 'Female', 'Other'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(gender === g ? '' : g)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    gender === g
                      ? 'bg-wf-red text-white'
                      : 'glass-input text-wf-gray-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className={labelClass}>Username <span className="text-wf-gray-600">(optional)</span></label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Auto-generated if left blank"
              autoComplete="username"
              className={inputClass}
            />
          </div>

          {/* How did you hear about us */}
          <div>
            <label className={labelClass}>How did you hear about us?</label>
            <select
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

          {/* Other referral input */}
          {referralSource === 'other' && (
            <div>
              <label className={labelClass}>Please specify</label>
              <input
                type="text"
                value={referralOther}
                onChange={(e) => setReferralOther(e.target.value)}
                placeholder="How did you find us?"
                className={inputClass}
              />
            </div>
          )}

          {/* Friend referral name */}
          {referralSource === 'friend' && (
            <div>
              <label className={labelClass}>Referral Name <span className="text-wf-gray-600">(optional)</span></label>
              <input
                type="text"
                value={referralOther}
                onChange={(e) => setReferralOther(e.target.value)}
                placeholder="Who referred you?"
                className={inputClass}
              />
            </div>
          )}

          {/* Referral Code */}
          <div>
            <label className={labelClass}>Referral Code <span className="text-wf-gray-600">(optional)</span></label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Enter referral code"
              className={inputClass}
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>

          <p className="text-center text-wf-gray-500 text-xs mt-3">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="text-wf-gray-300 underline">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-wf-gray-300 underline">Privacy Policy</Link>.
          </p>
        </form>

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
