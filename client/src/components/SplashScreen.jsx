import { useState, useEffect } from 'react';
import { APP_VERSION } from '../version';

// Fixed particles: angle (deg), distance (px), size (px), color
const PARTICLES = [
  { angle: 0,   dist: 80,  size: 5, color: '#EF4444' },
  { angle: 45,  dist: 90,  size: 3, color: '#ffffff' },
  { angle: 90,  dist: 75,  size: 5, color: '#EF4444' },
  { angle: 135, dist: 95,  size: 3, color: '#ffffff' },
  { angle: 180, dist: 80,  size: 5, color: '#EF4444' },
  { angle: 225, dist: 85,  size: 3, color: '#ffffff' },
  { angle: 270, dist: 75,  size: 5, color: '#EF4444' },
  { angle: 315, dist: 90,  size: 3, color: '#ffffff' },
  { angle: 22,  dist: 60,  size: 2, color: '#F97316' },
  { angle: 112, dist: 65,  size: 2, color: '#F97316' },
  { angle: 202, dist: 58,  size: 2, color: '#F97316' },
  { angle: 292, dist: 63,  size: 2, color: '#F97316' },
];

export default function SplashScreen({ onDone, persistent }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (persistent) return;
    const showTimer = setTimeout(() => setFading(true), 1400);
    const doneTimer = setTimeout(() => onDone(), 1900);
    return () => { clearTimeout(showTimer); clearTimeout(doneTimer); };
  }, [onDone, persistent]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      {/* Particle burst */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {PARTICLES.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * p.dist;
          const ty = Math.sin(rad) * p.dist;
          return (
            <div
              key={i}
              className="splash-particle"
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
              }}
            />
          );
        })}
      </div>

      {/* Logo */}
      <img
        src="/RepLabLogo2.jpg"
        alt="RepLab"
        className="relative z-10 rounded-3xl"
        style={{
          width: '16rem',
          animation: 'splashLogoIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      />

      {/* Version */}
      <div className="absolute bottom-8 z-10 flex flex-col items-center">
        <span className="text-xs text-wf-gray-500 tracking-widest">VERSION {APP_VERSION}</span>
        <span className="text-[10px] text-wf-gray-600 tracking-wider mt-1">Alpha Version</span>
      </div>
    </div>
  );
}
