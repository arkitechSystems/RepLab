const pullUp = {
  slug: 'pull-up',
  name: 'Pull-Up',
  category: 'Back',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Bodyweight',

  description:
    'The pull-up is a vertical pulling movement that builds the lats, mid-back, and biceps using only bodyweight. Hanging from a fixed bar with palms facing away, you pull yourself up until the chin clears the bar. It is the benchmark for relative upper-body pulling strength.',

  primaryMuscles: ['Lats', 'Mid-Back (Rhomboids, Mid-Traps)'],
  secondaryMuscles: ['Biceps', 'Rear Deltoids', 'Forearms / Grip'],

  musclesWorked: [
    { name: 'Lats',         role: 'primary',   percentage: 50, color: '#ef4444' },
    { name: 'Mid-Back',     role: 'primary',   percentage: 20, color: '#ef4444' },
    { name: 'Biceps',       role: 'secondary', percentage: 18, color: '#f59e0b' },
    { name: 'Grip / Forearms', role: 'tertiary', percentage: 12, color: '#6b7280' },
  ],

  instructions: [
    'Grip the bar with palms facing away (overhand), hands slightly wider than shoulder-width.',
    'Hang from a dead-hang position with arms fully extended and shoulders engaged (lats down).',
    'Brace the core and squeeze the glutes — body should be a rigid line.',
    'Pull by driving the elbows down and back toward the hips — think "elbows to back pockets".',
    'Continue until the chin clears the bar, with the chest moving toward the bar.',
    'Lower under control to a full dead-hang. No swinging or kipping.',
    'Pause briefly at the bottom; do not just drop into the next rep.',
  ],

  formTips: [
    'Initiate the pull from the back, not the arms — pull the shoulder blades down first.',
    'Keep the chest up and slight arch in the upper back through the movement.',
    'Full range of motion: dead-hang at the bottom, chin clear at the top.',
    'Cross the feet behind you and squeeze the glutes to prevent swinging.',
    'Eccentric (lowering) should take ~2 seconds — strength is built going down.',
  ],

  commonMistakes: [
    { mistake: 'Half-rep range (no dead hang or no chin clear)', fix: 'Touch dead hang at the bottom and pull until the throat clears the bar at the top.' },
    { mistake: 'Kipping / swinging body to gain momentum', fix: 'Brace the core, cross the feet, squeeze the glutes — strict pull only.' },
    { mistake: 'Pulling with biceps alone', fix: 'Initiate from the back: depress the scapulae before the arms bend.' },
    { mistake: 'Dropping out of the eccentric', fix: 'Lower with control over 2 seconds. The eccentric is half the lift.' },
  ],

  videoId: null,
};

export default pullUp;
