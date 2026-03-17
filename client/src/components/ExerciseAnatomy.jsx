/**
 * ExerciseAnatomy — SVG-based exercise demonstration diagram.
 *
 * Renders a simplified vector illustration of the exercise showing:
 * - Incline bench
 * - Lifter silhouette (start + end position ghosted)
 * - Barbell with bar path arrow
 * - Highlighted muscle regions with labels
 *
 * Props:
 *   figure   — figure config from the exercise data object
 *   phase    — 'start' | 'end' | 'both' (default: 'both')
 *
 * The component is data-driven: all coordinates come from the exercise
 * data's `figure` property, making it reusable across exercises.
 * For exercises with very different poses, you can swap in a custom
 * SVG asset via the `customSvg` prop instead.
 */

import { useState } from 'react';

const ROLE_COLORS = {
  primary:   { fill: '#ef4444', opacity: 0.55, stroke: '#ef4444' },
  secondary: { fill: '#f59e0b', opacity: 0.40, stroke: '#f59e0b' },
  tertiary:  { fill: '#6b7280', opacity: 0.35, stroke: '#6b7280' },
};

export default function ExerciseAnatomy({ figure, phase = 'both', customSvg }) {
  const [activePhase, setActivePhase] = useState(phase === 'both' ? 'end' : phase);

  // Allow swapping in a licensed illustration later
  if (customSvg) {
    return (
      <div className="w-full rounded-xl overflow-hidden bg-white/[0.03] border border-white/5">
        <img src={customSvg} alt="Exercise demonstration" className="w-full" />
      </div>
    );
  }

  if (!figure) return null;

  const { muscles, barPath, benchAngle = 40 } = figure;
  const showStart = phase === 'both' || activePhase === 'start';
  const showEnd = phase === 'both' || activePhase === 'end';

  return (
    <div className="w-full">
      {/* Phase toggle */}
      {phase === 'both' && (
        <div className="flex gap-2 mb-3 justify-center">
          {['start', 'end'].map(p => (
            <button
              key={p}
              onClick={() => setActivePhase(p)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-all ${
                activePhase === p
                  ? 'bg-wf-red text-white'
                  : 'bg-white/5 text-wf-gray-400 border border-white/10'
              }`}
            >
              {p === 'start' ? 'Starting Position' : 'Pressing Position'}
            </button>
          ))}
        </div>
      )}

      {/* SVG Diagram */}
      <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/5 p-2">
        <svg viewBox="0 0 400 380" className="w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Glow filter for muscle highlights */}
            <filter id="muscle-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Subtle grid pattern */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width="400" height="380" fill="url(#grid)" />

          {/* === INCLINE BENCH === */}
          <g transform={`rotate(-${benchAngle}, 200, 310)`}>
            {/* Bench pad */}
            <rect x="155" y="270" width="90" height="12" rx="3"
              fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1.5" />
            {/* Bench frame */}
            <rect x="185" y="282" width="30" height="6" rx="2"
              fill="#1a1a2e" stroke="#2a2a4e" strokeWidth="1" />
          </g>
          {/* Bench base / legs */}
          <line x1="160" y1="340" x2="160" y2="360" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          <line x1="240" y1="310" x2="240" y2="360" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          <line x1="140" y1="360" x2="260" y2="360" stroke="#2a2a4e" strokeWidth="2.5" strokeLinecap="round" />
          {/* Rack uprights */}
          <line x1="130" y1="140" x2="130" y2="290" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          <line x1="270" y1="140" x2="270" y2="290" stroke="#2a2a4e" strokeWidth="3" strokeLinecap="round" />
          {/* Rack hooks */}
          <line x1="130" y1="145" x2="140" y2="145" stroke="#3a3a5e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="270" y1="145" x2="260" y2="145" stroke="#3a3a5e" strokeWidth="2.5" strokeLinecap="round" />

          {/* === LIFTER SILHOUETTE === */}
          {/* Head */}
          <circle cx="200" cy="195" r="16" fill="#1e1e3a" stroke="#3a3a6e" strokeWidth="1.5" />

          {/* Torso (on incline) */}
          <path d="M 185,210 Q 180,250 178,290 L 222,290 Q 220,250 215,210 Z"
            fill="#1e1e3a" stroke="#3a3a6e" strokeWidth="1.5" />

          {/* Legs */}
          <path d="M 178,290 Q 165,320 155,350" fill="none" stroke="#3a3a6e" strokeWidth="8" strokeLinecap="round" />
          <path d="M 222,290 Q 230,320 235,350" fill="none" stroke="#3a3a6e" strokeWidth="8" strokeLinecap="round" />
          {/* Feet */}
          <line x1="150" y1="350" x2="162" y2="355" stroke="#3a3a6e" strokeWidth="5" strokeLinecap="round" />
          <line x1="232" y1="350" x2="242" y2="355" stroke="#3a3a6e" strokeWidth="5" strokeLinecap="round" />

          {/* === MUSCLE HIGHLIGHTS === */}
          {muscles.map(m => {
            const colors = ROLE_COLORS[m.role] || ROLE_COLORS.tertiary;
            return (
              <g key={m.id} filter="url(#muscle-glow)">
                <polygon
                  points={m.points}
                  fill={colors.fill}
                  fillOpacity={colors.opacity}
                  stroke={colors.stroke}
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />
              </g>
            );
          })}

          {/* === ARMS + BARBELL === */}
          {(() => {
            const bar = activePhase === 'start' ? barPath.start : barPath.end;
            const barMid = (bar.y1 + bar.y2) / 2;
            // Upper arms from shoulders to elbow area
            const elbowLY = activePhase === 'start' ? 220 : 185;
            const elbowRY = elbowLY;
            const elbowLX = activePhase === 'start' ? 148 : 152;
            const elbowRX = activePhase === 'start' ? 252 : 248;
            return (
              <g className="transition-all duration-500">
                {/* Upper arms */}
                <line x1="172" y1="195" x2={elbowLX} y2={elbowLY}
                  stroke="#3a3a6e" strokeWidth="7" strokeLinecap="round" />
                <line x1="228" y1="195" x2={elbowRX} y2={elbowRY}
                  stroke="#3a3a6e" strokeWidth="7" strokeLinecap="round" />
                {/* Forearms */}
                <line x1={elbowLX} y1={elbowLY} x2={bar.x1 + 15} y2={barMid}
                  stroke="#3a3a6e" strokeWidth="6" strokeLinecap="round" />
                <line x1={elbowRX} y1={elbowRY} x2={bar.x2 - 15} y2={barMid}
                  stroke="#3a3a6e" strokeWidth="6" strokeLinecap="round" />
                {/* Barbell */}
                <line x1={bar.x1} y1={barMid} x2={bar.x2} y2={barMid}
                  stroke="#8888aa" strokeWidth="3" strokeLinecap="round" />
                {/* Weight plates */}
                <rect x={bar.x1 - 4} y={barMid - 10} width="8" height="20" rx="2"
                  fill="#4a4a6e" stroke="#6a6a8e" strokeWidth="1" />
                <rect x={bar.x2 - 4} y={barMid - 10} width="8" height="20" rx="2"
                  fill="#4a4a6e" stroke="#6a6a8e" strokeWidth="1" />
              </g>
            );
          })()}

          {/* === BAR PATH ARROW === */}
          <g opacity="0.4">
            <line
              x1="295" y1={barPath.start.y1}
              x2="295" y2={barPath.end.y1}
              stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3"
              markerEnd="url(#arrowhead)"
            />
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <polygon points="0,0 6,3 0,6" fill="#ef4444" />
              </marker>
            </defs>
            <text x="300" y={(barPath.start.y1 + barPath.end.y1) / 2 + 3}
              fill="#ef4444" fontSize="8" fontWeight="600" opacity="0.7">
              BAR PATH
            </text>
          </g>

          {/* === MUSCLE LABELS === */}
          {muscles.filter(m => m.labelPos && m.anchorPos).map(m => {
            const colors = ROLE_COLORS[m.role] || ROLE_COLORS.tertiary;
            return (
              <g key={`label-${m.id}`}>
                {/* Connector line */}
                <line
                  x1={m.labelPos.x + 30} y1={m.labelPos.y}
                  x2={m.anchorPos.x} y2={m.anchorPos.y}
                  stroke={colors.stroke} strokeWidth="0.8" strokeOpacity="0.5"
                  strokeDasharray="2,2"
                />
                {/* Label background */}
                <rect
                  x={m.labelPos.x - 4} y={m.labelPos.y - 10}
                  width={m.label.length * 7 + 8} height="16" rx="4"
                  fill="rgba(0,0,0,0.6)" stroke={colors.stroke} strokeWidth="0.5" strokeOpacity="0.4"
                />
                {/* Label text */}
                <text
                  x={m.labelPos.x} y={m.labelPos.y + 2}
                  fill={colors.stroke} fontSize="9" fontWeight="600"
                  fontFamily="Space Grotesk, sans-serif"
                >
                  {m.label}
                </text>
              </g>
            );
          })}

          {/* Phase label */}
          <text x="200" y="25" textAnchor="middle"
            fill="rgba(255,255,255,0.3)" fontSize="10" fontWeight="700"
            fontFamily="Space Grotesk, sans-serif" letterSpacing="2"
          >
            {activePhase === 'start' ? 'STARTING POSITION' : 'PRESSING POSITION'}
          </text>
        </svg>
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
