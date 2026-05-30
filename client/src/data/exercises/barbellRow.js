const barbellRow = {
  slug: 'barbell-row',
  name: 'Barbell Row',
  category: 'Back',
  type: 'Compound',
  difficulty: 'Intermediate',
  equipment: 'Barbell',

  description:
    'The barbell row (bent-over row) is the primary horizontal pulling movement for back development. Hinging at the hips with a flat back, you pull the bar from arm-extended position into the lower ribcage. It builds thickness through the mid-back, lats, and rear delts.',

  primaryMuscles: ['Lats', 'Mid-Back (Rhomboids, Mid-Traps)'],
  secondaryMuscles: ['Rear Deltoids', 'Biceps', 'Lower Back (isometric)'],

  musclesWorked: [
    { name: 'Lats',          role: 'primary',   percentage: 35, color: '#ef4444' },
    { name: 'Mid-Back',      role: 'primary',   percentage: 30, color: '#ef4444' },
    { name: 'Rear Delts',    role: 'secondary', percentage: 15, color: '#f59e0b' },
    { name: 'Biceps',        role: 'secondary', percentage: 12, color: '#f59e0b' },
    { name: 'Lower Back',    role: 'tertiary',  percentage: 8,  color: '#6b7280' },
  ],

  instructions: [
    'Stand with the bar over mid-foot, feet hip-width apart.',
    'Hinge at the hips and bend slightly at the knees to grip the bar overhand, just outside the legs.',
    'Set the back flat with the torso roughly 45° above horizontal — chest tall, eyes a few feet in front.',
    'Brace the core and pull the bar by driving the elbows up and back toward the ceiling.',
    'Pull the bar into the lower ribcage / upper belly — squeeze the shoulder blades together hard.',
    'Lower the bar under control to the arm-extended start position.',
    'Maintain the same torso angle throughout — no standing up or yanking.',
  ],

  formTips: [
    'Keep the torso angle locked. If your torso rises with the bar, the weight is too heavy.',
    'Squeeze the shoulder blades together at the top of each rep — full contraction.',
    'Elbows track up and back, not flared 90° — keep them at roughly 45° from the torso.',
    'The bar should brush the legs on its way up — keep it close.',
    'Brace hard. The lower back works isometrically the entire set — it does not move.',
  ],

  commonMistakes: [
    { mistake: 'Using the lower back to swing the bar up', fix: 'Lock the torso angle. If you cannot pull strict, drop the weight by 20%.' },
    { mistake: 'Pulling the bar to the chest', fix: 'Aim for the lower ribcage / upper belly. Chest-high pulls strain the shoulders.' },
    { mistake: 'Rounding the lower back', fix: 'Brace the core, set the back flat before the first rep, hold it through the whole set.' },
    { mistake: 'Short range — bar never near the body', fix: 'Touch the bar to your body at the top of every rep, full extension at the bottom.' },
  ],

  videoId: null,
};

export default barbellRow;
