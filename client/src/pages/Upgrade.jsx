import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import StickyHeader from '../components/StickyHeader';

// Digital subscriptions cannot route through Stripe on native iOS (App Store
// guideline 3.1.1 — StoreKit required) OR native Android (Google Play
// Payments policy — Play Billing required for subscriptions; the user-choice
// billing carve-out does NOT cover subscriptions). Until platform IAP
// (StoreKit / Play Billing) is wired in a follow-up release, hide every
// Stripe checkout/portal path on both native platforms. Tier comparison and
// plan info still render so native users can see what's available; web
// remains the only purchase surface. Per Apple 3.1.3(a) we also avoid any
// "steering" CTAs (buttons, links) to external purchase inside the app —
// only plain informational text is shown to native users.
const IS_NATIVE_PLATFORM = Capacitor.isNativePlatform();

function friendlyError(err, fallback = 'Something went wrong. Try again in a moment.') {
  const msg = err?.message || '';
  if (/network|fetch|offline/i.test(msg)) return "Couldn't reach our servers. Check your connection and try again.";
  if (/auth|401|unauthor/i.test(msg)) return 'Your session expired. Please sign in again.';
  if (/rate|429/i.test(msg)) return 'Too many requests. Wait a minute and try again.';
  return fallback;
}

const PLANS = [
  {
    name: 'Pro',
    monthly: 9.99,
    yearly: 99.99,
    features: [
      'Featured trainer workouts',
      'AI workout generator',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    name: 'Elite',
    monthly: 19.99,
    yearly: 179.99,
    badge: 'Best Value',
    features: [
      'Everything in Pro',
      'Custom program builder',
      'Video exercise guides',
      'Nutrition tracking',
      '1-on-1 trainer chat',
    ],
  },
];

export default function Upgrade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateUser } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState('Pro');
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isSuccess = searchParams.get('success') === 'true';
  const isCanceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (!isSuccess) return;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const sub = await api('/billing/subscription');
        if (sub && sub.plan) {
          updateUser({ ...user, plan: sub.plan });
          clearInterval(poll);
        }
      } catch {}
      if (attempts >= 10) clearInterval(poll);
    }, 2000);
    return () => clearInterval(poll);
  }, [isSuccess]);

  useEffect(() => {
    api('/billing/subscription').then(setSubscription).catch(() => {});
  }, []);

  const currentPlan = PLANS.find((p) => p.name === selectedPlan);
  const price = billing === 'yearly' ? currentPlan.yearly : currentPlan.monthly;
  const isPremium = user?.plan && user.plan !== 'Free';

  async function handleCheckout() {
    setError('');
    setLoading(true);
    try {
      const data = await api('/billing/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlan, billing }),
      });
      window.location.href = data.url;
    } catch (err) {
      setError(friendlyError(err, "We couldn't start checkout. Please try again."));
      setLoading(false);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const data = await api('/billing/create-portal-session', { method: 'POST' });
      window.location.href = data.url;
    } catch (err) {
      setError(friendlyError(err, "We couldn't open the billing portal. Please try again."));
      setPortalLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
        <div className="ambient-bg" />
        <div
          className="w-full max-w-sm relative z-10 overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-8 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', borderRadius: '2px' }}>
              <svg className="w-8 h-8" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-[10px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
              Membership Active
            </p>
            <h1 className="text-[28px] font-black text-white tracking-tight" style={{ lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              WELCOME TO {(user?.plan || 'PRO').toUpperCase()}
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Your plan is now active. Unlock every feature and start training.
            </p>
            <button
              onClick={() => navigate('/app')}
              className="w-full active:scale-[0.98] text-white font-bold uppercase py-4 transition-all"
              style={{
                background: '#ef4444',
                borderRadius: '2px',
                letterSpacing: '0.2em',
                fontSize: '13px',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              Start Training
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isCanceled) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
        <div className="ambient-bg" />
        <div
          className="w-full max-w-sm relative z-10 overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />
          <div className="relative p-8 flex flex-col items-center gap-5 text-center">
            <div className="w-16 h-16 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
              <svg className="w-8 h-8 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[10px] uppercase font-light" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
              Checkout Canceled
            </p>
            <h1 className="text-[28px] font-black text-white tracking-tight" style={{ lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              NO CHANGES MADE
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Your checkout was canceled. No charges were made.
            </p>
            <button
              onClick={() => navigate('/upgrade')}
              className="w-full active:scale-[0.98] text-white font-bold uppercase py-4 transition-all"
              style={{
                background: '#ef4444',
                borderRadius: '2px',
                letterSpacing: '0.2em',
                fontSize: '13px',
                boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-[11px] uppercase text-white/40 active:text-white transition-colors font-semibold"
              style={{ letterSpacing: '0.25em' }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StickyHeader title="Upgrade Plan" />

      <div className="px-4 pb-8">
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm text-white/50 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>

        {/* Hero panel — always shown */}
        <div
          className="relative overflow-hidden mb-5"
          style={{
            background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
            borderRadius: '2px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.25), transparent)' }} />
          <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

          <div className="relative p-6">
            <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
              Membership
            </p>
            <h1 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
              {isPremium ? 'YOUR PLAN' : 'GO PRO'}
            </h1>
            {!isPremium && (
              <p className="text-sm text-white/55 mt-3 leading-relaxed">
                Unlock featured trainer programs, AI workout generation, and the full REPLAB toolkit.
              </p>
            )}
          </div>
        </div>

        {/* Already subscribed — Nike-styled manage card */}
        {isPremium && subscription && (
          <div
            className="relative overflow-hidden mb-5"
            style={{
              background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
              borderRadius: '2px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #ef4444, #ef4444, rgba(239,68,68,0.4))' }} />
            <div className="absolute -top-10 -right-10 w-[250px] h-[250px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.10) 0%, transparent 60%)', filter: 'blur(40px)' }} />

            <div className="relative p-6">
              <div className="flex items-start justify-between mb-5 gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.35em' }}>
                    Active Plan
                  </p>
                  <h2 className="text-[24px] font-black text-white tracking-tight uppercase" style={{ lineHeight: '0.95', letterSpacing: '-0.01em' }}>
                    {user.plan}
                  </h2>
                  <p className="text-[11px] uppercase text-white/40 font-semibold mt-2" style={{ letterSpacing: '0.25em' }}>
                    {subscription.billing === 'year' ? 'Annual Billing' : 'Monthly Billing'}
                    {subscription.cancelAtPeriodEnd && ' • Cancels at period end'}
                  </p>
                  {subscription.currentPeriodEnd && (
                    <p className="text-[11px] text-white/35 mt-1.5">
                      {subscription.cancelAtPeriodEnd ? 'Access until' : 'Renews'}{' '}
                      <span className="text-white/70 font-medium">
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    </p>
                  )}
                </div>
                <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.12)', borderRadius: '2px' }}>
                  <svg className="w-5 h-5" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              </div>
              {!IS_NATIVE_PLATFORM && (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="w-full text-white font-bold uppercase py-3.5 active:scale-[0.98] transition-all disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '2px',
                    letterSpacing: '0.25em',
                    fontSize: '12px',
                  }}
                >
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Plan selection — hide if already subscribed */}
        {!isPremium && (
          <>
            {/* Billing toggle — sharp pill row */}
            <div className="flex items-center mb-5" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '2px', padding: '4px' }}>
              <button
                onClick={() => setBilling('monthly')}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase transition-all ${
                  billing === 'monthly' ? 'text-white' : 'text-white/40'
                }`}
                style={{
                  letterSpacing: '0.25em',
                  borderRadius: '2px',
                  background: billing === 'monthly' ? '#ef4444' : 'transparent',
                  boxShadow: billing === 'monthly' ? '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase transition-all relative ${
                  billing === 'yearly' ? 'text-white' : 'text-white/40'
                }`}
                style={{
                  letterSpacing: '0.25em',
                  borderRadius: '2px',
                  background: billing === 'yearly' ? '#ef4444' : 'transparent',
                  boxShadow: billing === 'yearly' ? '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                }}
              >
                Yearly
                <span className={`ml-1.5 text-[9px] font-black ${billing === 'yearly' ? 'text-white' : 'text-white/55'}`} style={{ letterSpacing: '0.15em' }}>
                  −17%
                </span>
              </button>
            </div>

            {/* Plan Cards — Nike product tiles */}
            <div className="space-y-3 mb-6">
              {PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.name;
                const planPrice = billing === 'yearly' ? plan.yearly : plan.monthly;
                const perMonth = billing === 'yearly' ? (plan.yearly / 12).toFixed(2) : plan.monthly;

                return (
                  <button
                    key={plan.name}
                    onClick={() => setSelectedPlan(plan.name)}
                    className="w-full text-left relative overflow-hidden active:scale-[0.99] transition-all"
                    style={{
                      background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                      borderRadius: '2px',
                      boxShadow: isSelected
                        ? '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1.5px rgba(239,68,68,0.6)'
                        : '0 12px 40px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      className="h-[3px]"
                      style={{
                        background: isSelected
                          ? 'linear-gradient(90deg, #ef4444, #ef4444, rgba(239,68,68,0.4))'
                          : 'linear-gradient(90deg, rgba(239,68,68,0.5), rgba(239,68,68,0.15), transparent)',
                      }}
                    />
                    {isSelected && (
                      <div className="absolute -top-10 -right-10 w-[280px] h-[280px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 60%)', filter: 'blur(40px)' }} />
                    )}

                    <div className="relative p-5">
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="min-w-0">
                          <p
                            className="text-[10px] uppercase font-light mb-1"
                            style={{
                              color: isSelected ? 'rgba(239,68,68,0.95)' : 'rgba(255,255,255,0.35)',
                              letterSpacing: '0.4em',
                            }}
                          >
                            {plan.name === 'Pro' ? 'Athlete' : 'Performance'}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className="text-[26px] font-black text-white tracking-tight uppercase"
                              style={{ lineHeight: '0.95', letterSpacing: '-0.02em' }}
                            >
                              {plan.name}
                            </h3>
                            {plan.badge && (
                              <span
                                className="text-[9px] font-black uppercase text-white px-2 py-1"
                                style={{
                                  background: '#ef4444',
                                  borderRadius: '2px',
                                  letterSpacing: '0.2em',
                                  boxShadow: '0 2px 8px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                                }}
                              >
                                {plan.badge}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-baseline justify-end gap-0.5">
                            <span className="text-[28px] font-black text-white tracking-tight" style={{ lineHeight: '1', letterSpacing: '-0.02em' }}>
                              ${perMonth}
                            </span>
                            <span className="text-[11px] text-white/40 font-medium">/mo</span>
                          </div>
                          {billing === 'yearly' && (
                            <p className="text-[10px] uppercase font-bold mt-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em' }}>
                              ${planPrice}/yr • Save ${Math.round(plan.monthly * 12 - plan.yearly)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-4 space-y-2.5">
                        {plan.features.map((f) => (
                          <div key={f} className="flex items-center gap-2.5">
                            <div
                              className="w-4 h-4 shrink-0 flex items-center justify-center"
                              style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '2px' }}
                            >
                              <svg
                                className="w-2.5 h-2.5"
                                style={{ color: '#ef4444' }}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                            <span className="text-[13px] text-white/75 font-medium">{f}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <span
                          className="text-[10px] uppercase font-bold"
                          style={{
                            color: isSelected ? 'rgba(239,68,68,0.95)' : 'rgba(255,255,255,0.35)',
                            letterSpacing: '0.3em',
                          }}
                        >
                          {isSelected ? 'Selected' : 'Tap to Select'}
                        </span>
                        <div
                          className="w-5 h-5 flex items-center justify-center"
                          style={{
                            border: isSelected ? '2px solid #ef4444' : '2px solid rgba(255,255,255,0.2)',
                            borderRadius: '2px',
                            background: isSelected ? '#ef4444' : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <div
                className="mb-4 px-4 py-3 text-red-300 text-sm"
                style={{
                  background: 'rgba(127,29,29,0.30)',
                  border: '1px solid rgba(153,27,27,0.6)',
                  borderRadius: '2px',
                }}
              >
                {error}
              </div>
            )}

            {!IS_NATIVE_PLATFORM && (
              <>
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full text-white font-bold uppercase py-4 transition-all active:scale-[0.98] disabled:opacity-50 mb-4"
                  style={{
                    background: '#ef4444',
                    borderRadius: '2px',
                    letterSpacing: '0.25em',
                    fontSize: '13px',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  {loading
                    ? 'Redirecting...'
                    : `Subscribe to ${selectedPlan} • $${price}${billing === 'yearly' ? '/yr' : '/mo'}`}
                </button>

                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="text-[10px] uppercase text-white/35 font-semibold" style={{ letterSpacing: '0.2em' }}>
                    Secure Stripe Checkout • Cancel Anytime
                  </span>
                </div>
              </>
            )}

            {/* Native (iOS + Android) informational notice — NO button, NO link, NO tap target.
                Apple 3.1.3(a) forbids steering CTAs to external purchase inside the app.
                This is plain static text stating availability only. */}
            {IS_NATIVE_PLATFORM && (
              <div
                className="mt-2 px-5 py-4 text-center"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '2px',
                }}
              >
                <p className="text-[10px] uppercase font-light mb-2" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.35em' }}>
                  Membership
                </p>
                <p className="text-sm text-white/70 leading-relaxed">
                  REPLAB Pro is currently only available on the web.
                </p>
                <p className="text-[11px] text-white/40 leading-relaxed mt-2">
                  You can keep using the free version of REPLAB on this device.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
