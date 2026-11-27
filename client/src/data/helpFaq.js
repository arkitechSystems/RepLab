// Help chat FAQ (components/HelpChat.jsx, matcher utils/helpSearch.js).
//
// KEEP IN SYNC: every answer describes how the app works today, using the
// real button labels. When a user-facing flow, button label or route changes,
// update the matching entry here too (see CLAUDE.md "Keep in sync: help FAQ").
// Don't mention Featured Workouts, Challenges or Trainer Central — those are
// feature-flagged to the owner only (utils/featureFlags.js).
//
// Entry shape:
//   id         stable id (used in analytics: help_chat_answered.faq_id)
//   question   shown as the answer title and on suggestion chips
//   alternates other ways people ask it (matching only)
//   keywords   extra words that point at this entry (matching only)
//   answer     plain text; "\n" between lines; "1. …" lines render as steps
//   action     optional { label, to } — "Show me" button that navigates
//   category   grouping label

export const HELP_SUPPORT_EMAIL = 'support@replab-fitness.com';

// Chips shown when the chat opens.
export const HELP_STARTER_IDS = [
  'create-workout',
  'schedule-workout',
  'start-program',
  'build-program',
  'start-todays-workout',
  'contact-support',
];

export const HELP_FAQ = [
  // ── Workouts ───────────────────────────────────────────────────────────
  {
    id: 'create-workout',
    category: 'Workouts',
    question: 'How do I create a workout?',
    alternates: [
      'How do I add a workout?',
      'add a new workout',
      'make my own workout',
      'build a custom workout',
      'create a custom routine',
      'new workout',
    ],
    keywords: ['create', 'custom', 'own', '+ create', 'new workout'],
    answer:
      '1. On the Workouts tab, tap + Create.\n' +
      '2. Tap Create a Workout.\n' +
      '3. Enter a Workout Name (a description is optional).\n' +
      '4. Pick a Program, or leave it on No program (My Workouts).\n' +
      '5. Tap Confirm.\n' +
      '6. Tap Add Exercise and add your exercises, sets, weights and reps.\n' +
      '7. Tap Create Workout to save it.\n' +
      'The weights and reps you enter become the workout\'s Goal Wt and Goal Reps.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'log-as-you-go',
    category: 'Workouts',
    question: 'How do I start an empty workout and log as I go?',
    alternates: [
      'log as you go',
      'start a blank workout',
      'quick workout without a plan',
      'just log what I do today',
      'freestyle workout',
      'start empty workout',
    ],
    keywords: ['empty', 'blank', 'log as you go', 'freestyle', 'quick', 'unplanned'],
    answer:
      'When nothing is scheduled today, the top card on the Workouts tab shows Log as You Go. Tap it.\n' +
      'On any other day:\n' +
      '1. Open the Calendar tab.\n' +
      '2. Tap the pencil on a day.\n' +
      '3. Tap Start Empty Workout.\n' +
      '4. Name it and tap Confirm.\n' +
      '5. Tap Add Exercise and log your sets.\n' +
      'The workout is saved to My Workouts.',
    action: { label: 'Show me', to: '/calendar' },
  },
  {
    id: 'start-todays-workout',
    category: 'Workouts',
    question: "How do I start today's workout?",
    alternates: [
      'start my workout',
      'begin my workout today',
      "where is today's workout",
      'how do I start a session',
      'resume my workout',
    ],
    keywords: ['today', 'start', 'up next', 'resume', 'begin workout'],
    answer:
      '1. Open the Workouts tab.\n' +
      '2. On the top Up Next card, tap Start Workout (or Resume if you already started).\n' +
      '3. Tap Begin Workout to start the timer and check off sets.\n' +
      'You can also tap the red play button in the middle of the bottom bar, or tap the day on the Calendar.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'edit-workout',
    category: 'Workouts',
    question: 'How do I edit a workout?',
    alternates: [
      'change the exercises in a workout',
      'modify my workout',
      'update a workout',
      'add an exercise to my workout',
      'remove an exercise from a workout',
    ],
    keywords: ['edit', 'change', 'exercises', 'save changes'],
    answer:
      '1. On the Workouts tab, open My Workouts.\n' +
      '2. Tap Edit on the workout card (or tap the workout\'s name).\n' +
      '3. Change the name, description or exercises (+ Add Exercise, + Add Section).\n' +
      '4. Tap Save Changes. You\'re taken back to My Workouts.\n' +
      'You can also change a workout while you\'re doing it: use Add Exercise, or the ⋯ menu on an exercise to move or remove it.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'rename-workout',
    category: 'Workouts',
    question: 'How do I rename a workout?',
    alternates: ['change the name of my workout', 'edit workout name', 'rename'],
    keywords: ['rename', 'name', 'title', 'edit name'],
    answer:
      'In one of your programs, tap the pencil (Rename workout) on the workout card, type the new name and tap Save.\n' +
      'You can also tap the pencil next to the workout name in the workout itself, or tap Edit on the workout in My Workouts and change Workout Name, then Save Changes.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'delete-workout',
    category: 'Workouts',
    question: 'How do I delete a workout?',
    alternates: ['remove a workout', 'get rid of a workout', 'trash a workout'],
    keywords: ['delete', 'remove', 'trash'],
    answer:
      '1. On the Workouts tab, open My Workouts (or the program it\'s in).\n' +
      '2. Tap the trash icon on the workout card.\n' +
      '3. Tap Delete.\n' +
      'This also removes the workout\'s history and personal bests.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'move-workout-program',
    category: 'Workouts',
    question: 'How do I move a workout into a program?',
    alternates: ['put a workout in a program', 'organize workouts into programs', 'move workout to another program'],
    keywords: ['move', 'organize', 'program'],
    answer:
      '1. On the Workouts tab, open My Workouts.\n' +
      '2. Tap Move on the workout card.\n' +
      '3. Pick the program. It goes on the first open day after the program\'s last workout (a new week is added if the last week is full), and a message tells you the week and day.\n' +
      'No programs yet, or want a new one? Tap Create a Program (or + New Program), type a name and tap Create & Move.\n' +
      'To put it on a different day, open the program and use Move to another day.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'library',
    category: 'Workouts',
    question: 'Where can I find ready-made programs?',
    alternates: ['browse the workout library', 'premade workouts', 'find a program to follow', 'workout library'],
    keywords: ['library', 'browse', 'premade', 'ready made', 'hypertrophy', 'strength'],
    answer:
      '1. On the Workouts tab, tap the Browse Library card.\n' +
      '2. Filter by type or search.\n' +
      '3. Tap View Program to look inside, or Begin to start it.',
    action: { label: 'Show me', to: '/app' },
  },

  // ── Calendar ───────────────────────────────────────────────────────────
  {
    id: 'schedule-workout',
    category: 'Calendar',
    question: 'How do I add a workout to my calendar?',
    alternates: [
      'How do I add this to my calendar?',
      'schedule a workout',
      'schedule a workout on a date',
      'put a workout on a day',
      'plan a workout for tomorrow',
      'assign a workout to a day',
    ],
    keywords: ['calendar', 'schedule', 'date', 'day', '+ calendar', 'assign'],
    answer:
      'From a workout card:\n' +
      '1. Tap + Calendar.\n' +
      '2. Tap Begin Today, or Choose Date and then Schedule.\n' +
      'From the Calendar:\n' +
      '1. Open the Calendar tab (Weekly view).\n' +
      '2. Tap the pencil on the day.\n' +
      '3. Tap the workout you want.',
    action: { label: 'Show me', to: '/calendar' },
  },
  {
    id: 'change-calendar-day',
    category: 'Calendar',
    question: 'How do I change or remove a workout on my calendar?',
    alternates: [
      'swap the workout on a day',
      'clear a day on my calendar',
      'remove a scheduled workout',
      'move a workout to another day',
      'reschedule a workout',
    ],
    keywords: ['swap', 'clear', 'reschedule', 'remove', 'move', 'change workout'],
    answer:
      '1. Open the Calendar tab (Weekly view).\n' +
      '2. Tap the pencil on the day.\n' +
      '3. Tap a different workout to swap it, or Clear — No Workout to empty the day.\n' +
      'To move a workout, use Copy Workout to put it on the new day, then clear the old day.',
    action: { label: 'Show me', to: '/calendar' },
  },
  {
    id: 'rest-day',
    category: 'Calendar',
    question: 'How do I add a rest day or push my schedule back?',
    alternates: ['skip todays workout', 'push everything back a day', 'insert a rest day', 'take a day off'],
    keywords: ['rest', 'skip', 'push back', 'day off', 'insert rest day'],
    answer:
      '1. Open the Calendar tab.\n' +
      '2. Tap the pencil on the day.\n' +
      '3. Tap Rest Day.\n' +
      '4. Choose Insert Rest Day (other days stay the same), Skip Workout (pull later workouts up a day) or Push Everything Back (slide this workout and the rest forward a day).',
    action: { label: 'Show me', to: '/calendar' },
  },
  {
    id: 'copy-workout-day',
    category: 'Calendar',
    question: 'How do I copy a workout to another day?',
    alternates: ['duplicate a workout on the calendar', 'repeat a workout another day', 'do the same workout again'],
    keywords: ['copy', 'duplicate', 'repeat', 'same workout'],
    answer:
      '1. Open the Calendar tab.\n' +
      '2. Tap the pencil on the day that has the workout.\n' +
      '3. Tap Copy Workout.\n' +
      '4. Pick the day to copy it to.\n' +
      'If you already did the workout, you can choose Yes, Use Reps to make your logged weights and reps the new goals.',
    action: { label: 'Show me', to: '/calendar' },
  },
  {
    id: 'clear-calendar',
    category: 'Calendar',
    question: 'How do I clear my calendar?',
    alternates: ['delete everything on my calendar', 'reset my schedule', 'stop a program', 'end my program', 'quit a program'],
    keywords: ['clear calendar', 'reset', 'stop', 'quit', 'end', 'cancel program'],
    answer:
      '1. Open the Calendar tab.\n' +
      '2. Tap the pencil on the first day you want cleared.\n' +
      '3. Tap Clear Calendar.\n' +
      '4. Tap Clear.\n' +
      'Everything from that day onward is removed. Completed workouts and personal records are kept.',
    action: { label: 'Show me', to: '/calendar' },
  },
  {
    id: 'calendar-views',
    category: 'Calendar',
    question: 'What do the colors and marks on the calendar mean?',
    alternates: ['weekly vs monthly calendar', 'calendar legend', 'what does the red slash mean'],
    keywords: ['legend', 'weekly', 'monthly', 'missed', 'completed', 'colors'],
    answer:
      'Switch between Weekly and Monthly at the top of the Calendar.\n' +
      'In Monthly view the Legend shows Today, Completed, Scheduled, Missed (a red slash) and Rest.\n' +
      'In Weekly view, completed days have a green check.',
    action: { label: 'Show me', to: '/calendar' },
  },
  {
    id: 'missed-workouts',
    category: 'Calendar',
    question: 'What happens if I miss a workout?',
    alternates: ['I missed a workout', 'skipped a day', 'it says I missed a workout', 'resume or skip'],
    keywords: ['missed', 'miss', 'skip', 'resume', 'behind'],
    answer:
      'RepLab asks "It looks like you missed a workout" when a scheduled workout from the last 14 days wasn\'t done.\n' +
      'Resume moves it to today and pushes the rest of your schedule back.\n' +
      'Skip keeps your upcoming schedule as it is.\n' +
      'Closing the prompt just asks again next time.',
  },

  // ── Programs ───────────────────────────────────────────────────────────
  {
    id: 'start-program',
    category: 'Programs',
    question: 'How do I start a program?',
    alternates: [
      'begin a program',
      'follow a program',
      'put a program on my calendar',
      'schedule a program',
      'start program on a certain date',
    ],
    keywords: ['begin program', 'start', 'program', 'start date', 'day 1', 'begin'],
    answer:
      '1. Open the program (from Browse Library, or My Programs in My Workouts).\n' +
      '2. Tap Begin Program (Begin on library cards).\n' +
      '3. Tap Start Today, or Choose Date and then Schedule.\n' +
      'Every day of the program goes onto your calendar from that date. If the program has a Day 1 weekday, the date starts on the next one — you can change it.\n' +
      'If days already have workouts, you\'ll be asked before they\'re overwritten.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'build-program',
    category: 'Programs',
    question: 'How do I build my own program?',
    alternates: [
      'create a program',
      'make a new program',
      'set up a weekly plan',
      'build a training split',
      'new program',
    ],
    keywords: ['program', 'new program', 'create program', 'sample calendar', 'weeks'],
    answer:
      '1. On the Workouts tab, tap + Create.\n' +
      '2. Tap New Program.\n' +
      '3. Enter a Program Name and tap Create Program.\n' +
      '4. On the Sample Calendar, tap a day.\n' +
      '5. Choose Create a new workout, Add a workout from this program, Copy from My Workouts, or Mark as rest day.\n' +
      '6. Use + Add Week to add weeks.\n' +
      'Changes save as you go — there\'s no Save button.',
    action: { label: 'Show me', to: '/programs/create' },
  },
  {
    id: 'program-weeks',
    category: 'Programs',
    question: 'How do I add, duplicate or delete a week in my program?',
    alternates: ['copy a week', 'add another week', 'remove a week from my program', 'repeat week 1'],
    keywords: ['week', 'add week', 'duplicate week', 'delete week', 'copy week'],
    answer:
      'Open your program in Weekly view.\n' +
      '+ Add Week adds an empty week at the end.\n' +
      'Duplicate Week copies the week you\'re looking at onto a new last week.\n' +
      'Delete Week removes that week and its workouts (with their history and personal records), then renumbers the rest.\n' +
      'Programs can be up to 52 weeks.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'program-day-actions',
    category: 'Programs',
    question: 'How do I change a day in my program?',
    alternates: ['swap a workout in my program', 'move a workout to another day in my program', 'make a day a rest day', 'program calendar'],
    keywords: ['swap', 'move to another day', 'remove', 'rest day', 'sample calendar', 'weekly', 'monthly'],
    answer:
      '1. Open your program and switch to Weekly or Monthly.\n' +
      '2. Tap the day.\n' +
      '3. Choose View, Edit, Swap, Move to another day, or Remove (makes it a rest day).\n' +
      'Move to another day swaps the two days if the new day already has a workout.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'program-copies',
    category: 'Programs',
    question: 'What are copies, and how do I change all of them at once?',
    alternates: ['apply to all copies', 'same workout on several days', 'edit every copy of a workout', 'change all copies'],
    keywords: ['copies', 'copy', 'apply to all copies', 'all days'],
    answer:
      'When the same workout is on more than one day of a program, each day gets its own copy, so each day keeps its own history.\n' +
      'To change them all:\n' +
      '1. Tap the day and choose Edit.\n' +
      '2. Make your changes.\n' +
      '3. Tick Apply this change to all copies in this program.\n' +
      '4. Tap Save Changes.',
  },
  {
    id: 'program-day1',
    category: 'Programs',
    question: 'How do I set which weekday Day 1 of my program is?',
    alternates: ['start my program on a Monday', 'day 1 is', 'weekday for day one'],
    keywords: ['day 1', 'weekday', 'monday', 'sunday', 'day one'],
    answer:
      '1. Open your program\'s Sample Calendar.\n' +
      '2. Use the Day 1 is dropdown to pick a weekday (or Any day).\n' +
      'When you tap Begin Program, the start date is set to the next matching weekday.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'edit-delete-program',
    category: 'Programs',
    question: 'How do I rename or delete a program?',
    alternates: ['remove a program', 'edit my program name', 'reorder workouts in a program', 'delete program'],
    keywords: ['delete program', 'rename program', 'reorder', 'gear', 'edit program'],
    answer:
      '1. Open the program in List view.\n' +
      '2. Tap the gear (Edit program).\n' +
      '3. Change the name, reorder workouts with the arrows, or tap Delete Program.\n' +
      '4. Tap Done.\n' +
      'You can also tap the trash icon on the program card under My Programs. Deleting a program deletes its workouts and their history.',
    action: { label: 'Show me', to: '/app' },
  },

  // ── During a workout ───────────────────────────────────────────────────
  {
    id: 'add-exercise',
    category: 'During a workout',
    question: 'How do I add an exercise during a workout?',
    alternates: ['How do I add an exercise?', 'add exercises', 'add a custom exercise', 'add exercise to session', 'exercise is not in the list'],
    keywords: ['add exercise', 'custom exercise', 'search exercises'],
    answer:
      '1. Scroll below the exercise cards and tap Add Exercise.\n' +
      '2. Search, or filter by muscle.\n' +
      '3. Tap the exercise.\n' +
      'Can\'t find it? Type the name and tap Add "your name" to make a custom exercise.',
  },
  {
    id: 'supersets',
    category: 'During a workout',
    question: 'How do I make a superset?',
    alternates: ['group exercises together', 'pair two exercises', 'superset label', 'circuit'],
    keywords: ['superset', 'group', 'pair', 'a1', 'label'],
    answer:
      '1. Tap the exercise name (or ⋯ → Add to superset).\n' +
      '2. Pick a letter and number, like A1.\n' +
      '3. Tap Set A1.\n' +
      '4. Give the other exercise the same letter with the next number (A2).\n' +
      'Clear Label removes it from the superset.',
  },
  {
    id: 'set-types',
    category: 'During a workout',
    question: 'How do I change a set type, like warm-up or drop set?',
    alternates: ['mark a warm up set', 'drop set', 'what does REG mean', 'set type options'],
    keywords: ['set type', 'warm up', 'drop set', 'rest pause', 'reg', 'wu', 'ds'],
    answer:
      'Tap the small chip under the set number and pick a type:\n' +
      'Warm Up (WU), Touch Up (TU), Regular (REG), Drop Set (DS), Rest Pause (RP), Super Set (SS), Alternating Set (Alt), Pre-Exhaust (PrEx).\n' +
      'Only completed Regular sets count toward your PRs.\n' +
      'Don\'t see the chips? Turn on Set Type in the settings gear.',
  },
  {
    id: 'goal-weight',
    category: 'During a workout',
    question: 'What are Goal Wt and Goal Reps?',
    alternates: ['set a goal weight', 'change goal reps', 'target weight for a set', 'hide goal weight'],
    keywords: ['goal', 'goal wt', 'goal reps', 'target', 'actual'],
    answer:
      'Goal Wt and Goal Reps are what the workout plans for each set. Actual Wt and Actual Reps are what you really did.\n' +
      'When you create a workout, the weights and reps you enter become the goals.\n' +
      'Long-press a goal value to change it.\n' +
      'Show or hide the goal columns with the settings gear (Goal Weight, Goal Reps), or set the default in Profile.',
  },
  {
    id: 'add-remove-sets',
    category: 'During a workout',
    question: 'How do I add or remove a set?',
    alternates: ['delete a set', 'extra set', 'reorder sets', 'complete a set'],
    keywords: ['add set', 'remove set', 'swipe', 'delete set'],
    answer:
      'Tap Add set or Remove set under the sets.\n' +
      'Swipe a set left to delete it, or right to complete it.\n' +
      'Long-press and drag to reorder sets.',
  },
  {
    id: 'rest-timer',
    category: 'During a workout',
    question: 'How does the rest timer work?',
    alternates: ['how long should I rest between sets', 'how long do I rest', 'change rest time', 'rest timer length', 'turn off the rest timer', 'default rest time'],
    keywords: ['rest', 'timer', 'rest timer', 'countdown', 'default rest time'],
    answer:
      'The rest timer starts by itself each time you check off a set. You can also tap Start on the Rest bar.\n' +
      'Pick the length (15s to 3:00) in the dropdown next to Start.\n' +
      'Tap Skip to end it early.\n' +
      'Set your default in Profile → Default Rest Time.',
    action: { label: 'Show me', to: '/profile' },
  },
  {
    id: 'finish-workout',
    category: 'During a workout',
    question: 'How do I finish a workout?',
    alternates: ['complete my workout', 'mark workout complete', 'end session', 'save my workout'],
    keywords: ['finish', 'complete', 'mark complete', 'done', 'end'],
    answer:
      '1. Scroll to the bottom of the workout.\n' +
      '2. Tap Mark Complete.\n' +
      'You\'ll see your workout summary. Tap Done to go to the Calendar.\n' +
      'Log at least one set first.',
  },
  {
    id: 'edit-finished-workout',
    category: 'During a workout',
    question: 'How do I fix sets in a workout I already finished?',
    alternates: ['edit a completed workout', 'undo completion', 'change reps after finishing', 'edit locked'],
    keywords: ['undo completion', 'edit locked', 'completed', 'fix', 'past workout'],
    answer:
      '1. Open the finished workout (from the Calendar or your history, then View Workout).\n' +
      '2. Tap Undo Completion at the top.\n' +
      '3. Fix your sets.\n' +
      '4. Tap Mark Complete again.',
  },
  {
    id: 'exercise-notes',
    category: 'During a workout',
    question: 'How do I add notes to an exercise?',
    alternates: ['write a note', 'exercise notes', 'leave a comment on an exercise'],
    keywords: ['note', 'notes', 'comment'],
    answer: 'Tap Add notes at the bottom of the exercise card and type your note.',
  },
  {
    id: 'reorder-swap-exercise',
    category: 'During a workout',
    question: 'How do I reorder, swap or remove an exercise?',
    alternates: ['move an exercise up', 'replace an exercise', 'swap exercise', 'remove exercise from workout'],
    keywords: ['reorder', 'move up', 'move down', 'swap', 'replace', 'remove exercise'],
    answer:
      'Tap ⋯ on the exercise card for Move up, Move down and Remove exercise.\n' +
      'Tap Swap on the card to replace it with a different exercise.',
  },
  {
    id: 'exercise-videos',
    category: 'During a workout',
    question: 'How do I watch an exercise demo video?',
    alternates: ['exercise form video', 'how to do an exercise', 'demo', 'show me the form'],
    keywords: ['video', 'demo', 'form', 'how to perform'],
    answer:
      'During a workout, tap Demo on the exercise card.\n' +
      'Or open Utilities → Exercise Library, tap an exercise, and tap Watch form video.\n' +
      'If there\'s no demo yet, RepLab offers to search YouTube for you.',
    action: { label: 'Show me', to: '/exercises' },
  },
  {
    id: 'cardio',
    category: 'During a workout',
    question: 'How do I log cardio?',
    alternates: ['add cardio', 'treadmill', 'log a run', 'bike or rower'],
    keywords: ['cardio', 'run', 'treadmill', 'bike', 'rower', 'walk'],
    answer:
      'Add a cardio exercise like any other: tap Add Exercise and search for it (for example Treadmill).\n' +
      'The card switches to cardio fields so you can log your numbers.',
  },
  {
    id: 'theme',
    category: 'During a workout',
    question: 'How do I switch between dark and light cards?',
    alternates: ['dark mode', 'light mode', 'change the theme', 'cards are white'],
    keywords: ['dark', 'light', 'theme', 'dark theme', 'white cards'],
    answer:
      '1. In a workout, tap the settings gear.\n' +
      '2. Turn Dark Theme on for dark cards, or off for light cards.\n' +
      'Your choice is remembered for next time.',
  },
  {
    id: 'full-screen',
    category: 'During a workout',
    question: 'How do I use full-screen mode for exercises?',
    alternates: ['bigger exercise view', 'one exercise at a time', 'full screen'],
    keywords: ['full screen', 'full-screen', 'focus'],
    answer:
      'Tap the full-screen icon on an exercise card.\n' +
      'To start every workout in full-screen, turn on Profile → Full-Screen Mode.',
    action: { label: 'Show me', to: '/profile' },
  },

  // ── Tools ──────────────────────────────────────────────────────────────
  {
    id: 'plate-calculator',
    category: 'Tools',
    question: 'How do I use the plate calculator?',
    alternates: ['what plates do I load', 'how much on each side of the bar', 'plate math', 'load the bar'],
    keywords: ['plate', 'plates', 'bar', 'calculator', 'each side', 'barbell'],
    answer:
      'Open Utilities → Plate Calculator, enter the Target Weight, and it shows the plates for each side.\n' +
      'Pick Both Sides, One Side or Machine, and choose your Bar Weight.\n' +
      'In a workout, tap PC on an exercise card (or long-press a weight box), then tap Use to fill in the weight.\n' +
      'The plate calculator works in pounds (lbs).',
    action: { label: 'Show me', to: '/plate-calculator' },
  },
  {
    id: 'one-rep-max',
    category: 'Tools',
    question: 'How do I estimate my one rep max?',
    alternates: ['1rm calculator', 'max calculator', 'what is my max'],
    keywords: ['1rm', 'one rep max', 'max', 'estimate'],
    answer: 'Open Utilities → 1 Rep Max Estimator and enter a weight and reps from any set.',
    action: { label: 'Show me', to: '/utilities' },
  },
  {
    id: 'hiit-timer',
    category: 'Tools',
    question: 'Is there an interval timer?',
    alternates: ['hiit timer', 'tabata timer', 'interval training timer'],
    keywords: ['hiit', 'interval', 'tabata', 'timer', 'conditioning'],
    answer: 'Yes. Open Utilities → HIIT Timer.',
    action: { label: 'Show me', to: '/utilities' },
  },
  {
    id: 'units',
    category: 'Tools',
    question: 'Can I use kilograms instead of pounds?',
    alternates: ['switch to kg', 'change units', 'metric units', 'lbs or kg'],
    keywords: ['kg', 'kilograms', 'pounds', 'lbs', 'units', 'metric'],
    answer: 'Not yet. RepLab currently shows all weights in pounds (lbs).',
  },

  // ── Progress ───────────────────────────────────────────────────────────
  {
    id: 'personal-records',
    category: 'Progress',
    question: 'Where can I see my personal records (PRs)?',
    alternates: ['my PRs', 'personal bests', 'heaviest lifts', 'how are PRs counted', 'new PR'],
    keywords: ['pr', 'personal record', 'personal best', 'heaviest', 'record'],
    answer:
      'Your PRs show on the Workouts tab (Personal Records by: Weight or Volume), on your Profile, and in Utilities → Personal Records.\n' +
      'During a workout, tap PRs on an exercise card.\n' +
      'A new PR is celebrated when you do more reps at a weight than ever before. Only completed Regular sets count.',
    action: { label: 'Show me', to: '/utilities' },
  },
  {
    id: 'share-pr',
    category: 'Progress',
    question: 'How do I share a PR?',
    alternates: ['post my personal record', 'share my PR to Instagram'],
    keywords: ['share pr', 'instagram', 'brag'],
    answer: 'On the Workouts tab, under Personal Records by:, tap the share icon next to the lift and pick how to share it.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'progress',
    category: 'Progress',
    question: 'How do I see my progress?',
    alternates: ['progress charts', 'am I getting stronger', 'progressive overload', 'stats', 'graphs'],
    keywords: ['progress', 'chart', 'graph', 'overload', 'stats', 'improvement'],
    answer:
      'Open Utilities → Progress.\n' +
      'It shows your last 30 days, then every lift you\'ve logged by weight, colored by whether you did more reps than last time (green), the same (yellow) or fewer (red).\n' +
      'Filter by Body Part at the top.',
    action: { label: 'Show me', to: '/progress' },
  },
  {
    id: 'history',
    category: 'Progress',
    question: 'Where can I see my past workouts?',
    alternates: ['workout history', 'previous sessions', 'what did I do last week', 'workout log'],
    keywords: ['history', 'past', 'previous', 'log', 'sessions', 'summary'],
    answer:
      'Your Profile shows your recent workouts under Workout History. Tap View all to see every session.\n' +
      'Tap a session to see its summary, or tap a completed day on the Calendar.',
    action: { label: 'Show me', to: '/history' },
  },
  {
    id: 'body-metrics',
    category: 'Progress',
    question: 'How do I update my body weight and stats?',
    alternates: ['log my body weight', 'body fat', 'update my height', 'my 1 rep max numbers'],
    keywords: ['body weight', 'body fat', 'height', 'metrics', 'body metrics'],
    answer:
      '1. Open the Profile tab.\n' +
      '2. Fill in Body Metrics (Height, Weight, Body Fat) and Performance (Bench Press, Squat, Deadlift).\n' +
      '3. Tap Save Metrics.',
    action: { label: 'Show me', to: '/profile' },
  },

  // ── Sharing & community ────────────────────────────────────────────────
  {
    id: 'share-workout',
    category: 'Sharing',
    question: 'How do I share a workout or program with a friend?',
    alternates: ['send a workout to someone', 'share my program', 'invite a friend to a workout', 'share workout'],
    keywords: ['share', 'invite', 'friend', 'send', 'partner'],
    answer:
      '1. On the Workouts tab, open My Workouts.\n' +
      '2. Tap Share on a workout card (or the share icon on a program card).\n' +
      '3. Search for their RepLab username and tap Send Invite (or Share for a program).\n' +
      'You can also share outside RepLab with the buttons under Or share externally.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'accept-share',
    category: 'Sharing',
    question: 'Where do workouts people share with me show up?',
    alternates: ['someone shared a workout with me', 'accept a shared workout', 'pending invites'],
    keywords: ['shared with me', 'pending', 'accept', 'decline', 'bell'],
    answer:
      'A bell with a number appears at the top of the Workouts tab.\n' +
      'Open My Workouts and look under Pending. Tap Accept or Decline.\n' +
      'Accepted workouts appear under Shared With Me.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'share-summary',
    category: 'Sharing',
    question: 'How do I share my workout summary?',
    alternates: ['share my finished workout', 'post my workout', 'save workout image'],
    keywords: ['summary', 'share image', 'camera roll', 'share as text'],
    answer:
      'On the workout summary, tap the share icon.\n' +
      'Choose Share Image, Save to Camera Roll or Share as Text, or send it to a RepLab user.',
  },
  {
    id: 'community',
    category: 'Sharing',
    question: 'What is the Community feed?',
    alternates: ['community', 'RepLab feed', 'see what others are doing', 'applause'],
    keywords: ['community', 'feed', 'applaud', 'applause', 'social'],
    answer:
      'Open Utilities → Community to see the RepLab Feed.\n' +
      'It shows PRs, programs started or completed, and workout streaks from RepLab members. Tap the clap button to applaud someone.\n' +
      'Posts are added automatically — you don\'t have to post anything.',
    action: { label: 'Show me', to: '/community' },
  },
  {
    id: 'community-privacy',
    category: 'Sharing',
    question: 'How do I stop sharing my activity to the Community?',
    alternates: ['hide my PRs from the feed', 'community privacy', 'turn off community sharing'],
    keywords: ['privacy', 'private', 'hide', 'stop sharing', 'community'],
    answer:
      '1. Open the Profile tab.\n' +
      '2. Under RepLab Community, turn off Share to RepLab Community — or just the types you don\'t want shared (PRs, Programs started, Programs completed, Workout streaks).',
    action: { label: 'Show me', to: '/profile' },
  },

  // ── Exercises ──────────────────────────────────────────────────────────
  {
    id: 'exercise-library',
    category: 'Exercises',
    question: 'How do I browse the exercise library?',
    alternates: ['find an exercise', 'list of exercises', 'save an exercise', 'my custom exercises'],
    keywords: ['exercise library', 'exercises', 'muscle', 'bookmark', 'saved'],
    answer:
      'Open Utilities → Exercise Library.\n' +
      'Search, or filter by muscle group. Tap an exercise to see the muscles worked, how to do it, form tips and a video.\n' +
      'Tap the bookmark to save it to Saved.',
    action: { label: 'Show me', to: '/exercises' },
  },

  // ── Settings & account ─────────────────────────────────────────────────
  {
    id: 'notifications',
    category: 'Account',
    question: 'How do I turn notifications on or off?',
    alternates: ['workout reminders', 'stop notifications', 'push notifications', 'I am not getting reminders'],
    keywords: ['notification', 'reminder', 'push', 'alerts'],
    answer:
      'Workout reminders are controlled by your phone: open your phone\'s Settings, find RepLab, then Notifications.\n' +
      'To stop applause notifications, turn off Profile → Applause on my activity.',
    action: { label: 'Show me', to: '/profile' },
  },
  {
    id: 'offline',
    category: 'Account',
    question: 'Does RepLab work offline?',
    alternates: ['no internet at the gym', 'no signal', 'will my workout save without wifi', 'changes waiting to sync'],
    keywords: ['offline', 'internet', 'wifi', 'signal', 'sync'],
    answer:
      'Yes, for workouts you\'ve opened before on that phone. Log sets and Mark Complete as usual — it saves on your phone and syncs when you\'re back online.\n' +
      'Some changes, like building programs or editing the calendar, need a connection.',
  },
  {
    id: 'change-password',
    category: 'Account',
    question: 'How do I change my password?',
    alternates: ['update password', 'set a password', 'new password'],
    keywords: ['password', 'change password', 'set password', 'security'],
    answer:
      '1. Open the Profile tab.\n' +
      '2. Scroll to Security.\n' +
      '3. Enter your current and new password.\n' +
      '4. Tap Change Password.\n' +
      'Signed up with Google or Apple? You\'ll see Set a Password instead.',
    action: { label: 'Show me', to: '/profile' },
  },
  {
    id: 'forgot-password',
    category: 'Account',
    question: 'I forgot my password. How do I reset it?',
    alternates: ['reset password', 'cant log in', 'locked out', 'forgot password'],
    keywords: ['forgot', 'reset', 'password', 'locked out', 'sign in'],
    answer:
      '1. On the sign-in screen, tap Forgot password?\n' +
      '2. Enter your email and tap Send Reset Link.\n' +
      '3. Open the email and follow the link (it expires in 1 hour).\n' +
      'Signed up with Google or Apple? Just use Continue with Google or Continue with Apple.',
  },
  {
    id: 'apple-google-signin',
    category: 'Account',
    question: 'How do I sign in with Apple or Google?',
    alternates: ['sign in with google', 'sign in with apple', 'connect my google account', 'hide my email'],
    keywords: ['apple', 'google', 'sign in', 'continue with', 'hide my email', 'connect'],
    answer:
      'Tap Continue with Apple or Continue with Google on the sign-in screen.\n' +
      'If your email already has a RepLab account, you\'ll be asked for your RepLab password once to connect them.\n' +
      'With Apple, choose Share My Email — Hide My Email creates a separate account.\n' +
      'More tips: tap Sign In Help on the sign-in screen.',
  },
  {
    id: 'change-email',
    category: 'Account',
    question: 'How do I change my email or username?',
    alternates: ['update my email', 'change username', 'edit my profile name'],
    keywords: ['email', 'username', 'change email'],
    answer: `Email and username can't be changed in the app yet. Email ${HELP_SUPPORT_EMAIL} and we'll help.`,
  },
  {
    id: 'profile-photo',
    category: 'Account',
    question: 'How do I change my profile photo?',
    alternates: ['add a profile picture', 'upload photo', 'remove my photo'],
    keywords: ['photo', 'picture', 'avatar'],
    answer: 'On the Profile tab, tap your photo and choose Upload Photo, Change Photo or Remove Photo.',
    action: { label: 'Show me', to: '/profile' },
  },
  {
    id: 'sign-out',
    category: 'Account',
    question: 'How do I sign out?',
    alternates: ['log out', 'logout', 'switch accounts'],
    keywords: ['sign out', 'log out', 'logout'],
    answer: 'Open the Profile tab, scroll down and tap Sign Out.',
    action: { label: 'Show me', to: '/profile' },
  },
  {
    id: 'export-data',
    category: 'Account',
    question: 'How do I download my data?',
    alternates: ['export my workouts', 'get a copy of my data', 'backup my data'],
    keywords: ['export', 'download', 'data', 'backup'],
    answer: 'Open the Profile tab, scroll to the bottom and tap Export My Data.',
    action: { label: 'Show me', to: '/profile' },
  },
  {
    id: 'delete-account',
    category: 'Account',
    question: 'How do I delete my account?',
    alternates: ['close my account', 'cancel my account', 'remove my account and data'],
    keywords: ['delete account', 'close account', 'cancel account', 'remove data'],
    answer:
      '1. Open the Profile tab.\n' +
      '2. Scroll to the bottom and tap Delete Account.\n' +
      '3. Confirm with your password (or Apple/Google) and type DELETE.\n' +
      'This permanently deletes your workouts, programs and history.\n' +
      'No app? Go to replab-fitness.com/delete-account.',
    action: { label: 'Show me', to: '/profile' },
  },
  {
    id: 'tutorial',
    category: 'Account',
    question: 'Is there a tutorial?',
    alternates: ['how do I get started', 'new to RepLab', 'walkthrough', 'getting started guide'],
    keywords: ['tutorial', 'get started', 'walkthrough', 'beginner', 'guide'],
    answer: 'Yes. On the Workouts tab, scroll down to the Tutorial card and tap Begin.',
    action: { label: 'Show me', to: '/app' },
  },
  {
    id: 'cost',
    category: 'Account',
    question: 'Is RepLab free?',
    alternates: ['how much does it cost', 'subscription', 'pricing', 'do I have to pay'],
    keywords: ['free', 'cost', 'price', 'pay', 'subscription'],
    answer: 'Yes — there are no paid plans right now.',
  },
  {
    id: 'contact-support',
    category: 'Account',
    question: 'How do I contact support?',
    alternates: ['report a bug', 'talk to a person', 'send feedback', 'something is broken', 'email support'],
    keywords: ['support', 'contact', 'bug', 'feedback', 'email', 'human'],
    answer: `Email ${HELP_SUPPORT_EMAIL}. We read every message and usually reply within 1–2 business days.`,
  },
];
