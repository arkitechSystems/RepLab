// Public user guide. Served at /userguide. Legacy /trainer/guide 301-redirects here.
import config from './config.js';

export function userGuidePage() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/jpeg" href="/RepLabLogo4.jpg">
  <link rel="apple-touch-icon" href="/RepLabLogo4.jpg">
  <title>REPLAB — User Guide</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Space Grotesk', -apple-system, sans-serif; background: #000; color: #fff; -webkit-font-smoothing: antialiased; }
    body::before { content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 28px 28px; }
    .container { position: relative; z-index: 1; max-width: 720px; margin: 0 auto; padding: 32px 24px 80px; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; text-align: center; margin-bottom: 8px; }
    .logo span { color: #ef4444; }
    h1 { font-size: 28px; font-weight: 800; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 32px; }
    .toc { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px 24px; margin-bottom: 40px; }
    .toc h3 { font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 12px; }
    .toc a { display: block; padding: 6px 0; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 13px; font-weight: 500; transition: color 0.15s; }
    .toc a:hover { color: #ef4444; }
    .toc .sub { padding-left: 16px; font-size: 12px; color: rgba(255,255,255,0.35); }
    .section { margin-bottom: 48px; }
    .section h2 { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
    .section h3 { font-size: 16px; font-weight: 700; color: #ef4444; margin: 24px 0 8px; }
    .section h4 { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); margin: 16px 0 6px; }
    .section p { font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.6); margin-bottom: 12px; }
    .section ul, .section ol { margin: 0 0 16px 20px; }
    .section li { font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
    .section strong { color: rgba(255,255,255,0.85); }
    .tip { background: rgba(239,68,68,0.08); border-left: 3px solid #ef4444; border-radius: 8px; padding: 12px 16px; margin: 12px 0; font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.7; }
    .tip strong { color: #ef4444; }
    .back-btn { display: inline-block; margin-bottom: 24px; color: rgba(255,255,255,0.4); text-decoration: none; font-size: 13px; font-weight: 600; }
    .back-btn:hover { color: #fff; }
    @media (max-width: 600px) { .container { padding: 20px 16px 60px; } h1 { font-size: 22px; } }
  </style>
</head>
<body>
<div class="container">
  <a href="${config.APP_URL}" class="back-btn">&larr; Back to REPLAB</a>
  <div class="logo">REP<span>LAB</span></div>
  <h1>User Guide</h1>
  <p class="subtitle">Everything you need to know about using REPLAB</p>

  <!-- Table of Contents -->
  <div class="toc">
    <h3>Table of Contents</h3>
    <a href="#getting-started">1. Getting Started</a>
    <a href="#workouts" style="margin-top:8px;">2. Workouts</a>
    <a class="sub" href="#browse-library">Browse Workout Library</a>
    <a class="sub" href="#my-workouts">My Workouts</a>
    <a class="sub" href="#create-workout">Creating a Workout</a>
    <a class="sub" href="#begin-program">Adding a Program to Your Calendar</a>
    <a href="#calendar" style="margin-top:8px;">3. Calendar</a>
    <a class="sub" href="#schedule-workouts">Scheduling Workouts</a>
    <a class="sub" href="#change-workout">Changing or Removing a Workout</a>
    <a href="#workout-sessions" style="margin-top:8px;">4. Workout Sessions</a>
    <a class="sub" href="#logging-sets">Logging Sets, Weight &amp; Reps</a>
    <a class="sub" href="#completing-sets">Completing Sets</a>
    <a class="sub" href="#add-sets">Adding &amp; Removing Sets</a>
    <a class="sub" href="#swap-exercise">Swapping an Exercise</a>
    <a class="sub" href="#add-exercise">Adding an Exercise</a>
    <a class="sub" href="#move-exercises">Reordering Exercises</a>
    <a class="sub" href="#exercise-notes">Exercise Notes</a>
    <a class="sub" href="#save-session">Saving Your Session</a>
    <a class="sub" href="#rest-timer">Using the Rest Timer</a>
    <a href="#utilities" style="margin-top:8px;">5. Utilities</a>
    <a class="sub" href="#personal-records">Personal Records</a>
    <a class="sub" href="#one-rep-max">One Rep Max Estimator</a>
    <a class="sub" href="#rest-timer-util">Rest Timer</a>
    <a href="#trainer-dashboard" style="margin-top:8px;">6. Trainer Dashboard (Computer)</a>
    <a class="sub" href="#trainer-login">Logging In</a>
    <a class="sub" href="#trainer-create">Creating Workouts on a Computer</a>
    <a class="sub" href="#trainer-edit">Editing Workouts</a>
    <a href="#profile" style="margin-top:8px;">7. Profile &amp; Settings</a>
    <a class="sub" href="#feedback">Sending Feedback</a>
    <a class="sub" href="#challenges">Challenges</a>
    <a href="#tips" style="margin-top:8px;">8. Tips &amp; Best Practices</a>
  </div>

  <!-- 1. Getting Started -->
  <div class="section" id="getting-started">
    <h2>1. Getting Started</h2>
    <p>Welcome to REPLAB. Here's how to get up and running in under a minute:</p>
    <ol>
      <li><strong>Sign up</strong> with your email or phone number and create a password.</li>
      <li><strong>Take the tour</strong> &mdash; after signing up, you'll see a quick walkthrough of the app's main features. You can skip it, but it's worth the 30 seconds.</li>
      <li><strong>Browse the Workout Library</strong> &mdash; head to the Workouts tab and tap <strong>Browse Workout Library</strong>. Pick a program that matches your goals.</li>
      <li><strong>Begin a Program</strong> &mdash; tap <strong>Begin Program</strong> on any program card, choose a start date, and the app will schedule your workouts on the calendar.</li>
      <li><strong>Start training</strong> &mdash; go to the Calendar tab, tap today's workout, and start logging your sets.</li>
    </ol>
    <div class="tip"><strong>Tip:</strong> You can also create workouts from a computer at <strong>${config.APP_HOST}/workouts</strong> using the same login credentials.</div>
  </div>

  <!-- 2. Workouts -->
  <div class="section" id="workouts">
    <h2>2. Workouts</h2>
    <p>The Workouts tab is your home base for discovering, creating, and managing workout programs.</p>

    <h3 id="browse-library">Browse Workout Library</h3>
    <p>The Browse Workout Library contains pre-built programs designed for different training styles and goals. Each program is organized into weeks.</p>
    <ol>
      <li>Tap <strong>Browse Workout Library</strong> from the Workouts tab.</li>
      <li>You'll see a list of programs (Push Pull Legs, Upper/Lower, Bro Split, etc.).</li>
      <li>Tap a program to see its weekly breakdown.</li>
      <li>Tap a week to see individual workouts within that week.</li>
      <li>Tap any workout to preview its exercises, sets, and reps.</li>
    </ol>
    <p>Use the <strong>search bar</strong> at the top to filter programs by name.</p>

    <h3 id="my-workouts">My Workouts</h3>
    <p>Any workout you create yourself appears under <strong>My Workouts</strong>. This is your personal library &mdash; only you can see these.</p>
    <ul>
      <li>Programs you create in the app or on the Trainer Dashboard appear here.</li>
      <li>You can <strong>delete a program</strong> by tapping the trash icon on its card.</li>
      <li>You can <strong>delete individual weeks</strong> from the weekly view using the trash icon on each week card.</li>
    </ul>

    <h3 id="create-workout">Creating a Workout</h3>
    <p>There are several ways to create a workout:</p>
    <h4>In the App</h4>
    <ol>
      <li>Tap the <strong>+ Create</strong> button in the top-right of the Workouts tab.</li>
      <li>Choose <strong>Create Workout</strong> or <strong>Create Program</strong>.</li>
      <li>Add exercises, set the number of sets and reps, and save.</li>
    </ol>
    <h4>AI Workout Generator</h4>
    <ol>
      <li>Tap <strong>+ Create</strong> and select <strong>AI Workout</strong>.</li>
      <li>Answer a few questions about your goal, experience, equipment, and target muscles.</li>
      <li>The AI will generate a complete workout with exercises, sets, reps, and suggested weights based on your personal records.</li>
      <li>You can <strong>refine the workout</strong> by typing instructions like "make barbell curls a drop set" or "add 2 sets to bench press" in the text box at the bottom.</li>
      <li>When you're happy with it, tap <strong>Save Workout</strong>.</li>
    </ol>
    <h4>On a Computer (Client Dashboard)</h4>
    <p>See the <a href="#trainer-dashboard" style="color:#ef4444;text-decoration:none;">Client Dashboard</a> section below.</p>

    <h3 id="begin-program">Adding a Program to Your Calendar</h3>
    <ol>
      <li>Find a program in the Browse Library or My Workouts.</li>
      <li>Tap the <strong>Begin Program</strong> button.</li>
      <li>Choose <strong>Start Today</strong> or <strong>Choose Date</strong> to pick a specific start date.</li>
      <li>The app will assign each workout in the program to consecutive days on your calendar, including rest days.</li>
    </ol>
    <div class="tip"><strong>Tip:</strong> The Begin Program button appears on program cards, the week picker, and inside individual week views &mdash; so you can start from anywhere.</div>
  </div>

  <!-- 3. Calendar -->
  <div class="section" id="calendar">
    <h2>3. Calendar</h2>
    <p>The Calendar tab shows your weekly workout schedule. Each day displays the assigned workout or "No workout" if the day is empty.</p>

    <h3 id="schedule-workouts">Scheduling Workouts</h3>
    <ol>
      <li>Tap any day on the calendar.</li>
      <li>If a workout is assigned, tapping the day opens that workout session.</li>
      <li>If no workout is assigned, a workout picker appears where you can search and select any workout from your library.</li>
    </ol>
    <p>Use the <strong>left/right arrows</strong> at the top to navigate between weeks.</p>

    <h3 id="change-workout">Changing or Removing a Workout</h3>
    <ul>
      <li>To <strong>change</strong> a day's workout: tap the day, then tap the <strong>pencil icon</strong> to open the workout picker and select a different workout.</li>
      <li>To <strong>clear</strong> a day: in the workout picker, tap <strong>Clear &mdash; No Workout</strong> at the top of the list.</li>
    </ul>
    <p>Days that have been completed show a <strong>green accent</strong> and a "Complete" label.</p>
  </div>

  <!-- 4. Workout Sessions -->
  <div class="section" id="workout-sessions">
    <h2>4. Workout Sessions</h2>
    <p>A workout session is where the actual training happens. When you tap a scheduled workout on the calendar, you enter the session view.</p>

    <h3 id="logging-sets">Logging Sets, Weight &amp; Reps</h3>
    <p>Each exercise shows a list of sets. For each set, you'll see:</p>
    <ul>
      <li><strong>Set number</strong> &mdash; which set you're on</li>
      <li><strong>Set type</strong> &mdash; Regular, Warm Up, Drop Set, Super Set, etc. Tap to change.</li>
      <li><strong>Weight</strong> &mdash; tap the weight field and enter the weight you're using (in lbs).</li>
      <li><strong>Reps</strong> &mdash; tap the reps field and enter how many reps you completed.</li>
    </ul>
    <p>The app may <strong>auto-suggest weights</strong> based on your previous sessions. You'll see a colored banner above the exercise with a recommendation like "Try 185 lbs" or "Hold at 155 lbs".</p>

    <h3 id="completing-sets">Completing Sets</h3>
    <p>Tap the <strong>circle checkbox</strong> on the left side of any set to mark it as complete. The row turns green and the checkbox fills with a checkmark. Tap again to undo.</p>
    <p>The progress bar at the top of the session shows how many sets you've completed out of the total.</p>

    <h3 id="add-sets">Adding &amp; Removing Sets</h3>
    <ul>
      <li>To <strong>add a set</strong>: tap the <strong>+ Add Set</strong> button in the set controls bar below the exercise name. You can also tap the <strong>- Remove</strong> button to remove the last set.</li>
      <li>To <strong>delete a specific set</strong>: long-press (hold) on any set row, or right-click on desktop. A confirmation will appear.</li>
    </ul>

    <h3 id="swap-exercise">Swapping an Exercise</h3>
    <p>If a machine is taken or you want a different movement:</p>
    <ol>
      <li>Tap the <strong>swap icon</strong> (two arrows) in the exercise header.</li>
      <li>A full-screen panel opens with suggested substitutes that target the same muscle group.</li>
      <li>Use the <strong>search bar</strong> to find a specific exercise, or tap <strong>AI Suggest</strong> to get smart recommendations.</li>
      <li>Tap an exercise to swap it in. Your sets and reps carry over.</li>
    </ol>
    <div class="tip"><strong>Tip:</strong> Swapped exercises are saved with your session. When you come back to this day's workout, the swapped exercise will still be there.</div>

    <h3 id="add-exercise">Adding an Exercise</h3>
    <ol>
      <li>Scroll to the bottom of the workout and tap <strong>Add Exercise</strong>.</li>
      <li>Search for an exercise by name, or browse by muscle group.</li>
      <li>If the exercise isn't in the library, you can type any name and tap <strong>Add Custom Exercise</strong> to create it.</li>
      <li>The new exercise appears at the bottom of your workout with default sets.</li>
    </ol>
    <p>You can also add an exercise <strong>below a specific exercise</strong> by tapping the <strong>+ button</strong> in that exercise's header.</p>

    <h3 id="move-exercises">Reordering Exercises</h3>
    <p>To change the order of exercises in your workout:</p>
    <ul>
      <li>Tap the <strong>up arrow</strong> or <strong>down arrow</strong> buttons in the exercise header to move it up or down in the list.</li>
    </ul>

    <h3 id="exercise-notes">Exercise Notes</h3>
    <p>Each exercise has a <strong>Notes</strong> section at the bottom of its card. Tap <strong>+ Add Notes</strong> to write reminders like "pause at the bottom" or "squeeze at the top". Notes are saved with your session.</p>

    <h3 id="save-session">Saving Your Session</h3>
    <p>Tap the <strong>Save</strong> button at the bottom of the workout to save all your data. The app saves:</p>
    <ul>
      <li>Every set's weight and reps</li>
      <li>Any exercises you swapped, added, or removed</li>
      <li>Any sets you added or deleted</li>
      <li>Exercise notes</li>
      <li>Your personal records (updated automatically)</li>
    </ul>
    <p>When you come back to this day's workout later, <strong>everything is exactly as you left it</strong> &mdash; including swapped exercises and added sets. Each day's workout is saved independently.</p>
    <div class="tip"><strong>Tip:</strong> If you navigate away without saving, the app will ask if you want to save first, leave without saving, or stay on the page.</div>

    <h3 id="rest-timer">Using the Rest Timer</h3>
    <p>The rest timer helps you track rest periods between sets:</p>
    <ol>
      <li>Go to the <strong>Utilities</strong> tab.</li>
      <li>Find the <strong>Rest Timer</strong> section.</li>
      <li>Set your desired rest time (30s, 60s, 90s, 2min, or custom).</li>
      <li>Tap <strong>Start</strong> to begin the countdown. You'll hear a beep when the rest period is over.</li>
    </ol>
    <p>The timer works in the background &mdash; you can navigate to other parts of the app and the timer keeps running.</p>
  </div>

  <!-- 5. Utilities -->
  <div class="section" id="utilities">
    <h2>5. Utilities</h2>
    <p>The Utilities tab contains tools to help you track and analyze your training.</p>

    <h3 id="personal-records">Personal Records</h3>
    <p>Your PRs are tracked automatically every time you save a workout session. The app records your best reps at every weight for every exercise.</p>
    <ul>
      <li>PRs are grouped by <strong>muscle group</strong> (Chest, Back, Shoulders, etc.).</li>
      <li>Tap a muscle group to expand it and see your exercises.</li>
      <li>Tap an exercise to see your best reps at each weight.</li>
      <li>Each PR shows the <strong>date it was set</strong> &mdash; tap the date to view that workout session in your history.</li>
    </ul>
    <p>Pro users can use the <strong>search bar</strong> at the top to quickly find a specific exercise's PRs.</p>

    <h3 id="one-rep-max">One Rep Max Estimator</h3>
    <p>The 1RM Estimator calculates your estimated one-rep max based on the weight and reps you enter.</p>
    <ol>
      <li>Enter the <strong>weight</strong> you lifted.</li>
      <li>Enter the <strong>number of reps</strong> you completed.</li>
      <li>The app calculates your estimated 1RM using standard formulas.</li>
    </ol>
    <p>This is useful for programming percentages (e.g., "work at 75% of your 1RM").</p>

    <h3 id="rest-timer-util">Rest Timer</h3>
    <p>A dedicated countdown timer for rest periods between sets. Choose from preset times or set a custom duration. The timer beeps when your rest is over.</p>
  </div>

  <!-- 6. Trainer Dashboard -->
  <div class="section" id="trainer-dashboard">
    <h2>6. Client Dashboard (Computer)</h2>
    <p>The Client Dashboard lets you create and manage workouts from a computer. It's available at <a href="${config.APP_URL}/workouts" style="color:#ef4444;text-decoration:none;font-weight:600;">${config.APP_HOST}/workouts</a>.</p>

    <h3 id="trainer-login">Logging In</h3>
    <p>Use the <strong>same email and password</strong> you use in the app. Your workouts are linked to your account &mdash; anything you create on the computer appears in the app under My Workouts.</p>

    <h3 id="trainer-create">Creating Workouts on a Computer</h3>
    <ol>
      <li>Log in at <strong>${config.APP_HOST}/workouts</strong>.</li>
      <li>Click <strong>Create a Workout</strong>.</li>
      <li>Enter a workout name, select or create a program, and add a description.</li>
      <li>Add exercises by searching the exercise library. Each exercise has a set type selector, weight, and reps fields.</li>
      <li>You can add notes to each exercise to provide guidance or tips.</li>
      <li>Click <strong>Save Workout</strong>. The workout immediately appears in your app under My Workouts.</li>
    </ol>

    <h3 id="trainer-edit">Editing Workouts</h3>
    <ol>
      <li>Click <strong>My Workouts</strong> on the Client Dashboard.</li>
      <li>Find the workout you want to edit and click <strong>Edit</strong>.</li>
      <li>Make your changes &mdash; add/remove exercises, change sets/reps/weight, update the name or description.</li>
      <li>Click <strong>Save Changes</strong>. Updates take effect immediately in the app.</li>
    </ol>
    <p>You can also <strong>copy</strong> a workout to create a duplicate, or <strong>delete</strong> a workout entirely.</p>
  </div>

  <!-- 7. Profile & Settings -->
  <div class="section" id="profile">
    <h2>7. Profile &amp; Settings</h2>
    <p>The Profile tab shows your account info, workout history, and settings.</p>
    <ul>
      <li><strong>Body metrics</strong> &mdash; track your height, weight, body fat, and max lifts.</li>
      <li><strong>Workout history</strong> &mdash; scroll through your recent sessions with dates and exercise summaries.</li>
      <li><strong>Change password</strong> &mdash; update your password anytime.</li>
      <li><strong>Plan</strong> &mdash; view your current plan (Free, Pro, or Elite).</li>
    </ul>

    <h3 id="feedback">Sending Feedback</h3>
    <p>We're actively building REPLAB and your feedback matters. To send feedback:</p>
    <ol>
      <li>Go to the <strong>Profile</strong> tab.</li>
      <li>Tap <strong>Send Feedback</strong>.</li>
      <li>Describe the bug, feature idea, or improvement you'd like to see.</li>
      <li>Tap <strong>Submit</strong>. Your feedback goes directly to the development team.</li>
    </ol>

    <h3 id="challenges">Challenges</h3>
    <p>Challenges are limited-time competitions where you can test yourself against other users.</p>
    <ul>
      <li>Go to <strong>Workouts &gt; Challenges</strong>.</li>
      <li>Enter your score (e.g., max pushups in one set).</li>
      <li>View the leaderboard to see how you rank.</li>
      <li>Your latest entry overwrites your previous one. If you enter a lower score, the app will ask if you're sure.</li>
    </ul>
  </div>

  <!-- 8. Tips -->
  <div class="section" id="tips">
    <h2>8. Tips &amp; Best Practices</h2>
    <ul>
      <li><strong>Save often</strong> &mdash; tap Save after each exercise or at the end of your workout. The app will warn you if you try to leave with unsaved changes.</li>
      <li><strong>Use the weight suggestions</strong> &mdash; the app analyzes your recent sessions and suggests when to increase, hold, or decrease weight.</li>
      <li><strong>Check your PRs after each session</strong> &mdash; the Utilities tab updates in real-time. Tap the date on any PR to revisit that workout.</li>
      <li><strong>Create workouts on a computer</strong> &mdash; it's faster to build complex programs on <strong>${config.APP_HOST}/workouts</strong> where you have a full keyboard and larger screen.</li>
      <li><strong>Use the AI generator</strong> &mdash; if you're not sure what to do, let the AI build a workout for you. You can always refine it afterward.</li>
      <li><strong>Send feedback</strong> &mdash; this is an alpha version. If something breaks or you have an idea, tell us. Every piece of feedback gets read.</li>
    </ul>
  </div>

  <div style="text-align:center;margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
    <div class="logo" style="margin-bottom:8px;">REP<span>LAB</span></div>
    <p style="color:rgba(255,255,255,0.3);font-size:12px;">Alpha Version &middot; <a href="${config.APP_URL}" style="color:#ef4444;text-decoration:none;">${config.APP_HOST}</a></p>
  </div>
</div>
</body>
</html>`;
}
