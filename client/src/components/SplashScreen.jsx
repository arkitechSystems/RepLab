import { useState, useEffect } from 'react';
import { APP_VERSION } from '../version';

export default function SplashScreen({ onDone, persistent }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (persistent) return;
    const showTimer = setTimeout(() => setFading(true), 1200);
    const doneTimer = setTimeout(() => onDone(), 1700);
    return () => { clearTimeout(showTimer); clearTimeout(doneTimer); };
  }, [onDone, persistent]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      {/* Logo */}
      <img
        src="/RepLabLogo2.jpg"
        alt="REPLAB"
        className="relative z-10 rounded-3xl"
        style={{ width: '20.8rem' }}
      />

      {/* Version */}
      <div className="absolute bottom-8 z-10 flex flex-col items-center">
        <span className="text-xs text-wf-gray-500 tracking-widest">VERSION {APP_VERSION}</span>
        <span className="text-[10px] text-wf-gray-600 tracking-wider mt-1">Alpha Version</span>
      </div>
    </div>
  );
}
