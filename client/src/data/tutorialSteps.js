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
    waitFor: ['program-selected', 'begin-program-tapped'],
    allowInteraction: true,
    branch: {
      'begin-program-tapped': 'begin-modal',
    },
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
    position: 'bottom',
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

// Phase 1B: Create Workout Flow
//
// Step 1 spotlights the "+ Create" button on the Workouts hub. The user taps
// it, which fires the `create-menu-opened` action and advances the tutorial.
// CreateWorkout itself is reached via the Create menu; the remaining two
// steps spotlight the add-exercise search and the save button on that page.
export const PHASE_1B = [
  {
    type: 'spotlight',
    target: '[data-tutorial="create-btn"]',
    title: 'Create from Scratch',
    description: 'Tap + Create to build a workout. You\'ll name it, add exercises, set rep targets, and save it to My Workouts.',
    position: 'bottom',
    waitFor: 'create-menu-opened',
    allowInteraction: true,
  },
  {
    type: 'spotlight',
    target: '[data-tutorial="add-exercise-search"]',
    title: 'Add Exercises',
    description: 'Search the REPLAB library or type a custom name. You can drag-reorder, set the rest interval, and pick a set type (straight, drop, pyramid).',
    position: 'bottom',
  },
  {
    type: 'spotlight',
    target: '[data-tutorial="save-workout-btn"]',
    title: 'Save Your Workout',
    description: 'Tap Create Workout to save it. It lands in My Workouts so you can run it any time, share it, or schedule it on your calendar.',
    position: 'top',
  },
];

// Phase 2: Shared Calendar Flow
//
// Walks the user through the Calendar page itself — view toggle, day cell
// tap (where they can swap a workout / insert a rest day), and the copy-week
// feature that repeats a routine forward.
export const PHASE_2 = [
  {
    type: 'spotlight',
    target: '[data-tutorial="calendar-view-toggle"]',
    title: 'Weekly or Monthly',
    description: 'Use the Weekly / Monthly toggle to switch views. Weekly shows the full day cards; Monthly gives you a heatmap of the whole month at a glance.',
    position: 'bottom',
  },
  {
    type: 'spotlight',
    target: '[data-tutorial="calendar-day-cell"]',
    title: 'Your Calendar',
    description: 'Tap any day to swap its workout, insert a rest day, or copy the entire week forward. Use the week/month toggle above to change views.',
    position: 'top',
  },
];

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
