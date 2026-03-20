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
      <a class="card glass" href="/trainer/workouts">
        <div class="card-icon">📋</div>
        <div class="card-title">View Current Workouts</div>
        <div class="card-desc">Browse and manage your existing programs and workouts.</div>
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

      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <button type="button" onclick="addExercise()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;">
          + Add Exercise
        </button>
        <button type="button" onclick="addGroupTitle()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;border-color:rgba(239,68,68,0.2);color:rgba(239,68,68,0.7);">
          + Group Title
        </button>
      </div>

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

      var groupCount = 0;
      function addGroupTitle() {
        var gIdx = groupCount++;
        var container = document.getElementById('exercises-container');
        var card = el('div', 'border-radius:12px;margin-bottom:16px;border:1px solid rgba(239,68,68,0.15);background:rgba(239,68,68,0.03);padding:16px;position:relative;');
        card.id = 'group-' + gIdx;

        var header = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;');
        var badge = el('span', 'font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#ef4444;font-weight:700;');
        badge.textContent = 'GROUP TITLE';
        var removeBtn = el('button', 'background:none;border:none;color:rgba(255,255,255,0.25);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;', { type: 'button' });
        removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
        removeBtn.onmouseover = function() { this.style.color = '#ef4444'; };
        removeBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.25)'; };
        removeBtn.onclick = function() { var e = document.getElementById('group-' + gIdx); if (e) e.remove(); };
        header.appendChild(badge); header.appendChild(removeBtn);
        card.appendChild(header);

        var titleInput = el('input', 'width:100%;padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:15px;font-weight:700;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:8px;');
        titleInput.type = 'text'; titleInput.name = 'groups[' + gIdx + '][title]';
        titleInput.placeholder = 'e.g. Warm Up, Superset With, Circuit...'; titleInput.required = true;
        card.appendChild(titleInput);

        var descInput = el('input', 'width:100%;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:rgba(255,255,255,0.6);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;');
        descInput.type = 'text'; descInput.name = 'groups[' + gIdx + '][description]';
        descInput.placeholder = 'Description (optional)';
        card.appendChild(descInput);

        container.appendChild(card);
        titleInput.focus();
      }

      function updateSetCount(idx) {
        var setsDiv = document.getElementById('sets-' + idx);
        var count = setsDiv ? setsDiv.children.length : 0;
        var label = document.getElementById('set-count-' + idx);
        if (label) label.textContent = count + ' set' + (count !== 1 ? 's' : '');
      }

      function moveExercise(idx, direction) {
        var card = document.getElementById('exercise-' + idx);
        if (!card) return;
        var sibling = direction === -1 ? card.previousElementSibling : card.nextElementSibling;
        if (!sibling) return;
        var container = document.getElementById('exercises-container');
        if (direction === -1) container.insertBefore(card, sibling);
        else container.insertBefore(sibling, card);
      }

      function addExercise() {
        var idx = exerciseCount++;
        var container = document.getElementById('exercises-container');
        var card = el('div', 'border-radius:16px;margin-bottom:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);');
        card.className = 'glass';
        card.id = 'exercise-' + idx;

        // === HEADER: Exercise name + move up/down + remove ===
        var header = el('div', 'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;');
        var searchWrap = el('div', 'flex:1;position:relative;min-width:0;');
        var searchInput = el('input', 'width:100%;padding:0;border:none;background:none;color:#fff;font-size:15px;font-weight:600;font-family:inherit;outline:none;');
        searchInput.type = 'text'; searchInput.id = 'ex-search-' + idx; searchInput.name = 'exercises[' + idx + '][name]';
        searchInput.placeholder = 'Search exercises...'; searchInput.required = true; searchInput.autocomplete = 'off';
        searchInput.oninput = function() { searchExercises(idx, this.value); };
        searchInput.onfocus = function() { searchExercises(idx, this.value); };
        var resultsDiv = el('div', 'display:none;position:absolute;top:calc(100% + 8px);left:-16px;right:-16px;z-index:50;max-height:220px;overflow-y:auto;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);');
        resultsDiv.id = 'ex-results-' + idx;
        var validBadge = el('span', 'display:none;align-items:center;margin-left:6px;');
        validBadge.id = 'ex-valid-' + idx;
        searchWrap.appendChild(searchInput); searchWrap.appendChild(validBadge); searchWrap.appendChild(resultsDiv);
        var headerBtns = el('div', 'display:flex;align-items:center;gap:4px;shrink:0;');
        function mkCircleBtn(svg, hoverColor, hoverBg) {
          var b = el('button', 'width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.06);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,0.4);transition:all 0.15s;', { type: 'button' });
          b.innerHTML = svg;
          b.onmouseover = function() { this.style.color = hoverColor; this.style.background = hoverBg; };
          b.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.4)'; this.style.background = 'rgba(255,255,255,0.06)'; };
          return b;
        }
        var upBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>', '#fff', 'rgba(255,255,255,0.15)');
        upBtn.onclick = function() { moveExercise(idx, -1); };
        var downBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>', '#fff', 'rgba(255,255,255,0.15)');
        downBtn.onclick = function() { moveExercise(idx, 1); };
        var removeBtn = mkCircleBtn('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>', '#ef4444', 'rgba(239,68,68,0.15)');
        removeBtn.onclick = function() { removeExercise(idx); };
        headerBtns.appendChild(upBtn); headerBtns.appendChild(downBtn); headerBtns.appendChild(removeBtn);
        header.appendChild(searchWrap); header.appendChild(headerBtns);
        card.appendChild(header);

        // Hidden set type
        var stHidden = el('input'); stHidden.type = 'hidden'; stHidden.name = 'exercises[' + idx + '][setType]'; stHidden.id = 'settype-val-' + idx; stHidden.value = 'straight';
        card.appendChild(stHidden);

        // === SET CONTROLS SUBHEADER: count + add/remove set buttons ===
        var setControls = el('div', 'padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.015);');
        var setCountLabel = el('span', 'font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;');
        setCountLabel.id = 'set-count-' + idx;
        setCountLabel.textContent = '3 sets';
        var setBtns = el('div', 'display:flex;align-items:center;gap:6px;');
        var addSetPill = el('button', 'height:26px;padding:0 10px;border-radius:13px;background:rgba(255,255,255,0.06);border:none;display:flex;align-items:center;gap:4px;cursor:pointer;color:rgba(255,255,255,0.4);font-family:inherit;transition:all 0.15s;', { type: 'button' });
        addSetPill.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>';
        var addSetText = el('span', 'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;'); addSetText.textContent = 'Add Set';
        addSetPill.appendChild(addSetText);
        addSetPill.onmouseover = function() { this.style.color = '#fff'; this.style.background = 'rgba(255,255,255,0.12)'; };
        addSetPill.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.4)'; this.style.background = 'rgba(255,255,255,0.06)'; };
        addSetPill.onclick = function() { addSet(idx); updateSetCount(idx); };
        var rmSetPill = el('button', 'height:26px;padding:0 10px;border-radius:13px;background:rgba(255,255,255,0.06);border:none;display:flex;align-items:center;gap:4px;cursor:pointer;color:rgba(255,255,255,0.4);font-family:inherit;transition:all 0.15s;', { type: 'button' });
        rmSetPill.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15"/></svg>';
        var rmSetText = el('span', 'font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;'); rmSetText.textContent = 'Remove';
        rmSetPill.appendChild(rmSetText);
        rmSetPill.onmouseover = function() { this.style.color = '#ef4444'; this.style.background = 'rgba(239,68,68,0.12)'; };
        rmSetPill.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.4)'; this.style.background = 'rgba(255,255,255,0.06)'; };
        rmSetPill.onclick = function() { var sd = document.getElementById('sets-' + idx); if (sd && sd.lastChild) { sd.lastChild.remove(); updateSetCount(idx); } };
        setBtns.appendChild(addSetPill); setBtns.appendChild(rmSetPill);
        setControls.appendChild(setCountLabel); setControls.appendChild(setBtns);
        card.appendChild(setControls);

        // === COLUMN HEADERS ===
        var colHeaders = el('div', 'display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);');
        [{ t: 'Set', w: '36px' }, { t: 'Type', w: '72px' }, { t: 'Weight', f: '1' }, { t: 'Reps', f: '1' }, { t: '', w: '28px' }].forEach(function(c) {
          var sp = el('span', 'font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.25);font-weight:600;text-align:center;' + (c.f ? 'flex:' + c.f + ';' : 'width:' + c.w + ';'));
          sp.textContent = c.t; colHeaders.appendChild(sp);
        });
        card.appendChild(colHeaders);

        // === SETS CONTAINER ===
        var setsDiv = el('div'); setsDiv.id = 'sets-' + idx; card.appendChild(setsDiv);

        // === NOTES SECTION ===
        var notesWrap = el('div', 'padding:10px 16px;border-top:1px solid rgba(255,255,255,0.05);');
        var notesLabel = el('div', 'display:flex;align-items:center;gap:4px;margin-bottom:6px;');
        var notesIcon = el('span'); notesIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>';
        var notesText = el('span', 'font-size:10px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:1px;font-weight:600;'); notesText.textContent = 'Notes';
        notesLabel.appendChild(notesIcon); notesLabel.appendChild(notesText);
        var notesInput = el('textarea', 'width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);color:rgba(255,255,255,0.5);font-size:12px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;min-height:36px;');
        notesInput.name = 'exercises[' + idx + '][notes]'; notesInput.placeholder = 'Add notes for this exercise...'; notesInput.rows = 2;
        notesWrap.appendChild(notesLabel); notesWrap.appendChild(notesInput);
        card.appendChild(notesWrap);

        container.appendChild(card);
        addSet(idx); addSet(idx); addSet(idx);
        updateSetCount(idx);
      }

      function searchExercises(exIdx, query) {
        activeSearchIdx = exIdx;
        clearTimeout(searchTimeout);
        validatedExercises[exIdx] = false;
        var badge = document.getElementById('ex-valid-' + exIdx);
        if (badge) { badge.style.display = 'none'; }
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
        var input = document.getElementById('ex-search-' + exIdx);
        input.value = name;
        input.style.color = '#fff';
        document.getElementById('ex-results-' + exIdx).style.display = 'none';
        validatedExercises[exIdx] = true;
        var badge = document.getElementById('ex-valid-' + exIdx);
        if (badge) { badge.style.display = 'inline-flex'; badge.style.color = '#22c55e'; badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>'; }
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
        if (activeSearchIdx !== null) {
          selectExercise(activeSearchIdx, name);
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
          document.querySelectorAll('[id^="ex-results-"]').forEach(function(d) { d.style.display = 'none'; });
        }
        if (!e.target.closest('[id^="st-btn-"]') && !e.target.closest('[id^="st-dd-"]')) {
          document.querySelectorAll('[id^="st-dd-"]').forEach(function(d) { d.style.display = 'none'; });
        }
      });

      var setCounts = {};
      var inputCSS = 'flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;';
      var SET_SHORT = { warm_up: 'WU', straight: 'REG', drop: 'DS', rest_pause: 'RP', superset: 'SS', alternating: 'Alt', giant: 'Gia', pre_exhaust: 'PrEx' };

      function addSet(exIdx) {
        if (!setCounts[exIdx]) setCounts[exIdx] = 0;
        var setIdx = setCounts[exIdx]++;
        var setsDiv = document.getElementById('sets-' + exIdx);
        var row = el('div', 'display:flex;align-items:center;padding:6px 16px;border-bottom:1px solid rgba(255,255,255,0.04);' + (setIdx % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : ''));
        row.id = 'set-' + exIdx + '-' + setIdx;

        // Set number
        var num = el('span', 'width:36px;text-align:center;font-size:13px;color:rgba(255,255,255,0.4);font-weight:700;');
        num.textContent = setIdx + 1;

        // Set type dropdown
        var typeWrap = el('div', 'width:72px;position:relative;');
        var typeBtn = el('button', 'width:100%;padding:6px 4px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;font-family:inherit;cursor:pointer;text-align:center;outline:none;', { type: 'button' });
        typeBtn.textContent = 'REG';
        typeBtn.id = 'st-btn-' + exIdx + '-' + setIdx;
        var typeDD = el('div', 'display:none;position:absolute;top:100%;left:0;z-index:60;margin-top:2px;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);padding:2px;min-width:120px;');
        typeDD.id = 'st-dd-' + exIdx + '-' + setIdx;
        typeBtn.onclick = function() { typeDD.style.display = typeDD.style.display === 'none' ? 'block' : 'none'; };
        SET_TYPES.forEach(function(t) {
          var opt = el('button', 'width:100%;text-align:left;padding:6px 10px;border:none;background:none;color:#fff;font-size:11px;cursor:pointer;font-family:inherit;border-radius:5px;', { type: 'button' });
          opt.textContent = t.label;
          opt.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
          opt.onmouseout = function() { this.style.background = 'none'; };
          opt.onclick = function() {
            typeBtn.textContent = SET_SHORT[t.value] || 'REG';
            typeBtn.style.color = t.value === 'straight' ? 'rgba(255,255,255,0.6)' : '#ef4444';
            document.getElementById('settype-val-' + exIdx).value = t.value;
            typeDD.style.display = 'none';
          };
          typeDD.appendChild(opt);
        });
        typeWrap.appendChild(typeBtn); typeWrap.appendChild(typeDD);

        // Weight input
        var weightInput = el('input', inputCSS);
        weightInput.type = 'number'; weightInput.name = 'exercises[' + exIdx + '][sets][' + setIdx + '][weight]';
        weightInput.placeholder = '—'; weightInput.value = '0';
        weightInput.onfocus = function() { if (this.value === '0') this.value = ''; };
        weightInput.onblur = function() { if (!this.value) this.value = '0'; };

        // Reps input
        var repsInput = el('input', inputCSS);
        repsInput.type = 'number'; repsInput.name = 'exercises[' + exIdx + '][sets][' + setIdx + '][reps]';
        repsInput.placeholder = '10'; repsInput.value = '10';

        // Delete
        var delBtn = el('button', 'background:none;border:none;color:rgba(255,255,255,0.15);cursor:pointer;padding:4px;width:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;', { type: 'button' });
        delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
        delBtn.onmouseover = function() { this.style.color = '#ef4444'; this.style.background = 'rgba(239,68,68,0.1)'; };
        delBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.15)'; this.style.background = 'none'; };
        delBtn.onclick = function() { var e = document.getElementById('set-' + exIdx + '-' + setIdx); if (e) { e.remove(); updateSetCount(exIdx); } };

        row.appendChild(num); row.appendChild(typeWrap); row.appendChild(weightInput); row.appendChild(repsInput); row.appendChild(delBtn);
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

      // Validate all exercises are from library before submit
      document.getElementById('workout-form').addEventListener('submit', function(e) {
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
          e.preventDefault();
          alert('Please select exercises from the library or add them as custom exercises:\\n\\n' + invalid.join('\\n') + '\\n\\nClick an exercise from the dropdown or use "+ Add as custom exercise".');
        }
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

// GET /trainer/edit-workout/:id — Edit workout form
router.get('/edit-workout/:id', trainerAuth, async (req, res) => {
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
      <button type="button" onclick="addExercise()" class="btn-ghost" style="width:100%;text-align:center;padding:14px;margin-bottom:20px;">+ Add Exercise</button>
      <div style="display:flex;gap:8px;">
        <button type="submit" class="btn" style="flex:1;padding:14px;font-size:15px;margin:0;">Save Changes</button>
        <a href="/trainer/workouts" class="btn-ghost" style="flex:none;padding:14px 24px;margin:0;text-align:center;font-size:15px;">Cancel</a>
      </div>
    </form>

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
      var API = '${apiBase}';
      var EXISTING = ${JSON.stringify(exerciseList)};
      var SET_TYPES = [
        { value: 'warm_up', label: 'Warm Up' }, { value: 'straight', label: 'Regular' }, { value: 'drop', label: 'Drop Set' },
        { value: 'rest_pause', label: 'Rest-Pause' }, { value: 'superset', label: 'Super Set' }, { value: 'alternating', label: 'Alternating' },
        { value: 'giant', label: 'Giant Set' }, { value: 'pre_exhaust', label: 'Pre-Exhaust' },
      ];
      function getSetTypeLabel(v) { var t = SET_TYPES.find(function(x) { return x.value === v; }); return t ? t.label : 'Regular'; }
      function buildSetTypeButtons(exIdx) {
        return SET_TYPES.map(function(t) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = t.label;
          b.style.cssText = 'width:100%;text-align:left;padding:8px 12px;border:none;background:none;color:#fff;font-size:12px;cursor:pointer;font-family:inherit;border-radius:6px;';
          b.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; }; b.onmouseout = function() { this.style.background = 'none'; };
          b.onclick = function() { selectSetType(exIdx, t.value, t.label); }; return b;
        });
      }
      function toggleSetTypeDD(i) { var d = document.getElementById('settype-dd-' + i); d.style.display = d.style.display === 'none' ? 'block' : 'none'; }
      function selectSetType(i, v, l) { document.getElementById('settype-val-' + i).value = v; document.getElementById('settype-label-' + i).textContent = l; document.getElementById('settype-dd-' + i).style.display = 'none'; }
      document.addEventListener('click', function(e) {
        if (!e.target.closest('[id^="ex-search-"]') && !e.target.closest('[id^="ex-results-"]')) document.querySelectorAll('[id^="ex-results-"]').forEach(function(d) { d.style.display = 'none'; });
        if (!e.target.closest('[id^="settype-btn-"]') && !e.target.closest('[id^="settype-dd-"]')) document.querySelectorAll('[id^="settype-dd-"]').forEach(function(d) { d.style.display = 'none'; });
      });

      function mk(tag, css, attrs) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (attrs) Object.keys(attrs).forEach(function(k) { e[k] = attrs[k]; }); return e; }
      var exerciseCount = 0, searchTimeout = null, activeSearchIdx = null, setCounts = {};
      var validatedExercises = {}; // idx -> true if selected from library or added as custom
      var inputCSS = 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;';

      function addExercise(prefill) {
        var idx = exerciseCount++; var container = document.getElementById('exercises-container');
        var div = mk('div', 'padding:20px;border-radius:16px;margin-bottom:16px;position:relative;'); div.className = 'glass'; div.id = 'exercise-' + idx;
        var hdr = mk('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;');
        var lbl = mk('label', 'margin:0;font-size:13px;font-weight:700;color:#fff;'); lbl.textContent = 'Exercise ' + (idx + 1);
        var rmBtn = mk('button', 'background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;padding:4px 8px;border-radius:6px;font-family:inherit;font-size:12px;', { type: 'button' });
        rmBtn.textContent = 'Remove'; rmBtn.onmouseover = function() { this.style.color = '#ef4444'; }; rmBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.3)'; };
        rmBtn.onclick = function() { var e = document.getElementById('exercise-' + idx); if (e) e.remove(); };
        hdr.appendChild(lbl); hdr.appendChild(rmBtn); div.appendChild(hdr);
        var sw = mk('div', 'position:relative;');
        var si = mk('input', 'width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;');
        si.type = 'text'; si.id = 'ex-search-' + idx; si.name = 'exercises[' + idx + '][name]'; si.placeholder = 'Search exercises...'; si.required = true; si.autocomplete = 'off';
        if (prefill) si.value = prefill.name;
        si.oninput = function() { searchExercises(idx, this.value); }; si.onfocus = function() { searchExercises(idx, this.value); };
        var rd = mk('div', 'display:none;position:absolute;top:100%;left:0;right:0;z-index:50;max-height:200px;overflow-y:auto;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:10px;margin-top:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5);');
        rd.id = 'ex-results-' + idx; sw.appendChild(si); sw.appendChild(rd); div.appendChild(sw);
        var str = mk('div', 'margin-top:12px;margin-bottom:12px;display:flex;gap:8px;align-items:center;position:relative;');
        var stl = mk('label', 'margin:0;font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;'); stl.textContent = 'Set Type';
        var sth = mk('input'); sth.type = 'hidden'; sth.name = 'exercises[' + idx + '][setType]'; sth.id = 'settype-val-' + idx; sth.value = prefill ? prefill.setType : 'straight';
        var stb = mk('button', 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;', { type: 'button' });
        stb.id = 'settype-btn-' + idx; stb.onclick = function() { toggleSetTypeDD(idx); };
        var sbl = mk('span'); sbl.id = 'settype-label-' + idx; sbl.textContent = prefill ? getSetTypeLabel(prefill.setType) : 'Regular'; stb.appendChild(sbl);
        stb.insertAdjacentHTML('beforeend', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4;flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>');
        var sdd = mk('div', 'display:none;position:absolute;top:100%;left:0;right:0;z-index:55;margin-top:4px;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:4px;');
        sdd.id = 'settype-dd-' + idx; buildSetTypeButtons(idx).forEach(function(b) { sdd.appendChild(b); });
        str.appendChild(stl); str.appendChild(sth); str.appendChild(stb); str.appendChild(sdd); div.appendChild(str);
        var ch = mk('div', 'display:flex;gap:8px;align-items:center;margin-bottom:8px;');
        ['Set:40px', 'Reps:1', 'Weight (lbs):1', ':28px'].forEach(function(c) { var p = c.split(':'); var s = mk('span', 'font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);' + (p[1] === '1' ? 'flex:1;text-align:center;' : 'width:' + p[1] + ';')); s.textContent = p[0]; ch.appendChild(s); });
        div.appendChild(ch);
        var sd = mk('div'); sd.id = 'sets-' + idx; div.appendChild(sd);
        var asb = mk('button', 'margin-top:8px;background:none;border:1px dashed rgba(255,255,255,0.15);color:rgba(255,255,255,0.4);padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;width:100%;', { type: 'button' });
        asb.textContent = '+ Add Set'; asb.onmouseover = function() { this.style.borderColor = 'rgba(255,255,255,0.3)'; this.style.color = '#fff'; };
        asb.onmouseout = function() { this.style.borderColor = 'rgba(255,255,255,0.15)'; this.style.color = 'rgba(255,255,255,0.4)'; };
        asb.onclick = function() { addSet(idx); }; div.appendChild(asb);
        container.appendChild(div);
        if (prefill && prefill.sets.length > 0) { prefill.sets.forEach(function(s) { addSet(idx, s.reps, s.weight); }); }
        else { addSet(idx); addSet(idx); addSet(idx); }
      }
      function addSet(exIdx, prefillReps, prefillWeight) {
        if (!setCounts[exIdx]) setCounts[exIdx] = 0; var si = setCounts[exIdx]++;
        var sd = document.getElementById('sets-' + exIdx); var r = mk('div', 'display:flex;gap:8px;align-items:center;margin-bottom:6px;'); r.id = 'set-' + exIdx + '-' + si;
        var n = mk('span', 'font-size:13px;color:rgba(255,255,255,0.5);width:40px;text-align:center;font-weight:600;'); n.textContent = si + 1;
        var ri = mk('input', inputCSS); ri.type = 'number'; ri.name = 'exercises[' + exIdx + '][sets][' + si + '][reps]'; ri.placeholder = '10'; ri.value = prefillReps !== undefined ? prefillReps : '10';
        var wi = mk('input', inputCSS); wi.type = 'number'; wi.name = 'exercises[' + exIdx + '][sets][' + si + '][weight]'; wi.placeholder = '0'; wi.value = prefillWeight !== undefined ? prefillWeight : '0';
        var db = mk('button', 'background:none;border:none;color:rgba(255,255,255,0.2);cursor:pointer;padding:2px;width:28px;display:flex;align-items:center;justify-content:center;', { type: 'button' });
        db.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
        db.onmouseover = function() { this.style.color = '#ef4444'; }; db.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.2)'; };
        db.onclick = function() { var e = document.getElementById('set-' + exIdx + '-' + si); if (e) e.remove(); };
        r.appendChild(n); r.appendChild(ri); r.appendChild(wi); r.appendChild(db); sd.appendChild(r);
      }
      function searchExercises(exIdx, query) {
        activeSearchIdx = exIdx; clearTimeout(searchTimeout);
        var rd = document.getElementById('ex-results-' + exIdx);
        if (!query || query.length < 1) { rd.style.display = 'none'; return; }
        searchTimeout = setTimeout(async function() {
          try {
            var resp = await fetch(API + '/exercises?q=' + encodeURIComponent(query));
            var exercises = await resp.json(); rd.innerHTML = '';
            exercises.forEach(function(ex) {
              var b = document.createElement('button'); b.type = 'button';
              b.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.05);';
              b.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; }; b.onmouseout = function() { this.style.background = 'none'; };
              b.onclick = function() { document.getElementById('ex-search-' + exIdx).value = ex.name; rd.style.display = 'none'; };
              var ns = document.createElement('span'); ns.textContent = ex.name;
              var ms = document.createElement('span'); ms.textContent = ex.muscle || ''; ms.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.3);';
              b.appendChild(ns); b.appendChild(ms); rd.appendChild(b);
            });
            var cb = document.createElement('button'); cb.type = 'button';
            cb.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#ef4444;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;';
            cb.onmouseover = function() { this.style.background = 'rgba(239,68,68,0.08)'; }; cb.onmouseout = function() { this.style.background = 'none'; };
            cb.onclick = function() { rd.style.display = 'none'; document.getElementById('custom-ex-name').value = query; activeSearchIdx = exIdx; document.getElementById('custom-ex-modal').style.display = 'flex'; };
            cb.textContent = '+ Add "' + query + '" as custom exercise'; rd.appendChild(cb);
            rd.style.display = 'block';
          } catch (e) { console.error(e); }
        }, 200);
      }
      async function saveCustomExercise() {
        var name = document.getElementById('custom-ex-name').value.trim();
        var muscle = document.getElementById('custom-ex-muscle').value;
        if (!name) return;
        try { await fetch(API + '/exercises', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, muscleGroup: muscle }) }); } catch (e) {}
        if (activeSearchIdx !== null) document.getElementById('ex-search-' + activeSearchIdx).value = name;
        document.getElementById('custom-ex-modal').style.display = 'none';
      }
      // Load existing exercises
      EXISTING.forEach(function(ex) { addExercise(ex); });
      if (EXISTING.length === 0) addExercise();
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

export { trainerSessions };
export default router;
