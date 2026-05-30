const romanianDeadlift = {
  slug: 'romanian-deadlift',
  name: 'Romanian Deadlift',
  category: 'Hamstrings',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Barbell',

  description:
    'The Romanian deadlift (RDL) is a hip hinge that targets the hamstrings and glutes through a controlled eccentric. Unlike the conventional deadlift, the RDL starts from the top with a slight knee bend and emphasizes pushing the hips back while keeping the bar close to the body. It is the gold standard for posterior-chain hypertrophy.',

  primaryMuscles: ['Hamstrings', 'Glutes'],
  secondaryMuscles: ['Lower Back', 'Lats (isometric)', 'Grip'],

  musclesWorked: [
    { name: 'Hamstrings', role: 'primary',   percentage: 45, color: '#ef4444' },
    { name: 'Glutes',     role: 'primary',   percentage: 30, color: '#ef4444' },
    { name: 'Lower Back', role: 'secondary', percentage: 15, color: '#f59e0b' },
    { name: 'Grip / Lats', role: 'tertiary', percentage: 10, color: '#6b7280' },
  ],

  instructions: [
    'Start standing with the bar held at arm length in front of the thighs, hands shoulder-width.',
    'Set the feet hip-width with a slight bend in the knees that stays constant through the lift.',
    'Brace the core, set the lats by pulling the bar against the thighs, and take a big breath.',
    'Push the hips back as you lower the bar down the legs — the bar slides down the thighs.',
    'Continue until you feel a strong stretch in the hamstrings (usually bar at mid-shin level).',
    'Drive the hips forward to return to standing — squeeze the glutes hard at the top.',
    'Reset breath and tension between reps; the bar can briefly touch the floor or float just above.',
  ],

  formTips: [
    'It is a HIP hinge, not a squat. The knees stay in roughly the same position the whole rep.',
    'Keep the bar against the legs — touching the thighs going down, touching the shins at the bottom.',
    'Stop when your hamstrings tell you to. Bottoming out is hamstring flexibility, not bar height.',
    'Engage the lats — squeeze your armpits to keep the bar close.',
    'Slow eccentric (3 seconds down), explosive concentric (drive hips through).',
  ],

  commonMistakes: [
    { mistake: 'Bar drifting forward off the legs', fix: 'Pull the bar into the thighs with the lats. Tape the bar to your skin if you have to.' },
    { mistake: 'Rounding the lower back at the bottom', fix: 'Stop when the back can no longer stay flat — that is your range.' },
    { mistake: 'Bending the knees throughout (turning it into a deadlift)', fix: 'Lock the knees at the soft bend. Movement happens at the hips.' },
    { mistake: 'Hyperextending at the top', fix: 'Finish tall — glutes locked, ribs down. Do not lean back past vertical.' },
  ],

  videoId: null,
};

export default romanianDeadlift;
