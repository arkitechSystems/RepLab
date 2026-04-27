import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';

const PLANS = [
  {
    name: 'Pro',
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
      navigate('/');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    startTutorial(null);
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10">
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
                Limited Offer
              </p>
              <h2 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                7 DAYS FREE.<br />NO CARD.
              </h2>
              <p className="text-wf-gray-400 text-sm mt-3 leading-relaxed">
                Unlock every premium feature. Cancel anytime — we won't charge you a cent during the trial.
              </p>
            </div>

            <div className="w-full space-y-3 pt-4 border-t border-white/5">
              {PLANS.map((plan) => {
                const isSelected = selectedPlan === plan.name;
                return (
                  <button
                    key={plan.name}
                    onClick={() => setSelectedPlan(plan.name)}
                    className="w-full text-left relative overflow-hidden transition-all active:scale-[0.99]"
                    style={{
                      borderRadius: '2px',
                      background: isSelected
                        ? 'linear-gradient(160deg, rgba(239,68,68,0.10) 0%, rgba(239,68,68,0.04) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      border: isSelected
                        ? '1px solid rgba(239,68,68,0.55)'
                        : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: isSelected
                        ? '0 4px 14px rgba(239,68,68,0.18), inset 0 1px 0 rgba(255,255,255,0.04)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase font-light" style={{ color: isSelected ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.45)', letterSpacing: '0.35em' }}>
                            {plan.name}
                          </span>
                          {plan.name === 'Elite' && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 text-white" style={{ background: 'rgba(239,68,68,0.85)', letterSpacing: '0.2em', borderRadius: '2px' }}>
                              Best
                            </span>
                          )}
                        </div>
                        <div
                          className="w-4 h-4 flex items-center justify-center"
                          style={{
                            borderRadius: '999px',
                            border: isSelected ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.25)',
                          }}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />}
                        </div>
                      </div>

                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-[22px] font-black text-white tracking-tight" style={{ letterSpacing: '-0.02em' }}>FREE</span>
                        <span className="text-[11px] uppercase font-bold text-white/40" style={{ letterSpacing: '0.2em' }}>7 days</span>
                        <span className="text-[11px] text-wf-gray-500 line-through ml-auto">{plan.price}</span>
                      </div>

                      <div className="space-y-1.5 pt-3 border-t border-white/5">
                        {plan.features.map((f) => (
                          <div key={f} className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: isSelected ? '#ef4444' : 'rgba(255,255,255,0.35)' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span className="text-[13px] text-wf-gray-400">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 px-4 py-3 text-red-300 text-sm" style={{ background: 'rgba(127,29,29,0.30)', border: '1px solid rgba(153,27,27,0.6)', borderRadius: '2px' }}>
                {error}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={handleStartTrial}
                disabled={loading}
                className={`w-full active:scale-[0.98] text-white font-bold uppercase py-3.5 text-sm transition-transform ${loading ? 'btn-liquid' : ''}`}
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
                ) : `Start Free ${selectedPlan} Trial`}
              </button>

              <p className="text-[11px] text-white/30 text-center leading-relaxed px-2">
                Trial begins immediately. No charge during the 7-day window.
              </p>

              <button
                onClick={handleSkip}
                className="w-full text-[11px] uppercase font-bold text-white/40 active:text-white/80 py-2 transition-colors"
                style={{ letterSpacing: '0.2em' }}
              >
                No Thanks, Continue Free
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
