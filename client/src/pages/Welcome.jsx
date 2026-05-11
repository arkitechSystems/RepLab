import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { BibleVerseOverlay } from './BibleVerses';
import { pickNextVerse } from '../utils/versePicker';

const TOUR_STEPS = [
  {
    icon: (
      <svg className="w-16 h-16 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
    title: 'Browse Workouts',
    description: 'Explore pre-built programs like Push Pull Legs, Bro Split, and more — or create your own custom workouts from scratch.',
  },
  {
    icon: (
      <svg className="w-16 h-16 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: 'Schedule Your Week',
    description: 'Assign workouts to each day of the week on the Calendar tab. Tap a day to set your routine and stay consistent.',
  },
  {
    icon: (
      <svg className="w-16 h-16 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" />
      </svg>
    ),
    title: 'Track & Beat PRs',
    description: 'Log your sets, reps, and weight during each session. The app automatically tracks your personal bests so you can see your progress. Check the Utilities tab to view your PRs for each exercise!',
  },
  {
    icon: (
      <svg className="w-16 h-16 text-wf-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L12 4.37m-5.68 5.7h11.8M4.26 19.72a9.96 9.96 0 005.49 2.06c5.52 0 10-4.48 10-10 0-1.19-.21-2.34-.59-3.41" />
      </svg>
    ),
    title: 'Utilities & Tools',
    description: 'Use built-in tools like the 1 Rep Max Estimator to calculate your strength. More tools coming soon!',
  },
];

// Phase marker — TOUR_STEPS.length means "show the 1RM collection screen
// after the tour finishes, before dropping the user on the main page."
const MAXES_STEP = TOUR_STEPS.length;

export default function Welcome() {
  const [step, setStep] = useState(-1); // -1 = intro screen
  const [maxBench, setMaxBench] = useState('');
  const [maxSquat, setMaxSquat] = useState('');
  const [maxDeadlift, setMaxDeadlift] = useState('');
  const [savingMaxes, setSavingMaxes] = useState(false);
  // Verse shown as the final beat of onboarding regardless of which exit
  // path the user took (skip from any step, or "Save & continue" from
  // the maxes screen). Lazily picked the first time we need it so the
  // user's verse rotation only burns one entry per onboarding completion.
  const [exitVerse, setExitVerse] = useState(null);
  const navigate = useNavigate();

  // Single funnel for "we're done with onboarding" — every exit goes through
  // here. Respects the wf-bible-verses preference (default on for new users
  // since the key is unset).
  function exitToApp() {
    const versesEnabled = (() => {
      try { return localStorage.getItem('wf-bible-verses') !== 'off'; }
      catch { return true; }
    })();
    if (!versesEnabled) {
      navigate('/app');
      return;
    }
    try {
      const { verse } = pickNextVerse();
      setExitVerse(verse);
    } catch {
      navigate('/app');
    }
  }

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else if (step === TOUR_STEPS.length - 1) {
      setStep(MAXES_STEP);
    } else {
      exitToApp();
    }
  }

  function handleSkip() {
    exitToApp();
  }

  async function handleSaveMaxes() {
    const payload = {};
    const bench = Number(maxBench);
    const squat = Number(maxSquat);
    const deadlift = Number(maxDeadlift);
    if (bench > 0) payload.maxBench = bench;
    if (squat > 0) payload.maxSquat = squat;
    if (deadlift > 0) payload.maxDeadlift = deadlift;
    if (Object.keys(payload).length === 0) {
      exitToApp();
      return;
    }
    setSavingMaxes(true);
    try {
      await api('/metrics', { method: 'PUT', body: JSON.stringify(payload) });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Failed to save maxes during onboarding:', err);
    } finally {
      setSavingMaxes(false);
      exitToApp();
    }
  }

  // Verse takeover — the very last screen before the user sees the app.
  // Closing it (X or any keypress on the overlay's close button) drops the
  // user on the home route.
  if (exitVerse) {
    return (
      <BibleVerseOverlay
        verse={exitVerse}
        onClose={() => navigate('/app')}
      />
    );
  }

  // Shared Nike panel wrapper — black gradient + red accent stripe +
  // ambient spotlight. Caller supplies eyebrow / title / body / CTA.
  const renderPanel = ({ eyebrow, title, body, footer, showSkip = false }) => (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-8 safe-top safe-bottom relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10">
        {showSkip && (
          <div className="flex justify-end mb-3">
            <button
              onClick={handleSkip}
              className="text-[10px] uppercase font-bold text-white/40 active:text-white/80 transition-colors"
              style={{ letterSpacing: '0.2em' }}
            >
              Skip
            </button>
          </div>
        )}
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
            <div className="mb-5">
              <h1 className="text-[20px] font-black tracking-wide text-white logo-glow mb-3">
                REP<span className="text-wf-red">LAB</span>
              </h1>
              <p className="text-[10px] uppercase font-light mb-1" style={{ color: 'rgba(239,68,68,0.85)', letterSpacing: '0.4em' }}>
                {eyebrow}
              </p>
              <h2 className="text-[28px] font-black text-white tracking-tight" style={{ fontFamily: 'system-ui', lineHeight: '0.95', letterSpacing: '-0.02em' }}>
                {title}
              </h2>
            </div>
            {body}
            {footer}
          </div>
        </div>
      </div>
    </div>
  );

  // Red gradient CTA matching the Sign In / Sign Up button. `loading` flips
  // it to btn-liquid + spinner; `solid` keeps it static (used for non-async
  // step buttons like "Take a Tour" / "Next").
  const renderCta = ({ label, onClick, loading = false, type = 'button' }) => (
    <button
      type={type}
      onClick={onClick}
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
      ) : label}
    </button>
  );

  // Intro screen
  if (step === -1) {
    return renderPanel({
      eyebrow: 'Welcome',
      title: 'GET TO KNOW THE APP',
      body: (
        <p className="text-wf-gray-400 text-sm leading-relaxed mb-6">
          Quick four-step tour of how RepLab works — programs, scheduling,
          tracking PRs, and the built-in tools. Skip anytime.
        </p>
      ),
      footer: (
        <div className="space-y-3">
          {renderCta({ label: 'Take a Tour', onClick: () => setStep(0) })}
          <button
            onClick={handleSkip}
            className="w-full text-[11px] uppercase font-bold text-white/40 active:text-white/80 py-2 transition-colors"
            style={{ letterSpacing: '0.2em' }}
          >
            Skip
          </button>
        </div>
      ),
    });
  }

  // 1RM collection screen — final step of onboarding, right before the
  // user lands on the main Workouts page. Optional: skip drops them on /
  // without saving anything.
  if (step === MAXES_STEP) {
    const maxInput = (label, value, setValue) => (
      <label className="w-full flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase font-bold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em' }}>{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="2000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="—"
            className="w-24 glass-input rounded-[2px] px-3 py-2 text-white text-sm text-right font-medium focus:outline-none placeholder:text-wf-gray-600"
          />
          <span className="text-wf-gray-500 text-[10px] uppercase font-bold w-6" style={{ letterSpacing: '0.15em' }}>lbs</span>
        </div>
      </label>
    );
    return renderPanel({
      eyebrow: 'Final Step',
      title: 'YOUR 1RMs',
      showSkip: true,
      body: (
        <>
          <p className="text-wf-gray-400 text-sm leading-relaxed mb-2">
            Optional — fill in as many as you know.
          </p>
          <p className="text-wf-gray-500 text-xs leading-relaxed mb-5">
            Some programs prescribe a percentage of your 1RM (e.g. "75% 1RM").
            If we know your bench, squat, or deadlift max, we'll auto-fill the
            suggested weight for those sets so you don't have to do the math.
          </p>
          <div className="w-full flex flex-col gap-3 pt-3 border-t border-white/5">
            {maxInput('Bench Press', maxBench, setMaxBench)}
            {maxInput('Squat', maxSquat, setMaxSquat)}
            {maxInput('Deadlift', maxDeadlift, setMaxDeadlift)}
          </div>
        </>
      ),
      footer: (
        <div className="space-y-3 mt-6">
          {renderCta({ label: 'Save & Continue', onClick: handleSaveMaxes, loading: savingMaxes })}
          <button
            onClick={handleSkip}
            className="w-full text-[11px] uppercase font-bold text-white/40 active:text-white/80 py-2 transition-colors"
            style={{ letterSpacing: '0.2em' }}
          >
            I'll add these later
          </button>
        </div>
      ),
    });
  }

  // Tour steps
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return renderPanel({
    eyebrow: `Step ${step + 1} of ${TOUR_STEPS.length}`,
    title: current.title.toUpperCase(),
    showSkip: true,
    body: (
      <div className="flex flex-col items-center text-center gap-5 mb-2">
        <div className="w-24 h-24 rounded-[2px] flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
          {current.icon}
        </div>
        <p className="text-wf-gray-400 text-sm leading-relaxed">{current.description}</p>
      </div>
    ),
    footer: (
      <div className="flex flex-col items-center gap-5 mt-6">
        {/* Progress dots */}
        <div className="flex gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? 'bg-wf-red w-6' : 'bg-white/20 w-1'
              }`}
            />
          ))}
        </div>
        {renderCta({ label: isLast ? "Let's Go" : 'Next', onClick: handleNext })}
      </div>
    ),
  });
}
