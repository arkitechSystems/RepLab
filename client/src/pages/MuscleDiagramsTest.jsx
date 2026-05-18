// Test page: visualize the "muscle group highlight diagrams" concept for
// REPLAB. Front + back stylized silhouettes with major muscle groups
// rendered as colorable SVG shapes. Used as a low-cost alternative to
// per-exercise video/photo content — only ~15 reusable muscle group shapes
// are needed to cover every exercise via a primary/secondary tag mapping.

const COLORS = {
  primary: '#ef4444',     // wf-red (muscle is the main target)
  secondary: '#fb923c',   // orange (muscle is a synergist / stabilizer)
  inactive: '#3f3f46',    // zinc-700 (muscle is not significantly worked)
  skeleton: '#52525b',    // zinc-600 (head, joints — non-muscle filler)
  outline: 'rgba(255,255,255,0.06)',
};

function fillFor(muscleKey, primary, secondary) {
  if (primary.includes(muscleKey)) return COLORS.primary;
  if (secondary.includes(muscleKey)) return COLORS.secondary;
  return COLORS.inactive;
}

function FrontSilhouette({ primary = [], secondary = [] }) {
  const f = (m) => fillFor(m, primary, secondary);
  return (
    <svg viewBox="0 0 120 220" width="120" height="220" aria-label="Front view body silhouette">
      {/* Head */}
      <circle cx="60" cy="18" r="13" fill={COLORS.skeleton} />
      {/* Neck */}
      <rect x="55" y="29" width="10" height="9" fill={COLORS.skeleton} />

      {/* Trapezius (front portion — clavicle area) */}
      <path d="M 45 38 Q 60 36 75 38 L 73 46 Q 60 44 47 46 Z" fill={f('traps')} />

      {/* Anterior Deltoids (front shoulders) */}
      <ellipse cx="36" cy="46" rx="10" ry="9" fill={f('shoulders')} />
      <ellipse cx="84" cy="46" rx="10" ry="9" fill={f('shoulders')} />

      {/* Chest / Pectorals — two halves of a heart-ish shape */}
      <path d="M 46 46 Q 58 44 60 48 L 60 68 Q 50 70 45 66 Q 42 56 46 46 Z" fill={f('chest')} />
      <path d="M 74 46 Q 62 44 60 48 L 60 68 Q 70 70 75 66 Q 78 56 74 46 Z" fill={f('chest')} />

      {/* Biceps (front of upper arm) */}
      <ellipse cx="32" cy="65" rx="7" ry="14" fill={f('biceps')} />
      <ellipse cx="88" cy="65" rx="7" ry="14" fill={f('biceps')} />

      {/* Forearms */}
      <ellipse cx="29" cy="93" rx="6" ry="13" fill={f('forearms')} />
      <ellipse cx="91" cy="93" rx="6" ry="13" fill={f('forearms')} />

      {/* Abs / Rectus Abdominis — 3 stacked blocks for a "six pack" feel */}
      <rect x="51" y="72" width="18" height="8" rx="2" fill={f('abs')} />
      <rect x="51" y="82" width="18" height="8" rx="2" fill={f('abs')} />
      <rect x="51" y="92" width="18" height="8" rx="2" fill={f('abs')} />

      {/* Obliques (side of waist) */}
      <path d="M 44 70 Q 47 88 50 100 L 50 70 Z" fill={f('obliques')} />
      <path d="M 76 70 Q 73 88 70 100 L 70 70 Z" fill={f('obliques')} />

      {/* Pelvis filler */}
      <rect x="48" y="102" width="24" height="14" rx="4" fill={COLORS.skeleton} />

      {/* Quadriceps (front of thigh) */}
      <path d="M 46 116 Q 50 140 49 162 L 60 162 L 60 116 Z" fill={f('quads')} />
      <path d="M 74 116 Q 70 140 71 162 L 60 162 L 60 116 Z" fill={f('quads')} />

      {/* Knees filler */}
      <ellipse cx="53" cy="164" rx="7" ry="3" fill={COLORS.skeleton} />
      <ellipse cx="67" cy="164" rx="7" ry="3" fill={COLORS.skeleton} />

      {/* Calves (front view — tibialis / shins; we group as calves for simplicity) */}
      <ellipse cx="53" cy="188" rx="7" ry="20" fill={f('calves')} />
      <ellipse cx="67" cy="188" rx="7" ry="20" fill={f('calves')} />
    </svg>
  );
}

function BackSilhouette({ primary = [], secondary = [] }) {
  const f = (m) => fillFor(m, primary, secondary);
  return (
    <svg viewBox="0 0 120 220" width="120" height="220" aria-label="Back view body silhouette">
      {/* Head (back) */}
      <circle cx="60" cy="18" r="13" fill={COLORS.skeleton} />
      {/* Neck */}
      <rect x="55" y="29" width="10" height="9" fill={COLORS.skeleton} />

      {/* Trapezius (the big diamond-ish upper back muscle) */}
      <path d="M 45 38 Q 60 33 75 38 L 70 55 Q 60 58 50 55 Z" fill={f('traps')} />

      {/* Rear Deltoids */}
      <ellipse cx="36" cy="48" rx="10" ry="8" fill={f('rear-delts')} />
      <ellipse cx="84" cy="48" rx="10" ry="8" fill={f('rear-delts')} />

      {/* Lats (latissimus dorsi) — wing shape from armpit flaring down */}
      <path d="M 48 56 Q 36 70 42 95 L 51 92 L 51 56 Z" fill={f('lats')} />
      <path d="M 72 56 Q 84 70 78 95 L 69 92 L 69 56 Z" fill={f('lats')} />

      {/* Rhomboids / Mid-back (between shoulder blades) */}
      <rect x="51" y="56" width="18" height="36" rx="3" fill={f('mid-back')} />

      {/* Triceps (back of upper arm) */}
      <ellipse cx="32" cy="65" rx="7" ry="14" fill={f('triceps')} />
      <ellipse cx="88" cy="65" rx="7" ry="14" fill={f('triceps')} />

      {/* Forearms */}
      <ellipse cx="29" cy="93" rx="6" ry="13" fill={f('forearms')} />
      <ellipse cx="91" cy="93" rx="6" ry="13" fill={f('forearms')} />

      {/* Lower back (erector spinae) */}
      <rect x="51" y="92" width="18" height="14" rx="3" fill={f('lower-back')} />

      {/* Glutes */}
      <ellipse cx="53" cy="115" rx="11" ry="10" fill={f('glutes')} />
      <ellipse cx="67" cy="115" rx="11" ry="10" fill={f('glutes')} />

      {/* Hamstrings (back of thigh) */}
      <path d="M 46 125 Q 50 145 49 162 L 60 162 L 60 125 Z" fill={f('hamstrings')} />
      <path d="M 74 125 Q 70 145 71 162 L 60 162 L 60 125 Z" fill={f('hamstrings')} />

      {/* Knees filler */}
      <ellipse cx="53" cy="164" rx="7" ry="3" fill={COLORS.skeleton} />
      <ellipse cx="67" cy="164" rx="7" ry="3" fill={COLORS.skeleton} />

      {/* Calves (back view — gastrocnemius bulge) */}
      <ellipse cx="53" cy="186" rx="8" ry="18" fill={f('calves')} />
      <ellipse cx="67" cy="186" rx="8" ry="18" fill={f('calves')} />
    </svg>
  );
}

// Each exercise tags which muscles are activated, per view, at what intensity.
// The same shapes are reused across every exercise — the only data is the
// primary/secondary tag list. This is the proof-of-concept for the
// "muscle group highlight" approach.
const EXERCISES = [
  {
    name: 'Dumbbell Bench Press',
    description: 'Pressing movement targeting the chest with shoulder + tricep support.',
    front: { primary: ['chest'], secondary: ['shoulders'] },
    back: { primary: [], secondary: ['triceps'] },
    primaryLabels: ['Chest (Pectoralis Major)'],
    secondaryLabels: ['Anterior Deltoids', 'Triceps'],
  },
  {
    name: 'Bulgarian Split Squats',
    description: 'Single-leg squat variation that loads the front leg quads + glutes.',
    front: { primary: ['quads'], secondary: ['abs'] },
    back: { primary: ['glutes'], secondary: ['hamstrings', 'calves'] },
    primaryLabels: ['Quadriceps', 'Glutes'],
    secondaryLabels: ['Hamstrings', 'Calves', 'Core'],
  },
  {
    name: 'Lat Pull-Downs',
    description: 'Vertical pull that drives the elbows down + back, lighting up the lats.',
    front: { primary: [], secondary: ['biceps', 'forearms'] },
    back: { primary: ['lats'], secondary: ['rear-delts', 'mid-back', 'traps'] },
    primaryLabels: ['Latissimus Dorsi'],
    secondaryLabels: ['Biceps', 'Rear Deltoids', 'Rhomboids', 'Trapezius'],
  },
];

function Legend({ color, label, items }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
      </div>
      <ul className="text-[12px] text-wf-gray-300 ml-5 space-y-0.5">
        {items.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );
}

export default function MuscleDiagramsTest() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a', color: 'white' }}>
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight mb-1">Muscle Group Highlight Diagrams</h1>
          <p className="text-sm text-wf-gray-500">
            Test concept: stylized front + back silhouettes with muscle groups colored by activation level.
            Re-uses ~15 muscle shapes across every exercise — only the activation tags differ per movement.
          </p>
        </div>

        <div className="space-y-6">
          {EXERCISES.map((ex) => (
            <div
              key={ex.name}
              className="rounded-xl p-5"
              style={{
                background: 'linear-gradient(160deg, #1e1e1e 0%, #141414 100%)',
                border: `1px solid ${COLORS.outline}`,
              }}
            >
              <h2 className="text-lg font-bold mb-1">{ex.name}</h2>
              <p className="text-xs text-wf-gray-500 mb-5">{ex.description}</p>

              <div className="flex justify-center gap-8 mb-6">
                <div className="text-center">
                  <FrontSilhouette primary={ex.front.primary} secondary={ex.front.secondary} />
                  <p className="text-[10px] text-wf-gray-500 uppercase tracking-[0.2em] mt-2">Front</p>
                </div>
                <div className="text-center">
                  <BackSilhouette primary={ex.back.primary} secondary={ex.back.secondary} />
                  <p className="text-[10px] text-wf-gray-500 uppercase tracking-[0.2em] mt-2">Back</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: COLORS.outline }}>
                <Legend color={COLORS.primary} label="Primary" items={ex.primaryLabels} />
                <Legend color={COLORS.secondary} label="Secondary" items={ex.secondaryLabels} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${COLORS.outline}` }}>
          <p className="text-[10px] text-wf-gray-500 uppercase tracking-wider mb-2">Notes</p>
          <ul className="text-xs text-wf-gray-400 space-y-1.5">
            <li>• Same SVG shapes used for every exercise — only the primary/secondary tag arrays change per movement.</li>
            <li>• Total reusable muscle groups: ~15 (chest, shoulders, biceps, triceps, forearms, abs, obliques, traps, lats, mid-back, lower-back, rear-delts, quads, hamstrings, glutes, calves).</li>
            <li>• No licensing exposure — entirely original SVG, no third-party assets.</li>
            <li>• Mapping data per exercise can live in a JSON file keyed by exercise ID and shipped client-side.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
