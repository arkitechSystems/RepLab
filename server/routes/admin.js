import { Router } from 'express';
import db from '../db.js';

const router = Router();

function adminAuth(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// GET /admin/users?key=YOUR_ADMIN_KEY
// Returns all real users (excludes demo accounts)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await db.getAllUsers();

    // If ?format=html, return a styled HTML page
    if (req.query.format === 'html') {
      const rows = users.map((u, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${u.email || '—'}</td>
          <td>${u.phone || '—'}</td>
          <td>${new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        </tr>`).join('');

      return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit Users</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 32px; color: #111; }
    .header { margin-bottom: 24px; }
    .header h1 { font-size: 28px; font-weight: 800; }
    .header p { color: #666; margin-top: 4px; font-size: 14px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; }
    .stat { background: #fff; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat .value { font-size: 28px; font-weight: 800; }
    .stat .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #111; color: #fff; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    td { padding: 12px 16px; border-top: 1px solid #eee; font-size: 14px; }
    tr:hover td { background: #f9f9f9; }
    .print-btn { background: #111; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 24px; }
    .print-btn:hover { background: #333; }
    @media print { .print-btn { display: none; } body { padding: 0; background: #fff; } .stat { box-shadow: none; border: 1px solid #ddd; } table { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>WillFit Users</h1>
    <p>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <div class="stats">
    <div class="stat">
      <div class="value">${users.length}</div>
      <div class="label">Total Users</div>
    </div>
    <div class="stat">
      <div class="value">${users.filter(u => u.email).length}</div>
      <div class="label">Email Signups</div>
    </div>
    <div class="stat">
      <div class="value">${users.filter(u => u.phone).length}</div>
      <div class="label">Phone Signups</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Email</th><th>Phone</th><th>Signed Up</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`);
    }

    res.json({ count: users.length, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
