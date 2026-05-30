const conventionalDeadlift = {
  slug: 'conventional-deadlift',
  name: 'Conventional Deadlift',
  category: 'Back',
  type: 'Compound',
  difficulty: 'Advanced',
  equipment: 'Barbell',

  description:
    'The conventional deadlift is a full-body pull from the floor. With feet hip-width under the bar, you hinge at the hips, grip the bar just outside the legs, and stand up to lockout. It builds posterior-chain strength (hamstrings, glutes, lower back) and total-body coordination more than any other single lift.',

  primaryMuscles: ['Hamstrings', 'Glutes', 'Lower Back'],
  secondaryMuscles: ['Traps', 'Lats', 'Forearms', 'Core'],

  musclesWorked: [
    { name: 'Hamstrings',  role: 'primary',   percentage: 30, color: '#ef4444' },
    { name: 'Glutes',      role: 'primary',   percentage: 28, color: '#ef4444' },
    { name: 'Lower Back',  role: 'primary',   percentage: 20, color: '#ef4444' },
    { name: 'Traps & Lats',role: 'secondary', percentage: 12, color: '#f59e0b' },
    { name: 'Grip / Core', role: 'tertiary',  percentage: 10, color: '#6b7280' },
  ],

  instructions: [
    'Stand with mid-foot under the bar, feet roughly hip-width apart.',
    'Hinge at the hips and bend the knees to grip the bar just outside the legs.',
    'Pull the slack out of the bar — your shoulders should be over or slightly in front of the bar.',
    'Brace the core, set the lats by pulling the bar into the shins, and take a big breath.',
    'Push the floor away with the legs while keeping the back flat and bar against the body.',
    'As the bar passes the knees, drive the hips through to a tall lockout — squeeze the glutes.',
    'Lower the bar by hinging at the hips first, then bending the knees once the bar clears them.',
  ],

  formTips: [
    'The bar must travel in a vertical line. If it drifts forward, you lose mechanical advantage.',
    'Keep the lats engaged — imagine squeezing oranges in the armpits — to hold the bar close.',
    'Squeeze the bar so hard your knuckles whiten. Strong grip = stronger pull.',
    'Lock out by driving the hips forward, not by leaning back. No hyperextension at the top.',
    'Reset between reps — let the bar settle, re-brace, re-set the back. Deadlifts are singles strung together.',
  ],

  commonMistakes: [
    { mistake: 'Rounding the lower back', fix: 'Brace harder before the pull. If you cannot keep it flat, the weight is too heavy.' },
    { mistake: 'Bar drifting forward off the shins', fix: 'Engage the lats and pull the bar INTO the body throughout the pull.' },
    { mistake: 'Hyperextending at lockout', fix: 'Finish tall and squeeze glutes — do not lean back past vertical.' },
    { mistake: 'Hips rise before shoulders', fix: 'Push the floor away with the legs first. The hips and shoulders rise together.' },
  ],

  videoId: null,
};

export default conventionalDeadlift;
