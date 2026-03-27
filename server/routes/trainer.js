import express, { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../dbPool.js';
import db from '../db.js';
import { DASHBOARD_CSS, SIDEBAR_JS } from '../dashboardCSS.js';
import { exerciseCardScript } from '../exerciseCardBuilder.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

// Session management
const trainerSessions = new Map(); // token -> { userId, email, firstName, lastName }

function trainerAuth(req, res, next) {
  const sessionToken = req.cookies?.trainer_session;
  if (sessionToken && trainerSessions.has(sessionToken)) {
    req.trainer = trainerSessions.get(sessionToken);
    return next();
  }
  if (req.headers.accept?.includes('text/html') || req.query.format === 'html') {
    return res.redirect('/trainer/login');
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// CSS is now shared via dashboardCSS.js

function trainerLoginPage(error) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit Trainer — Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${DASHBOARD_CSS}
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 0; }
    .login-card { position: relative; z-index: 1; width: 100%; max-width: 380px; padding: 0 24px; }
    .login-logo { font-size: 36px; font-weight: 900; letter-spacing: 2px; text-align: center; margin-bottom: 8px; }
    .login-logo span { color: #ef4444; }
    .subtitle { text-align: center; color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 32px; }
    .btn-login {
      width: 100%; padding: 14px; border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
      font-family: inherit; cursor: pointer; color: #fff;
      background: linear-gradient(135deg, #DC2626, #EF4444, #F97316);
      background-size: 200% 200%; animation: gradShift 3s ease infinite;
      box-shadow: 0 4px 20px rgba(239,68,68,0.3); transition: all 0.2s;
    }
    .btn-login:hover { box-shadow: 0 6px 30px rgba(239,68,68,0.45); transform: translateY(-1px); }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-logo">WILL<span>FIT</span></div>
    <p class="subtitle">Trainer Dashboard</p>
    <div class="glass" style="padding:28px;">
      ${error ? `<div class="error">${error}</div>` : ''}
      <form method="POST" action="/trainer/login">
        <div class="field">
          <label>Email</label>
          <input type="text" name="identifier" placeholder="Enter your email" required autocomplete="email" />
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" name="password" placeholder="Enter password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-login">Sign In</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

function trainerPage(title, body, trainer) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit Trainer — ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${DASHBOARD_CSS}</style>
</head>
<body>
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:12px 32px;background:linear-gradient(135deg,rgba(20,0,0,0.92),rgba(30,5,5,0.92),rgba(20,0,0,0.92));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(239,68,68,0.2);box-shadow:0 2px 20px rgba(239,68,68,0.08),inset 0 -1px 0 rgba(239,68,68,0.1);">
  <a href="/trainer" style="text-decoration:none;"><div class="logo" style="margin:0;color:#fff;">WILL<span style="color:#ef4444;">FIT</span></div></a>
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:600;">${trainer ? esc(trainer.firstName || trainer.email) : 'Trainer'}</span>
    <a href="/trainer" style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='rgba(255,255,255,0.5)';this.style.background='none'">Home</a>
    <a href="/trainer/logout" style="color:#ef4444;font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'">Logout</a>
  </div>
</nav>
<div style="height:56px;"></div>
<!-- Sidebar -->
<div class="sidebar" id="dashboard-sidebar">
  <div class="sidebar-toggle">
    <button id="sidebar-toggle-btn" onclick="toggleSidebar()" title="Toggle sidebar">
      <svg id="sidebar-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
    </button>
  </div>
  <div class="sidebar-section" onclick="toggleSection('workouts')">
    <span>Workouts</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-workouts">
    <a href="/trainer"${title === 'Dashboard' ? ' class="active"' : ''}>Dashboard</a>
    <a href="/trainer/create-workout"${title === 'Create a Workout' ? ' class="active"' : ''}>Create Workout</a>
    <a href="/trainer/workouts"${title === 'View Current Workouts' ? ' class="active"' : ''}>View Workouts</a>
  </div>
  <div class="sidebar-section" onclick="toggleSection('clients')">
    <span>Clients</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-clients">
    <a href="/trainer/clients"${title === 'My Clients' ? ' class="active"' : ''}>My Clients</a>
  </div>
  <div class="sidebar-section" onclick="toggleSection('resources')">
    <span>Resources</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-resources">
    <a href="/trainer/guide"${title === 'User Guide' ? ' class="active"' : ''}>User Guide</a>
  </div>
</div>
<script>${SIDEBAR_JS}</script>
<div class="main-with-sidebar">
<div class="container">
${body}
</div>
</div>
</body>
</html>`;
}

// GET /trainer/login
router.get('/login', (req, res) => {
  const error = req.query.error || '';
  res.send(trainerLoginPage(error));
});

// POST /trainer/login — authenticate with app credentials
router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.redirect('/trainer/login?error=Email+and+password+are+required');
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, phone, password_hash, first_name, last_name, role, plan FROM users WHERE email = $1 OR phone = $1',
      [identifier.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.redirect('/trainer/login?error=Invalid+credentials');
    }

    const user = rows[0];
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.redirect('/trainer/login?error=Invalid+credentials');
    }

    // Only users with trainer role can access the trainer dashboard
    if (user.role !== 'trainer') {
      return res.redirect('/trainer/login?error=Trainer+access+required.+Apply+in+the+app+to+become+a+trainer.');
    }

    // Log login with geo lookup
    try {
      const loginIp = req.ip === '::1' || req.ip === '127.0.0.1' ? '' : req.ip;
      let city = null, state = null;
      if (loginIp) {
        try {
          const geoRes = await fetch(`http://ip-api.com/json/${loginIp}?fields=city,regionName,status`);
          const geo = await geoRes.json();
          if (geo.status === 'success') { city = geo.city || null; state = geo.regionName || null; }
        } catch {}
      }
      await pool.query(
        'INSERT INTO trainer_login_history (user_id, email, ip, user_agent, city, state) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.id, user.email || user.phone, req.ip, req.headers['user-agent']?.substring(0, 200), city, state]
      );
    } catch {}

    const token = crypto.randomBytes(32).toString('hex');
    trainerSessions.set(token, {
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role || 'client',
      plan: user.plan || 'Free',
    });

    res.cookie('trainer_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.redirect('/trainer');
  } catch (err) {
    console.error('Trainer login error:', err);
    return res.redirect('/trainer/login?error=Something+went+wrong');
  }
});

// GET /trainer/guide — User Manual (public, no auth required)
router.get('/guide', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit — User Guide</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
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
  <a href="https://will-fit.shop" class="back-btn">&larr; Back to WillFit</a>
  <div class="logo">WILL<span>FIT</span></div>
  <h1>User Guide</h1>
  <p class="subtitle">Everything you need to know about using WillFit</p>

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
    <p>Welcome to WillFit. Here's how to get up and running in under a minute:</p>
    <ol>
      <li><strong>Sign up</strong> with your email or phone number and create a password.</li>
      <li><strong>Take the tour</strong> — after signing up, you'll see a quick walkthrough of the app's main features. You can skip it, but it's worth the 30 seconds.</li>
      <li><strong>Browse the Workout Library</strong> — head to the Workouts tab and tap <strong>Browse Workout Library</strong>. Pick a program that matches your goals.</li>
      <li><strong>Begin a Program</strong> — tap <strong>Begin Program</strong> on any program card, choose a start date, and the app will schedule your workouts on the calendar.</li>
      <li><strong>Start training</strong> — go to the Calendar tab, tap today's workout, and start logging your sets.</li>
    </ol>
    <div class="tip"><strong>Tip:</strong> You can also create workouts from a computer at <strong>will-fit.shop/trainer</strong> using the same login credentials.</div>
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
    <p>Any workout you create yourself appears under <strong>My Workouts</strong>. This is your personal library — only you can see these.</p>
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
    <h4>On a Computer (Trainer Dashboard)</h4>
    <p>See the <a href="#trainer-dashboard" style="color:#ef4444;text-decoration:none;">Trainer Dashboard</a> section below.</p>

    <h3 id="begin-program">Adding a Program to Your Calendar</h3>
    <ol>
      <li>Find a program in the Browse Library or My Workouts.</li>
      <li>Tap the <strong>Begin Program</strong> button.</li>
      <li>Choose <strong>Start Today</strong> or <strong>Choose Date</strong> to pick a specific start date.</li>
      <li>The app will assign each workout in the program to consecutive days on your calendar, including rest days.</li>
    </ol>
    <div class="tip"><strong>Tip:</strong> The Begin Program button appears on program cards, the week picker, and inside individual week views — so you can start from anywhere.</div>
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
      <li>To <strong>clear</strong> a day: in the workout picker, tap <strong>Clear — No Workout</strong> at the top of the list.</li>
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
      <li><strong>Set number</strong> — which set you're on</li>
      <li><strong>Set type</strong> — Regular, Warm Up, Drop Set, Super Set, etc. Tap to change.</li>
      <li><strong>Weight</strong> — tap the weight field and enter the weight you're using (in lbs).</li>
      <li><strong>Reps</strong> — tap the reps field and enter how many reps you completed.</li>
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
    <p>When you come back to this day's workout later, <strong>everything is exactly as you left it</strong> — including swapped exercises and added sets. Each day's workout is saved independently.</p>
    <div class="tip"><strong>Tip:</strong> If you navigate away without saving, the app will ask if you want to save first, leave without saving, or stay on the page.</div>

    <h3 id="rest-timer">Using the Rest Timer</h3>
    <p>The rest timer helps you track rest periods between sets:</p>
    <ol>
      <li>Go to the <strong>Utilities</strong> tab.</li>
      <li>Find the <strong>Rest Timer</strong> section.</li>
      <li>Set your desired rest time (30s, 60s, 90s, 2min, or custom).</li>
      <li>Tap <strong>Start</strong> to begin the countdown. You'll hear a beep when the rest period is over.</li>
    </ol>
    <p>The timer works in the background — you can navigate to other parts of the app and the timer keeps running.</p>
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
      <li>Each PR shows the <strong>date it was set</strong> — tap the date to view that workout session in your history.</li>
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
    <h2>6. Trainer Dashboard (Computer)</h2>
    <p>The Trainer Dashboard lets you create and manage workouts from a computer. It's available at <a href="https://will-fit.shop/trainer" style="color:#ef4444;text-decoration:none;font-weight:600;">will-fit.shop/trainer</a>.</p>

    <h3 id="trainer-login">Logging In</h3>
    <p>Use the <strong>same email and password</strong> you use in the app. Your workouts are linked to your account — anything you create on the computer appears in the app under My Workouts.</p>

    <h3 id="trainer-create">Creating Workouts on a Computer</h3>
    <ol>
      <li>Log in at <strong>will-fit.shop/trainer</strong>.</li>
      <li>Click <strong>Create a Workout</strong>.</li>
      <li>Enter a workout name, select or create a program, and add a description.</li>
      <li>Add exercises by searching the exercise library. Each exercise has a set type selector, weight, and reps fields.</li>
      <li>You can add notes to each exercise to provide guidance or tips.</li>
      <li>Click <strong>Save Workout</strong>. The workout immediately appears in your app under My Workouts.</li>
    </ol>

    <h3 id="trainer-edit">Editing Workouts</h3>
    <ol>
      <li>Click <strong>View Current Workouts</strong> on the Trainer Dashboard.</li>
      <li>Find the workout you want to edit and click <strong>Edit</strong>.</li>
      <li>Make your changes — add/remove exercises, change sets/reps/weight, update the name or description.</li>
      <li>Click <strong>Save Changes</strong>. Updates take effect immediately in the app.</li>
    </ol>
    <p>You can also <strong>copy</strong> a workout to create a duplicate, or <strong>delete</strong> a workout entirely.</p>
  </div>

  <!-- 7. Profile & Settings -->
  <div class="section" id="profile">
    <h2>7. Profile &amp; Settings</h2>
    <p>The Profile tab shows your account info, workout history, and settings.</p>
    <ul>
      <li><strong>Body metrics</strong> — track your height, weight, body fat, and max lifts.</li>
      <li><strong>Workout history</strong> — scroll through your recent sessions with dates and exercise summaries.</li>
      <li><strong>Change password</strong> — update your password anytime.</li>
      <li><strong>Plan</strong> — view your current plan (Free, Pro, or Elite).</li>
    </ul>

    <h3 id="feedback">Sending Feedback</h3>
    <p>We're actively building WillFit and your feedback matters. To send feedback:</p>
    <ol>
      <li>Go to the <strong>Profile</strong> tab.</li>
      <li>Tap <strong>Send Feedback</strong>.</li>
      <li>Describe the bug, feature idea, or improvement you'd like to see.</li>
      <li>Tap <strong>Submit</strong>. Your feedback goes directly to the development team.</li>
    </ol>

    <h3 id="challenges">Challenges</h3>
    <p>Challenges are limited-time competitions where you can test yourself against other users.</p>
    <ul>
      <li>Go to <strong>Workouts > Challenges</strong>.</li>
      <li>Enter your score (e.g., max pushups in one set).</li>
      <li>View the leaderboard to see how you rank.</li>
      <li>Your latest entry overwrites your previous one. If you enter a lower score, the app will ask if you're sure.</li>
    </ul>
  </div>

  <!-- 8. Tips -->
  <div class="section" id="tips">
    <h2>8. Tips &amp; Best Practices</h2>
    <ul>
      <li><strong>Save often</strong> — tap Save after each exercise or at the end of your workout. The app will warn you if you try to leave with unsaved changes.</li>
      <li><strong>Use the weight suggestions</strong> — the app analyzes your recent sessions and suggests when to increase, hold, or decrease weight.</li>
      <li><strong>Check your PRs after each session</strong> — the Utilities tab updates in real-time. Tap the date on any PR to revisit that workout.</li>
      <li><strong>Create workouts on a computer</strong> — it's faster to build complex programs on <strong>will-fit.shop/trainer</strong> where you have a full keyboard and larger screen.</li>
      <li><strong>Use the AI generator</strong> — if you're not sure what to do, let the AI build a workout for you. You can always refine it afterward.</li>
      <li><strong>Send feedback</strong> — this is an alpha version. If something breaks or you have an idea, tell us. Every piece of feedback gets read.</li>
    </ul>
  </div>

  <div style="text-align:center;margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06);">
    <div class="logo" style="margin-bottom:8px;">WILL<span>FIT</span></div>
    <p style="color:rgba(255,255,255,0.3);font-size:12px;">Alpha Version &middot; <a href="https://will-fit.shop" style="color:#ef4444;text-decoration:none;">will-fit.shop</a></p>
  </div>
</div>
</body>
</html>`);
});

// GET /trainer/logout
router.get('/logout', (req, res) => {
  const sessionToken = req.cookies?.trainer_session;
  if (sessionToken) {
    trainerSessions.delete(sessionToken);
    res.clearCookie('trainer_session');
  }
  res.redirect('/trainer/login');
});

// GET /trainer — Dashboard home
router.get('/', trainerAuth, (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  const scopeMsg = isAdmin
    ? 'Workouts you create here will appear in the <strong style="color:#ef4444;">Browse Workout Library</strong> for all users.'
    : 'Workouts you create here will appear in your <strong style="color:#ef4444;">My Workouts</strong> section.';

  res.send(trainerPage('Dashboard', `
    <div class="header">
      <h1>Trainer Dashboard${isAdmin ? ' <span style="font-size:14px;background:rgba(239,68,68,0.15);color:#ef4444;padding:4px 10px;border-radius:8px;font-weight:700;vertical-align:middle;margin-left:8px;">ADMIN</span>' : ''}</h1>
      <p>Welcome back, ${esc(req.trainer.firstName || req.trainer.email)}. Manage your workouts and programs.</p>
    </div>
    <div class="glass" style="padding:16px 20px;margin-bottom:24px;border-left:3px solid ${isAdmin ? '#ef4444' : '#3b82f6'};">
      <p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;">${scopeMsg}</p>
    </div>
    <div class="card-grid">
      <a class="card glass" href="/trainer/create-workout">
        <div class="card-icon">➕</div>
        <div class="card-title">Create a Workout</div>
        <div class="card-desc">Build a new workout from scratch. Add exercises, sets, reps, and weights.</div>
      </a>
      <a class="card glass" href="/trainer/workouts">
        <div class="card-icon">📋</div>
        <div class="card-title">View Current Workouts</div>
        <div class="card-desc">Browse and manage your existing programs and workouts.</div>
      </a>
      <a class="card glass" href="/trainer/clients">
        <div class="card-icon">👥</div>
        <div class="card-title">My Clients</div>
        <div class="card-desc">View your client list, check their workout history, and assign programs.</div>
      </a>
      <a class="card glass" href="/trainer/guide">
        <div class="card-icon">📖</div>
        <div class="card-title">User Guide</div>
        <div class="card-desc">Detailed instructions on how to use every feature in WillFit.</div>
      </a>
    </div>
  `, req.trainer));
});

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Clients Page ───
router.get('/clients', trainerAuth, async (req, res) => {
  const isPro = req.trainer.plan === 'Pro' || req.trainer.plan === 'Elite';
  try {
    const { rows: clients } = await pool.query(
      `SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.username, u.plan, u.created_at,
              tc.created_at as assigned_at,
              (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND completed = true) as completed_sessions,
              (SELECT MAX(date) FROM sessions WHERE user_id = u.id AND completed = true) as last_workout
       FROM trainer_clients tc
       JOIN users u ON tc.client_id = u.id
       WHERE tc.trainer_id = $1
       ORDER BY u.first_name, u.last_name`,
      [req.trainer.userId]
    );

    const clientRows = clients.map(c => `
      <tr>
        <td><strong>${esc(c.first_name || '')} ${esc(c.last_name || '')}</strong><br><span style="color:rgba(255,255,255,0.4);font-size:11px">${esc(c.username || c.email || c.phone)}</span></td>
        <td>${c.plan}</td>
        <td>${c.completed_sessions || 0}</td>
        <td>${c.last_workout || '—'}</td>
        <td>${new Date(c.assigned_at).toLocaleDateString()}</td>
        <td>
          <a href="/trainer/clients/${c.id}/history" style="color:#ef4444;text-decoration:none;font-weight:600;font-size:12px">View History</a>
          ${isPro ? `<span style="margin:0 4px;color:rgba(255,255,255,0.2)">|</span><a href="/trainer/clients/${c.id}/create-program" style="color:#3b82f6;text-decoration:none;font-weight:600;font-size:12px">Create Program</a>` : ''}
          <span style="margin:0 4px;color:rgba(255,255,255,0.2)">|</span>
          <form method="POST" action="/trainer/clients/${c.id}/remove" style="display:inline"><button type="submit" style="background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:12px;font-weight:600" onclick="return confirm('Remove this client?')">Remove</button></form>
        </td>
      </tr>
    `).join('');

    res.send(trainerPage('My Clients', `
      <div class="header">
        <h1>My Clients</h1>
        <p>Manage your assigned clients, view their workout history${isPro ? ', and create programs for them' : ''}.</p>
        ${!isPro ? '<p style="color:#f59e0b;font-size:12px;margin-top:8px">⭐ Upgrade to Pro to create and assign workout programs to clients.</p>' : ''}
      </div>

      <div class="glass" style="padding:20px;margin-bottom:24px">
        <h3 style="font-size:14px;font-weight:700;margin-bottom:12px">Add a Client</h3>
        <div style="display:flex;gap:8px">
          <input type="text" id="client-search" placeholder="Search by name, email, or username..." style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#fff;font-size:13px;outline:none" oninput="searchClients(this.value)">
        </div>
        <div id="search-results" style="margin-top:8px"></div>
      </div>

      <div class="glass" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Client</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Plan</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Workouts</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Last Workout</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Assigned</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Actions</th>
            </tr>
          </thead>
          <tbody style="font-size:13px">
            ${clientRows || '<tr><td colspan="6" style="text-align:center;padding:32px;color:rgba(255,255,255,0.3)">No clients yet. Search above to add one.</td></tr>'}
          </tbody>
        </table>
      </div>

      <script>
      let searchTimer;
      function searchClients(q) {
        clearTimeout(searchTimer);
        if (q.length < 2) { document.getElementById('search-results').innerHTML = ''; return; }
        searchTimer = setTimeout(async () => {
          try {
            const res = await fetch('/trainer/api/clients/search?q=' + encodeURIComponent(q));
            const data = await res.json();
            const el = document.getElementById('search-results');
            if (!data.users || data.users.length === 0) {
              el.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:12px;padding:4px">No users found</p>';
              return;
            }
            function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
            el.innerHTML = data.users.map(u => \`
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.03);margin-bottom:4px">
                <div>
                  <span style="color:#fff;font-weight:600;font-size:13px">\${escHtml(u.firstName || '')} \${escHtml(u.lastName || '')}</span>
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;margin-left:8px">\${escHtml(u.email || u.username || '')}</span>
                </div>
                <button onclick="addClient(\${parseInt(u.id)})" style="background:rgba(239,68,68,0.15);color:#ef4444;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Add</button>
              </div>
            \`).join('');
          } catch (err) { console.error(err); }
        }, 300);
      }
      async function addClient(id) {
        try {
          const res = await fetch('/trainer/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: id }),
          });
          if (res.ok) { location.reload(); }
          else { const d = await res.json(); alert(d.error || 'Failed'); }
        } catch (err) { alert('Failed to add client'); }
      }
      </script>
    `, req.trainer));
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// Remove a client (form POST from clients page)
router.post('/clients/:clientId/remove', trainerAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2', [req.trainer.userId, req.params.clientId]);
    res.redirect('/trainer/clients');
  } catch (err) {
    console.error(err);
    res.redirect('/trainer/clients');
  }
});

// Client workout history page
router.get('/clients/:clientId/history', trainerAuth, async (req, res) => {
  const { clientId } = req.params;
  try {
    // Verify ownership
    const { rows: check } = await pool.query(
      'SELECT id FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2',
      [req.trainer.userId, clientId]
    );
    if (check.length === 0) return res.redirect('/trainer/clients');

    const { rows: [client] } = await pool.query(
      'SELECT first_name, last_name, email, username FROM users WHERE id = $1', [clientId]
    );
    if (!client) return res.redirect('/trainer/clients');

    const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email || client.username;

    const { rows: sessions } = await pool.query(
      `SELECT s.id, s.date, s.completed, s.created_at, t.name as template_name,
              (SELECT COUNT(*) FROM session_entries WHERE session_id = s.id) as total_sets
       FROM sessions s
       LEFT JOIN templates t ON s.template_id = t.id
       WHERE s.user_id = $1
       ORDER BY s.date DESC
       LIMIT 100`,
      [clientId]
    );

    const sessionRows = sessions.map(s => `
      <tr>
        <td>${s.date}</td>
        <td>${esc(s.template_name || 'Unknown')}</td>
        <td>${s.total_sets} sets</td>
        <td><span style="color:${s.completed ? '#22c55e' : '#f59e0b'};font-weight:600">${s.completed ? 'Completed' : 'In Progress'}</span></td>
      </tr>
    `).join('');

    res.send(trainerPage('My Clients', `
      <div class="header">
        <p style="margin-bottom:8px"><a href="/trainer/clients" style="color:#ef4444;text-decoration:none;font-size:13px">&larr; Back to Clients</a></p>
        <h1>${esc(clientName)}'s Workout History</h1>
        <p>${sessions.length} recorded sessions</p>
      </div>

      <div class="glass" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Date</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Workout</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Volume</th>
              <th style="padding:12px 16px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px">Status</th>
            </tr>
          </thead>
          <tbody style="font-size:13px">
            ${sessionRows || '<tr><td colspan="4" style="text-align:center;padding:32px;color:rgba(255,255,255,0.3)">No workout sessions yet</td></tr>'}
          </tbody>
        </table>
      </div>
    `, req.trainer));
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// JSON API: search exercises for autocomplete
router.get('/api/exercises', trainerAuth, async (req, res) => {
  try {
    const exercises = await db.getExercises(req.trainer.userId, { search: req.query.q, limit: 20 });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

// JSON API: get muscle groups
router.get('/api/muscle-groups', trainerAuth, async (req, res) => {
  try {
    const groups = await db.getMuscleGroups();
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch muscle groups' });
  }
});

// JSON API: create custom exercise
router.post('/api/exercises', trainerAuth, express.json(), async (req, res) => {
  try {
    const { name, muscleGroup } = req.body;
    if (!name || !muscleGroup) return res.status(400).json({ error: 'Name and muscle group required' });
    const exercise = await db.createExercise(req.trainer.userId, name.trim(), muscleGroup, []);
    res.status(201).json(exercise);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create exercise' });
  }
});

// JSON API: create program
router.post('/api/programs', trainerAuth, express.json(), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Program name is required' });
    const isAdmin = req.trainer.isAdmin || false;
    const userId = isAdmin ? null : req.trainer.userId;
    const { rows: [program] } = await pool.query(
      'INSERT INTO programs (user_id, name, description) VALUES ($1, $2, $3) RETURNING id, name',
      [userId, name.trim(), description?.trim() || '']
    );
    res.status(201).json(program);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A program with that name already exists' });
    res.status(500).json({ error: 'Failed to create program' });
  }
});

// GET /trainer/create-workout — Redirect to React app with JWT bridge
router.get('/create-workout', trainerAuth, async (req, res) => {
  try {
    const user = await db.findUserById(req.trainer.userId);
    if (!user) return res.redirect('/trainer?error=User+not+found');
    const jwt = generateToken(user);
    const programId = req.query.programId;
    let target = '/clientworkouts/create?from=trainer';
    if (programId) target += '&programId=' + programId;
    return res.redirect('/?authToken=' + encodeURIComponent(jwt) + '&redirect=' + encodeURIComponent(target));
  } catch (err) {
    console.error('Bridge error:', err);
    return res.redirect('/trainer?error=Failed+to+open+workout+builder');
  }
});

// OLD create-workout form (kept for reference, unreachable)
router.get('/create-workout-legacy', trainerAuth, async (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  const msg = req.query.msg || '';
  const error = req.query.error || '';

  // Get programs for the dropdown
  const { rows: programs } = await pool.query(
    isAdmin
      ? 'SELECT id, name FROM programs WHERE user_id IS NULL ORDER BY name'
      : 'SELECT id, name FROM programs WHERE user_id = $1 ORDER BY name',
    isAdmin ? [] : [req.trainer.userId]
  );

  // Get muscle groups for custom exercise modal
  const muscleGroups = await db.getMuscleGroups();

  res.send(trainerPage('Create a Workout', `
    <div style="margin-bottom:20px;">
      <a href="/trainer" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;font-weight:600;">
        <span style="margin-right:4px;">&larr;</span> Back to Dashboard
      </a>
    </div>
    <div class="header">
      <h1>Create a Workout</h1>
      <p>Add exercises, sets, reps, and weights. ${isAdmin ? 'This workout will be added to the Browse Workout Library.' : 'This workout will appear in your My Workouts.'}</p>
    </div>
    ${msg ? `<div class="glass" style="padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;"><p style="color:#4ade80;font-size:13px;">${esc(msg)}</p></div>` : ''}
    ${error ? `<div class="glass" style="padding:12px 16px;border-left:3px solid #ef4444;margin-bottom:20px;"><p style="color:#f87171;font-size:13px;">${esc(error)}</p></div>` : ''}
    <form method="POST" action="/trainer/create-workout" id="workout-form">
      <div class="glass" style="padding:24px;border-radius:16px;margin-bottom:20px;overflow:visible;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <label>Workout Name</label>
            <input type="text" name="workoutName" placeholder="e.g. Upper Body A" required
              style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
          </div>
          <div style="flex:1;min-width:200px;position:relative;">
            <label>Program</label>
            <input type="hidden" name="programId" id="program-value" value="" />
            <button type="button" id="program-btn" onclick="toggleProgramDropdown()"
              style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
              <span id="program-label">— No Program —</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
            </button>
            <div id="program-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:200;margin-top:4px;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.6);max-height:280px;overflow-y:auto;">
              <div style="padding:4px;">
                <button type="button" onclick="selectProgram('','— No Program —')" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:rgba(255,255,255,0.5);font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;transition:background 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='none'">— No Program —</button>
                ${programs.map(p => `<button type="button" onclick="selectProgram('${p.id}','${esc(p.name).replace(/'/g, "\\'")}')" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;transition:background 0.1s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='none'">${esc(p.name)}</button>`).join('')}
                <div style="border-top:1px solid rgba(255,255,255,0.08);margin:4px 0;"></div>
                <button type="button" onclick="document.getElementById('program-dropdown').style.display='none';openNewProgramModal()" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#ef4444;font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;font-weight:600;transition:background 0.1s;" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='none'">+ New Program</button>
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top:16px;">
          <label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
          <input type="text" name="description" placeholder="e.g. Chest, Shoulders, Triceps"
            style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
      </div>

      <div id="exercises-container"></div>

      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <button type="button" onclick="addExercise()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;">
          + Add Exercise
        </button>
        <button type="button" onclick="addSectionHeader()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;border-color:rgba(255,255,255,0.15);">
          + Add Section Header
        </button>
      </div>

      <button type="submit" class="btn" style="width:100%;padding:14px;font-size:15px;margin:0;">
        Save Workout
      </button>
    </form>

    <!-- Set Type Picker Modal -->
    <div id="settype-modal" style="display:none;position:fixed;inset:0;z-index:9998;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);" onclick="if(event.target===this)this.style.display='none'">
      <div style="padding:16px;max-width:300px;width:85%;border-radius:16px;background:rgba(25,25,25,0.98);border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.8);">
        <h3 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:12px;">Set Type</h3>
        <div id="settype-options"></div>
      </div>
    </div>

    <!-- Custom Exercise Modal -->
    <div id="custom-ex-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);" onclick="if(event.target===this)this.style.display='none'">
      <div class="glass" style="padding:24px;max-width:400px;width:90%;border-radius:16px;">
        <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px;">Add Custom Exercise</h3>
        <div style="margin-bottom:12px;">
          <label>Exercise Name</label>
          <input type="text" id="custom-ex-name" placeholder="e.g. Cable Lateral Raise"
            style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:16px;">
          <label>Muscle Group</label>
          <select id="custom-ex-muscle" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;-webkit-appearance:none;">
            ${muscleGroups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('')}
          </select>
        </div>
        <button type="button" onclick="saveCustomExercise()" class="btn" style="margin:0;width:100%;padding:12px;font-size:14px;">Add Exercise</button>
      </div>
    </div>

    <!-- New Program Modal -->
    <div id="new-program-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);" onclick="if(event.target===this)this.style.display='none'">
      <div class="glass" style="padding:24px;max-width:400px;width:90%;border-radius:16px;">
        <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px;">Create New Program</h3>
        <div style="margin-bottom:12px;">
          <label>Program Name</label>
          <input type="text" id="new-program-name" placeholder="e.g. 4-Week Strength Program"
            style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:16px;">
          <label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
          <input type="text" id="new-program-desc" placeholder="e.g. Progressive overload focused"
            style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div id="new-program-error" style="display:none;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px 14px;font-size:13px;color:#f87171;margin-bottom:12px;text-align:center;"></div>
        <div style="display:flex;gap:8px;">
          <button type="button" onclick="document.getElementById('new-program-modal').style.display='none'" class="btn-ghost" style="margin:0;flex:1;text-align:center;padding:12px;font-size:14px;">Cancel</button>
          <button type="button" onclick="saveNewProgram()" class="btn" style="margin:0;flex:1;padding:12px;font-size:14px;">Create Program</button>
        </div>
      </div>
    </div>

    <script>
      function toggleProgramDropdown() {
        const dd = document.getElementById('program-dropdown');
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
      }
      function selectProgram(id, name) {
        document.getElementById('program-value').value = id;
        document.getElementById('program-label').textContent = name;
        document.getElementById('program-btn').style.color = id ? '#fff' : 'rgba(255,255,255,0.5)';
        document.getElementById('program-dropdown').style.display = 'none';
      }
      document.addEventListener('click', function(e) {
        if (!e.target.closest('#program-btn') && !e.target.closest('#program-dropdown')) {
          document.getElementById('program-dropdown').style.display = 'none';
        }
      });

      function openNewProgramModal() {
        document.getElementById('new-program-name').value = '';
        document.getElementById('new-program-desc').value = '';
        document.getElementById('new-program-error').style.display = 'none';
        document.getElementById('new-program-modal').style.display = 'flex';
        setTimeout(() => document.getElementById('new-program-name').focus(), 100);
      }

      async function saveNewProgram() {
        const name = document.getElementById('new-program-name').value.trim();
        const desc = document.getElementById('new-program-desc').value.trim();
        const errorDiv = document.getElementById('new-program-error');
        if (!name) {
          errorDiv.textContent = 'Program name is required';
          errorDiv.style.display = 'block';
          return;
        }
        errorDiv.style.display = 'none';
        try {
          const resp = await fetch('/trainer/api/programs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc }),
          });
          const data = await resp.json();
          if (!resp.ok) {
            errorDiv.textContent = data.error || 'Failed to create program';
            errorDiv.style.display = 'block';
            return;
          }
          // Add the new program to the dropdown and select it
          const dd = document.getElementById('program-dropdown').querySelector('div');
          const separator = dd.querySelector('div[style*="border-top"]');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.onclick = function() { selectProgram(data.id, data.name); };
          btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;transition:background 0.1s;';
          btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
          btn.onmouseout = function() { this.style.background = 'none'; };
          btn.textContent = data.name;
          dd.insertBefore(btn, separator);
          selectProgram(data.id, data.name);
          document.getElementById('new-program-modal').style.display = 'none';
        } catch (err) {
          errorDiv.textContent = 'Something went wrong';
          errorDiv.style.display = 'block';
        }
      }

      ${exerciseCardScript('/trainer/api')}

      addExercise();

      // Validate and AJAX submit — stay on page after save
      document.getElementById('workout-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var form = this;
        var cards = document.querySelectorAll('[id^="exercise-"]');
        var invalid = [];
        cards.forEach(function(card) {
          var idx = card.id.replace('exercise-', '');
          var input = document.getElementById('ex-search-' + idx);
          if (input && input.value.trim() && !validatedExercises[idx]) {
            invalid.push(input.value.trim());
            input.style.borderBottom = '2px solid #ef4444';
          }
        });
        if (invalid.length > 0) {
          alert('Please select exercises from the library or add them as custom exercises:\\n\\n' + invalid.join('\\n'));
          return;
        }
        var submitBtn = form.querySelector('[type="submit"]');
        var origText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) })
          .then(function() {
            var existing = document.getElementById('save-msg');
            if (existing) existing.remove();
            var msg = document.createElement('div');
            msg.id = 'save-msg';
            msg.className = 'glass';
            msg.style.cssText = 'padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;';
            msg.innerHTML = '<p style="color:#4ade80;font-size:13px;">Workout saved successfully</p>';
            form.parentNode.insertBefore(msg, form);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(function() { if (msg.parentNode) msg.remove(); }, 4000);
          })
          .catch(function() { alert('Failed to save. Please try again.'); })
          .finally(function() { submitBtn.textContent = origText; submitBtn.disabled = false; });
      });
    </script>
  `, req.trainer));
});

// GET /trainer/workouts — View current workouts
router.get('/workouts', trainerAuth, async (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  try {
    const { rows: programs } = await pool.query(
      isAdmin
        ? 'SELECT id, name, description FROM programs WHERE user_id IS NULL ORDER BY name'
        : 'SELECT id, name, description FROM programs WHERE user_id = $1 ORDER BY name',
      isAdmin ? [] : [req.trainer.userId]
    );

    let content = '';
    if (programs.length === 0) {
      content = '<div class="glass" style="padding:40px;text-align:center;"><p style="color:rgba(255,255,255,0.4);font-size:14px;">No programs yet. <a href="/trainer/create-workout" style="color:#ef4444;text-decoration:none;font-weight:600;">Create your first workout</a></p></div>';
    } else {
      for (const program of programs) {
        const { rows: templates } = await pool.query(
          'SELECT t.id, t.name, t.description, t.is_rest, t.sort_order, ' +
          '(SELECT COUNT(*) FROM template_exercises te WHERE te.template_id = t.id) AS exercise_count ' +
          'FROM templates t WHERE t.program_id = $1 ORDER BY t.sort_order',
          [program.id]
        );

        const workoutRows = templates.map((t, i) => {
          const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
          if (t.is_rest) {
            return '<tr style="' + rowBg + '">' +
              '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.3);font-style:italic;">' +
                '<span style="display:inline-flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>Rest Day</span>' +
              '</td><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.2);">—</td>' +
              '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.2);">—</td>' +
              '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>';
          }
          return '<tr style="' + rowBg + 'transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'' + (i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent') + '\'">' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
              '<div style="font-weight:700;color:#fff;font-size:14px;">' + esc(t.name) + '</div>' +
            '</td>' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + (t.description ? esc(t.description) : '<span style="color:rgba(255,255,255,0.2);">—</span>') + '</td>' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
              '<span style="display:inline-block;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.6);font-weight:600;">' + t.exercise_count + ' exercises</span>' +
            '</td>' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;white-space:nowrap;">' +
              '<a href="/trainer/edit-workout/' + t.id + '" style="color:#ef4444;text-decoration:none;font-size:11px;font-weight:600;padding:6px 10px;border-radius:7px;border:1px solid rgba(239,68,68,0.3);margin-right:4px;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'none\'">Edit</a>' +
              '<a href="/trainer/copy-workout/' + t.id + '" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:11px;font-weight:600;padding:6px 10px;border-radius:7px;border:1px solid rgba(255,255,255,0.1);margin-right:4px;" onmouseover="this.style.color=\'#3b82f6\';this.style.borderColor=\'rgba(59,130,246,0.3)\';this.style.background=\'rgba(59,130,246,0.08)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.5)\';this.style.borderColor=\'rgba(255,255,255,0.1)\';this.style.background=\'none\'">Copy</a>' +
              '<a href="/trainer/delete-workout/' + t.id + '" onclick="return confirm(\'Delete this workout and all its exercises? This cannot be undone.\')" style="color:rgba(255,255,255,0.3);text-decoration:none;font-size:11px;font-weight:600;padding:6px 10px;border-radius:7px;border:1px solid rgba(255,255,255,0.08);" onmouseover="this.style.color=\'#ef4444\';this.style.borderColor=\'rgba(239,68,68,0.3)\';this.style.background=\'rgba(239,68,68,0.08)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.3)\';this.style.borderColor=\'rgba(255,255,255,0.08)\';this.style.background=\'none\'">Delete</a>' +
            '</td>' +
          '</tr>';
        }).join('');

        const nonRest = templates.filter(t => !t.is_rest).length;
        const totalExercises = templates.reduce((s, t) => s + (Number(t.exercise_count) || 0), 0);
        content += '<div class="glass" style="border-radius:16px;overflow:hidden;margin-bottom:24px;">' +
          '<div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">' +
            '<div>' +
              '<h3 style="font-size:18px;font-weight:800;color:#fff;margin:0;letter-spacing:-0.3px;">' + esc(program.name) + '</h3>' +
              '<p style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;">' +
                nonRest + ' workout' + (nonRest !== 1 ? 's' : '') +
                ' &middot; ' + totalExercises + ' total exercises' +
                (program.description ? ' &middot; ' + esc(program.description) : '') +
              '</p>' +
            '</div>' +
            '<div style="display:flex;gap:6px;">' +
              '<span style="padding:5px 12px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">' + templates.length + ' days</span>' +
            '</div>' +
          '</div>' +
          (templates.length > 0
            ? '<div class="table-wrap"><table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr>' +
                  '<th style="padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);">Workout</th>' +
                  '<th style="padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);">Description</th>' +
                  '<th style="padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);">Exercises</th>' +
                  '<th style="padding:12px 20px;width:90px;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);"></th>' +
                '</tr></thead>' +
                '<tbody>' + workoutRows + '</tbody>' +
              '</table></div>'
            : '<div style="padding:24px;text-align:center;"><p style="color:rgba(255,255,255,0.3);font-size:13px;">No workouts in this program yet.</p></div>'
          ) +
        '</div>';
      }
    }

    res.send(trainerPage('View Current Workouts', '<div style="margin-bottom:20px;">' +
      '<a href="/trainer" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;font-weight:600;">' +
        '<span style="margin-right:4px;">&larr;</span> Back to Dashboard' +
      '</a>' +
    '</div>' +
    '<div class="header">' +
      '<h1>Current Workouts</h1>' +
      '<p>' + programs.length + ' program' + (programs.length !== 1 ? 's' : '') + ' &middot; ' + (isAdmin ? 'Browse Workout Library' : 'My Workouts') + '</p>' +
    '</div>' +
    '<a href="/trainer/create-workout" class="btn" style="margin-bottom:24px;">+ Create New Workout</a>' +
    content, req.trainer));
  } catch (err) {
    console.error('View workouts error:', err);
    res.status(500).send(trainerPage('Error', '<p style="color:#f87171;">Failed to load workouts.</p>', req.trainer));
  }
});

// POST /trainer/create-workout — Save the workout
router.post('/create-workout', trainerAuth, express.urlencoded({ extended: true }), async (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  const { workoutName, description, programId, exercises } = req.body;

  if (!workoutName?.trim()) {
    return res.redirect('/trainer/create-workout?error=Workout+name+is+required');
  }

  try {
    // If no program selected, find or create a default one
    let finalProgramId = programId ? Number(programId) : null;
    if (!finalProgramId) {
      const programName = isAdmin ? 'Trainer Workouts' : 'My Workouts';
      const userId = isAdmin ? null : req.trainer.userId;
      const { rows: existing } = await pool.query(
        userId
          ? 'SELECT id FROM programs WHERE name = $1 AND user_id = $2'
          : 'SELECT id FROM programs WHERE name = $1 AND user_id IS NULL',
        userId ? [programName, userId] : [programName]
      );
      if (existing.length > 0) {
        finalProgramId = existing[0].id;
      } else {
        const { rows: [newProg] } = await pool.query(
          'INSERT INTO programs (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
          [userId, programName, '']
        );
        finalProgramId = newProg.id;
      }
    }

    const userId = isAdmin ? null : req.trainer.userId;

    // Get current max sort_order
    const { rows: sortRows } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM templates WHERE program_id = $1',
      [finalProgramId]
    );
    const sortOrder = sortRows[0].next_sort;

    // Create template
    const { rows: [tmpl] } = await pool.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING id',
      [userId, finalProgramId, workoutName.trim(), description?.trim() || '', sortOrder]
    );

    // Insert exercises and sets (including section headers)
    if (exercises && typeof exercises === 'object') {
      const exArray = Array.isArray(exercises) ? exercises : Object.values(exercises);
      let exSortOrder = 0;
      for (const ex of exArray) {
        if (!ex?.name?.trim()) continue;
        if (ex.isSectionHeader === '1') {
          await pool.query(
            'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [tmpl.id, ex.name.trim(), 'straight', 1, 0, 0, exSortOrder, true, ex.sectionNotes?.trim() || '']
          );
        } else {
          const setType = ex.setType || 'straight';
          const sets = ex.sets ? (Array.isArray(ex.sets) ? ex.sets : Object.values(ex.sets)) : [];
          let setNum = 1;
          for (const set of sets) {
            if (!set) continue;
            await pool.query(
              'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [tmpl.id, ex.name.trim(), setType, setNum++, parseInt(set.reps) || 10, parseInt(set.weight) || 0, exSortOrder]
            );
          }
        }
        exSortOrder++;
      }
    }

    res.redirect('/trainer/create-workout?msg=Workout+"' + encodeURIComponent(workoutName.trim()) + '"+created+successfully');
  } catch (err) {
    console.error('Create workout error:', err);
    res.redirect('/trainer/create-workout?error=Failed+to+create+workout');
  }
});

// GET /trainer/edit-workout/:id — Redirect to React app with JWT bridge
router.get('/edit-workout/:id', trainerAuth, async (req, res) => {
  try {
    const user = await db.findUserById(req.trainer.userId);
    if (!user) return res.redirect('/trainer?error=User+not+found');
    const jwt = generateToken(user);
    const target = '/clientworkouts/edit/' + req.params.id + '?from=trainer';
    return res.redirect('/?authToken=' + encodeURIComponent(jwt) + '&redirect=' + encodeURIComponent(target));
  } catch (err) {
    console.error('Bridge error:', err);
    return res.redirect('/trainer?error=Failed+to+open+workout+editor');
  }
});

// OLD edit-workout form (kept for reference, unreachable)
router.get('/edit-workout-legacy/:id', trainerAuth, async (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  const templateId = Number(req.params.id);
  const msg = req.query.msg || '';
  const error = req.query.error || '';

  try {
    // Load the template
    const { rows: tmplRows } = await pool.query(
      'SELECT t.*, p.name AS program_name FROM templates t LEFT JOIN programs p ON p.id = t.program_id WHERE t.id = $1',
      [templateId]
    );
    if (!tmplRows[0]) return res.redirect('/trainer/workouts');
    const tmpl = tmplRows[0];

    // Verify ownership
    if (!isAdmin && tmpl.user_id !== req.trainer.userId) return res.redirect('/trainer/workouts');

    // Load exercises (including section headers)
    const { rows: exercises } = await pool.query(
      'SELECT name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number',
      [templateId]
    );

    // Group by exercise
    const exerciseMap = new Map();
    for (const ex of exercises) {
      if (ex.is_section_header) {
        exerciseMap.set(ex.sort_order, { name: ex.name, isSectionHeader: true, sectionNotes: ex.section_notes || '' });
        continue;
      }
      if (!exerciseMap.has(ex.sort_order)) {
        exerciseMap.set(ex.sort_order, { name: ex.name, setType: ex.set_type || 'straight', sets: [] });
      }
      exerciseMap.get(ex.sort_order).sets.push({ reps: ex.planned_reps, weight: Number(ex.suggested_weight) });
    }
    const exerciseList = [...exerciseMap.values()];

    // Load programs for dropdown
    const { rows: programs } = await pool.query(
      isAdmin
        ? 'SELECT id, name FROM programs WHERE user_id IS NULL ORDER BY name'
        : 'SELECT id, name FROM programs WHERE user_id = $1 ORDER BY name',
      isAdmin ? [] : [req.trainer.userId]
    );
    const muscleGroups = await db.getMuscleGroups();
    const apiBase = '/trainer/api';

    res.send(trainerPage('Edit Workout', `
    <div style="margin-bottom:20px;">
      <a href="/trainer/workouts" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;font-weight:600;">
        <span style="margin-right:4px;">&larr;</span> Back to Workouts
      </a>
    </div>
    <div class="header">
      <h1>Edit Workout</h1>
      <p>Editing <strong style="color:#fff;">${esc(tmpl.name)}</strong>${tmpl.program_name ? ' in ' + esc(tmpl.program_name) : ''}</p>
    </div>
    ${msg ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;"><p style="color:#4ade80;font-size:13px;">' + esc(msg) + '</p></div>' : ''}
    ${error ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #ef4444;margin-bottom:20px;"><p style="color:#f87171;font-size:13px;">' + esc(error) + '</p></div>' : ''}
    <form method="POST" action="/trainer/edit-workout/${templateId}">
      <div class="glass" style="padding:24px;border-radius:16px;margin-bottom:20px;overflow:visible;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <label>Workout Name</label>
            <input type="text" name="workoutName" value="${esc(tmpl.name)}" required style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
          </div>
          <div style="flex:1;min-width:200px;">
            <label>Program</label>
            <select name="programId" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;">
              <option value="">— No Program —</option>
              ${programs.map(p => '<option value="' + p.id + '"' + (p.id === tmpl.program_id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('')}
            </select>
          </div>
        </div>
        <div style="margin-top:16px;">
          <label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
          <input type="text" name="description" value="${esc(tmpl.description || '')}" placeholder="e.g. Chest, Shoulders, Triceps" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
      </div>
      <div id="exercises-container"></div>
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <button type="button" onclick="addExercise()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;">+ Add Exercise</button>
        <button type="button" onclick="addSectionHeader()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;border-color:rgba(255,255,255,0.15);">+ Add Section Header</button>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="submit" class="btn" style="flex:1;padding:14px;font-size:15px;margin:0;">Save Changes</button>
        <a href="/trainer/workouts" class="btn-ghost" style="flex:none;padding:14px 24px;margin:0;text-align:center;font-size:15px;">Cancel</a>
      </div>
    </form>

    <!-- Set Type Picker Modal -->
    <div id="settype-modal" style="display:none;position:fixed;inset:0;z-index:9998;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);" onclick="if(event.target===this)this.style.display='none'">
      <div style="padding:16px;max-width:300px;width:85%;border-radius:16px;background:rgba(25,25,25,0.98);border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.8);">
        <h3 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:12px;">Set Type</h3>
        <div id="settype-options"></div>
      </div>
    </div>

    <!-- Custom Exercise Modal -->
    <div id="custom-ex-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);" onclick="if(event.target===this)this.style.display='none'">
      <div class="glass" style="padding:24px;max-width:400px;width:90%;border-radius:16px;">
        <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px;">Add Custom Exercise</h3>
        <div style="margin-bottom:12px;"><label>Exercise Name</label>
          <input type="text" id="custom-ex-name" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:16px;"><label>Muscle Group</label>
          <select id="custom-ex-muscle" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
            ${muscleGroups.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('')}
          </select>
        </div>
        <button type="button" onclick="saveCustomExercise()" class="btn" style="margin:0;width:100%;padding:12px;">Add Exercise</button>
      </div>
    </div>

    <script>
      var EXISTING = ${JSON.stringify(exerciseList)};

      ${exerciseCardScript(apiBase)}

      // Load existing exercises (including section headers)
      EXISTING.forEach(function(ex) {
        if (ex.isSectionHeader) { addSectionHeader(ex); }
        else { addExercise(ex); }
      });
      if (EXISTING.length === 0) addExercise();

      // AJAX form submit — stay on page after save
      document.querySelector('form').addEventListener('submit', function(e) {
        e.preventDefault();
        var form = this;
        var submitBtn = form.querySelector('[type="submit"]');
        var origText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) })
          .then(function() {
            var existing = document.getElementById('save-msg');
            if (existing) existing.remove();
            var msg = document.createElement('div');
            msg.id = 'save-msg';
            msg.className = 'glass';
            msg.style.cssText = 'padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;';
            msg.innerHTML = '<p style="color:#4ade80;font-size:13px;">Changes saved successfully</p>';
            form.parentNode.insertBefore(msg, form);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(function() { if (msg.parentNode) msg.remove(); }, 4000);
          })
          .catch(function() { alert('Failed to save. Please try again.'); })
          .finally(function() { submitBtn.textContent = origText; submitBtn.disabled = false; });
      });
    </script>
    `, req.trainer));
  } catch (err) {
    console.error('Edit workout error:', err);
    res.redirect('/trainer/workouts');
  }
});

// POST /trainer/edit-workout/:id — Save edited workout
router.post('/edit-workout/:id', trainerAuth, express.urlencoded({ extended: true }), async (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  const templateId = Number(req.params.id);
  const { workoutName, description, programId, exercises } = req.body;

  if (!workoutName?.trim()) return res.redirect('/trainer/edit-workout/' + templateId + '?error=Workout+name+is+required');

  try {
    // Verify ownership
    const { rows: tmplRows } = await pool.query('SELECT user_id, program_id FROM templates WHERE id = $1', [templateId]);
    if (!tmplRows[0]) return res.redirect('/trainer/workouts');
    if (!isAdmin && tmplRows[0].user_id !== req.trainer.userId) return res.redirect('/trainer/workouts');

    // Update template
    const newProgramId = programId ? Number(programId) : tmplRows[0].program_id;
    await pool.query(
      'UPDATE templates SET name = $1, description = $2, program_id = $3 WHERE id = $4',
      [workoutName.trim(), description?.trim() || '', newProgramId, templateId]
    );

    // Delete old exercises and insert new ones (including section headers)
    await pool.query('DELETE FROM template_exercises WHERE template_id = $1', [templateId]);

    if (exercises && typeof exercises === 'object') {
      const exArray = Array.isArray(exercises) ? exercises : Object.values(exercises);
      let exSort = 0;
      for (const ex of exArray) {
        if (!ex?.name?.trim()) continue;
        if (ex.isSectionHeader === '1') {
          await pool.query(
            'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [templateId, ex.name.trim(), 'straight', 1, 0, 0, exSort, true, ex.sectionNotes?.trim() || '']
          );
        } else {
          const setType = ex.setType || 'straight';
          const sets = ex.sets ? (Array.isArray(ex.sets) ? ex.sets : Object.values(ex.sets)) : [];
          let setNum = 1;
          for (const set of sets) {
            if (!set) continue;
            await pool.query(
              'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [templateId, ex.name.trim(), setType, setNum++, parseInt(set.reps) || 10, parseInt(set.weight) || 0, exSort]
            );
          }
        }
        exSort++;
      }
    }

    res.redirect('/trainer/edit-workout/' + templateId + '?msg=Workout+updated+successfully');
  } catch (err) {
    console.error('Save edit error:', err);
    res.redirect('/trainer/edit-workout/' + templateId + '?error=Failed+to+save+changes');
  }
});

// GET /trainer/delete-workout/:id — Delete workout
router.get('/delete-workout/:id', trainerAuth, async (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  try {
    const { rows } = await pool.query('SELECT user_id FROM templates WHERE id = $1', [Number(req.params.id)]);
    if (rows[0] && (isAdmin || rows[0].user_id === req.trainer.userId)) {
      await pool.query('DELETE FROM templates WHERE id = $1', [Number(req.params.id)]);
    }
    res.redirect('/trainer/workouts');
  } catch (err) { console.error(err); res.redirect('/trainer/workouts'); }
});

// GET /trainer/copy-workout/:id — Duplicate workout
router.get('/copy-workout/:id', trainerAuth, async (req, res) => {
  const isAdmin = req.trainer.isAdmin || false;
  const templateId = Number(req.params.id);
  try {
    const { rows: tmplRows } = await pool.query('SELECT * FROM templates WHERE id = $1', [templateId]);
    if (!tmplRows[0]) return res.redirect('/trainer/workouts');
    const tmpl = tmplRows[0];
    if (!isAdmin && tmpl.user_id !== req.trainer.userId) return res.redirect('/trainer/workouts');

    // Get max sort order
    const { rows: sortRows } = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM templates WHERE program_id = $1', [tmpl.program_id]);

    // Create copy
    const { rows: [newTmpl] } = await pool.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [tmpl.user_id, tmpl.program_id, tmpl.name + ' (Copy)', tmpl.description, tmpl.is_rest, sortRows[0].next_sort]
    );

    // Copy exercises
    const { rows: exercises } = await pool.query(
      'SELECT name, set_type, set_number, planned_reps, suggested_weight, sort_order FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number',
      [templateId]
    );
    for (const ex of exercises) {
      await pool.query(
        'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [newTmpl.id, ex.name, ex.set_type, ex.set_number, ex.planned_reps, ex.suggested_weight, ex.sort_order]
      );
    }
    res.redirect('/trainer/workouts');
  } catch (err) { console.error(err); res.redirect('/trainer/workouts'); }
});

// ─── Trainer Client Management API ───

// Helper: check if trainer has Pro+ plan (required for creating/assigning programs)
function requireProPlan(session) {
  return session.plan === 'Pro' || session.plan === 'Elite';
}

// List trainer's assigned clients
router.get('/api/clients', trainerAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.username, u.plan, u.created_at,
              tc.created_at as assigned_at
       FROM trainer_clients tc
       JOIN users u ON tc.client_id = u.id
       WHERE tc.trainer_id = $1
       ORDER BY u.first_name, u.last_name`,
      [req.trainer.userId]
    );
    res.json({ clients: rows.map(u => ({
      id: u.id, email: u.email, phone: u.phone, firstName: u.first_name, lastName: u.last_name,
      username: u.username, plan: u.plan, createdAt: u.created_at, assignedAt: u.assigned_at,
    })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users to add as clients
router.get('/api/clients/search', trainerAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q || q.length < 2) return res.json({ users: [] });
    const { rows } = await pool.query(
      `SELECT id, email, phone, first_name, last_name, username FROM users
       WHERE role = 'client' AND (
         LOWER(email) LIKE $1 OR LOWER(username) LIKE $1
         OR LOWER(first_name || ' ' || last_name) LIKE $1
       )
       AND id NOT IN (SELECT client_id FROM trainer_clients WHERE trainer_id = $2)
       LIMIT 20`,
      [`%${q}%`, req.trainer.userId]
    );
    res.json({ users: rows.map(u => ({
      id: u.id, email: u.email, phone: u.phone, firstName: u.first_name, lastName: u.last_name, username: u.username,
    })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign a client to this trainer
router.post('/api/clients', trainerAuth, express.json(), async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    // Verify client exists and is not already a trainer
    const { rows: userRows } = await pool.query("SELECT id, role FROM users WHERE id = $1", [clientId]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (userRows[0].role === 'trainer') return res.status(400).json({ error: 'Cannot assign a trainer as a client' });

    await pool.query(
      'INSERT INTO trainer_clients (trainer_id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.trainer.userId, clientId]
    );
    res.status(201).json({ message: 'Client assigned' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove a client from this trainer
router.delete('/api/clients/:clientId', trainerAuth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2',
      [req.trainer.userId, req.params.clientId]
    );
    res.json({ message: 'Client removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View a client's workout history (all trainers can do this)
router.get('/api/clients/:clientId/history', trainerAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    // Verify this client is assigned to this trainer
    const { rows: check } = await pool.query(
      'SELECT id FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2',
      [req.trainer.userId, clientId]
    );
    if (check.length === 0) return res.status(403).json({ error: 'Not your client' });

    const { rows: sessions } = await pool.query(
      `SELECT s.id, s.date, s.completed, s.created_at, t.name as template_name
       FROM sessions s
       LEFT JOIN templates t ON s.template_id = t.id
       WHERE s.user_id = $1
       ORDER BY s.date DESC
       LIMIT 50`,
      [clientId]
    );

    res.json({ sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View a client's specific session details
router.get('/api/clients/:clientId/sessions/:sessionId', trainerAuth, async (req, res) => {
  try {
    const { clientId, sessionId } = req.params;
    // Verify this client is assigned to this trainer
    const { rows: check } = await pool.query(
      'SELECT id FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2',
      [req.trainer.userId, clientId]
    );
    if (check.length === 0) return res.status(403).json({ error: 'Not your client' });

    const { rows: session } = await pool.query(
      `SELECT s.*, t.name as template_name FROM sessions s
       LEFT JOIN templates t ON s.template_id = t.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sessionId, clientId]
    );
    if (session.length === 0) return res.status(404).json({ error: 'Session not found' });

    const { rows: entries } = await pool.query(
      'SELECT * FROM session_entries WHERE session_id = $1 ORDER BY exercise_name, set_number',
      [sessionId]
    );

    res.json({ session: session[0], entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a program and assign it to a client (Pro+ only)
router.post('/api/clients/:clientId/programs', trainerAuth, express.json(), async (req, res) => {
  try {
    if (!requireProPlan(req.trainer)) {
      return res.status(403).json({ error: 'Pro or Elite plan required to create programs for clients' });
    }

    const { clientId } = req.params;
    // Verify this client is assigned to this trainer
    const { rows: check } = await pool.query(
      'SELECT id FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2',
      [req.trainer.userId, clientId]
    );
    if (check.length === 0) return res.status(403).json({ error: 'Not your client' });

    const { name, description, workouts } = req.body;
    if (!name) return res.status(400).json({ error: 'Program name required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create program for the client
      const { rows: [program] } = await client.query(
        'INSERT INTO programs (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [clientId, name, description || '']
      );

      // Create workouts/templates within the program
      if (workouts && Array.isArray(workouts)) {
        for (let wi = 0; wi < workouts.length; wi++) {
          const w = workouts[wi];
          const { rows: [tmpl] } = await client.query(
            'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [clientId, program.id, w.name, w.description || '', w.isRest || false, wi]
          );

          if (w.exercises && Array.isArray(w.exercises)) {
            for (let ei = 0; ei < w.exercises.length; ei++) {
              const ex = w.exercises[ei];
              const sets = ex.sets || [];
              for (let si = 0; si < sets.length; si++) {
                const s = sets[si];
                await client.query(
                  `INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                  [tmpl.id, ex.name, s.setType || 'straight', s.setNumber || si + 1, s.plannedReps || 10, s.suggestedWeight || 0, ei]
                );
              }
            }
          }
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ program: { id: program.id, name: program.name } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { trainerSessions };
export default router;
