import express, { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../dbPool.js';
import db from '../db.js';

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

// Shared CSS (references the same design system as admin dashboard)
const SHARED_CSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      background: #000; color: #fff;
      -webkit-font-smoothing: antialiased;
    }
    body::before {
      content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 28px 28px;
    }
    .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; }
    .logo span { color: #ef4444; }
    .glass {
      background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;
    }
    .header { margin-bottom: 28px; }
    .header h1 { font-size: 28px; font-weight: 800; color: #fff; }
    .header p { color: rgba(255,255,255,0.4); margin-top: 4px; font-size: 13px; }
    .btn {
      background: linear-gradient(135deg, #DC2626, #EF4444, #F97316);
      background-size: 200% 200%; animation: gradShift 3s ease infinite;
      color: #fff; border: none; padding: 10px 20px; border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer;
      text-decoration: none; display: inline-block;
      box-shadow: 0 4px 20px rgba(239,68,68,0.3); transition: box-shadow 0.2s, transform 0.2s;
    }
    .btn:hover { box-shadow: 0 6px 30px rgba(239,68,68,0.45); transform: translateY(-1px); }
    @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card {
      padding: 28px; text-decoration: none; color: #fff; transition: all 0.3s; display: block;
      border: 1px solid rgba(255,255,255,0.15);
      box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 0 8px rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.05);
    }
    .card:hover {
      border-color: rgba(255,255,255,0.25); transform: translateY(-2px); background: rgba(255,255,255,0.08);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.06), 0 0 1px rgba(255,255,255,0.2);
    }
    .card .card-icon { font-size: 32px; margin-bottom: 14px; }
    .card .card-title { font-size: 18px; font-weight: 700; }
    .card .card-desc { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 8px; line-height: 1.6; }
    label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-weight: 600; }
    input[type="text"], input[type="password"], input[type="email"] {
      width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.06); color: #fff; font-size: 15px; font-family: inherit;
      outline: none; transition: border-color 0.2s;
    }
    input:focus { border-color: rgba(239,68,68,0.6); box-shadow: 0 0 0 2px rgba(239,68,68,0.15); }
    .field { margin-bottom: 16px; }
    .error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #f87171; margin-bottom: 16px; text-align: center; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
`;

function trainerLoginPage(error) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit Trainer — Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${SHARED_CSS}
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
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
  <style>
    ${SHARED_CSS}
    body { padding: 32px; min-height: 100vh; }
  </style>
</head>
<body>
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:12px 32px;background:linear-gradient(135deg,rgba(20,0,0,0.92),rgba(30,5,5,0.92),rgba(20,0,0,0.92));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(239,68,68,0.2);box-shadow:0 2px 20px rgba(239,68,68,0.08),inset 0 -1px 0 rgba(239,68,68,0.1);">
  <a href="/trainer" style="text-decoration:none;"><div class="logo" style="margin:0;color:#fff;">WILL<span style="color:#ef4444;">FIT</span></div></a>
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:600;">${trainer ? (trainer.firstName || trainer.email) : 'Trainer'}</span>
    <a href="/trainer" style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='rgba(255,255,255,0.5)';this.style.background='none'">Home</a>
    <a href="/trainer/logout" style="color:#ef4444;font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'">Logout</a>
  </div>
</nav>
<div style="height:56px;"></div>
<div class="container">
${body}
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
      'SELECT id, email, phone, password_hash, first_name, last_name FROM users WHERE email = $1 OR phone = $1',
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

    const token = crypto.randomBytes(32).toString('hex');
    trainerSessions.set(token, {
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
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
      <p>Welcome back, ${req.trainer.firstName || req.trainer.email}. Manage your workouts and programs.</p>
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
    </div>
  `, req.trainer));
});

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// GET /trainer/create-workout — Workout builder form
router.get('/create-workout', trainerAuth, async (req, res) => {
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

      <button type="button" onclick="addExercise()" class="btn-ghost" style="width:100%;text-align:center;padding:14px;margin-bottom:20px;">
        + Add Exercise
      </button>

      <button type="submit" class="btn" style="width:100%;padding:14px;font-size:15px;margin:0;">
        Save Workout
      </button>
    </form>

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
      // Close program dropdown on outside click
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

      const SET_TYPES = [
        { value: 'warm_up', label: 'Warm Up' },
        { value: 'straight', label: 'Regular' },
        { value: 'drop', label: 'Drop Set' },
        { value: 'rest_pause', label: 'Rest-Pause' },
        { value: 'superset', label: 'Super Set' },
        { value: 'alternating', label: 'Alternating' },
        { value: 'giant', label: 'Giant Set' },
        { value: 'pre_exhaust', label: 'Pre-Exhaust' },
      ];
      function buildSetTypeButtons(exIdx) {
        return SET_TYPES.map(function(t) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = t.label;
          btn.style.cssText = 'width:100%;text-align:left;padding:8px 12px;border:none;background:none;color:#fff;font-size:12px;cursor:pointer;font-family:inherit;border-radius:6px;transition:background 0.1s;';
          btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
          btn.onmouseout = function() { this.style.background = 'none'; };
          btn.onclick = function() { selectSetType(exIdx, t.value, t.label); };
          return btn;
        });
      }

      let exerciseCount = 0;
      let searchTimeout = null;
      let activeSearchIdx = null;

      function el(tag, styles, attrs) {
        var e = document.createElement(tag);
        if (styles) e.style.cssText = styles;
        if (attrs) Object.keys(attrs).forEach(function(k) { e[k] = attrs[k]; });
        return e;
      }

      function addExercise() {
        var idx = exerciseCount++;
        var container = document.getElementById('exercises-container');
        var div = el('div', 'padding:20px;border-radius:16px;margin-bottom:16px;position:relative;');
        div.className = 'glass';
        div.id = 'exercise-' + idx;

        // Header row
        var header = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;');
        var lbl = el('label', 'margin:0;font-size:13px;font-weight:700;color:#fff;');
        lbl.textContent = 'Exercise ' + (idx + 1);
        var removeBtn = el('button', 'background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;padding:4px 8px;border-radius:6px;font-family:inherit;font-size:12px;', { type: 'button' });
        removeBtn.textContent = 'Remove';
        removeBtn.onmouseover = function() { this.style.color = '#ef4444'; this.style.background = 'rgba(239,68,68,0.15)'; };
        removeBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.3)'; this.style.background = 'none'; };
        removeBtn.onclick = function() { removeExercise(idx); };
        header.appendChild(lbl);
        header.appendChild(removeBtn);
        div.appendChild(header);

        // Exercise search
        var searchWrap = el('div', 'position:relative;');
        var searchInput = el('input', 'width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;margin-bottom:0;box-sizing:border-box;');
        searchInput.type = 'text';
        searchInput.id = 'ex-search-' + idx;
        searchInput.name = 'exercises[' + idx + '][name]';
        searchInput.placeholder = 'Search exercises...';
        searchInput.required = true;
        searchInput.autocomplete = 'off';
        searchInput.oninput = function() { searchExercises(idx, this.value); };
        searchInput.onfocus = function() { searchExercises(idx, this.value); };
        var resultsDiv = el('div', 'display:none;position:absolute;top:100%;left:0;right:0;z-index:50;max-height:200px;overflow-y:auto;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:10px;margin-top:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5);');
        resultsDiv.id = 'ex-results-' + idx;
        searchWrap.appendChild(searchInput);
        searchWrap.appendChild(resultsDiv);
        div.appendChild(searchWrap);

        // Set type row
        var stRow = el('div', 'margin-top:12px;margin-bottom:12px;display:flex;gap:8px;align-items:center;position:relative;');
        var stLabel = el('label', 'margin:0;font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;');
        stLabel.textContent = 'Set Type';
        var stHidden = el('input');
        stHidden.type = 'hidden';
        stHidden.name = 'exercises[' + idx + '][setType]';
        stHidden.id = 'settype-val-' + idx;
        stHidden.value = 'straight';
        var stBtn = el('button', 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;', { type: 'button' });
        stBtn.id = 'settype-btn-' + idx;
        stBtn.onclick = function() { toggleSetTypeDD(idx); };
        var stBtnLabel = el('span');
        stBtnLabel.id = 'settype-label-' + idx;
        stBtnLabel.textContent = 'Regular';
        stBtn.appendChild(stBtnLabel);
        stBtn.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4;flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>');
        var stDD = el('div', 'display:none;position:absolute;top:100%;left:0;right:0;z-index:55;margin-top:4px;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:4px;');
        stDD.id = 'settype-dd-' + idx;
        buildSetTypeButtons(idx).forEach(function(b) { stDD.appendChild(b); });
        stRow.appendChild(stLabel);
        stRow.appendChild(stHidden);
        stRow.appendChild(stBtn);
        stRow.appendChild(stDD);
        div.appendChild(stRow);

        // Column headers
        var colHeaders = el('div', 'display:flex;gap:8px;align-items:center;margin-bottom:8px;');
        ['Set:40px', 'Reps:1', 'Weight (lbs):1', ':28px'].forEach(function(c) {
          var parts = c.split(':');
          var sp = el('span', 'font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);' + (parts[1] === '1' ? 'flex:1;text-align:center;' : 'width:' + parts[1] + ';'));
          sp.textContent = parts[0];
          colHeaders.appendChild(sp);
        });
        div.appendChild(colHeaders);

        // Sets container
        var setsDiv = el('div');
        setsDiv.id = 'sets-' + idx;
        div.appendChild(setsDiv);

        // Add set button
        var addSetBtn = el('button', 'margin-top:8px;background:none;border:1px dashed rgba(255,255,255,0.15);color:rgba(255,255,255,0.4);padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;width:100%;transition:all 0.15s;', { type: 'button' });
        addSetBtn.textContent = '+ Add Set';
        addSetBtn.onmouseover = function() { this.style.borderColor = 'rgba(255,255,255,0.3)'; this.style.color = '#fff'; };
        addSetBtn.onmouseout = function() { this.style.borderColor = 'rgba(255,255,255,0.15)'; this.style.color = 'rgba(255,255,255,0.4)'; };
        addSetBtn.onclick = function() { addSet(idx); };
        div.appendChild(addSetBtn);

        container.appendChild(div);
        addSet(idx); addSet(idx); addSet(idx);
      }

      function searchExercises(exIdx, query) {
        activeSearchIdx = exIdx;
        clearTimeout(searchTimeout);
        const resultsDiv = document.getElementById('ex-results-' + exIdx);
        if (!query || query.length < 1) { resultsDiv.style.display = 'none'; return; }
        searchTimeout = setTimeout(async () => {
          try {
            var resp = await fetch('/trainer/api/exercises?q=' + encodeURIComponent(query));
            var exercises = await resp.json();
            resultsDiv.innerHTML = '';
            exercises.forEach(function(ex) {
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.05);';
              btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
              btn.onmouseout = function() { this.style.background = 'none'; };
              btn.onclick = function() { selectExercise(exIdx, ex.name); };
              var nameSpan = document.createElement('span');
              nameSpan.textContent = ex.name;
              if (ex.isCustom) {
                var tag = document.createElement('span');
                tag.textContent = ' custom';
                tag.style.cssText = 'font-size:9px;color:#ef4444;margin-left:4px;';
                nameSpan.appendChild(tag);
              }
              var muscleSpan = document.createElement('span');
              muscleSpan.textContent = ex.muscle || '';
              muscleSpan.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.3);';
              btn.appendChild(nameSpan);
              btn.appendChild(muscleSpan);
              resultsDiv.appendChild(btn);
            });
            // Add custom exercise option
            var customBtn = document.createElement('button');
            customBtn.type = 'button';
            customBtn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#ef4444;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;';
            customBtn.onmouseover = function() { this.style.background = 'rgba(239,68,68,0.08)'; };
            customBtn.onmouseout = function() { this.style.background = 'none'; };
            customBtn.onclick = function() { openCustomModal(exIdx); };
            customBtn.textContent = '+ Add "' + query + '" as custom exercise';
            resultsDiv.appendChild(customBtn);
            resultsDiv.style.display = 'block';
          } catch (err) { console.error(err); }
        }, 200);
      }

      function selectExercise(exIdx, name) {
        document.getElementById('ex-search-' + exIdx).value = name;
        document.getElementById('ex-results-' + exIdx).style.display = 'none';
      }

      function openCustomModal(exIdx) {
        document.getElementById('ex-results-' + exIdx).style.display = 'none';
        const input = document.getElementById('ex-search-' + exIdx);
        document.getElementById('custom-ex-name').value = input.value;
        activeSearchIdx = exIdx;
        document.getElementById('custom-ex-modal').style.display = 'flex';
      }

      async function saveCustomExercise() {
        const name = document.getElementById('custom-ex-name').value.trim();
        const muscle = document.getElementById('custom-ex-muscle').value;
        if (!name) return;
        try {
          await fetch('/trainer/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, muscleGroup: muscle }),
          });
        } catch (err) { console.error('Failed to save custom exercise:', err); }
        // Set the exercise name in the form
        if (activeSearchIdx !== null) {
          document.getElementById('ex-search-' + activeSearchIdx).value = name;
        }
        document.getElementById('custom-ex-modal').style.display = 'none';
      }

      function getCookie(n) {
        var m = document.cookie.match(new RegExp('(^|;)\\\\s*' + n + '\\\\s*=\\\\s*([^;]+)'));
        return m ? m.pop() : '';
      }

      function toggleSetTypeDD(exIdx) {
        const dd = document.getElementById('settype-dd-' + exIdx);
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
      }
      function selectSetType(exIdx, value, label) {
        document.getElementById('settype-val-' + exIdx).value = value;
        document.getElementById('settype-label-' + exIdx).textContent = label;
        document.getElementById('settype-dd-' + exIdx).style.display = 'none';
      }

      // Close all dropdowns when clicking outside
      document.addEventListener('click', function(e) {
        if (!e.target.closest('[id^="ex-search-"]') && !e.target.closest('[id^="ex-results-"]')) {
          document.querySelectorAll('[id^="ex-results-"]').forEach(d => d.style.display = 'none');
        }
        if (!e.target.closest('[id^="settype-btn-"]') && !e.target.closest('[id^="settype-dd-"]')) {
          document.querySelectorAll('[id^="settype-dd-"]').forEach(d => d.style.display = 'none');
        }
      });

      var setCounts = {};
      var inputStyle = 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;';

      function addSet(exIdx) {
        if (!setCounts[exIdx]) setCounts[exIdx] = 0;
        var setIdx = setCounts[exIdx]++;
        var setsDiv = document.getElementById('sets-' + exIdx);
        var row = el('div', 'display:flex;gap:8px;align-items:center;margin-bottom:6px;');
        row.id = 'set-' + exIdx + '-' + setIdx;

        var num = el('span', 'font-size:13px;color:rgba(255,255,255,0.5);width:40px;text-align:center;font-weight:600;');
        num.textContent = setIdx + 1;

        var repsInput = el('input', inputStyle);
        repsInput.type = 'number';
        repsInput.name = 'exercises[' + exIdx + '][sets][' + setIdx + '][reps]';
        repsInput.placeholder = '10';
        repsInput.value = '10';

        var weightInput = el('input', inputStyle);
        weightInput.type = 'number';
        weightInput.name = 'exercises[' + exIdx + '][sets][' + setIdx + '][weight]';
        weightInput.placeholder = '0';
        weightInput.value = '0';

        var delBtn = el('button', 'background:none;border:none;color:rgba(255,255,255,0.2);cursor:pointer;padding:2px;width:28px;display:flex;align-items:center;justify-content:center;', { type: 'button' });
        delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
        delBtn.onmouseover = function() { this.style.color = '#ef4444'; };
        delBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.2)'; };
        delBtn.onclick = function() { removeSet(exIdx, setIdx); };

        row.appendChild(num);
        row.appendChild(repsInput);
        row.appendChild(weightInput);
        row.appendChild(delBtn);
        setsDiv.appendChild(row);
      }

      function removeSet(exIdx, setIdx) {
        var e = document.getElementById('set-' + exIdx + '-' + setIdx);
        if (e) e.remove();
      }

      function removeExercise(idx) {
        var e = document.getElementById('exercise-' + idx);
        if (e) e.remove();
      }

      addExercise();
    </script>
  `, req.trainer));
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

    res.redirect('/trainer/create-workout?msg=Workout+"' + encodeURIComponent(workoutName.trim()) + '"+created+successfully');
  } catch (err) {
    console.error('Create workout error:', err);
    res.redirect('/trainer/create-workout?error=Failed+to+create+workout');
  }
});

export { trainerSessions };
export default router;
