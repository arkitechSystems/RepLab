const standingOverheadPress = {
  slug: 'standing-overhead-press',
  name: 'Standing Overhead Press',
  category: 'Shoulders',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Barbell',

  description:
    'The standing overhead press (also called the strict press) drives a barbell from the front rack to overhead lockout while standing upright. It builds vertical pressing strength through the shoulders, triceps, and upper chest, and demands core and glute bracing to keep the body rigid under load.',

  primaryMuscles: ['Anterior & Lateral Deltoids'],
  secondaryMuscles: ['Triceps', 'Upper Chest', 'Core'],

  musclesWorked: [
    { name: 'Shoulders',  role: 'primary',   percentage: 55, color: '#ef4444' },
    { name: 'Triceps',    role: 'secondary', percentage: 25, color: '#f59e0b' },
    { name: 'Upper Chest',role: 'secondary', percentage: 12, color: '#f59e0b' },
    { name: 'Core',       role: 'tertiary',  percentage: 8,  color: '#6b7280' },
  ],

  instructions: [
    'Set the bar at upper-chest height in the rack.',
    'Grip the bar slightly wider than shoulder-width with wrists stacked over the elbows.',
    'Unrack into a front-rack position: bar across the front delts, elbows just in front of the bar.',
    'Step back, set feet hip-width, squeeze glutes and brace the core.',
    'Press the bar straight up — pull the head back slightly so the bar can travel vertically past the face.',
    'Once the bar clears the head, push the head forward through the arms to a tall overhead lockout.',
    'Lower the bar back to the front rack under control; reset breath and tension before the next rep.',
  ],

  formTips: [
    'Brace 360° — abs, obliques, and lower back — before each rep.',
    'Squeeze the glutes hard. A loose midsection turns this into a leaning press.',
    'Bar path is vertical. Move the head, not the bar — pull the chin back, push it through at lockout.',
    'Wrists straight; bar sits in the heel of the palm, not the fingers.',
    'Finish each rep with biceps near the ears, head fully through the arms.',
  ],

  commonMistakes: [
    { mistake: 'Excessive backward lean', fix: 'Brace the core and glutes harder. A small lean is fine; tilting the torso backward is not.' },
    { mistake: 'Bar drifting forward', fix: 'Engage the lats and keep elbows under the bar throughout the press.' },
    { mistake: 'Incomplete lockout', fix: 'Push the head through the arms at the top — biceps next to the ears.' },
    { mistake: 'Pressing with the lower back', fix: 'Squeeze glutes to lock the pelvis. If lower back arches, drop the weight.' },
  ],

  videoId: null,
};

export default standingOverheadPress;
