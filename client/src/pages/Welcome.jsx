import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const [showComingSoon, setShowComingSoon] = useState(false);
  const navigate = useNavigate();

  function handleTour() {
    setShowComingSoon(true);
    setTimeout(() => navigate('/'), 1500);
  }

  if (showComingSoon) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <div className="ambient-bg" />
        <p className="text-2xl font-bold text-white relative z-10">Coming Soon</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative">
      <div className="ambient-bg" />
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center gap-8">
        <h1 className="text-4xl font-black tracking-wide text-white logo-glow">
          WILL<span className="text-wf-red">FIT</span>
        </h1>
        <p className="text-wf-gray-400 text-center">Welcome! Get to know the app.</p>

        <button
          onClick={handleTour}
          className="w-full btn-gradient active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl text-base transition-all"
        >
          Take a Tour
        </button>

        <button
          onClick={() => navigate('/')}
          className="text-wf-gray-500 text-sm hover:text-wf-gray-300 transition-colors"
        >
          skip
        </button>
      </div>
    </div>
  );
}
