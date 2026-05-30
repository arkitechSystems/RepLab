const cableTricepPushdown = {
  slug: 'cable-tricep-pushdown',
  name: 'Cable Tricep Pushdown',
  category: 'Triceps',
  type: 'Isolation',
  difficulty: 'Beginner',
  equipment: 'Cable Machine',

  description:
    'The cable tricep pushdown is a single-joint isolation that loads the triceps through a full range with constant cable tension. Standing in front of a high pulley with a straight bar or rope, you press the attachment down by extending the elbows against the cable. It is one of the most effective ways to overload the long head of the tricep.',

  primaryMuscles: ['Triceps (all three heads)'],
  secondaryMuscles: ['Forearms', 'Core (stabilization)'],

  musclesWorked: [
    { name: 'Triceps',  role: 'primary',   percentage: 80, color: '#ef4444' },
    { name: 'Forearms', role: 'secondary', percentage: 12, color: '#f59e0b' },
    { name: 'Core',     role: 'tertiary',  percentage: 8,  color: '#6b7280' },
  ],

  instructions: [
    'Attach a straight bar or rope to a high cable pulley.',
    'Stand facing the pulley, feet hip-width, with a slight forward lean (~10°).',
    'Grip the attachment with palms facing down (straight bar) or neutral (rope).',
    'Set the elbows at your sides — they should not move during the lift.',
    'Press the attachment down by extending the elbows until the arms are fully locked.',
    'Squeeze the triceps hard at the bottom for a half-second.',
    'Let the attachment rise back up under control until forearms touch biceps; do not let the cable yank your arms up.',
  ],

  formTips: [
    'The elbows are hinges, not movers. They stay pinned to the ribs the entire set.',
    'Lock out the elbows at the bottom of every rep — partial reps undertrain the triceps.',
    'Slight forward lean lets the cable line up with the triceps for better leverage.',
    'Rope attachment? Split the rope outward at the bottom for extra peak contraction.',
    'Squeeze the bar / rope hard — grip drives nervous-system output to the triceps.',
  ],

  commonMistakes: [
    { mistake: 'Elbows flaring out and back', fix: 'Pin the elbows to the ribcage. If they move, lower the weight.' },
    { mistake: 'Using the lats to push the weight down', fix: 'Isolate the movement at the elbow. Shoulders and torso stay still.' },
    { mistake: 'Half range — not letting the bar rise fully', fix: 'Let the forearms come up until they touch the biceps. Full range = full growth.' },
    { mistake: 'Going too heavy and rocking the body', fix: 'Cable isolations live on quality reps. Drop the weight, slow the eccentric.' },
  ],

  videoId: null,
};

export default cableTricepPushdown;
