const barbellBenchPress = {
  slug: 'barbell-bench-press',
  name: 'Barbell Bench Press',
  category: 'Chest',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Barbell',

  description:
    'The barbell bench press is the foundational pressing movement for upper-body strength. Lying flat on a bench, you lower the bar to the mid-chest and press it back to lockout, driving force through the chest, front shoulders, and triceps. It is the standard benchmark for horizontal pushing strength.',

  primaryMuscles: ['Chest (Pectoralis Major)'],
  secondaryMuscles: ['Anterior Deltoids', 'Triceps'],

  musclesWorked: [
    { name: 'Chest',           role: 'primary',   percentage: 60, color: '#ef4444' },
    { name: 'Front Deltoids',  role: 'secondary', percentage: 22, color: '#f59e0b' },
    { name: 'Triceps',         role: 'tertiary',  percentage: 18, color: '#6b7280' },
  ],

  instructions: [
    'Lie flat on the bench with eyes directly under the bar.',
    'Grip the bar slightly wider than shoulder-width with a full grip (thumb wrapped).',
    'Retract shoulder blades and plant feet firmly on the floor.',
    'Unrack the bar and hold it directly over the shoulders with arms locked.',
    'Lower the bar with control to the mid-chest, just below the nipple line.',
    'Press the bar up and slightly back to lockout, finishing over the shoulders.',
    'Keep the wrists stacked over the elbows throughout.',
  ],

  formTips: [
    'Keep shoulder blades pinched together and tucked down throughout the set.',
    'Drive the heels into the floor to stabilize the body — this is leg drive.',
    'Lower the bar in a slight arc; press in a slight arc back over the shoulders.',
    'Keep wrists straight — bent wrists shift load and risk injury.',
    'Touch the chest with control; do not bounce the bar.',
  ],

  commonMistakes: [
    { mistake: 'Flaring elbows to 90°', fix: 'Tuck elbows to roughly 45–75° from the torso to spare the shoulders.' },
    { mistake: 'Lifting the hips off the bench', fix: 'Keep glutes planted. A slight lower-back arch is fine; an unsupported hip lift is not.' },
    { mistake: 'Bouncing the bar off the chest', fix: 'Pause for a half-second at the chest to control the bottom; then press up.' },
    { mistake: 'Pressing without leg drive', fix: 'Plant the feet and push the floor away as you press — it stiffens the whole body.' },
  ],

  videoId: null,
};

export default barbellBenchPress;
