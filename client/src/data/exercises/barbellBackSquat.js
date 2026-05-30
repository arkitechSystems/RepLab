const barbellBackSquat = {
  slug: 'barbell-back-squat',
  name: 'Barbell Back Squat',
  category: 'Quads',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Barbell',

  description:
    'The barbell back squat is the cornerstone lower-body lift. With the bar racked across the upper back, you descend by breaking at the hips and knees, then drive back up to standing. It builds quads, glutes, and posterior-chain strength simultaneously and is the standard for measuring leg strength.',

  primaryMuscles: ['Quadriceps', 'Glutes'],
  secondaryMuscles: ['Hamstrings', 'Lower Back', 'Core'],

  musclesWorked: [
    { name: 'Quadriceps', role: 'primary',   percentage: 45, color: '#ef4444' },
    { name: 'Glutes',     role: 'primary',   percentage: 30, color: '#ef4444' },
    { name: 'Hamstrings', role: 'secondary', percentage: 15, color: '#f59e0b' },
    { name: 'Core / Lower Back', role: 'tertiary', percentage: 10, color: '#6b7280' },
  ],

  instructions: [
    'Set the bar in the rack at roughly mid-chest height.',
    'Step under the bar and place it across the upper traps (high bar) or rear delts (low bar).',
    'Grip the bar firmly outside the shoulders, elbows pointing down and back.',
    'Stand up to unrack, take two controlled steps back, and set your stance shoulder-width with toes turned slightly out.',
    'Brace the core, take a big breath, and descend by simultaneously bending hips and knees.',
    'Squat until the hip crease is at or below the top of the knee, then drive up through the whole foot.',
    'Lock out at the top with knees and hips fully extended; reset breath before the next rep.',
  ],

  formTips: [
    'Drive the knees out in line with the toes — let them track, do not cave inward.',
    'Keep the chest tall and the bar over the mid-foot throughout the descent.',
    'Brace as if about to take a punch — full 360° tension around the spine.',
    'Sit between the hips, not back onto the heels alone — full-foot contact.',
    'Match breathing to bar speed: inhale at the top, hold through the descent and drive, exhale at lockout.',
  ],

  commonMistakes: [
    { mistake: 'Knees caving inward', fix: 'Cue "spread the floor" — actively push the knees out over the toes on the way up.' },
    { mistake: 'Hips shooting up first', fix: 'Lead the ascent with the chest. If hips rise first the squat becomes a good morning.' },
    { mistake: 'Heels lifting off the floor', fix: 'Improve ankle mobility, or try slightly elevated heels (lifting shoes / small plate).' },
    { mistake: 'Cutting depth short', fix: 'Hip crease must reach at or below the top of the knee. Lower the weight if needed.' },
  ],

  videoId: null,
};

export default barbellBackSquat;
