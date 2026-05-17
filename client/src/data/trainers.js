// Trainer data config — add a new trainer by adding an object to this array.
// The TrainerProfile component renders everything from this data.

const TRAINERS = [
  {
    id: 'zumba-jason',
    name: 'Zumba Jason',
    // photo removed — the bundled /zumba-jason.jpg was dropped in the
    // pre-launch asset purge. Renderers fall back to `initials` when
    // photo is missing (see TrainerProfile.jsx + Workouts.jsx card).
    initials: 'ZJ',
    title: 'Certified HIIT & Dance Fitness Instructor',
    credentials: 'ACE Certified Personal Trainer \u00b7 NASM HIIT Specialist',
    bio: "Jason brings the energy. With over 8 years of experience in high-intensity interval training and dance-based fitness, he's helped hundreds of people crush their goals while actually having fun. His workouts are fast, fierce, and designed to torch calories in minimal time.",
    accentColor: 'purple',
    tags: ['HIIT', 'Dance Fitness', 'Cardio', 'Fat Burn', 'Bodyweight'],
    socials: {
      instagram: '#',
      youtube: '#',
      x: '#',
    },
    stats: {
      years: '8+',
      clients: '500+',
      rating: 4.9,
      communityWorkouts: 3842,
    },
    workouts: [
      {
        id: 'zj-hiit',
        name: 'HIIT Blast',
        description: 'High-intensity interval training by Zumba Jason',
        difficulty: 'Intermediate',
        duration: '30 min',
        calories: '~350 cal',
        colorFrom: 'orange-500',
        colorTo: 'red-500',
        dotColor: 'bg-orange-500',
        badgeColor: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
        exercises: [
          { name: 'Jump Squats', sets: [{ plannedReps: 15 }, { plannedReps: 15 }, { plannedReps: 15 }], repRange: '15' },
          { name: 'Burpees', sets: [{ plannedReps: 12 }, { plannedReps: 12 }, { plannedReps: 12 }], repRange: '12' },
          { name: 'Mountain Climbers', sets: [{ plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }], repRange: '20' },
          { name: 'Box Jumps', sets: [{ plannedReps: 10 }, { plannedReps: 10 }, { plannedReps: 10 }], repRange: '10' },
          { name: 'Kettlebell Swings', sets: [{ plannedReps: 15 }, { plannedReps: 15 }, { plannedReps: 15 }], repRange: '15' },
          { name: 'Battle Ropes', sets: [{ plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }], repRange: '20' },
          { name: 'Plank Jacks', sets: [{ plannedReps: 15 }, { plannedReps: 15 }, { plannedReps: 15 }], repRange: '15' },
          { name: 'High Knees', sets: [{ plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }], repRange: '20' },
        ],
      },
      {
        id: 'zj-dance-burn',
        name: 'Dance Burn',
        description: 'Dance-inspired cardio workout by Zumba Jason',
        difficulty: 'Beginner',
        duration: '25 min',
        calories: '~280 cal',
        colorFrom: 'pink-500',
        colorTo: 'purple-500',
        dotColor: 'bg-pink-500',
        badgeColor: { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400' },
        exercises: [
          { name: 'Lateral Shuffles', sets: [{ plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }], repRange: '20' },
          { name: 'Squat Pulses', sets: [{ plannedReps: 15 }, { plannedReps: 15 }, { plannedReps: 15 }], repRange: '15' },
          { name: 'Jumping Jacks', sets: [{ plannedReps: 25 }, { plannedReps: 25 }, { plannedReps: 25 }], repRange: '25' },
          { name: 'Hip Circles', sets: [{ plannedReps: 12 }, { plannedReps: 12 }, { plannedReps: 12 }], repRange: '12' },
          { name: 'Step Touch Combos', sets: [{ plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }], repRange: '20' },
          { name: 'Grapevine Slides', sets: [{ plannedReps: 16 }, { plannedReps: 16 }, { plannedReps: 16 }], repRange: '16' },
        ],
      },
      {
        id: 'zj-core-destroyer',
        name: 'Core Destroyer',
        description: 'Intense core-focused circuit by Zumba Jason',
        difficulty: 'Advanced',
        duration: '20 min',
        calories: '~220 cal',
        colorFrom: 'red-600',
        colorTo: 'orange-600',
        dotColor: 'bg-red-600',
        badgeColor: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400' },
        exercises: [
          { name: 'Hanging Leg Raises', sets: [{ plannedReps: 12 }, { plannedReps: 12 }, { plannedReps: 12 }, { plannedReps: 12 }], repRange: '12' },
          { name: 'Ab Rollouts', sets: [{ plannedReps: 10 }, { plannedReps: 10 }, { plannedReps: 10 }], repRange: '10' },
          { name: 'Russian Twists', sets: [{ plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }], repRange: '20' },
          { name: 'Dragon Flags', sets: [{ plannedReps: 6 }, { plannedReps: 6 }, { plannedReps: 6 }], repRange: '6' },
          { name: 'Dead Bugs', sets: [{ plannedReps: 15 }, { plannedReps: 15 }, { plannedReps: 15 }], repRange: '15' },
          { name: 'Hollow Body Hold', sets: [{ plannedReps: 30 }, { plannedReps: 30 }, { plannedReps: 30 }], repRange: '30s' },
          { name: 'Bicycle Crunches', sets: [{ plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }, { plannedReps: 20 }], repRange: '20' },
        ],
      },
    ],
  },
];

export function getTrainers() {
  return TRAINERS;
}

export function getTrainerById(id) {
  return TRAINERS.find((t) => t.id === id) || null;
}
