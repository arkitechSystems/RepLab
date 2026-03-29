import { Router } from 'express';
import pool from '../dbPool.js';
import { DASHBOARD_CSS } from '../dashboardCSS.js';

const router = Router();

// Shop pages use JWT auth from the app (Bearer token in cookie or header)
// For server-rendered pages, we check for a cookie-based session
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET;

function shopAuth(req, res, next) {
  // Try cookie first (set when user visits from app link)
  const token = req.cookies?.replab_token;
  // Fallback to query param (for direct links from app)
  const tokenParam = req.query.token;
  const t = token || tokenParam;

  if (!t) {
    return res.send(shopPage('Login Required', `
      <div style="text-align:center;padding:60px 20px">
        <h2 style="font-size:24px;font-weight:800;margin-bottom:8px">Login Required</h2>
        <p style="color:rgba(255,255,255,0.5);margin-bottom:24px">Open the RepLab app to access your workout dashboard.</p>
      </div>
    `));
  }

  try {
    const decoded = jwt.verify(t, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role || 'client';

    // Set cookie for subsequent page loads
    if (!token && tokenParam) {
      res.cookie('replab_token', tokenParam, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    next();
  } catch {
    return res.send(shopPage('Session Expired', `
      <div style="text-align:center;padding:60px 20px">
        <h2 style="font-size:24px;font-weight:800;margin-bottom:8px">Session Expired</h2>
        <p style="color:rgba(255,255,255,0.5);margin-bottom:24px">Please open the RepLab app and navigate to your dashboard again.</p>
      </div>
    `));
  }
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shopPage(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RepLab — ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Space Grotesk', -apple-system, sans-serif; background: #0a0a0a; color: #fff; -webkit-font-smoothing: antialiased; }
    body::before { content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 28px 28px; }
    .container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 24px 20px 80px; }
    .logo { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
    .logo span { color: #ef4444; }
    nav { padding: 14px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.6); backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 10; }
    .glass { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 800; color: #fff; }
    .stat-label { font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 16px; text-align: left; font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); }
    h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
    .section { margin-bottom: 28px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .badge-green { background: rgba(34,197,94,0.15); color: #22c55e; }
    .badge-yellow { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge-red { background: rgba(239,68,68,0.15); color: #ef4444; }
    @media (max-width: 600px) {
      .stat-grid { grid-template-columns: repeat(2, 1fr); }
      td, th { padding: 8px 10px; }
    }
  </style>
</head>
<body>
<nav>
  <div class="logo">REP<span>LAB</span></div>
  <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:600">Workout Dashboard</span>
</nav>
<div class="container">
${body}
</div>
</body>
</html>`;
}

// GET /shop/workouts — Main workout dashboard
router.get('/workouts', shopAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Fetch user info
    const { rows: [user] } = await pool.query(
      'SELECT first_name, last_name, email, username, plan, role FROM users WHERE id = $1', [userId]
    );
    if (!user) return res.status(404).send('User not found');

    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || user.username;

    // Stats
    const { rows: [stats] } = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE completed = true) as total_completed,
        COUNT(*) FILTER (WHERE completed = true AND date >= to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')) as week_completed,
        COUNT(*) FILTER (WHERE completed = true AND date >= to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')) as month_completed
       FROM sessions WHERE user_id = $1`,
      [userId]
    );

    // Recent sessions
    const { rows: sessions } = await pool.query(
      `SELECT s.id, s.date, s.completed, t.name as template_name,
              (SELECT COUNT(*) FROM session_entries WHERE session_id = s.id) as total_sets
       FROM sessions s
       LEFT JOIN templates t ON s.template_id = t.id
       WHERE s.user_id = $1
       ORDER BY s.date DESC
       LIMIT 20`,
      [userId]
    );

    // Programs
    const { rows: programs } = await pool.query(
      `SELECT p.id, p.name, p.description,
              (SELECT COUNT(*) FROM templates WHERE program_id = p.id AND is_rest = false) as workout_count
       FROM programs p
       WHERE p.user_id = $1
       ORDER BY p.sort_order, p.id`,
      [userId]
    );

    // Trainer info (if assigned)
    const { rows: trainerRows } = await pool.query(
      `SELECT u.first_name, u.last_name, u.email, u.username
       FROM trainer_clients tc
       JOIN users u ON tc.trainer_id = u.id
       WHERE tc.client_id = $1`,
      [userId]
    );
    const trainer = trainerRows[0] || null;
    const trainerName = trainer ? `${trainer.first_name || ''} ${trainer.last_name || ''}`.trim() || trainer.email : null;

    const sessionRows = sessions.map(s => `
      <tr>
        <td>${s.date}</td>
        <td>${esc(s.template_name || 'Unknown')}</td>
        <td>${s.total_sets} sets</td>
        <td><span class="badge ${s.completed ? 'badge-green' : 'badge-yellow'}">${s.completed ? 'Completed' : 'In Progress'}</span></td>
      </tr>
    `).join('');

    const programCards = programs.map(p => `
      <div class="glass" style="padding:16px;margin-bottom:8px">
        <div style="font-weight:700;font-size:14px">${esc(p.name)}</div>
        ${p.description ? `<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px">${esc(p.description)}</div>` : ''}
        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:6px">${p.workout_count} workouts</div>
      </div>
    `).join('');

    res.send(shopPage('Workout Dashboard', `
      <div style="margin-bottom:24px;padding-top:8px">
        <h1>Welcome, ${esc(userName)}</h1>
        <p style="color:rgba(255,255,255,0.5);font-size:14px">Your workout dashboard — track progress and stay on top of your fitness goals.</p>
        ${trainerName ? `<p style="color:#3b82f6;font-size:13px;margin-top:6px">Trainer: <strong>${esc(trainerName)}</strong></p>` : ''}
      </div>

      <div class="stat-grid">
        <div class="glass stat-card">
          <div class="stat-value">${stats.total_completed}</div>
          <div class="stat-label">Total Workouts</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-value">${stats.week_completed}</div>
          <div class="stat-label">This Week</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-value">${stats.month_completed}</div>
          <div class="stat-label">This Month</div>
        </div>
        <div class="glass stat-card">
          <div class="stat-value">${programs.length}</div>
          <div class="stat-label">Programs</div>
        </div>
      </div>

      ${programs.length > 0 ? `
        <div class="section">
          <h2>Your Programs</h2>
          ${programCards}
        </div>
      ` : ''}

      <div class="section">
        <h2>Recent Workouts</h2>
        <div class="glass" style="padding:0;overflow:hidden">
          <table>
            <thead><tr><th>Date</th><th>Workout</th><th>Volume</th><th>Status</th></tr></thead>
            <tbody>
              ${sessionRows || '<tr><td colspan="4" style="text-align:center;padding:32px;color:rgba(255,255,255,0.3)">No workouts yet. Start logging in the app!</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `));
  } catch (err) {
    console.error('Shop workouts error:', err);
    res.status(500).send('Internal server error');
  }
});

export default router;
