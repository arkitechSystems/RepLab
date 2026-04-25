import { MUSCLE_COLORS } from '../utils/muscleAllocation';

// Stylized front + back anatomical silhouette. Each muscle group is its own
// shape so it can be filled (with intensity proportional to its share of the
// workout) when worked, and stays as the base "rest" color otherwise.
//
// allocation: array of { muscle, share, count, color } from buildMuscleAllocation.
// Empty array → both figures render with no highlights.
//
// The shapes are deliberately simple — recognizable as a body, not a Da Vinci
// drawing. Refine paths over time without changing the data contract.
export default function BodyHeatmap({ allocation = [], className = '' }) {
  const byMuscle = {};
  for (const a of allocation) byMuscle[a.muscle] = a;

  // Highlight intensity scales with share so a 60% chest reads stronger than
  // a 20% chest. Floor at 0.55 so any worked muscle is visibly lit.
  const fillFor = (muscle) => {
    const a = byMuscle[muscle];
    if (!a) return null;
    const intensity = 0.55 + a.share * 0.45;
    return { color: a.color, opacity: intensity };
  };

  const REST = '#1f1f1f';
  const STROKE = 'rgba(255,255,255,0.08)';

  function MuscleShape({ muscle, children }) {
    const fill = fillFor(muscle);
    return (
      <g
        style={fill ? { filter: `drop-shadow(0 0 6px ${fill.color}40)` } : undefined}
      >
        {/* Children are rendered with the muscle fill or rest fill via CSS var */}
        <g
          fill={fill ? fill.color : REST}
          opacity={fill ? fill.opacity : 1}
          stroke={STROKE}
          strokeWidth={0.6}
        >
          {children}
        </g>
      </g>
    );
  }

  return (
    <div className={`flex items-start justify-center gap-4 ${className}`}>
      {/* FRONT */}
      <div className="flex flex-col items-center">
        <p className="text-[9px] uppercase font-bold text-white/40 mb-1.5" style={{ letterSpacing: '0.25em' }}>Front</p>
        <svg viewBox="0 0 200 400" className="w-32 h-auto">
          {/* Head */}
          <ellipse cx="100" cy="40" rx="22" ry="27" fill={REST} stroke={STROKE} strokeWidth={0.6} />
          {/* Neck */}
          <rect x="91" y="62" width="18" height="12" rx="3" fill={REST} stroke={STROKE} strokeWidth={0.6} />

          {/* Traps (front sliver, above clavicle) */}
          <MuscleShape muscle="Traps">
            <path d="M 78,76 Q 100,68 122,76 L 118,82 Q 100,76 82,82 Z" />
          </MuscleShape>

          {/* Shoulders / front delts — left + right */}
          <MuscleShape muscle="Shoulders">
            <path d="M 78,76 Q 60,76 54,92 Q 56,104 70,108 Q 80,104 80,92 Z" />
            <path d="M 122,76 Q 140,76 146,92 Q 144,104 130,108 Q 120,104 120,92 Z" />
          </MuscleShape>

          {/* Chest / pecs */}
          <MuscleShape muscle="Chest">
            <path d="M 80,92 L 99,90 L 99,138 Q 88,144 76,136 Q 74,118 80,92 Z" />
            <path d="M 120,92 L 101,90 L 101,138 Q 112,144 124,136 Q 126,118 120,92 Z" />
          </MuscleShape>

          {/* Biceps */}
          <MuscleShape muscle="Biceps">
            <path d="M 54,98 Q 50,108 52,140 Q 56,160 64,162 Q 70,160 70,140 L 70,108 Z" />
            <path d="M 146,98 Q 150,108 148,140 Q 144,160 136,162 Q 130,160 130,140 L 130,108 Z" />
          </MuscleShape>

          {/* Forearms */}
          <MuscleShape muscle="Forearms">
            <path d="M 52,162 Q 50,180 50,210 Q 56,222 66,220 Q 70,200 70,180 L 64,162 Z" />
            <path d="M 148,162 Q 150,180 150,210 Q 144,222 134,220 Q 130,200 130,180 L 136,162 Z" />
          </MuscleShape>

          {/* Core / abs */}
          <MuscleShape muscle="Core">
            <path d="M 80,140 L 120,140 L 122,205 Q 100,212 78,205 Z" />
          </MuscleShape>

          {/* Quads */}
          <MuscleShape muscle="Quads">
            <path d="M 78,210 Q 76,230 80,300 Q 90,310 99,300 Q 101,260 99,210 Z" />
            <path d="M 122,210 Q 124,230 120,300 Q 110,310 101,300 Q 99,260 101,210 Z" />
          </MuscleShape>

          {/* Calves (front view shows shins/calf edges) */}
          <MuscleShape muscle="Calves">
            <path d="M 82,308 Q 80,340 84,378 Q 92,384 96,378 Q 98,340 96,308 Z" />
            <path d="M 118,308 Q 120,340 116,378 Q 108,384 104,378 Q 102,340 104,308 Z" />
          </MuscleShape>
        </svg>
      </div>

      {/* BACK */}
      <div className="flex flex-col items-center">
        <p className="text-[9px] uppercase font-bold text-white/40 mb-1.5" style={{ letterSpacing: '0.25em' }}>Back</p>
        <svg viewBox="0 0 200 400" className="w-32 h-auto">
          {/* Head (back) */}
          <ellipse cx="100" cy="40" rx="22" ry="27" fill={REST} stroke={STROKE} strokeWidth={0.6} />
          {/* Neck */}
          <rect x="91" y="62" width="18" height="12" rx="3" fill={REST} stroke={STROKE} strokeWidth={0.6} />

          {/* Traps — large diamond on upper back */}
          <MuscleShape muscle="Traps">
            <path d="M 80,74 Q 100,72 120,74 L 118,108 Q 100,118 82,108 Z" />
          </MuscleShape>

          {/* Rear delts (shoulders) */}
          <MuscleShape muscle="Shoulders">
            <path d="M 80,76 Q 60,76 54,92 Q 56,104 70,108 Q 80,104 80,92 Z" />
            <path d="M 120,76 Q 140,76 146,92 Q 144,104 130,108 Q 120,104 120,92 Z" />
          </MuscleShape>

          {/* Lats / mid-back */}
          <MuscleShape muscle="Back">
            <path d="M 80,108 L 120,108 L 124,170 Q 100,180 76,170 Z" />
          </MuscleShape>

          {/* Triceps (back of arms) */}
          <MuscleShape muscle="Triceps">
            <path d="M 54,98 Q 50,108 52,140 Q 56,160 64,162 Q 70,160 70,140 L 70,108 Z" />
            <path d="M 146,98 Q 150,108 148,140 Q 144,160 136,162 Q 130,160 130,140 L 130,108 Z" />
          </MuscleShape>

          {/* Forearms (back) */}
          <MuscleShape muscle="Forearms">
            <path d="M 52,162 Q 50,180 50,210 Q 56,222 66,220 Q 70,200 70,180 L 64,162 Z" />
            <path d="M 148,162 Q 150,180 150,210 Q 144,222 134,220 Q 130,200 130,180 L 136,162 Z" />
          </MuscleShape>

          {/* Lower back (subtle, part of Back highlight) */}
          <MuscleShape muscle="Back">
            <path d="M 84,170 L 116,170 L 118,202 Q 100,206 82,202 Z" />
          </MuscleShape>

          {/* Glutes */}
          <MuscleShape muscle="Glutes">
            <path d="M 78,205 Q 76,222 82,238 Q 92,242 99,238 Q 101,222 99,205 Z" />
            <path d="M 122,205 Q 124,222 118,238 Q 108,242 101,238 Q 99,222 101,205 Z" />
          </MuscleShape>

          {/* Hamstrings */}
          <MuscleShape muscle="Hamstrings">
            <path d="M 80,240 Q 78,260 82,300 Q 90,310 99,300 Q 101,270 99,240 Z" />
            <path d="M 120,240 Q 122,260 118,300 Q 110,310 101,300 Q 99,270 101,240 Z" />
          </MuscleShape>

          {/* Calves */}
          <MuscleShape muscle="Calves">
            <path d="M 82,308 Q 80,340 84,378 Q 92,384 96,378 Q 98,340 96,308 Z" />
            <path d="M 118,308 Q 120,340 116,378 Q 108,384 104,378 Q 102,340 104,308 Z" />
          </MuscleShape>
        </svg>
      </div>
    </div>
  );
}

// Re-export for convenience.
export { MUSCLE_COLORS };
