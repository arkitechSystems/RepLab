import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const PAYMENTS_ENABLED = false; // Set to true when ready to accept payments

export default function Upgrade() {
  const navigate = useNavigate();

  if (!PAYMENTS_ENABLED) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
        <div className="ambient-bg" />
        <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-wf-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">Paid Plans Coming Soon</h1>
          <p className="text-wf-gray-400 text-sm leading-relaxed">
            We're working on Pro and Elite plans with premium features. Stay tuned!
          </p>
          <button
            onClick={() => navigate(-1)}
            className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const [selectedPlan, setSelectedPlan] = useState('Pro');
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'yearly'
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { user, updateUser } = useAuth();

  const currentPlan = PLANS.find((p) => p.name === selectedPlan);
  const price = billing === 'yearly' ? currentPlan.yearly : currentPlan.monthly;
  const yearlySavings = Math.round((currentPlan.monthly * 12 - currentPlan.yearly) * 100) / 100;

  // Format card number with spaces
  function handleCardNumber(value) {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  }

  // Format expiry as MM/YY
  function handleExpiry(value) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      setExpiry(digits.slice(0, 2) + '/' + digits.slice(2));
    } else {
      setExpiry(digits);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 15) {
      setError('Please enter a valid card number');
      return;
    }
    if (expiry.length < 5) {
      setError('Please enter a valid expiration date');
      return;
    }
    if (cvc.length < 3) {
      setError('Please enter a valid CVC');
      return;
    }

    setLoading(true);
    try {
      const data = await api('/auth/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlan, billing }),
      });
      updateUser(data.user);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
        <div className="ambient-bg" />
        <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">Welcome to {selectedPlan}!</h1>
          <p className="text-wf-gray-400 text-sm">
            Your {selectedPlan} plan is now active. Enjoy all the premium features.
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

  const isAlreadyOnPlan = user?.plan === 'Pro' || user?.plan === 'Elite';

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

        {/* Current plan notice */}
        {isAlreadyOnPlan && (
          <div className="glass-card rounded-xl p-4 mb-4 border-l-4 border-green-500">
            <p className="text-sm text-wf-gray-400">
              You're currently on the <span className="text-white font-semibold">{user.plan}</span> plan
              {user.trialEnd && new Date(user.trialEnd) > new Date() && (
                <span> (trial ends {new Date(user.trialEnd).toLocaleDateString()})</span>
              )}
            </p>
          </div>
        )}

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

        {/* Payment Form */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          <h3 className="text-base font-bold text-white mb-4">Payment Details</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Name on Card</label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="John Doe"
                className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder-wf-gray-600 focus:outline-none focus:ring-1 focus:ring-wf-blue/50"
                required
              />
            </div>
            <div>
              <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Card Number</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => handleCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder-wf-gray-600 focus:outline-none focus:ring-1 focus:ring-wf-blue/50 font-mono"
                required
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">Expiry</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={expiry}
                  onChange={(e) => handleExpiry(e.target.value)}
                  placeholder="MM/YY"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder-wf-gray-600 focus:outline-none focus:ring-1 focus:ring-wf-blue/50 font-mono"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-wf-gray-400 uppercase tracking-wider mb-1 block">CVC</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  className="w-full glass-input rounded-xl px-4 py-3 text-white text-sm placeholder-wf-gray-600 focus:outline-none focus:ring-1 focus:ring-wf-blue/50 font-mono"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold py-3.5 rounded-xl text-base transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Processing...' : `Subscribe to ${selectedPlan} — $${price}${billing === 'yearly' ? '/yr' : '/mo'}`}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <svg className="w-4 h-4 text-wf-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="text-xs text-wf-gray-500">Secure payment. Cancel anytime.</span>
        </div>
      </div>
    </div>
  );
}
