import { useState, useEffect } from 'react';

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
