import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { friendlyError } from '../utils/errors';
import { track } from '../utils/analytics';
import { REFERRAL_OPTIONS, GENDER_OPTIONS, buildReferralSource } from '../utils/signupOptions';

// Optional "finish your profile" step shown once, right after a first-time
// Continue with Google / Apple sign-up. Asks for what the providers don't
// share (zip, phone, gender, referral info — plus the name when Apple didn't
// share it). Everything is optional; Skip at the top goes straight on.
// Field markup mirrors Signup.jsx so the two feel like one form.
export default function CompleteProfile() {
  const { user, updateUser } = useAuth();
  const needsName = !user?.firstName || !user?.lastName;
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralOther, setReferralOther] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const errorRef = useRef(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  // Same post-signup destination as the email signup. Full reload so the
  // app boots fresh with the new session, matching Signup.jsx.
  function goOn() {
    window.location.replace('/welcome');
  }

  function handleSkip() {
    track('signup_profile_skipped');
    goOn();
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = await api('/auth/signup-profile', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: needsName ? firstName.trim() || undefined : undefined,
          lastName: needsName ? lastName.trim() || undefined : undefined,
          zipCode: zipCode.trim() || undefined,
          phone: phone.trim() || undefined,
          gender: gender || undefined,
          referralSource: buildReferralSource(referralSource, referralOther) || undefined,
          referralCode: referralCode.trim() || undefined,
        }),
      });
      if (data?.user) updateUser({ ...user, ...data.user });
      track('signup_profile_completed');
      goOn();
    } catch (err) {
      setError(err?.status >= 400 && err?.status < 500 && err?.message
        ? err.message
        : friendlyError(err, "We couldn't save your details. You can skip for now."));
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full glass-input rounded-[2px] px-4 py-3.5 text-white text-base placeholder:text-wf-gray-500 focus:outline-none transition-all';
  const labelClass = 'text-[10px] uppercase font-bold mb-1.5 block';
  const labelStyle = { color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em' };
  const sectionEyebrow = 'text-[10px] uppercase font-bold mb-3 pt-2 block';
  const sectionEyebrowStyle = { color: 'rgba(239,68,68,0.85)', letterSpacing: '0.3em' };
  const optional = <span className="text-wf-gray-600 normal-case font-normal" style={{ letterSpacing: '0' }}>(optional)</span>;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center px-4 safe-top safe-bottom relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10 py-8">
        {/* Skip sits at the top so it's the first thing people see — this
            whole step is optional. */}
        <div className="flex justify-end mb-5">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="inline-flex items-center gap-1 text-sm font-semibold text-wf-gray-300 active:text-white transition-colors"
          >
            Skip
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

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
            <div className="mb-6">
              <h1 className="text-[20px] font-black tracking-wide text-white logo-glow mb-3">
                REP<span className="text-wf-red">LAB</span>
              </h1>
              <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
                You're in
              </p>
              <h2 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                FINISH YOUR PROFILE
              </h2>
              <p className="text-sm text-wf-gray-400 mt-3">
                A few optional details. Skip if you'd rather not.
              </p>
            </div>

            <form onSubmit={handleSave} noValidate className="space-y-4">
              {error && (
                <div ref={errorRef} className="bg-red-900/30 border border-red-800 rounded-[2px] px-4 py-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <span className={sectionEyebrow} style={sectionEyebrowStyle}>About You</span>

              {/* Name — only when the provider didn't share it (Apple can omit it) */}
              {needsName && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="profile-first-name" className={labelClass} style={labelStyle}>First Name</label>
                    <input
                      id="profile-first-name"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="profile-last-name" className={labelClass} style={labelStyle}>Last Name</label>
                    <input
                      id="profile-last-name"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {/* Zip Code */}
              <div>
                <label htmlFor="profile-zip" className={labelClass} style={labelStyle}>Zip Code {optional}</label>
                <input
                  id="profile-zip"
                  type="text"
                  inputMode="numeric"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="e.g. 02101"
                  maxLength={10}
                  autoComplete="postal-code"
                  className={inputClass}
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="profile-phone" className={labelClass} style={labelStyle}>Phone {optional}</label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                  className={inputClass}
                />
              </div>

              {/* Gender */}
              <div>
                <label className={labelClass} style={labelStyle}>Gender {optional}</label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((g) => (
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

              <div className="pt-2 border-t border-white/5">
                <span className={sectionEyebrow} style={sectionEyebrowStyle}>Referral</span>
              </div>

              {/* How did you hear about us */}
              <div>
                <label htmlFor="profile-referral-source" className={labelClass} style={labelStyle}>How did you hear about us?</label>
                <select
                  id="profile-referral-source"
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
                  <label htmlFor="profile-referral-other" className={labelClass} style={labelStyle}>Please specify</label>
                  <input
                    id="profile-referral-other"
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
                  <label htmlFor="profile-referral-friend" className={labelClass} style={labelStyle}>Referral Name {optional}</label>
                  <input
                    id="profile-referral-friend"
                    type="text"
                    value={referralOther}
                    onChange={(e) => setReferralOther(e.target.value)}
                    placeholder="Who referred you?"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="profile-referral-code" className={labelClass} style={labelStyle}>Referral Code {optional}</label>
                <input
                  id="profile-referral-code"
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Enter referral code"
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className={`w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform mt-2 ${saving ? 'btn-liquid' : ''}`}
                style={saving ? {
                  letterSpacing: '0.15em',
                  borderRadius: '2px',
                } : {
                  letterSpacing: '0.15em',
                  borderRadius: '2px',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.9) 0%, rgba(220,38,38,0.9) 100%)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
              >
                {saving ? (
                  <span className="inline-flex items-center justify-center h-5">
                    <span className="replab-spinner inline-block" style={{ width: 20, height: 20 }} />
                  </span>
                ) : (
                  'Save & Continue'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
