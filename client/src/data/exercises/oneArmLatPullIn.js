const oneArmLatPullIn = {
  slug: '1-arm-lat-pull-in',
  name: '1-Arm Lat Pull-In',
  category: 'Back',
  type: 'Isolation',
  difficulty: 'Intermediate',
  equipment: 'Cable Machine',

  description:
    'The 1-arm lat pull-in is a unilateral cable movement that pulls the handle diagonally across the body toward the opposite hip rather than straight down. That cross-body angle puts the lat through a longer stretch at the top and a harder contraction at the bottom than a standard pulldown, making it a strong finisher for isolating the lats and ironing out side-to-side imbalances.',

  primaryMuscles: ['Lats'],
  secondaryMuscles: ['Rear Delts', 'Biceps', 'Traps (lower)'],

  musclesWorked: [
    { name: 'Lats',       role: 'primary',   percentage: 65, color: '#ef4444' },
    { name: 'Rear Delts', role: 'secondary', percentage: 20, color: '#f59e0b' },
    { name: 'Biceps',     role: 'tertiary',  percentage: 15, color: '#6b7280' },
  ],

  instructions: [
    'Attach a single handle to a high pulley on a cable machine.',
    'Stand side-on to the machine, feet shoulder-width, knees soft, core braced.',
    'Grip the handle with the arm nearest the machine, arm extended overhead.',
    'Initiate the pull by driving the elbow down and across the body toward the opposite hip.',
    'Keep the wrist neutral and let the lat, not the arm, do the pulling.',
    'Squeeze the lat hard as the hand finishes near the hip.',
    'Control the return to a full overhead stretch before starting the next rep.',
    'Complete all reps on one side before switching arms.',
  ],

  formTips: [
    'Pull with the elbow, not the hand — think "elbow to hip."',
    'Keep the path diagonal across the body, not straight down — that cross-body angle is what separates this from a normal pulldown.',
    'Avoid leaning back or using body English to move the weight; isolate the lat.',
    'Pause and squeeze for a full second at the bottom of each rep.',
    'Control the eccentric back to a full overhead stretch — that stretch position drives a lot of the growth stimulus.',
  ],

  commonMistakes: [
    { mistake: 'Turning it into a straight-down pulldown', fix: 'Pull diagonally across the body toward the opposite hip, not straight down.' },
    { mistake: 'Muscling the weight down with the bicep', fix: 'Lead with the elbow and think about drawing the shoulder blade down and back.' },
    { mistake: 'Leaning back or using momentum', fix: 'Brace the core and keep the torso still through the whole rep.' },
    { mistake: 'Cutting the top stretch short', fix: 'Let the arm fully extend overhead between reps to get the full range of motion.' },
  ],

  videoId: null,
};

export default oneArmLatPullIn;
