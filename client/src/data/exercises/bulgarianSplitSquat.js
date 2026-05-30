const bulgarianSplitSquat = {
  slug: 'bulgarian-split-squat',
  name: 'Bulgarian Split Squat',
  category: 'Quads',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Dumbbells',

  description:
    'The Bulgarian split squat is a single-leg quad and glute builder where the rear foot is elevated on a bench or box. By unilaterally loading one leg, it builds size and strength in the quads and glutes, exposes side-to-side imbalances, and improves balance and core control. It is a foundational accessory for any leg-day program.',

  primaryMuscles: ['Quadriceps', 'Glutes'],
  secondaryMuscles: ['Hamstrings', 'Adductors', 'Core'],

  musclesWorked: [
    { name: 'Quadriceps', role: 'primary',   percentage: 45, color: '#ef4444' },
    { name: 'Glutes',     role: 'primary',   percentage: 30, color: '#ef4444' },
    { name: 'Hamstrings', role: 'secondary', percentage: 15, color: '#f59e0b' },
    { name: 'Adductors / Core', role: 'tertiary', percentage: 10, color: '#6b7280' },
  ],

  instructions: [
    'Stand roughly two feet in front of a flat bench or knee-height box.',
    'Place the top of one foot (laces down) on the bench behind you.',
    'Hold a dumbbell in each hand at the sides (or a single goblet, or barbell across the back).',
    'The front foot should be far enough forward that the knee tracks over the mid-foot at the bottom.',
    'Brace the core and descend by bending the front knee — let the back knee track down toward the floor.',
    'Stop when the back knee is just above the floor; front thigh roughly parallel.',
    'Drive through the whole front foot (heel + mid-foot) to return to standing. Complete all reps on one side, then switch.',
  ],

  formTips: [
    'Most of the weight is on the front leg. The back leg is a balance point, not a lifter.',
    'Keep the torso mostly upright — slight forward lean is fine, large lean shifts load off the quads.',
    'Front knee tracks over the mid-foot. Knee caving inward = drop the weight.',
    'Drive through the WHOLE front foot, not just the heel or toes.',
    'Pause briefly at the bottom — no bouncing the back knee off the floor.',
  ],

  commonMistakes: [
    { mistake: 'Standing too close to the bench', fix: 'Move the front foot forward until the knee tracks neutrally — not jammed past the toes.' },
    { mistake: 'Loading the back leg', fix: 'Push the back foot DOWN into the bench, not back — keep weight on the front leg.' },
    { mistake: 'Knee caving inward', fix: 'Cue "spread the floor" with the front foot. Lower the weight if needed.' },
    { mistake: 'Coming up onto the toes', fix: 'Keep the whole foot planted. If the heel lifts, you are leaning too far forward.' },
  ],

  videoId: null,
};

export default bulgarianSplitSquat;
