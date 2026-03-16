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
    <a class="card" href="/admin/analytics?key=${key}">
      <div class="card-icon">📊</div>
      <div class="card-title">Session Analytics</div>
      <div class="card-desc">Workout completions, most active users, and recent activity across all users.</div>
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
      // Dynamic columns from user object keys (skip id and passwordHash)
      const skipKeys = new Set(['id', 'passwordHash']);
      const allKeys = users.length > 0
        ? Object.keys(users[0]).filter((k) => !skipKeys.has(k))
        : [];

      // Pretty labels: camelCase → Title Case
      const label = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

      const headerCells = `<th>#</th>` + allKeys.map((k) => `<th>${label(k)}</th>`).join('') + `<th style="text-align:center;">Actions</th>`;

      const rows = users.map((u, i) => {
        const cells = allKeys.map((k) => {
          const val = u[k];
          if (val == null) return '<td>—</td>';
          if (k === 'createdAt' || k.endsWith('At')) return `<td>${new Date(val).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })} <span style="color:#888;">${new Date(val).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })} CT</span></td>`;
          return `<td>${val}</td>`;
        }).join('');
        const deleteBtn = `<td style="text-align:center;">
          <button onclick="deleteUser(${u.id}, '${(u.email || u.phone || 'User #' + u.id).replace(/'/g, "\\'")}')" class="delete-btn" title="Delete user">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </td>`;
        return `<tr><td>${i + 1}</td>${cells}${deleteBtn}</tr>`;
      }).join('');

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
    function deleteUser(id, name) {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      const modal = document.createElement('div');
      modal.style.cssText = 'background:#fff;border-radius:16px;padding:28px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
      modal.innerHTML = \`
        <h3 style="font-size:18px;font-weight:800;margin-bottom:6px;">Delete User</h3>
        <p style="font-size:14px;color:#555;margin-bottom:16px;">
          This will permanently delete <strong>\${name}</strong> and all their data (programs, workouts, sessions, PRs). This cannot be undone.
        </p>
        <p style="font-size:13px;color:#888;margin-bottom:8px;">Type <strong style="color:#ef4444;">delete</strong> to confirm:</p>
        <input id="delete-confirm-input" type="text" placeholder="Type delete" style="width:100%;padding:10px 14px;border:2px solid #ddd;border-radius:8px;font-size:15px;outline:none;margin-bottom:16px;box-sizing:border-box;" />
        <div style="display:flex;gap:10px;">
          <button id="delete-cancel-btn" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>
          <button id="delete-confirm-btn" style="flex:1;padding:10px;border-radius:8px;border:none;background:#ddd;color:#888;font-size:14px;font-weight:600;cursor:not-allowed;" disabled>Delete</button>
        </div>
      \`;
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const input = document.getElementById('delete-confirm-input');
      const confirmBtn = document.getElementById('delete-confirm-btn');
      const cancelBtn = document.getElementById('delete-cancel-btn');

      input.focus();
      input.addEventListener('input', () => {
        if (input.value.toLowerCase().trim() === 'delete') {
          confirmBtn.disabled = false;
          confirmBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
        } else {
          confirmBtn.disabled = true;
          confirmBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:none;background:#ddd;color:#888;font-size:14px;font-weight:600;cursor:not-allowed;';
        }
      });

      cancelBtn.addEventListener('click', () => document.body.removeChild(overlay));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

      confirmBtn.addEventListener('click', async () => {
        confirmBtn.textContent = 'Deleting...';
        confirmBtn.disabled = true;
        try {
          const res = await fetch('/admin/users/' + id + '?key=${key}', { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            document.body.removeChild(overlay);
            location.reload();
          } else {
            alert('Failed: ' + (data.error || 'Unknown error'));
            document.body.removeChild(overlay);
          }
        } catch (err) {
          alert('Failed: ' + err.message);
          document.body.removeChild(overlay);
        }
      });
    }
  </script>
  <style>
    .delete-btn { background: none; border: none; cursor: pointer; color: #999; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
    .delete-btn:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
    @media print { .delete-btn { display: none; } }
  </style>
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
      <tr>${headerCells}</tr>
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

// DELETE /admin/users/:id?key=YOUR_ADMIN_KEY — Delete a user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID' });

    const user = await db.findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.deleteUser(userId);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/analytics?key=YOUR_ADMIN_KEY — Session Analytics
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const sessions = await db.getSessionAnalytics();
    const key = req.adminKey;

    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);

    const completed = sessions.filter((s) => s.completed);
    const completedThisWeek = completed.filter((s) => new Date(s.createdAt) >= weekAgo);
    const completedThisMonth = completed.filter((s) => new Date(s.createdAt) >= monthAgo);
    const uniqueUsers = new Set(completed.map((s) => s.userId));

    // Most active users — count completed sessions per user
    const userCounts = {};
    for (const s of completed) {
      const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email || s.username || `User #${s.userId}`;
      if (!userCounts[s.userId]) userCounts[s.userId] = { name, email: s.email, count: 0, lastWorkout: s.createdAt };
      userCounts[s.userId].count++;
      if (new Date(s.createdAt) > new Date(userCounts[s.userId].lastWorkout)) {
        userCounts[s.userId].lastWorkout = s.createdAt;
      }
    }
    const topUsers = Object.values(userCounts).sort((a, b) => b.count - a.count).slice(0, 20);

    const topUserRows = topUsers.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${u.name}</td>
        <td>${u.email || '—'}</td>
        <td>${u.count}</td>
        <td>${new Date(u.lastWorkout).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      </tr>`).join('');

    // Most popular workouts
    const workoutCounts = {};
    for (const s of completed) {
      const name = s.templateName || 'Unknown';
      workoutCounts[name] = (workoutCounts[name] || 0) + 1;
    }
    const topWorkouts = Object.entries(workoutCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topWorkoutRows = topWorkouts.map(([name, count], i) => `
      <tr><td>${i + 1}</td><td>${name}</td><td>${count}</td></tr>`).join('');

    // Recent activity (last 20 sessions)
    const recentRows = sessions.slice(0, 20).map((s) => {
      const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email || s.username || `User #${s.userId}`;
      return `
      <tr>
        <td>${name}</td>
        <td>${s.templateName || '—'}</td>
        <td>${s.completed ? '<span style="color: #22c55e; font-weight: 600;">Completed</span>' : '<span style="color: #888;">In Progress</span>'}</td>
        <td>${new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      </tr>`;
    }).join('');

    res.send(adminPage('Session Analytics', `
  <div class="breadcrumb"><a href="/admin?key=${key}">Dashboard</a> / Session Analytics</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Session Analytics</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat">
      <div class="value">${completed.length}</div>
      <div class="label">Total Workouts</div>
    </div>
    <div class="stat">
      <div class="value">${uniqueUsers.size}</div>
      <div class="label">Active Users</div>
    </div>
    <div class="stat">
      <div class="value">${completedThisWeek.length}</div>
      <div class="label">This Week</div>
    </div>
    <div class="stat">
      <div class="value">${completedThisMonth.length}</div>
      <div class="label">This Month</div>
    </div>
  </div>

  <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Most Active Users</h3>
  <table style="margin-bottom: 32px;">
    <thead>
      <tr><th>#</th><th>Name</th><th>Email</th><th>Workouts</th><th>Last Workout</th></tr>
    </thead>
    <tbody>${topUserRows || '<tr><td colspan="5" style="text-align:center; color:#888;">No completed workouts yet</td></tr>'}</tbody>
  </table>

  <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Most Popular Workouts</h3>
  <table style="margin-bottom: 32px;">
    <thead>
      <tr><th>#</th><th>Workout</th><th>Times Completed</th></tr>
    </thead>
    <tbody>${topWorkoutRows || '<tr><td colspan="3" style="text-align:center; color:#888;">No completed workouts yet</td></tr>'}</tbody>
  </table>

  <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Recent Activity</h3>
  <table>
    <thead>
      <tr><th>User</th><th>Workout</th><th>Status</th><th>Date</th></tr>
    </thead>
    <tbody>${recentRows || '<tr><td colspan="4" style="text-align:center; color:#888;">No sessions yet</td></tr>'}</tbody>
  </table>
    `));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
