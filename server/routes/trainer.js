import express, { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import pool from '../dbPool.js';

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
  `, req.trainer));
});

export { trainerSessions };
export default router;
