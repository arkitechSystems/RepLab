/**
 * ExerciseAnatomy — Animated SVG exercise demonstration.
 *
 * Smoothly animates through the full rep cycle:
 *   lockout → eccentric (lower) → bottom pause → concentric (press) → lockout pause → repeat
 *
 * Muscle highlights pulse brighter on the concentric (effort) phase.
 * Play/pause button lets the user freeze at any point.
 *
 * Props:
 *   figure    — figure config from the exercise data object
 *   customSvg — optional: swap in a licensed image/animation instead
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const ROLE_COLORS = {
  primary:   { fill: '#ef4444', stroke: '#ef4444' },
  secondary: { fill: '#f59e0b', stroke: '#f59e0b' },
  tertiary:  { fill: '#6b7280', stroke: '#6b7280' },
};

// Easing: slow at ends, fast in middle (sine ease-in-out)
function ease(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}

// Lerp between two values
function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function ExerciseAnatomy({ figure, customSvg }) {
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0 = top (lockout), 1 = bottom (chest)
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const directionRef = useRef(1); // 1 = going down, -1 = going up
  const pauseTimerRef = useRef(0);

  // Animation speed: full rep cycle ~3.5s
  // Eccentric (down): 1.5s, pause at bottom: 0.3s, concentric (up): 1.2s, pause at top: 0.5s
  const ECCENTRIC_SPEED = 0.67;   // progress per second (down)
  const CONCENTRIC_SPEED = 0.83;  // progress per second (up)
  const BOTTOM_PAUSE = 300;       // ms
  const TOP_PAUSE = 500;          // ms

  const animate = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Handle pauses at top/bottom
    if (pauseTimerRef.current > 0) {
      pauseTimerRef.current -= dt;
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const speed = directionRef.current === 1 ? ECCENTRIC_SPEED : CONCENTRIC_SPEED;
    const delta = (dt / 1000) * speed * directionRef.current;

    setProgress(prev => {
      let next = prev + delta;

      // Hit bottom
      if (next >= 1) {
        next = 1;
        directionRef.current = -1;
        pauseTimerRef.current = BOTTOM_PAUSE;
      }
      // Hit top
      if (next <= 0) {
        next = 0;
        directionRef.current = 1;
        pauseTimerRef.current = TOP_PAUSE;
      }

      return next;
    });

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, animate]);

  if (customSvg) {
    return (
      <div className="w-full rounded-xl overflow-hidden bg-white/[0.03] border border-white/5">
        <img src={customSvg} alt="Exercise demonstration" className="w-full" />
      </div>
    );
  }

  if (!figure) return null;

  const { muscles, barPath, benchAngle = 40 } = figure;
  const t = ease(progress); // eased progress: 0 = top, 1 = bottom

  // Interpolate bar position
  const barY = lerp(barPath.end.y1, barPath.start.y1, t);
  const barX1 = lerp(barPath.end.x1, barPath.start.x1, t);
  const barX2 = lerp(barPath.end.x2, barPath.start.x2, t);

  // Arm positions
  const elbowLX = lerp(152, 148, t);
  const elbowRX = lerp(248, 252, t);
  const elbowLY = lerp(185, 220, t);
  const elbowRY = elbowLY;

  // Muscle intensity: brighter on concentric (going up)
  const isConcentricPhase = directionRef.current === -1;
  const muscleIntensity = isConcentricPhase ? lerp(0.55, 0.85, 1 - progress) : lerp(0.35, 0.55, progress);

  // Phase label
  const phaseLabel = progress < 0.1 ? 'LOCKOUT' : progress > 0.9 ? 'BOTTOM' : isConcentricPhase ? 'PRESSING' : 'LOWERING';

  return (
    <div className="w-full">
      {/* SVG Diagram */}
      <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/5 p-2">
        <svg viewBox="0 0 400 380" className="w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="muscle-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation={lerp(2, 5, muscleIntensity)} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
            </pattern>
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <polygon points="0,0 6,3 0,6" fill="#ef4444" />
            </marker>
          </defs>

          {/* Background grid */}
          <rect width="400" height="380" fill="url(#grid)" />

          {/* === INCLINE BENCH === */}
          <g transform={`rotate(-${benchAngle}, 200, 310)`}>
            <rect x="155" y="270" width="90" height="12" rx="3" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1.5" />
            <rect x="185" y="282" width="30" height="6" rx="2" fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
          </g>
          {/* Bench legs */}
          <line x1="160" y1="340" x2="160" y2="360" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          <line x1="240" y1="310" x2="240" y2="360" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          <line x1="140" y1="360" x2="260" y2="360" stroke="#2a2a4e" strokeWidth="2.5" strokeLinecap="round" />
          {/* Rack */}
          <line x1="130" y1="140" x2="130" y2="290" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          <line x1="270" y1="140" x2="270" y2="290" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          <line x1="130" y1="145" x2="140" y2="145" stroke="#3a3a5e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="270" y1="145" x2="260" y2="145" stroke="#3a3a5e" strokeWidth="2.5" strokeLinecap="round" />

          {/* === LIFTER === */}
          <circle cx="200" cy="195" r="16" fill="#1e1e3a" stroke="#3a3a6e" strokeWidth="1.5" />
          <path d="M 185,210 Q 180,250 178,290 L 222,290 Q 220,250 215,210 Z" fill="#1e1e3a" stroke="#3a3a6e" strokeWidth="1.5" />
          <path d="M 178,290 Q 165,320 155,350" fill="none" stroke="#3a3a6e" strokeWidth="8" strokeLinecap="round" />
          <path d="M 222,290 Q 230,320 235,350" fill="none" stroke="#3a3a6e" strokeWidth="8" strokeLinecap="round" />
          <line x1="150" y1="350" x2="162" y2="355" stroke="#3a3a6e" strokeWidth="5" strokeLinecap="round" />
          <line x1="232" y1="350" x2="242" y2="355" stroke="#3a3a6e" strokeWidth="5" strokeLinecap="round" />

          {/* === MUSCLE HIGHLIGHTS (animated intensity) === */}
          {muscles.map(m => {
            const colors = ROLE_COLORS[m.role] || ROLE_COLORS.tertiary;
            const baseOpacity = m.role === 'primary' ? 0.55 : m.role === 'secondary' ? 0.40 : 0.35;
            const opacity = lerp(baseOpacity, baseOpacity + 0.35, isConcentricPhase ? (1 - progress) : 0);
            return (
              <g key={m.id} filter="url(#muscle-glow)">
                <polygon
                  points={m.points}
                  fill={colors.fill}
                  fillOpacity={opacity}
                  stroke={colors.stroke}
                  strokeWidth="1"
                  strokeOpacity={lerp(0.4, 0.9, opacity)}
                />
              </g>
            );
          })}

          {/* === ARMS + BARBELL (animated) === */}
          {/* Upper arms */}
          <line x1="172" y1="195" x2={elbowLX} y2={elbowLY} stroke="#3a3a6e" strokeWidth="7" strokeLinecap="round" />
          <line x1="228" y1="195" x2={elbowRX} y2={elbowRY} stroke="#3a3a6e" strokeWidth="7" strokeLinecap="round" />
          {/* Forearms */}
          <line x1={elbowLX} y1={elbowLY} x2={barX1 + 15} y2={barY} stroke="#3a3a6e" strokeWidth="6" strokeLinecap="round" />
          <line x1={elbowRX} y1={elbowRY} x2={barX2 - 15} y2={barY} stroke="#3a3a6e" strokeWidth="6" strokeLinecap="round" />
          {/* Barbell */}
          <line x1={barX1} y1={barY} x2={barX2} y2={barY} stroke="#8888aa" strokeWidth="3" strokeLinecap="round" />
          {/* Weight plates */}
          <rect x={barX1 - 4} y={barY - 10} width="8" height="20" rx="2" fill="#4a4a6e" stroke="#6a6a8e" strokeWidth="1" />
          <rect x={barX2 - 4} y={barY - 10} width="8" height="20" rx="2" fill="#4a4a6e" stroke="#6a6a8e" strokeWidth="1" />

          {/* === BAR PATH === */}
          <g opacity="0.3">
            <line x1="295" y1={barPath.start.y1} x2="295" y2={barPath.end.y1}
              stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arrowhead)" />
            <text x="300" y={(barPath.start.y1 + barPath.end.y1) / 2 + 3}
              fill="#ef4444" fontSize="8" fontWeight="600" opacity="0.7">BAR PATH</text>
          </g>

          {/* === BAR POSITION INDICATOR === */}
          <circle cx="295" cy={barY} r="3" fill="#ef4444" opacity="0.8" />

          {/* === MUSCLE LABELS === */}
          {muscles.filter(m => m.labelPos && m.anchorPos).map(m => {
            const colors = ROLE_COLORS[m.role] || ROLE_COLORS.tertiary;
            return (
              <g key={`label-${m.id}`}>
                <line x1={m.labelPos.x + 30} y1={m.labelPos.y} x2={m.anchorPos.x} y2={m.anchorPos.y}
                  stroke={colors.stroke} strokeWidth="0.8" strokeOpacity="0.5" strokeDasharray="2,2" />
                <rect x={m.labelPos.x - 4} y={m.labelPos.y - 10}
                  width={m.label.length * 7 + 8} height="16" rx="4"
                  fill="rgba(0,0,0,0.6)" stroke={colors.stroke} strokeWidth="0.5" strokeOpacity="0.4" />
                <text x={m.labelPos.x} y={m.labelPos.y + 2}
                  fill={colors.stroke} fontSize="9" fontWeight="600" fontFamily="Space Grotesk, sans-serif">
                  {m.label}
                </text>
              </g>
            );
          })}

          {/* Phase label */}
          <text x="200" y="25" textAnchor="middle"
            fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="700"
            fontFamily="Space Grotesk, sans-serif" letterSpacing="2">
            {phaseLabel}
          </text>
        </svg>

        {/* Play/Pause button */}
        <button
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-wf-gray-400 hover:text-white active:scale-90 transition-all"
        >
          {playing ? (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Rep progress bar */}
      <div className="mt-2 px-1">
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-colors duration-200"
            style={{
              width: `${(1 - progress) * 100}%`,
              backgroundColor: isConcentricPhase ? '#ef4444' : '#3a3a6e',
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        {[
          { label: 'Primary', color: '#ef4444' },
          { label: 'Secondary', color: '#f59e0b' },
          { label: 'Tertiary', color: '#6b7280' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color, opacity: 0.7 }} />
            <span className="text-[10px] text-wf-gray-500 uppercase tracking-wider">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
