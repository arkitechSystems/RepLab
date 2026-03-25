import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';

const PLANS = [
  {
    name: 'Pro',
    color: 'wf-blue',
    price: '$9.99/mo',
    features: [
      'Featured trainer workouts',
      'AI workout generator',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    name: 'Elite',
    color: 'purple-400',
    price: '$19.99/mo',
    features: [
      'Everything in Pro',
      'Custom program builder',
      'Video exercise guides',
      'Nutrition tracking',
      '1-on-1 trainer chat',
    ],
  },
];

export default function FreeTrialOffer() {
  const [selectedPlan, setSelectedPlan] = useState('Pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const { startTutorial } = useTutorial();

  async function handleStartTrial() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/auth/start-trial', {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlan }),
      });
      updateUser(data.user);
      startTutorial(null);
      navigate('/workouts');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    startTutorial(null);
    navigate('/workouts');
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12 relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">Try Premium Free</h1>
          <p className="text-wf-gray-400 text-sm mt-2">
            Get 7 days free — no credit card required. Cancel anytime.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="w-full space-y-3">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.name;
            const borderColor = plan.name === 'Pro' ? 'border-wf-blue' : 'border-purple-400';
            const textColor = plan.name === 'Pro' ? 'text-wf-blue' : 'text-purple-400';
            const bgColor = plan.name === 'Pro' ? 'bg-wf-blue/10' : 'bg-purple-400/10';

            return (
              <button
                key={plan.name}
                onClick={() => setSelectedPlan(plan.name)}
                className={`w-full text-left rounded-2xl p-4 border-2 transition-all ${
                  isSelected
                    ? `${borderColor} ${bgColor}`
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${isSelected ? textColor : 'text-white'}`}>
                      {plan.name}
                    </span>
                    {plan.name === 'Elite' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                        Best Value
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-wf-gray-500 line-through">{plan.price}</span>
                    <span className={`block text-sm font-bold ${isSelected ? textColor : 'text-white'}`}>
                      Free for 7 days
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <svg className={`w-4 h-4 shrink-0 ${isSelected ? textColor : 'text-wf-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-sm text-wf-gray-400">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Radio indicator */}
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

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold py-3.5 rounded-xl text-base transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Starting...' : `Start Free ${selectedPlan} Trial`}
        </button>

        <p className="text-wf-gray-500 text-xs text-center leading-relaxed">
          Your 7-day free trial begins immediately. You won't be charged during the trial period.
        </p>

        <button
          onClick={handleSkip}
          className="text-wf-gray-500 text-sm hover:text-wf-gray-300 transition-colors"
        >
          No thanks, continue with Free
        </button>
      </div>
    </div>
  );
}
