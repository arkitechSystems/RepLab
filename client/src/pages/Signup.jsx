import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function isPhone(value) {
  return /^\+?\d[\d\s\-().]{6,}$/.test(value.trim());
}

const REFERRAL_OPTIONS = [
  { value: '', label: 'Select one...' },
  { value: 'facebook', label: 'Facebook / Instagram Ad' },
  { value: 'youtube', label: 'YouTube Ad' },
  { value: 'tiktok', label: 'TikTok' },
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const isPhoneIdentifier = isPhone(identifier);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

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

    setLoading(true);
    try {
      const finalReferral = referralSource === 'other' ? `Other: ${referralOther}` : referralSource;
      await signup(identifier, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        username: username.trim() || undefined,
        referralSource: finalReferral || undefined,
        referralCode: referralCode.trim() || undefined,
      });
      navigate('/welcome');
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
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-wide text-white logo-glow">
            WILL<span className="text-wf-red">FIT</span>
          </h1>
          <p className="text-wf-gray-400 text-sm mt-2">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
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
