import express, { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../dbPool.js';
import db from '../db.js';
import { DASHBOARD_CSS, SIDEBAR_JS } from '../dashboardCSS.js';

const router = Router();

// Session management
const clientSessions = new Map(); // token -> { userId, email, firstName, lastName, role, plan }

function clientAuth(req, res, next) {
  const sessionToken = req.cookies?.client_session;
  if (sessionToken && clientSessions.has(sessionToken)) {
    req.client = clientSessions.get(sessionToken);
    return next();
  }
  if (req.headers.accept?.includes('text/html') || req.query.format === 'html') {
    return res.redirect('/workouts/login');
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function clientLoginPage(error) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RepLab — Workout Dashboard Login</title>
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
    <div class="login-logo">REP<span>LAB</span></div>
    <p class="subtitle">Workout Dashboard</p>
    <div class="glass" style="padding:28px;">
      ${error ? `<div class="error">${error}</div>` : ''}
      <form method="POST" action="/workouts/login">
        <div class="field">
          <label>Email / Phone</label>
          <input type="text" name="identifier" placeholder="Enter your email or phone" required autocomplete="email" />
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

function clientPage(title, body, user) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RepLab — ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${DASHBOARD_CSS}</style>
</head>
<body>
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:12px 32px;background:linear-gradient(135deg,rgba(20,0,0,0.92),rgba(30,5,5,0.92),rgba(20,0,0,0.92));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(239,68,68,0.2);box-shadow:0 2px 20px rgba(239,68,68,0.08),inset 0 -1px 0 rgba(239,68,68,0.1);">
  <a href="/workouts" style="text-decoration:none;"><div class="logo" style="margin:0;color:#fff;">REP<span style="color:#ef4444;">LAB</span></div></a>
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:600;">${user ? (user.firstName || user.email) : 'User'}</span>
    <a href="/workouts" style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='rgba(255,255,255,0.5)';this.style.background='none'">Home</a>
    <a href="/workouts/logout" style="color:#ef4444;font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'">Logout</a>
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
    <a href="/workouts"${title === 'Dashboard' ? ' class="active"' : ''}>Dashboard</a>
    <a href="/workouts/create-workout"${title === 'Create a Workout' ? ' class="active"' : ''}>Create Workout</a>
    <a href="/workouts/my-workouts"${title === 'My Workouts' ? ' class="active"' : ''}>My Workouts</a>
  </div>
  <div class="sidebar-section" onclick="toggleSection('history')">
    <span>History</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-history">
    <a href="/workouts/history"${title === 'Workout History' ? ' class="active"' : ''}>Workout History</a>
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

// GET /workouts/login
router.get('/login', (req, res) => {
  const error = req.query.error || '';
  res.send(clientLoginPage(error));
});

// POST /workouts/login
router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.redirect('/workouts/login?error=Email+and+password+are+required');
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, phone, password_hash, first_name, last_name, role, plan FROM users WHERE email = $1 OR phone = $1',
      [identifier.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.redirect('/workouts/login?error=Invalid+credentials');
    }

    const user = rows[0];
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.redirect('/workouts/login?error=Invalid+credentials');
    }

    // No role restriction — any user can log in

    const token = crypto.randomBytes(32).toString('hex');
    clientSessions.set(token, {
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role || 'client',
      plan: user.plan || 'Free',
    });

    res.cookie('client_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.redirect('/workouts');
  } catch (err) {
    console.error('Client login error:', err);
    return res.redirect('/workouts/login?error=Something+went+wrong');
  }
});

// GET /workouts/logout
router.get('/logout', (req, res) => {
  const sessionToken = req.cookies?.client_session;
  if (sessionToken) {
    clientSessions.delete(sessionToken);
    res.clearCookie('client_session');
  }
  res.redirect('/workouts/login');
});

// GET /workouts — Dashboard home
router.get('/', clientAuth, (req, res) => {
  res.send(clientPage('Dashboard', `
    <div class="header">
      <h1>Workout Dashboard</h1>
      <p>Welcome back, ${req.client.firstName || req.client.email}. Manage your workouts and track your progress.</p>
    </div>
    <div class="card-grid">
      <a class="card glass" href="/workouts/create-workout">
        <div class="card-icon">➕</div>
        <div class="card-title">Create a Workout</div>
        <div class="card-desc">Build a new workout from scratch.</div>
      </a>
      <a class="card glass" href="/workouts/my-workouts">
        <div class="card-icon">📋</div>
        <div class="card-title">My Workouts</div>
        <div class="card-desc">Browse and manage your workouts and programs.</div>
      </a>
      <a class="card glass" href="/workouts/history">
        <div class="card-icon">📊</div>
        <div class="card-title">Workout History</div>
        <div class="card-desc">View your completed workout sessions.</div>
      </a>
    </div>
  `, req.client));
});

// GET /workouts/create-workout
router.get('/create-workout', clientAuth, async (req, res) => {
  const msg = req.query.msg || '';
  const error = req.query.error || '';

  const { rows: programs } = await pool.query(
    'SELECT id, name FROM programs WHERE user_id = $1 ORDER BY name',
    [req.client.userId]
  );

  const muscleGroups = await db.getMuscleGroups();

  res.send(clientPage('Create a Workout', `
<div style="margin-bottom:20px;">
  <a href="/workouts" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;font-weight:600;">
    <span style="margin-right:4px;">&larr;</span> Back to Dashboard
  </a>
</div>
${msg ? '<div class="glass" style="padding:14px 20px;margin-bottom:20px;border-left:3px solid #22c55e;"><p style="color:#4ade80;font-size:13px;font-weight:600;">✓ ' + decodeURIComponent(msg) + '</p></div>' : ''}
${error ? '<div class="glass" style="padding:14px 20px;margin-bottom:20px;border-left:3px solid #ef4444;"><p style="color:#f87171;font-size:13px;font-weight:600;">' + decodeURIComponent(error) + '</p></div>' : ''}
<div class="header">
  <h1>Create a Workout</h1>
  <p>Add exercises, sets, and reps to build your workout.</p>
</div>
<form method="POST" action="/workouts/create-workout" id="workout-form">
<div class="glass" style="padding:24px;border-radius:16px;margin-bottom:20px;">
  <div class="field">
    <label>Workout Name <span style="color:#ef4444;">*</span></label>
    <input type="text" name="workoutName" placeholder="e.g. Upper Body Push" required />
  </div>
  <div class="field">
    <label>Description <span style="color:rgba(255,255,255,0.3);font-weight:400;font-size:11px;">(optional)</span></label>
    <textarea name="description" placeholder="Brief description of this workout..." rows="2" style="resize:vertical;min-height:60px;"></textarea>
  </div>
  <div class="field">
    <label>Program <span style="color:rgba(255,255,255,0.3);font-weight:400;font-size:11px;">(optional — leave blank to use default)</span></label>
    <select name="programId">
      <option value="">— No Program (standalone) —</option>
      ${programs.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('')}
    </select>
  </div>
</div>

<div id="exercises-container"></div>

<button type="button" onclick="addExercise()" style="width:100%;padding:14px;border:2px dashed rgba(255,255,255,0.15);border-radius:12px;background:none;color:rgba(255,255,255,0.5);font-size:14px;font-weight:600;cursor:pointer;margin-bottom:20px;transition:all 0.2s;font-family:inherit;" onmouseover="this.style.borderColor='rgba(239,68,68,0.4)';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='rgba(255,255,255,0.5)'">
  + Add Exercise
</button>

<button type="submit" class="btn" style="width:100%;padding:16px;font-size:16px;" id="save-btn">Save Workout</button>
</form>

<!-- Custom Exercise Modal -->
<div id="custom-exercise-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;">
  <div class="glass" style="max-width:400px;width:90%;padding:28px;border-radius:16px;position:relative;">
    <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px;">Create Custom Exercise</h3>
    <div class="field">
      <label>Exercise Name</label>
      <input type="text" id="custom-ex-name" placeholder="e.g. Cable Lateral Raise" />
    </div>
    <div class="field">
      <label>Muscle Group</label>
      <select id="custom-ex-muscle">
        ${muscleGroups.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('')}
      </select>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button type="button" onclick="closeCustomExerciseModal()" class="btn-ghost" style="flex:1;">Cancel</button>
      <button type="button" onclick="saveCustomExercise()" class="btn" style="flex:1;">Create</button>
    </div>
  </div>
</div>

<script>
let exerciseCount = 0;
let exerciseLibrary = [];
let activeSearchInput = null;

// Fetch exercise library on load
fetch('/workouts/api/exercises')
  .then(r => r.json())
  .then(data => { exerciseLibrary = data; })
  .catch(() => {});

function addExercise(afterEl) {
  const idx = exerciseCount++;
  const html = \`
    <div class="glass exercise-block" id="exercise-\${idx}" style="padding:20px;border-radius:14px;margin-bottom:16px;position:relative;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#ef4444;" class="ex-number">\${idx + 1}</div>
        <div style="flex:1;position:relative;">
          <input type="text" name="exercises[\${idx}][name]" placeholder="Search exercises..." class="ex-search" autocomplete="off" oninput="searchExercises(this, \${idx})" onfocus="searchExercises(this, \${idx})" style="padding-right:36px;" required />
          <span class="ex-valid-badge" id="valid-badge-\${idx}" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#22c55e;font-size:16px;">✓</span>
          <div class="search-results" id="search-results-\${idx}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:10px;max-height:200px;overflow-y:auto;margin-top:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);"></div>
        </div>
        <button type="button" onclick="removeExercise(\${idx})" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:rgba(255,255,255,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all 0.2s;" onmouseover="this.style.borderColor='#ef4444';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.4)'">&times;</button>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);font-weight:700;margin-bottom:6px;display:block;">Set Type</label>
        <select name="exercises[\${idx}][setType]" style="width:100%;">
          <option value="straight">Straight Sets</option>
          <option value="drop">Drop Set</option>
          <option value="superset">Superset</option>
          <option value="warmup">Warm-up</option>
          <option value="amrap">AMRAP</option>
          <option value="rpe">RPE-Based</option>
        </select>
      </div>
      <div class="sets-container" id="sets-\${idx}">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;" class="set-row">
          <span style="width:20px;font-size:11px;color:rgba(255,255,255,0.3);text-align:center;font-weight:700;">1</span>
          <input type="number" name="exercises[\${idx}][sets][0][reps]" placeholder="Reps" min="1" style="flex:1;" value="10" />
          <input type="number" name="exercises[\${idx}][sets][0][weight]" placeholder="Weight (lbs)" min="0" style="flex:1;" value="0" />
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button type="button" onclick="addSet(\${idx})" style="flex:1;padding:8px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:none;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;" onmouseover="this.style.borderColor='rgba(239,68,68,0.3)';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.5)'">+ Add Set</button>
        <button type="button" onclick="removeSet(\${idx})" style="flex:1;padding:8px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:none;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;" onmouseover="this.style.borderColor='rgba(239,68,68,0.3)';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.5)'">- Remove Set</button>
      </div>
    </div>
  \`;
  const container = document.getElementById('exercises-container');
  if (afterEl) {
    afterEl.insertAdjacentHTML('afterend', html);
  } else {
    container.insertAdjacentHTML('beforeend', html);
  }
  renumberExercises();
}

function removeExercise(idx) {
  const el = document.getElementById('exercise-' + idx);
  if (el) el.remove();
  renumberExercises();
}

function renumberExercises() {
  document.querySelectorAll('.exercise-block').forEach((block, i) => {
    block.querySelector('.ex-number').textContent = i + 1;
  });
}

function addSet(exIdx) {
  const container = document.getElementById('sets-' + exIdx);
  const rows = container.querySelectorAll('.set-row');
  const setNum = rows.length;
  const html = \`<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;" class="set-row">
    <span style="width:20px;font-size:11px;color:rgba(255,255,255,0.3);text-align:center;font-weight:700;">\${setNum + 1}</span>
    <input type="number" name="exercises[\${exIdx}][sets][\${setNum}][reps]" placeholder="Reps" min="1" style="flex:1;" value="10" />
    <input type="number" name="exercises[\${exIdx}][sets][\${setNum}][weight]" placeholder="Weight (lbs)" min="0" style="flex:1;" value="0" />
  </div>\`;
  container.insertAdjacentHTML('beforeend', html);
}

function removeSet(exIdx) {
  const container = document.getElementById('sets-' + exIdx);
  const rows = container.querySelectorAll('.set-row');
  if (rows.length > 1) rows[rows.length - 1].remove();
}

function searchExercises(input, exIdx) {
  activeSearchInput = { input, exIdx };
  const query = input.value.toLowerCase().trim();
  const results = document.getElementById('search-results-' + exIdx);
  const badge = document.getElementById('valid-badge-' + exIdx);
  if (!query) { results.style.display = 'none'; badge.style.display = 'none'; return; }

  const matches = exerciseLibrary.filter(e => e.name.toLowerCase().includes(query)).slice(0, 8);

  // Check if exact match
  const exact = exerciseLibrary.some(e => e.name.toLowerCase() === query);
  badge.style.display = exact ? 'inline' : 'none';

  if (matches.length === 0) {
    results.innerHTML = '<div style="padding:10px 14px;"><span style="color:rgba(255,255,255,0.3);font-size:12px;">No matches</span><br><button type="button" onclick="openCustomExerciseModal(' + exIdx + ')" style="margin-top:6px;background:none;border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">+ Create Custom Exercise</button></div>';
    results.style.display = 'block';
    return;
  }

  results.innerHTML = matches.map(e =>
    '<div style="padding:8px 14px;cursor:pointer;font-size:13px;color:rgba(255,255,255,0.7);border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;" onmouseover="this.style.background=\\'rgba(255,255,255,0.05)\\'" onmouseout="this.style.background=\\'none\\'" onclick="selectExercise(' + exIdx + ',\\'' + e.name.replace(/'/g, "\\\\'") + '\\')">' +
    '<span style="font-weight:600;color:#fff;">' + e.name + '</span>' +
    (e.muscle_group ? '<span style="margin-left:8px;font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;">' + e.muscle_group + '</span>' : '') +
    '</div>'
  ).join('') + '<div style="padding:8px 14px;border-top:1px solid rgba(255,255,255,0.08);"><button type="button" onclick="openCustomExerciseModal(' + exIdx + ')" style="background:none;border:none;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">+ Create Custom Exercise</button></div>';
  results.style.display = 'block';
}

function selectExercise(exIdx, name) {
  const block = document.getElementById('exercise-' + exIdx);
  const input = block.querySelector('.ex-search');
  input.value = name;
  document.getElementById('search-results-' + exIdx).style.display = 'none';
  document.getElementById('valid-badge-' + exIdx).style.display = 'inline';
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('ex-search')) {
    document.querySelectorAll('.search-results').forEach(r => r.style.display = 'none');
  }
});

let customExIdx = null;
function openCustomExerciseModal(exIdx) {
  customExIdx = exIdx;
  document.getElementById('custom-exercise-modal').style.display = 'flex';
  document.getElementById('custom-ex-name').value = '';
  document.getElementById('custom-ex-name').focus();
}
function closeCustomExerciseModal() {
  document.getElementById('custom-exercise-modal').style.display = 'none';
}
function saveCustomExercise() {
  const name = document.getElementById('custom-ex-name').value.trim();
  const muscle = document.getElementById('custom-ex-muscle').value;
  if (!name) return;
  fetch('/exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, muscleGroup: muscle, isCustom: true })
  })
  .then(r => r.json())
  .then(() => {
    exerciseLibrary.push({ name, muscle_group: muscle });
    if (customExIdx !== null) selectExercise(customExIdx, name);
    closeCustomExerciseModal();
  })
  .catch(() => alert('Failed to create exercise'));
}

// Add first exercise on load
addExercise();

// Form validation
document.getElementById('workout-form').addEventListener('submit', function(e) {
  const exercises = document.querySelectorAll('.exercise-block');
  if (exercises.length === 0) {
    e.preventDefault();
    alert('Add at least one exercise to your workout.');
    return;
  }
  document.getElementById('save-btn').textContent = 'Saving...';
  document.getElementById('save-btn').disabled = true;
});
</script>
  `, req.client));
});

// POST /workouts/create-workout
router.post('/create-workout', clientAuth, express.urlencoded({ extended: true }), async (req, res) => {
  const { workoutName, description, programId, exercises } = req.body;

  if (!workoutName?.trim()) {
    return res.redirect('/workouts/create-workout?error=Workout+name+is+required');
  }

  try {
    // If no program selected, find or create a default one
    let finalProgramId = programId ? Number(programId) : null;
    if (!finalProgramId) {
      const programName = 'My Workouts';
      const userId = req.client.userId;
      const { rows: existing } = await pool.query(
        'SELECT id FROM programs WHERE name = $1 AND user_id = $2',
        [programName, userId]
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

    const userId = req.client.userId;

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

    // Insert exercises and sets
    if (exercises && typeof exercises === 'object') {
      const exArray = Array.isArray(exercises) ? exercises : Object.values(exercises);
      let exSortOrder = 0;
      for (const ex of exArray) {
        if (!ex?.name?.trim()) continue;
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
        exSortOrder++;
      }
    }

    res.redirect('/workouts/create-workout?msg=Workout+"' + encodeURIComponent(workoutName.trim()) + '"+created+successfully');
  } catch (err) {
    console.error('Create workout error:', err);
    res.redirect('/workouts/create-workout?error=Failed+to+create+workout');
  }
});

// GET /workouts/my-workouts
router.get('/my-workouts', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id as program_id, p.name as program_name, p.description as program_desc,
              t.id as template_id, t.name as template_name, t.is_rest, t.sort_order,
              (SELECT COUNT(*) FROM template_exercises WHERE template_id = t.id) as exercise_count
       FROM programs p
       LEFT JOIN templates t ON t.program_id = p.id
       WHERE p.user_id = $1
       ORDER BY p.name, t.sort_order`,
      [req.client.userId]
    );

    // Group by program
    const programMap = new Map();
    for (const row of rows) {
      if (!programMap.has(row.program_id)) {
        programMap.set(row.program_id, {
          id: row.program_id,
          name: row.program_name,
          description: row.program_desc,
          workouts: []
        });
      }
      if (row.template_id) {
        programMap.get(row.program_id).workouts.push({
          id: row.template_id,
          name: row.template_name,
          isRest: row.is_rest,
          exerciseCount: Number(row.exercise_count)
        });
      }
    }

    const programs = [...programMap.values()];

    let body = `
      <div style="margin-bottom:20px;">
        <a href="/workouts" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;font-weight:600;">
          <span style="margin-right:4px;">&larr;</span> Back to Dashboard
        </a>
      </div>
      <div class="header">
        <h1>My Workouts</h1>
        <p>Browse and manage your workouts and programs.</p>
      </div>
    `;

    if (programs.length === 0) {
      body += `
        <div class="glass" style="padding:40px;text-align:center;border-radius:16px;">
          <p style="color:rgba(255,255,255,0.5);font-size:15px;margin-bottom:16px;">No workouts yet. Create your first workout!</p>
          <a href="/workouts/create-workout" class="btn" style="text-decoration:none;">+ Create Workout</a>
        </div>
      `;
    } else {
      for (const program of programs) {
        body += `
          <div class="glass" style="padding:24px;border-radius:16px;margin-bottom:20px;">
            <h3 style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px;">${esc(program.name)}</h3>
            ${program.description ? '<p style="font-size:13px;color:rgba(255,255,255,0.4);margin-bottom:16px;">' + esc(program.description) + '</p>' : '<div style="margin-bottom:16px;"></div>'}
        `;

        if (program.workouts.length === 0) {
          body += `<p style="font-size:13px;color:rgba(255,255,255,0.3);font-style:italic;">No workouts in this program.</p>`;
        } else {
          for (const w of program.workouts) {
            body += `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:8px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='none'">
                <div>
                  <span style="font-size:14px;font-weight:600;color:#fff;">${esc(w.name)}</span>
                  <span style="font-size:12px;color:rgba(255,255,255,0.3);margin-left:10px;">${w.exerciseCount} exercise${w.exerciseCount !== 1 ? 's' : ''}</span>
                </div>
                <div style="display:flex;gap:8px;">
                  <a href="/workouts/edit-workout/${w.id}" style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:600;text-decoration:none;padding:6px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;transition:all 0.15s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.3)';this.style.color='#fff'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.4)'">Edit</a>
                  <button type="button" onclick="deleteWorkout(${w.id})" style="color:rgba(255,255,255,0.3);font-size:12px;font-weight:600;padding:6px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:none;cursor:pointer;font-family:inherit;transition:all 0.15s;" onmouseover="this.style.borderColor='#ef4444';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.3)'">Delete</button>
                </div>
              </div>
            `;
          }
        }

        body += `</div>`;
      }
    }

    body += `
      <script>
      function deleteWorkout(id) {
        if (!confirm('Are you sure you want to delete this workout?')) return;
        fetch('/workouts/delete-workout/' + id, { method: 'DELETE' })
          .then(r => r.json())
          .then(data => { if (data.ok) location.reload(); else alert('Failed to delete workout.'); })
          .catch(() => alert('Failed to delete workout.'));
      }
      </script>
    `;

    res.send(clientPage('My Workouts', body, req.client));
  } catch (err) {
    console.error('My workouts error:', err);
    res.send(clientPage('My Workouts', '<p style="color:#f87171;">Failed to load workouts.</p>', req.client));
  }
});

// DELETE /workouts/delete-workout/:id
router.delete('/delete-workout/:id', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT t.id, t.user_id FROM templates t WHERE t.id = $1',
      [Number(req.params.id)]
    );
    if (!rows[0]) return res.json({ ok: false, error: 'Not found' });
    if (rows[0].user_id !== req.client.userId) return res.json({ ok: false, error: 'Unauthorized' });

    await pool.query('DELETE FROM templates WHERE id = $1', [Number(req.params.id)]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete workout error:', err);
    return res.json({ ok: false, error: 'Failed to delete' });
  }
});

// GET /workouts/edit-workout/:id
router.get('/edit-workout/:id', clientAuth, async (req, res) => {
  const templateId = Number(req.params.id);
  const msg = req.query.msg || '';
  const error = req.query.error || '';

  try {
    // Load the template
    const { rows: tmplRows } = await pool.query(
      'SELECT t.*, p.name AS program_name FROM templates t LEFT JOIN programs p ON p.id = t.program_id WHERE t.id = $1',
      [templateId]
    );
    if (!tmplRows[0]) return res.redirect('/workouts/my-workouts');
    const tmpl = tmplRows[0];

    // Verify ownership
    if (tmpl.user_id !== req.client.userId) return res.redirect('/workouts/my-workouts');

    // Load exercises
    const { rows: exercises } = await pool.query(
      'SELECT name, set_type, set_number, planned_reps, suggested_weight, sort_order FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number',
      [templateId]
    );

    // Group by exercise
    const exerciseMap = new Map();
    for (const ex of exercises) {
      if (!exerciseMap.has(ex.sort_order)) {
        exerciseMap.set(ex.sort_order, { name: ex.name, setType: ex.set_type || 'straight', sets: [] });
      }
      exerciseMap.get(ex.sort_order).sets.push({ reps: ex.planned_reps, weight: Number(ex.suggested_weight) });
    }
    const exerciseList = [...exerciseMap.values()];

    // Load programs for dropdown
    const { rows: programs } = await pool.query(
      'SELECT id, name FROM programs WHERE user_id = $1 ORDER BY name',
      [req.client.userId]
    );
    const muscleGroups = await db.getMuscleGroups();

    res.send(clientPage('Edit Workout', `
    <div style="margin-bottom:20px;">
      <a href="/workouts/my-workouts" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;font-weight:600;">
        <span style="margin-right:4px;">&larr;</span> Back to My Workouts
      </a>
    </div>
    <div class="header">
      <h1>Edit Workout</h1>
      <p>Editing <strong style="color:#fff;">${esc(tmpl.name)}</strong>${tmpl.program_name ? ' in ' + esc(tmpl.program_name) : ''}</p>
    </div>
    ${msg ? '<div class="glass" style="padding:14px 20px;margin-bottom:20px;border-left:3px solid #22c55e;"><p style="color:#4ade80;font-size:13px;font-weight:600;">✓ ' + decodeURIComponent(msg) + '</p></div>' : ''}
    ${error ? '<div class="glass" style="padding:14px 20px;margin-bottom:20px;border-left:3px solid #ef4444;"><p style="color:#f87171;font-size:13px;font-weight:600;">' + decodeURIComponent(error) + '</p></div>' : ''}
    <form method="POST" action="/workouts/edit-workout/${templateId}" id="workout-form">
    <div class="glass" style="padding:24px;border-radius:16px;margin-bottom:20px;">
      <div class="field">
        <label>Workout Name <span style="color:#ef4444;">*</span></label>
        <input type="text" name="workoutName" value="${esc(tmpl.name)}" required />
      </div>
      <div class="field">
        <label>Description <span style="color:rgba(255,255,255,0.3);font-weight:400;font-size:11px;">(optional)</span></label>
        <textarea name="description" rows="2" style="resize:vertical;min-height:60px;">${esc(tmpl.description || '')}</textarea>
      </div>
      <div class="field">
        <label>Program</label>
        <select name="programId">
          <option value="">— No Program (standalone) —</option>
          ${programs.map(p => '<option value="' + p.id + '"' + (p.id === tmpl.program_id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('')}
        </select>
      </div>
    </div>

    <div id="exercises-container"></div>

    <button type="button" onclick="addExercise()" style="width:100%;padding:14px;border:2px dashed rgba(255,255,255,0.15);border-radius:12px;background:none;color:rgba(255,255,255,0.5);font-size:14px;font-weight:600;cursor:pointer;margin-bottom:20px;transition:all 0.2s;font-family:inherit;" onmouseover="this.style.borderColor='rgba(239,68,68,0.4)';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='rgba(255,255,255,0.5)'">
      + Add Exercise
    </button>

    <div style="display:flex;gap:8px;">
      <button type="submit" class="btn" style="flex:1;padding:16px;font-size:16px;margin:0;" id="save-btn">Save Changes</button>
      <a href="/workouts/my-workouts" class="btn-ghost" style="flex:none;padding:16px 24px;margin:0;text-align:center;font-size:15px;text-decoration:none;">Cancel</a>
    </div>
    </form>

    <!-- Custom Exercise Modal -->
    <div id="custom-exercise-modal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);align-items:center;justify-content:center;">
      <div class="glass" style="max-width:400px;width:90%;padding:28px;border-radius:16px;position:relative;">
        <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px;">Create Custom Exercise</h3>
        <div class="field">
          <label>Exercise Name</label>
          <input type="text" id="custom-ex-name" placeholder="e.g. Cable Lateral Raise" />
        </div>
        <div class="field">
          <label>Muscle Group</label>
          <select id="custom-ex-muscle">
            ${muscleGroups.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('')}
          </select>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button type="button" onclick="closeCustomExerciseModal()" class="btn-ghost" style="flex:1;">Cancel</button>
          <button type="button" onclick="saveCustomExercise()" class="btn" style="flex:1;">Create</button>
        </div>
      </div>
    </div>

    <script>
    let exerciseCount = 0;
    let exerciseLibrary = [];
    let activeSearchInput = null;
    const EXISTING = ${JSON.stringify(exerciseList)};

    fetch('/workouts/api/exercises')
      .then(r => r.json())
      .then(data => { exerciseLibrary = data; })
      .catch(() => {});

    function addExercise(afterEl) {
      const idx = exerciseCount++;
      const html = \`
        <div class="glass exercise-block" id="exercise-\${idx}" style="padding:20px;border-radius:14px;margin-bottom:16px;position:relative;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
            <div style="width:28px;height:28px;border-radius:8px;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#ef4444;" class="ex-number">\${idx + 1}</div>
            <div style="flex:1;position:relative;">
              <input type="text" name="exercises[\${idx}][name]" placeholder="Search exercises..." class="ex-search" autocomplete="off" oninput="searchExercises(this, \${idx})" onfocus="searchExercises(this, \${idx})" style="padding-right:36px;" required />
              <span class="ex-valid-badge" id="valid-badge-\${idx}" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);color:#22c55e;font-size:16px;">✓</span>
              <div class="search-results" id="search-results-\${idx}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:50;background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:10px;max-height:200px;overflow-y:auto;margin-top:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);"></div>
            </div>
            <button type="button" onclick="removeExercise(\${idx})" style="width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:rgba(255,255,255,0.4);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all 0.2s;" onmouseover="this.style.borderColor='#ef4444';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.4)'">&times;</button>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);font-weight:700;margin-bottom:6px;display:block;">Set Type</label>
            <select name="exercises[\${idx}][setType]" style="width:100%;">
              <option value="straight">Straight Sets</option>
              <option value="drop">Drop Set</option>
              <option value="superset">Superset</option>
              <option value="warmup">Warm-up</option>
              <option value="amrap">AMRAP</option>
              <option value="rpe">RPE-Based</option>
            </select>
          </div>
          <div class="sets-container" id="sets-\${idx}">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;" class="set-row">
              <span style="width:20px;font-size:11px;color:rgba(255,255,255,0.3);text-align:center;font-weight:700;">1</span>
              <input type="number" name="exercises[\${idx}][sets][0][reps]" placeholder="Reps" min="1" style="flex:1;" value="10" />
              <input type="number" name="exercises[\${idx}][sets][0][weight]" placeholder="Weight (lbs)" min="0" style="flex:1;" value="0" />
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button type="button" onclick="addSet(\${idx})" style="flex:1;padding:8px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:none;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;" onmouseover="this.style.borderColor='rgba(239,68,68,0.3)';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.5)'">+ Add Set</button>
            <button type="button" onclick="removeSet(\${idx})" style="flex:1;padding:8px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:none;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;" onmouseover="this.style.borderColor='rgba(239,68,68,0.3)';this.style.color='#ef4444'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.5)'">- Remove Set</button>
          </div>
        </div>
      \`;
      const container = document.getElementById('exercises-container');
      if (afterEl) {
        afterEl.insertAdjacentHTML('afterend', html);
      } else {
        container.insertAdjacentHTML('beforeend', html);
      }
      renumberExercises();
    }

    function removeExercise(idx) {
      const el = document.getElementById('exercise-' + idx);
      if (el) el.remove();
      renumberExercises();
    }

    function renumberExercises() {
      document.querySelectorAll('.exercise-block').forEach((block, i) => {
        block.querySelector('.ex-number').textContent = i + 1;
      });
    }

    function addSet(exIdx) {
      const container = document.getElementById('sets-' + exIdx);
      const rows = container.querySelectorAll('.set-row');
      const setNum = rows.length;
      const html = \`<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;" class="set-row">
        <span style="width:20px;font-size:11px;color:rgba(255,255,255,0.3);text-align:center;font-weight:700;">\${setNum + 1}</span>
        <input type="number" name="exercises[\${exIdx}][sets][\${setNum}][reps]" placeholder="Reps" min="1" style="flex:1;" value="10" />
        <input type="number" name="exercises[\${exIdx}][sets][\${setNum}][weight]" placeholder="Weight (lbs)" min="0" style="flex:1;" value="0" />
      </div>\`;
      container.insertAdjacentHTML('beforeend', html);
    }

    function removeSet(exIdx) {
      const container = document.getElementById('sets-' + exIdx);
      const rows = container.querySelectorAll('.set-row');
      if (rows.length > 1) rows[rows.length - 1].remove();
    }

    function searchExercises(input, exIdx) {
      activeSearchInput = { input, exIdx };
      const query = input.value.toLowerCase().trim();
      const results = document.getElementById('search-results-' + exIdx);
      const badge = document.getElementById('valid-badge-' + exIdx);
      if (!query) { results.style.display = 'none'; badge.style.display = 'none'; return; }

      const matches = exerciseLibrary.filter(e => e.name.toLowerCase().includes(query)).slice(0, 8);
      const exact = exerciseLibrary.some(e => e.name.toLowerCase() === query);
      badge.style.display = exact ? 'inline' : 'none';

      if (matches.length === 0) {
        results.innerHTML = '<div style="padding:10px 14px;"><span style="color:rgba(255,255,255,0.3);font-size:12px;">No matches</span><br><button type="button" onclick="openCustomExerciseModal(' + exIdx + ')" style="margin-top:6px;background:none;border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">+ Create Custom Exercise</button></div>';
        results.style.display = 'block';
        return;
      }

      results.innerHTML = matches.map(e =>
        '<div style="padding:8px 14px;cursor:pointer;font-size:13px;color:rgba(255,255,255,0.7);border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;" onmouseover="this.style.background=\\'rgba(255,255,255,0.05)\\'" onmouseout="this.style.background=\\'none\\'" onclick="selectExercise(' + exIdx + ',\\'' + e.name.replace(/'/g, "\\\\'") + '\\')">' +
        '<span style="font-weight:600;color:#fff;">' + e.name + '</span>' +
        (e.muscle_group ? '<span style="margin-left:8px;font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;">' + e.muscle_group + '</span>' : '') +
        '</div>'
      ).join('') + '<div style="padding:8px 14px;border-top:1px solid rgba(255,255,255,0.08);"><button type="button" onclick="openCustomExerciseModal(' + exIdx + ')" style="background:none;border:none;color:#ef4444;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">+ Create Custom Exercise</button></div>';
      results.style.display = 'block';
    }

    function selectExercise(exIdx, name) {
      const block = document.getElementById('exercise-' + exIdx);
      const input = block.querySelector('.ex-search');
      input.value = name;
      document.getElementById('search-results-' + exIdx).style.display = 'none';
      document.getElementById('valid-badge-' + exIdx).style.display = 'inline';
    }

    document.addEventListener('click', (e) => {
      if (!e.target.classList.contains('ex-search')) {
        document.querySelectorAll('.search-results').forEach(r => r.style.display = 'none');
      }
    });

    let customExIdx = null;
    function openCustomExerciseModal(exIdx) {
      customExIdx = exIdx;
      document.getElementById('custom-exercise-modal').style.display = 'flex';
      document.getElementById('custom-ex-name').value = '';
      document.getElementById('custom-ex-name').focus();
    }
    function closeCustomExerciseModal() {
      document.getElementById('custom-exercise-modal').style.display = 'none';
    }
    function saveCustomExercise() {
      const name = document.getElementById('custom-ex-name').value.trim();
      const muscle = document.getElementById('custom-ex-muscle').value;
      if (!name) return;
      fetch('/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, muscleGroup: muscle, isCustom: true })
      })
      .then(r => r.json())
      .then(() => {
        exerciseLibrary.push({ name, muscle_group: muscle });
        if (customExIdx !== null) selectExercise(customExIdx, name);
        closeCustomExerciseModal();
      })
      .catch(() => alert('Failed to create exercise'));
    }

    // Pre-populate existing exercises
    EXISTING.forEach(function(ex) {
      addExercise();
      const idx = exerciseCount - 1;
      const block = document.getElementById('exercise-' + idx);
      const input = block.querySelector('.ex-search');
      input.value = ex.name;
      // Set the set type
      const setTypeSelect = block.querySelector('select[name="exercises[' + idx + '][setType]"]');
      if (setTypeSelect) setTypeSelect.value = ex.setType || 'straight';
      // Remove default set row and add actual sets
      const setsContainer = document.getElementById('sets-' + idx);
      setsContainer.innerHTML = '';
      ex.sets.forEach(function(s, si) {
        const setHtml = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;" class="set-row">' +
          '<span style="width:20px;font-size:11px;color:rgba(255,255,255,0.3);text-align:center;font-weight:700;">' + (si + 1) + '</span>' +
          '<input type="number" name="exercises[' + idx + '][sets][' + si + '][reps]" placeholder="Reps" min="1" style="flex:1;" value="' + (s.reps || 10) + '" />' +
          '<input type="number" name="exercises[' + idx + '][sets][' + si + '][weight]" placeholder="Weight (lbs)" min="0" style="flex:1;" value="' + (s.weight || 0) + '" />' +
          '</div>';
        setsContainer.insertAdjacentHTML('beforeend', setHtml);
      });
    });

    // If no existing exercises, add one blank
    if (EXISTING.length === 0) addExercise();

    document.getElementById('workout-form').addEventListener('submit', function(e) {
      const exercises = document.querySelectorAll('.exercise-block');
      if (exercises.length === 0) {
        e.preventDefault();
        alert('Add at least one exercise to your workout.');
        return;
      }
      document.getElementById('save-btn').textContent = 'Saving...';
      document.getElementById('save-btn').disabled = true;
    });
    </script>
    `, req.client));
  } catch (err) {
    console.error('Edit workout page error:', err);
    res.redirect('/workouts/my-workouts');
  }
});

// POST /workouts/edit-workout/:id
router.post('/edit-workout/:id', clientAuth, express.urlencoded({ extended: true }), async (req, res) => {
  const templateId = Number(req.params.id);
  const { workoutName, description, programId, exercises } = req.body;

  if (!workoutName?.trim()) return res.redirect('/workouts/edit-workout/' + templateId + '?error=Workout+name+is+required');

  try {
    // Verify ownership
    const { rows: tmplRows } = await pool.query('SELECT user_id, program_id FROM templates WHERE id = $1', [templateId]);
    if (!tmplRows[0]) return res.redirect('/workouts/my-workouts');
    if (tmplRows[0].user_id !== req.client.userId) return res.redirect('/workouts/my-workouts');

    // Update template
    const newProgramId = programId ? Number(programId) : tmplRows[0].program_id;
    await pool.query(
      'UPDATE templates SET name = $1, description = $2, program_id = $3 WHERE id = $4',
      [workoutName.trim(), description?.trim() || '', newProgramId, templateId]
    );

    // Delete old exercises and insert new ones
    await pool.query('DELETE FROM template_exercises WHERE template_id = $1', [templateId]);

    if (exercises && typeof exercises === 'object') {
      const exArray = Array.isArray(exercises) ? exercises : Object.values(exercises);
      let exSort = 0;
      for (const ex of exArray) {
        if (!ex?.name?.trim()) continue;
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
        exSort++;
      }
    }

    res.redirect('/workouts/edit-workout/' + templateId + '?msg=Workout+updated+successfully');
  } catch (err) {
    console.error('Save edit error:', err);
    res.redirect('/workouts/edit-workout/' + templateId + '?error=Failed+to+save+changes');
  }
});

// GET /workouts/history
router.get('/history', clientAuth, async (req, res) => {
  try {
    const { rows: sessions } = await pool.query(
      `SELECT s.id, s.template_id, s.date, s.duration, s.completed_at,
              t.name as workout_name
       FROM sessions s
       LEFT JOIN templates t ON s.template_id = t.id
       WHERE s.user_id = $1
       ORDER BY s.completed_at DESC
       LIMIT 50`,
      [req.client.userId]
    );

    let body = `
      <div style="margin-bottom:20px;">
        <a href="/workouts" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;font-weight:600;">
          <span style="margin-right:4px;">&larr;</span> Back to Dashboard
        </a>
      </div>
      <div class="header">
        <h1>Workout History</h1>
        <p>Your completed workout sessions.</p>
      </div>
    `;

    if (sessions.length === 0) {
      body += `
        <div class="glass" style="padding:40px;text-align:center;border-radius:16px;">
          <p style="color:rgba(255,255,255,0.5);font-size:15px;">No completed sessions yet. Start a workout from the app to see your history here!</p>
        </div>
      `;
    } else {
      body += `
        <div class="glass" style="border-radius:16px;overflow:hidden;">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Workout Name</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
      `;

      for (const s of sessions) {
        const workoutName = s.workout_name || 'Unknown Workout';
        const date = s.date ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const duration = s.duration ? Math.floor(s.duration / 60) + ':' + String(s.duration % 60).padStart(2, '0') : '—';
        const completedAt = s.completed_at ? new Date(s.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

        body += `
                <tr>
                  <td style="font-weight:600;color:#fff;">${esc(workoutName)}</td>
                  <td>${date}</td>
                  <td>${duration}</td>
                  <td>${completedAt}</td>
                </tr>
        `;
      }

      body += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    res.send(clientPage('Workout History', body, req.client));
  } catch (err) {
    console.error('History error:', err);
    res.send(clientPage('Workout History', '<p style="color:#f87171;">Failed to load workout history.</p>', req.client));
  }
});

// GET /workouts/api/exercises
router.get('/api/exercises', clientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT name, muscle_group FROM exercises ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Exercises API error:', err);
    res.json([]);
  }
});

export default router;
