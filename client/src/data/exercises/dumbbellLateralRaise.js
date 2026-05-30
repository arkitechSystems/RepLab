const dumbbellLateralRaise = {
  slug: 'dumbbell-lateral-raise',
  name: 'Dumbbell Lateral Raise',
  category: 'Shoulders',
  type: 'Isolation',
  difficulty: 'Beginner',
  equipment: 'Dumbbells',

  description:
    'The dumbbell lateral raise isolates the lateral (side) deltoid by raising the arms out to the sides against gravity. It is the most direct exercise for building shoulder width and is a staple of any shoulder-development program.',

  primaryMuscles: ['Lateral Deltoids'],
  secondaryMuscles: ['Anterior Deltoids', 'Traps (upper)'],

  musclesWorked: [
    { name: 'Lateral Delts', role: 'primary',   percentage: 70, color: '#ef4444' },
    { name: 'Front Delts',   role: 'secondary', percentage: 18, color: '#f59e0b' },
    { name: 'Traps',         role: 'tertiary',  percentage: 12, color: '#6b7280' },
  ],

  instructions: [
    'Stand tall holding a dumbbell in each hand at the sides, palms facing the body.',
    'Soft bend in the elbows — keep that bend constant for the whole set.',
    'Slightly hinge forward (5-10°) so the side delts are aligned with gravity.',
    'Lead with the elbows: raise the arms out to the sides until the upper arm is parallel to the floor.',
    'At the top, the elbows should be slightly higher than the wrists ("pour the pitcher" cue).',
    'Lower with control — the eccentric is the muscle-building half of the movement.',
    'Do not lock out at the top; pause briefly, then descend.',
  ],

  formTips: [
    'Lead with the elbow, not the hand. The dumbbell follows the elbow up.',
    'Stop at parallel (or slightly higher). Higher recruits the traps and dilutes the lateral delt.',
    'Use weights you can control. Heavy lateral raises become swing-and-momentum, not isolation.',
    'A 3-second eccentric will make a 12 lb dumbbell feel like a 25.',
    'Keep the torso still. If you are jerking the upper body to lift the weight, drop the load.',
  ],

  commonMistakes: [
    { mistake: 'Swinging the body to lift the weight', fix: 'Lighter weight, strict form. Sit against a wall for a set if you need a feedback cue.' },
    { mistake: 'Raising above parallel', fix: 'Stop when the upper arm is parallel to the floor. Higher is traps work, not lateral delt.' },
    { mistake: 'Internal rotation at the top (palms down past parallel)', fix: '"Pour the pitcher" — slight forward tilt of the pinky at the top.' },
    { mistake: 'Dropping the weight on the eccentric', fix: 'Lower for a 2-3 second count. The eccentric does most of the muscle-building.' },
  ],

  videoId: null,
};

export default dumbbellLateralRaise;
