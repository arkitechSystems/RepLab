import { useState, useEffect } from 'react';

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setFading(true), 1400);
    const doneTimer = setTimeout(() => onDone(), 1900);
    return () => { clearTimeout(showTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <div className="ambient-bg" />
      <span
        className="font-black tracking-wide text-white logo-glow relative z-10"
        style={{
          fontSize: '9rem',
          animation: 'splashLogoIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        W<span className="text-wf-red">F</span>
      </span>
    </div>
  );
}
