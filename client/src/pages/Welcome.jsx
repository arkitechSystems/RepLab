import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

export default function Welcome() {
  const [step, setStep] = useState(-1); // -1 = intro screen
  const navigate = useNavigate();

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      navigate('/free-trial');
    }
  }

  function handleSkip() {
    navigate('/free-trial');
  }

  // Intro screen
  if (step === -1) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
        <div className="ambient-bg" />
        <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-8">
          <h1 className="text-4xl font-black tracking-wide text-white logo-glow">
            WILL<span className="text-wf-red">FIT</span>
          </h1>
          <p className="text-wf-gray-400 text-center">Welcome! Get to know the app.</p>

          <button
            onClick={() => setStep(0)}
            className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all"
          >
            Take a Tour
          </button>

          <button
            onClick={handleSkip}
            className="text-wf-gray-500 text-sm hover:text-wf-gray-300 transition-colors"
          >
            skip
          </button>
        </div>
      </div>
    );
  }

  // Tour steps
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between px-6 py-12 relative">
      <div className="ambient-bg" />

      {/* Skip button */}
      <div className="w-full max-w-sm relative z-10 flex justify-end">
        <button
          onClick={handleSkip}
          className="text-wf-gray-500 text-sm hover:text-wf-gray-300 transition-colors"
        >
          skip
        </button>
      </div>

      {/* Content */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center text-center gap-6 flex-1 justify-center">
        <div className="w-28 h-28 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
          {current.icon}
        </div>
        <h2 className="text-2xl font-bold text-white">{current.title}</h2>
        <p className="text-wf-gray-400 text-base leading-relaxed">{current.description}</p>
      </div>

      {/* Bottom section: dots + button */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-6">
        {/* Progress dots */}
        <div className="flex gap-2">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-wf-red w-6' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all"
        >
          {isLast ? "Let's Go" : 'Next'}
        </button>
      </div>
    </div>
  );
}
