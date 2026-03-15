import { Router } from 'express';
import db from '../db.js';

const router = Router();

function adminAuth(req, res, next) {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Pass key to use in links
  req.adminKey = key;
  next();
}

function adminPage(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit Admin — ${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 32px; color: #111; }
    .header { margin-bottom: 24px; }
    .header h1 { font-size: 28px; font-weight: 800; }
    .header h2 { font-size: 18px; font-weight: 600; color: #666; margin-top: 4px; }
    .header p { color: #666; margin-top: 4px; font-size: 14px; }
    .breadcrumb { font-size: 13px; color: #888; margin-bottom: 20px; }
    .breadcrumb a { color: #111; text-decoration: none; font-weight: 600; }
    .breadcrumb a:hover { text-decoration: underline; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { background: #fff; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat .value { font-size: 28px; font-weight: 800; }
    .stat .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th { background: #111; color: #fff; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
    td { padding: 12px 16px; border-top: 1px solid #eee; font-size: 14px; }
    tr:hover td { background: #f9f9f9; }
    .btn { background: #111; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 24px; margin-right: 8px; text-decoration: none; display: inline-block; }
    .btn:hover { background: #333; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-decoration: none; color: #111; transition: box-shadow 0.2s, transform 0.2s; display: block; }
    .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateY(-2px); }
    .card .card-icon { font-size: 32px; margin-bottom: 12px; }
    .card .card-title { font-size: 18px; font-weight: 700; }
    .card .card-desc { font-size: 14px; color: #666; margin-top: 6px; line-height: 1.5; }
    @media print { .btn, .breadcrumb { display: none; } body { padding: 0; background: #fff; } .stat { box-shadow: none; border: 1px solid #ddd; } table { box-shadow: none; } }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

// GET /admin?key=YOUR_ADMIN_KEY — Admin Dashboard Home
router.get('/', adminAuth, (req, res) => {
  const key = req.adminKey;
  res.send(adminPage('Dashboard', `
  <div class="header">
    <h1>Admin Dashboard</h1>
    <p>WillFit administration panel</p>
  </div>
  <div class="card-grid">
    <a class="card" href="/admin/users?key=${key}&format=html">
      <div class="card-icon">👥</div>
      <div class="card-title">User Sign Ups</div>
      <div class="card-desc">View all registered users, contact info, referral sources, and export data.</div>
    </a>
  </div>
  `));
});

// GET /admin/users?key=YOUR_ADMIN_KEY
// Returns all real users (excludes demo accounts)
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    const key = req.adminKey;

    // If ?format=html, return a styled HTML page
    if (req.query.format === 'html') {
      const rows = users.map((u, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${u.firstName || ''} ${u.lastName || ''}</td>
          <td>${u.username || '—'}</td>
          <td>${u.email || '—'}</td>
          <td>${u.phone || '—'}</td>
          <td>${u.gender || '—'}</td>
          <td>${u.referralSource || '—'}</td>
          <td>${u.referralCode || '—'}</td>
          <td>${new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        </tr>`).join('');

      return res.send(adminPage('User Sign Ups', `
  <div class="breadcrumb"><a href="/admin?key=${key}">Dashboard</a> / User Sign Ups</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>User Sign Ups</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <a class="btn" onclick="window.print()" href="javascript:void(0)">Print / Save as PDF</a>
  <a class="btn" onclick="exportExcel()" href="javascript:void(0)">Export to Excel</a>
  <script>
    function exportExcel() {
      const table = document.querySelector('table');
      let csv = '';
      for (const row of table.rows) {
        const cells = [];
        for (const cell of row.cells) {
          let val = cell.textContent.replace(/"/g, '""');
          cells.push('"' + val + '"');
        }
        csv += cells.join(',') + '\\n';
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'willfit_users_' + new Date().toISOString().slice(0,10) + '.csv';
      link.click();
    }
  </script>
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
      <tr><th>#</th><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Gender</th><th>Referral</th><th>Code</th><th>Signed Up</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`));
    }

    res.json({ count: users.length, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
