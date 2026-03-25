// Phase 1A: Pre-Built Program Flow
export const PHASE_1A = [
  {
    type: 'spotlight',
    target: '[data-tutorial="browse-library"]',
    title: 'Browse Workout Library',
    description: 'Tap here to browse pre-built programs designed by trainers. Choose from Push Pull Legs, Upper/Lower, Bro Split, and more.',
    position: 'top',
    waitFor: 'browse-library-tap',
    allowInteraction: true,
  },
  {
    type: 'spotlight',
    target: '[data-tutorial="program-card"]',
    title: 'Pick a Program',
    description: 'Tap a program to preview its workouts and see what each day looks like.',
    position: 'top',
    waitFor: 'program-selected',
    allowInteraction: true,
  },
  {
    type: 'spotlight',
    target: '[data-tutorial="begin-program-btn"]',
    extraTargets: ['[data-tutorial="week-card"]'],
    title: 'Two Ways to Add Workouts',
    description: 'Tap "Begin Program" to add the entire program to your calendar at once, or tap a week to view its workouts and pick a single one to add for a specific day.',
    position: 'bottom',
    waitFor: ['begin-program-tapped', 'week-selected'],
    allowInteraction: true,
    branch: {
      'begin-program-tapped': 'begin-modal',
      'week-selected': 'week-add',
    },
  },
  {
    id: 'week-add',
    type: 'spotlight',
    target: '[data-tutorial="week-add-btn"]',
    title: 'Add a Workout',
    description: 'Tap the Add button to schedule this workout on a specific day of the week.',
    position: 'top',
    waitFor: 'add-workout-opened',
    allowInteraction: true,
  },
  {
    id: 'begin-modal',
    type: 'spotlight',
    target: '[data-tutorial="begin-modal"]',
    title: 'Choose When to Start',
    description: 'Tap Start Today to schedule your workouts beginning today, or tap Choose Date to pick a custom start date.',
    position: 'top',
    waitFor: 'begin-confirmed',
    allowInteraction: true,
  },
];

// Phase 1B: Create Workout Flow (future)
export const PHASE_1B = [];

// Phase 2: Shared Calendar Flow (future)
export const PHASE_2 = [];

// Phase 3: Shared Workout Session Flow (future)
export const PHASE_3 = [];

export function getStepsForPhase(phase) {
  switch (phase) {
    case '1a': return PHASE_1A;
    case '1b': return PHASE_1B;
    case '2': return PHASE_2;
    case '3': return PHASE_3;
    default: return [];
  }
}
