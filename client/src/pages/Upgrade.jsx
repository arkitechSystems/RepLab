import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import StickyHeader from '../components/StickyHeader';

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

  // Refresh user plan after successful checkout
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

  // Fetch current subscription
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
      setError(err.message || 'Failed to start checkout. Please try again.');
      setLoading(false);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const data = await api('/billing/create-portal-session', { method: 'POST' });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || 'Failed to open billing portal.');
      setPortalLoading(false);
    }
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
        <div className="ambient-bg" />
        <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">Welcome to {user?.plan || 'Pro'}!</h1>
          <p className="text-wf-gray-400 text-sm">
            Your plan is now active. Enjoy all the premium features.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all"
          >
            Start Training
          </button>
        </div>
      </div>
    );
  }

  // Canceled state
  if (isCanceled) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
        <div className="ambient-bg" />
        <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">No Changes Made</h1>
          <p className="text-wf-gray-400 text-sm">
            Your checkout was canceled. No charges were made.
          </p>
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-wf-gray-500 active:text-white transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StickyHeader title="Upgrade Plan" />

      <div className="px-4 pb-8">
        {/* Back button */}
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm text-wf-gray-400 active:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
        </div>

        {/* Already subscribed — show manage option */}
        {isPremium && subscription && (
          <div className="glass-card rounded-2xl p-5 mb-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-bold text-base">{user.plan} Plan</p>
                <p className="text-sm text-wf-gray-400 mt-0.5">
                  {subscription.billing === 'year' ? 'Annual' : 'Monthly'} billing
                  {subscription.cancelAtPeriodEnd && ' — cancels at period end'}
                </p>
                {subscription.currentPeriodEnd && (
                  <p className="text-xs text-wf-gray-500 mt-1">
                    {subscription.cancelAtPeriodEnd ? 'Access until' : 'Renews'}{' '}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>
            <button
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="w-full glass-card text-white font-semibold py-3 rounded-xl text-sm active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
            </button>
          </div>
        )}

        {/* Plan selection — hide if already subscribed */}
        {!isPremium && (
          <>
            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-1 mb-5">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-4 py-2 rounded-l-xl text-sm font-semibold transition-all ${
                  billing === 'monthly'
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-wf-gray-500'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-4 py-2 rounded-r-xl text-sm font-semibold transition-all ${
                  billing === 'yearly'
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-wf-gray-500'
                }`}
              >
                Yearly
                <span className="ml-1 text-[10px] text-green-400 font-bold">Save $$$</span>
              </button>
            </div>

            {/* Plan Cards */}
            <div className="space-y-3 mb-6">
              {PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.name;
                const borderColor = plan.name === 'Pro' ? 'border-wf-blue' : 'border-purple-400';
                const textColor = plan.name === 'Pro' ? 'text-wf-blue' : 'text-purple-400';
                const bgColor = plan.name === 'Pro' ? 'bg-wf-blue/10' : 'bg-purple-400/10';
                const planPrice = billing === 'yearly' ? plan.yearly : plan.monthly;
                const perMonth = billing === 'yearly' ? (plan.yearly / 12).toFixed(2) : plan.monthly;

                return (
                  <button
                    key={plan.name}
                    onClick={() => setSelectedPlan(plan.name)}
                    className={`w-full text-left rounded-2xl p-4 border-2 transition-all ${
                      isSelected ? `${borderColor} ${bgColor}` : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${isSelected ? textColor : 'text-white'}`}>
                          {plan.name}
                        </span>
                        {plan.badge && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-black ${isSelected ? textColor : 'text-white'}`}>
                          ${perMonth}
                        </span>
                        <span className="text-xs text-wf-gray-500">/mo</span>
                        {billing === 'yearly' && (
                          <span className="block text-[10px] text-green-400">
                            ${planPrice}/yr — save ${Math.round(plan.monthly * 12 - plan.yearly)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {plan.features.map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <svg className={`w-3.5 h-3.5 shrink-0 ${isSelected ? textColor : 'text-wf-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span className="text-sm text-wf-gray-400">{f}</span>
                        </div>
                      ))}
                    </div>

                    {/* Radio */}
                    <div className="flex justify-end mt-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? borderColor : 'border-white/20'
                      }`}>
                        {isSelected && (
                          <div className={`w-2.5 h-2.5 rounded-full ${plan.name === 'Pro' ? 'bg-wf-blue' : 'bg-purple-400'}`} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Checkout Button */}
            {error && (
              <p className="text-red-400 text-sm text-center mb-3">{error}</p>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold py-3.5 rounded-xl text-base transition-all active:scale-[0.98] disabled:opacity-50 mb-4"
            >
              {loading ? 'Redirecting...' : `Subscribe to ${selectedPlan} — $${price}${billing === 'yearly' ? '/yr' : '/mo'}`}
            </button>

            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-xs text-wf-gray-500">Secure payment via Stripe. Cancel anytime.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
