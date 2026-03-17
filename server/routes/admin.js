import express, { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { Resend } from 'resend';
import pool from '../dbPool.js';

const router = Router();

// Generate a session token
const activeSessions = new Set();

function adminAuth(req, res, next) {
  // Check cookie first
  const sessionToken = req.cookies?.admin_session;
  if (sessionToken && activeSessions.has(sessionToken)) {
    req.adminKey = process.env.ADMIN_KEY;
    return next();
  }
  // Key-in-URL fallback (disabled — uncomment to re-enable):
  // const key = req.query.key || req.headers['x-admin-key'];
  // if (process.env.ADMIN_KEY && key === process.env.ADMIN_KEY) {
  //   req.adminKey = key;
  //   return next();
  // }
  // Not authenticated — redirect to login for HTML requests, 401 for API
  if (req.headers.accept?.includes('text/html') || req.query.format === 'html') {
    return res.redirect('/admin/login');
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// GET /admin/login — Login page
router.get('/login', (req, res) => {
  const error = req.query.error || '';
  res.send(adminLoginPage(error));
});

// POST /admin/login — Handle login
router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || 'admin';

  // Check DB password first, fall back to env var
  const dbHash = await db.getAdminSetting('admin_password_hash');
  let valid = false;
  if (dbHash) {
    valid = username === validUser && bcrypt.compareSync(password, dbHash);
  } else {
    const validPass = process.env.ADMIN_PASS || process.env.ADMIN_KEY;
    valid = username === validUser && password === validPass;
  }

  if (valid) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token);
    res.cookie('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.redirect('/admin');
  }
  return res.redirect('/admin/login?error=Invalid+credentials');
});

// POST /admin/change-password — Change admin password (requires login)
router.post('/change-password', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.redirect('/admin?msg=Password+must+be+at+least+6+characters');
  }
  if (newPassword !== confirmPassword) {
    return res.redirect('/admin?msg=Passwords+do+not+match');
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.setAdminSetting('admin_password_hash', hash);
  return res.redirect('/admin?msg=Password+updated+successfully');
});

// GET /admin/forgot-password — Forgot password page
router.get('/forgot-password', (req, res) => {
  const msg = req.query.msg || '';
  res.send(adminLoginPage('', `
    <div style="text-align:center;margin-bottom:16px;">
      <p style="color:rgba(255,255,255,0.5);font-size:13px;">Enter your admin email to receive a password reset link.</p>
    </div>
    ${msg ? '<div class="error" style="background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.3);color:#4ade80;">' + msg + '</div>' : ''}
    <form method="POST" action="/admin/forgot-password">
      <div class="field">
        <label>Admin Email</label>
        <input type="email" name="email" placeholder="Enter admin email" required />
      </div>
      <button type="submit" class="btn-login">Send Reset Link</button>
    </form>
    <div style="text-align:center;margin-top:16px;">
      <a href="/admin/login" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;">Back to Login</a>
    </div>
  `));
});

// POST /admin/forgot-password — Send reset email
router.post('/forgot-password', express.urlencoded({ extended: false }), async (req, res) => {
  const { email } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL;

  // Always show success to prevent email enumeration
  if (email === adminEmail && process.env.RESEND_API_KEY) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.setAdminSetting('admin_reset_token', token);
    await db.setAdminSetting('admin_reset_expires', new Date(Date.now() + 3600000).toISOString());

    const resetUrl = `https://will-fit.shop/admin/reset-password?token=${token}`;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'WillFit <noreply@will-fit.shop>',
        to: adminEmail,
        subject: 'Admin Dashboard Password Reset',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h1 style="color:#111;font-size:24px;">Reset Admin Password</h1>
            <p style="color:#444;font-size:16px;line-height:1.6;">Click the button below to reset your admin dashboard password. This link expires in 1 hour.</p>
            <a href="${resetUrl}" style="display:inline-block;margin-top:20px;padding:14px 28px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Reset Password</a>
            <p style="color:#999;font-size:13px;margin-top:32px;">If you didn't request this, ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Failed to send admin reset email:', err.message);
    }
  }
  return res.redirect('/admin/forgot-password?msg=If+that+email+is+registered,+a+reset+link+has+been+sent.');
});

// GET /admin/reset-password — Reset password page
router.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  const storedToken = await db.getAdminSetting('admin_reset_token');
  const expires = await db.getAdminSetting('admin_reset_expires');

  if (!token || token !== storedToken || !expires || new Date(expires) < new Date()) {
    return res.redirect('/admin/login?error=Invalid+or+expired+reset+link');
  }

  res.send(adminLoginPage('', `
    <form method="POST" action="/admin/reset-password">
      <input type="hidden" name="token" value="${token}" />
      <div class="field">
        <label>New Password</label>
        <input type="password" name="newPassword" placeholder="Enter new password" required minlength="6" />
      </div>
      <div class="field">
        <label>Confirm Password</label>
        <input type="password" name="confirmPassword" placeholder="Confirm new password" required />
      </div>
      <button type="submit" class="btn-login">Reset Password</button>
    </form>
    <div style="text-align:center;margin-top:16px;">
      <a href="/admin/login" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;">Back to Login</a>
    </div>
  `));
});

// POST /admin/reset-password — Process password reset
router.post('/reset-password', express.urlencoded({ extended: false }), async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;
  const storedToken = await db.getAdminSetting('admin_reset_token');
  const expires = await db.getAdminSetting('admin_reset_expires');

  if (!token || token !== storedToken || !expires || new Date(expires) < new Date()) {
    return res.redirect('/admin/login?error=Invalid+or+expired+reset+link');
  }
  if (!newPassword || newPassword.length < 6) {
    return res.redirect(`/admin/reset-password?token=${token}&error=Password+must+be+at+least+6+characters`);
  }
  if (newPassword !== confirmPassword) {
    return res.redirect(`/admin/reset-password?token=${token}&error=Passwords+do+not+match`);
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await db.setAdminSetting('admin_password_hash', hash);
  // Clear reset token
  await db.setAdminSetting('admin_reset_token', '');
  await db.setAdminSetting('admin_reset_expires', '');
  // Clear all sessions so old login is invalidated
  activeSessions.clear();

  return res.redirect('/admin/login?error=Password+reset+successfully.+Please+log+in.');
});

// GET /admin/logout
router.get('/logout', (req, res) => {
  const sessionToken = req.cookies?.admin_session;
  if (sessionToken) activeSessions.delete(sessionToken);
  res.clearCookie('admin_session');
  res.redirect('/admin/login');
});

function adminLoginPage(error, customContent) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit Admin — Login</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      background: #000; color: #fff;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      -webkit-font-smoothing: antialiased;
    }
    body::before {
      content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 28px 28px;
    }
    .login-card {
      position: relative; z-index: 1; width: 100%; max-width: 380px; padding: 0 24px;
    }
    .logo { font-size: 36px; font-weight: 900; letter-spacing: 2px; text-align: center; margin-bottom: 8px; }
    .logo span { color: #ef4444; }
    .subtitle { text-align: center; color: rgba(255,255,255,0.4); font-size: 14px; margin-bottom: 32px; }
    .glass {
      background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px;
    }
    label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-weight: 600; }
    input[type="text"], input[type="password"], input[type="email"] {
      width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.06); color: #fff; font-size: 15px; font-family: inherit;
      outline: none; transition: border-color 0.2s;
    }
    input:focus { border-color: rgba(239,68,68,0.6); box-shadow: 0 0 0 2px rgba(239,68,68,0.15); }
    .field { margin-bottom: 16px; }
    .btn-login {
      width: 100%; padding: 14px; border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
      font-family: inherit; cursor: pointer; color: #fff;
      background: linear-gradient(135deg, #DC2626, #EF4444, #F97316);
      background-size: 200% 200%; animation: grad 3s ease infinite;
      box-shadow: 0 4px 20px rgba(239,68,68,0.3); transition: all 0.2s;
    }
    .btn-login:hover { box-shadow: 0 6px 30px rgba(239,68,68,0.45); transform: translateY(-1px); }
    @keyframes grad { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    .error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #f87171; margin-bottom: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo">WILL<span>FIT</span></div>
    <p class="subtitle">Admin Dashboard</p>
    <div class="glass">
      ${error ? `<div class="error">${error}</div>` : ''}
      ${customContent || `
      <form method="POST" action="/admin/login">
        <div class="field">
          <label>Username</label>
          <input type="text" name="username" placeholder="Enter username" required autocomplete="username" />
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" name="password" placeholder="Enter password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-login">Sign In</button>
      </form>
      <div style="text-align:center;margin-top:16px;">
        <a href="/admin/forgot-password" style="color:rgba(255,255,255,0.4);font-size:13px;text-decoration:none;">Forgot password?</a>
      </div>
      `}
    </div>
  </div>
</body>
</html>`;
}

function adminPage(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WillFit Admin — ${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      background: #000;
      color: #fff;
      padding: 32px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 28px 28px;
    }
    .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; }

    /* Logo */
    .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
    .logo span { color: #ef4444; }

    .header { margin-bottom: 28px; }
    .header h1 { font-size: 28px; font-weight: 800; color: #fff; }
    .header h2 { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.5); margin-top: 4px; }
    .header p { color: rgba(255,255,255,0.4); margin-top: 4px; font-size: 13px; }
    .breadcrumb { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 20px; }
    .breadcrumb a { color: #ef4444; text-decoration: none; font-weight: 600; }
    .breadcrumb a:hover { text-decoration: underline; }

    /* Glass cards */
    .glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }

    .stats { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat { flex: 1; min-width: 140px; padding: 20px; }
    .stat .value { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #ef4444, #f97316); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .stat .label { font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }

    /* Tables */
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-wrap table { min-width: 600px; }
    .table-wrap th { position: sticky; top: 0; z-index: 1; }
    table { width: 100%; border-collapse: collapse; }
    th { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
    td { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 13px; color: rgba(255,255,255,0.8); }
    tr:hover td { background: rgba(255,255,255,0.03); }

    /* Buttons */
    .btn {
      background: linear-gradient(135deg, #DC2626, #EF4444, #F97316);
      background-size: 200% 200%;
      animation: gradShift 3s ease infinite;
      color: #fff; border: none; padding: 10px 20px; border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 24px;
      margin-right: 8px; text-decoration: none; display: inline-block;
      box-shadow: 0 4px 20px rgba(239,68,68,0.3);
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .btn:hover { box-shadow: 0 6px 30px rgba(239,68,68,0.45); transform: translateY(-1px); }
    @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }

    .btn-ghost {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7); padding: 10px 20px; border-radius: 10px;
      font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 24px;
      margin-right: 8px; text-decoration: none; display: inline-block;
      transition: all 0.2s;
    }
    .btn-ghost:hover { background: rgba(255,255,255,0.1); color: #fff; }

    /* Card grid */
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { padding: 28px; text-decoration: none; color: #fff; transition: all 0.3s; display: block; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 0 8px rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.05); }
    .card:hover { border-color: rgba(255,255,255,0.25); transform: translateY(-2px); background: rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.06), 0 0 1px rgba(255,255,255,0.2); }
    .card .card-icon { font-size: 32px; margin-bottom: 14px; }
    .card .card-title { font-size: 18px; font-weight: 700; }
    .card .card-desc { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 8px; line-height: 1.6; }

    /* Section titles */
    h3 { color: #fff; }

    /* Delete button */
    .delete-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
    .delete-btn:hover { color: #ef4444; background: rgba(239,68,68,0.15); }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

    @media print {
      .btn, .btn-ghost, .breadcrumb, .delete-btn { display: none; }
      body { padding: 16px; background: #fff; color: #111; }
      body::before { display: none; }
      .glass { background: #fff; border: 1px solid #ddd; backdrop-filter: none; }
      .stat .value { -webkit-text-fill-color: #111; background: none; }
      .stat .label { color: #888; }
      th { background: #111; color: #fff; }
      td { color: #333; border-top-color: #eee; }
      tr:hover td { background: transparent; }
      .card { border: 1px solid #ddd; }
      .card .card-desc { color: #666; }
    }
  </style>
</head>
<body>
<nav style="position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:12px 32px;background:linear-gradient(135deg,rgba(20,0,0,0.92),rgba(30,5,5,0.92),rgba(20,0,0,0.92));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(239,68,68,0.2);box-shadow:0 2px 20px rgba(239,68,68,0.08),inset 0 -1px 0 rgba(239,68,68,0.1);">
  <a href="/admin" style="text-decoration:none;"><div class="logo" style="margin:0;color:#fff;">WILL<span style="color:#ef4444;">FIT</span></div></a>
  <div style="display:flex;align-items:center;gap:8px;">
    <a href="/admin" style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='rgba(255,255,255,0.5)';this.style.background='none'">Home</a>
    <div style="position:relative;">
      <button onclick="var d=document.getElementById('settings-dropdown');d.style.display=d.style.display==='block'?'none':'block'" style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;background:none;border:none;cursor:pointer;padding:8px 14px;border-radius:8px;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;gap:4px;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='rgba(255,255,255,0.5)';this.style.background='none'">
        Settings
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
      </button>
      <div id="settings-dropdown" style="display:none;position:absolute;right:0;top:100%;margin-top:4px;background:rgba(20,20,20,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:4px;min-width:180px;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
        <button onclick="document.getElementById('settings-dropdown').style.display='none';document.getElementById('pw-modal').style.display='flex'" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;cursor:pointer;border-radius:8px;font-family:inherit;" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'" onmouseout="this.style.background='none';this.style.color='rgba(255,255,255,0.7)'">Change Password</button>
        <button onclick="document.getElementById('settings-dropdown').style.display='none';window.location.href='/admin/forgot-password'" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;cursor:pointer;border-radius:8px;font-family:inherit;" onmouseover="this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'" onmouseout="this.style.background='none';this.style.color='rgba(255,255,255,0.7)'">Reset Password</button>
      </div>
    </div>
    <a href="/admin/logout" style="color:#ef4444;font-size:12px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:8px;transition:all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'">Logout</a>
  </div>
</nav>
<script>document.addEventListener('click',function(e){var d=document.getElementById('settings-dropdown');if(d&&d.style.display==='block'&&!e.target.closest('[onclick*="settings-dropdown"]')&&!d.contains(e.target))d.style.display='none';});</script>
<div style="height:56px;"></div>
<div class="container">
<!-- Change Password Modal -->
<div id="pw-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);" onclick="if(event.target===this)this.style.display='none'">
  <div class="glass" style="padding:28px;max-width:400px;width:90%;border-radius:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="font-size:16px;font-weight:700;color:#fff;">Change Password</h3>
      <button onclick="document.getElementById('pw-modal').style.display='none'" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;padding:4px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <form method="POST" action="/admin/change-password">
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;font-weight:600;">New Password</label>
        <input type="password" name="newPassword" placeholder="Min 6 characters" required minlength="6"
          style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;font-weight:600;">Confirm Password</label>
        <input type="password" name="confirmPassword" placeholder="Confirm password" required
          style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
      </div>
      <button type="submit" class="btn" style="margin:0;width:100%;padding:12px;font-size:14px;">Update Password</button>
    </form>
  </div>
</div>
${body}
</div>
</body>
</html>`;
}

// Escape HTML entities to prevent XSS in admin dashboard output
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function helpBlock(text) {
  const id = 'help-' + Math.random().toString(36).slice(2, 8);
  return `<div style="margin-top:32px;padding:20px 24px;border-top:1px solid rgba(255,255,255,0.06);cursor:pointer;" onclick="document.getElementById('${id}').style.display='flex'">
    <p style="font-size:11px;color:rgba(255,255,255,0.25);line-height:1.8;">${text}</p>
    <p style="font-size:10px;color:rgba(255,255,255,0.15);margin-top:8px;text-align:center;">Click to expand</p>
  </div>
  <div id="${id}" style="display:none;position:fixed;inset:0;z-index:9998;background:#fff;overflow-y:auto;padding:0;" onclick="if(event.target===this||event.target.id==='${id}-close')this.style.display='none'">
    <div style="max-width:700px;margin:0 auto;padding:48px 32px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
        <div>
          <h1 style="font-size:24px;font-weight:800;color:#111;margin:0;">Page Guide</h1>
          <p style="font-size:13px;color:#888;margin-top:4px;">How this page works</p>
        </div>
        <button id="${id}-close" onclick="document.getElementById('${id}').style.display='none'" style="background:#f5f5f5;border:none;width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <p style="font-size:15px;color:#333;line-height:2;">${text}</p>
    </div>
  </div>`;
}

// GET /admin — Admin Dashboard Home
router.get('/', adminAuth, async (req, res) => {
  const key = req.adminKey;

  let totalUsers = 0, activeUsers7d = 0, newUsers7d = 0;
  try {
    const users = await db.getAllUsers();
    totalUsers = users.length;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    newUsers7d = users.filter(u => u.createdAt && new Date(u.createdAt) >= new Date(weekAgo)).length;
    const active = await db.getActiveUsers();
    activeUsers7d = active.last7d;
  } catch {}

  res.send(adminPage('Dashboard', `
  <div class="header">
    <h1>Admin Dashboard</h1>
    <p>WillFit administration panel</p>
  </div>
  <div class="stats" style="margin-top:8px;">
    <div class="stat glass">
      <div class="value">${totalUsers}</div>
      <div class="label">Total Users</div>
    </div>
    <div class="stat glass">
      <div class="value">${activeUsers7d}</div>
      <div class="label">Active (7 Days)</div>
    </div>
    <div class="stat glass">
      <div class="value">${newUsers7d}</div>
      <div class="label">New (7 Days)</div>
    </div>
  </div>
  <div class="card-grid">
    <a class="card glass" href="/admin/users?format=html">
      <div class="card-icon">👥</div>
      <div class="card-title">User Sign Ups</div>
      <div class="card-desc">View all registered users, contact info, referral sources, and export data.</div>
    </a>
    <a class="card glass" href="/admin/analytics">
      <div class="card-icon">📊</div>
      <div class="card-title">Session Analytics</div>
      <div class="card-desc">Workout completions, most active users, and recent activity across all users.</div>
    </a>
    <a class="card glass" href="/admin/builds" style="border-color:rgba(239,68,68,0.25);">
      <div class="card-icon">🔨</div>
      <div class="card-title">Pending Builds</div>
      <div class="card-desc">Track progress on features, integrations, and requirements needed for launch.</div>
    </a>
    <a class="card glass" href="/admin/feedback">
      <div class="card-icon">💬</div>
      <div class="card-title">Feedback</div>
      <div class="card-desc">View bug reports and improvement ideas submitted by users.</div>
    </a>
    <a class="card glass" href="/admin/retention">
      <div class="card-icon">📈</div>
      <div class="card-title">Retention Dashboard</div>
      <div class="card-desc">Day 1, 7, and 30 retention rates across your user base.</div>
    </a>
    <a class="card glass" href="/admin/active">
      <div class="card-icon">🟢</div>
      <div class="card-title">Active Users</div>
      <div class="card-desc">Users who logged a session in the last 24 hours, 7 days, and 30 days.</div>
    </a>
    <a class="card glass" href="/admin/referrals">
      <div class="card-icon">🔗</div>
      <div class="card-title">Referral Breakdown</div>
      <div class="card-desc">See where your users are coming from by referral source.</div>
    </a>
    <a class="card glass" href="/admin/devices">
      <div class="card-icon">📱</div>
      <div class="card-title">Device Breakdown</div>
      <div class="card-desc">Signup device distribution across your user base.</div>
    </a>
    <a class="card glass" href="/admin/workouts">
      <div class="card-icon">🏋️</div>
      <div class="card-title">Workout Library</div>
      <div class="card-desc">Browse all programs and templates in the workout library.</div>
    </a>
    <a class="card glass" href="/admin/announcements">
      <div class="card-icon">📢</div>
      <div class="card-title">Announcements</div>
      <div class="card-desc">Create and manage announcements shown to users in the app.</div>
    </a>
    <a class="card glass" href="/admin/flags">
      <div class="card-icon">🚩</div>
      <div class="card-title">Feature Flags</div>
      <div class="card-desc">Toggle features on and off without deploying code.</div>
    </a>
    <a class="card glass" href="/admin/health">
      <div class="card-icon">💚</div>
      <div class="card-title">Health Check</div>
      <div class="card-desc">Server status, database connection, memory usage, and uptime.</div>
    </a>
    <a class="card glass" href="/admin/errors">
      <div class="card-icon">🚨</div>
      <div class="card-title">Error Log</div>
      <div class="card-desc">View the last 50 server errors captured in memory.</div>
    </a>
    <a class="card glass" href="/admin/revenue">
      <div class="card-icon">💰</div>
      <div class="card-title">Revenue Dashboard</div>
      <div class="card-desc">Track revenue when paid plans are launched.</div>
    </a>
    <a class="card glass" href="/admin/subscriptions">
      <div class="card-icon">💳</div>
      <div class="card-title">Subscription Manager</div>
      <div class="card-desc">Manage user subscriptions when paid plans are launched.</div>
    </a>
  </div>

  ${req.query.msg ? `<div class="glass" style="margin-top:24px;padding:14px 20px;border-left:3px solid #22c55e;"><p style="color:#4ade80;font-size:13px;">${req.query.msg}</p></div>` : ''}
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
          return `<td>${esc(val)}</td>`;
        }).join('');
        const deleteBtn = `<td style="text-align:center;">
          <button onclick="deleteUser(${u.id}, '${(u.email || u.phone || 'User #' + u.id).replace(/'/g, "\\'")}')" class="delete-btn" title="Delete user">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </td>`;
        return `<tr><td>${i + 1}</td>${cells}${deleteBtn}</tr>`;
      }).join('');

      return res.send(adminPage('User Sign Ups', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / User Sign Ups</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>User Sign Ups</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <a class="btn" onclick="window.print()" href="javascript:void(0)">Print / Save as PDF</a>
  <a class="btn-ghost" onclick="exportExcel()" href="javascript:void(0)">Export to Excel</a>
  <a class="btn-ghost" onclick="toggleFullscreen()" href="javascript:void(0)" id="fs-btn">Fullscreen Table</a>
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
      modal.innerHTML = '<h3 style="font-size:18px;font-weight:800;margin-bottom:6px;">Delete User</h3>'
        + '<p style="font-size:14px;color:#555;margin-bottom:16px;">This will permanently delete <strong>' + name + '</strong> and all their data. This cannot be undone.</p>'
        + '<p style="font-size:13px;color:#888;margin-bottom:8px;">Type <strong style="color:#ef4444;">delete</strong> to confirm:</p>'
        + '<input id="delete-confirm-input" type="text" placeholder="Type delete" style="width:100%;padding:10px 14px;border:2px solid #ddd;border-radius:8px;font-size:15px;outline:none;margin-bottom:16px;box-sizing:border-box;" />'
        + '<div style="display:flex;gap:10px;">'
        + '<button id="delete-cancel-btn" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>'
        + '<button id="delete-confirm-btn" style="flex:1;padding:10px;border-radius:8px;border:none;background:#ddd;color:#888;font-size:14px;font-weight:600;cursor:not-allowed;" disabled>Delete</button>'
        + '</div>';
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
    .table-fullscreen {
      position: fixed !important; inset: 0 !important; z-index: 9998 !important;
      border-radius: 0 !important; max-height: 100vh !important;
      background: #000 !important; margin: 0 !important;
    }
    .table-fullscreen table { min-width: auto !important; }
    .table-fullscreen th { position: sticky; top: 0; z-index: 1; background: rgba(30,30,30,0.98) !important; }
    .fs-close {
      position: fixed; top: 12px; right: 12px; z-index: 9999;
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
      color: #fff; border-radius: 10px; padding: 8px 16px; font-size: 13px;
      font-weight: 600; cursor: pointer; font-family: inherit; display: none;
    }
    .fs-close:hover { background: rgba(255,255,255,0.2); }
    @media print { .delete-btn, #fs-btn, .fs-close { display: none !important; } }
  </style>
  <button class="fs-close" id="fs-close-btn" onclick="toggleFullscreen()">Exit Fullscreen</button>
  <script>
    function toggleFullscreen() {
      const wrap = document.querySelector('.table-wrap');
      const closeBtn = document.getElementById('fs-close-btn');
      const fsBtn = document.getElementById('fs-btn');
      if (wrap.classList.contains('table-fullscreen')) {
        wrap.classList.remove('table-fullscreen');
        closeBtn.style.display = 'none';
        fsBtn.textContent = 'Fullscreen Table';
        document.body.style.overflow = '';
      } else {
        wrap.classList.add('table-fullscreen');
        closeBtn.style.display = 'block';
        fsBtn.textContent = 'Exit Fullscreen';
        document.body.style.overflow = 'hidden';
      }
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const wrap = document.querySelector('.table-wrap');
        if (wrap && wrap.classList.contains('table-fullscreen')) toggleFullscreen();
      }
    });
  </script>
  <div class="stats" style="margin-top:8px;">
    <div class="stat glass">
      <div class="value">${users.length}</div>
      <div class="label">Total Users</div>
    </div>
    <div class="stat glass">
      <div class="value">${users.filter(u => u.email).length}</div>
      <div class="label">Email Signups</div>
    </div>
    <div class="stat glass">
      <div class="value">${users.filter(u => u.phone).length}</div>
      <div class="label">Phone Signups</div>
    </div>
  </div>
  <div class="glass table-wrap" style="border-radius:16px;width:98vw;position:relative;left:50%;transform:translateX(-50%);">
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
  ${helpBlock('This page shows every registered user on WillFit, excluding demo accounts. Each row displays the information the user provided during signup, including their name, email or phone, username, zip code, gender, referral source, referral code, UTM marketing parameters (captured from ad links), their signup device and browser, the city and state detected from their IP address, and the exact date and time they created their account. You can delete a user by clicking the X icon in the Actions column — this permanently removes their account and all associated data including programs, workouts, sessions, and personal records. Use the Print button to save a PDF snapshot, Export to Excel to download a CSV file, or Fullscreen Table to expand the table for easier viewing on smaller screens. The table scrolls horizontally on mobile devices. All timestamps are shown in Central Time (CT).')}`));
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
      <tr><td>${i + 1}</td><td>${esc(name)}</td><td>${count}</td></tr>`).join('');

    // Recent activity (last 20 sessions)
    const recentRows = sessions.slice(0, 20).map((s) => {
      const name = [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email || s.username || `User #${s.userId}`;
      return `
      <tr>
        <td>${esc(name)}</td>
        <td>${s.templateName || '—'}</td>
        <td>${s.completed ? '<span style="color: #22c55e; font-weight: 600;">Completed</span>' : '<span style="color: #888;">In Progress</span>'}</td>
        <td>${new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      </tr>`;
    }).join('');

    res.send(adminPage('Session Analytics', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Session Analytics</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Session Analytics</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats" style="margin-top:8px;">
    <div class="stat glass">
      <div class="value">${completed.length}</div>
      <div class="label">Total Workouts</div>
    </div>
    <div class="stat glass">
      <div class="value">${uniqueUsers.size}</div>
      <div class="label">Active Users</div>
    </div>
    <div class="stat glass">
      <div class="value">${completedThisWeek.length}</div>
      <div class="label">This Week</div>
    </div>
    <div class="stat glass">
      <div class="value">${completedThisMonth.length}</div>
      <div class="label">This Month</div>
    </div>
  </div>

  <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: rgba(255,255,255,0.7);">Most Active Users</h3>
  <div class="glass table-wrap" style="border-radius:16px;overflow:hidden;margin-bottom:32px;">
  <table>
    <thead>
      <tr><th>#</th><th>Name</th><th>Email</th><th>Workouts</th><th>Last Workout</th></tr>
    </thead>
    <tbody>${topUserRows || '<tr><td colspan="5" style="text-align:center; color:rgba(255,255,255,0.3);">No completed workouts yet</td></tr>'}</tbody>
  </table>
  </div>

  <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: rgba(255,255,255,0.7);">Most Popular Workouts</h3>
  <div class="glass table-wrap" style="border-radius:16px;overflow:hidden;margin-bottom:32px;">
  <table>
    <thead>
      <tr><th>#</th><th>Workout</th><th>Times Completed</th></tr>
    </thead>
    <tbody>${topWorkoutRows || '<tr><td colspan="3" style="text-align:center; color:rgba(255,255,255,0.3);">No completed workouts yet</td></tr>'}</tbody>
  </table>
  </div>

  <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: rgba(255,255,255,0.7);">Recent Activity</h3>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead>
      <tr><th>User</th><th>Workout</th><th>Status</th><th>Date</th></tr>
    </thead>
    <tbody>${recentRows || '<tr><td colspan="4" style="text-align:center; color:rgba(255,255,255,0.3);">No sessions yet</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('Session Analytics gives you a high-level view of how your users are engaging with WillFit. Total Workouts counts every completed workout session across all users. Active Users shows unique users who have completed at least one workout. This Week and This Month filter those counts to recent time periods so you can spot trends. The Most Active Users table ranks users by how many workouts they have completed, helping you identify your power users. Most Popular Workouts shows which workout templates are being used most frequently, which can inform which types of programs to create more of. Recent Activity is a live feed of the last 20 workout sessions logged, showing who worked out, what they did, whether they completed it, and when. Demo accounts are excluded from all calculations.')}
    `));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 1. Feedback Viewer
// ============================================================
router.get('/feedback', adminAuth, async (req, res) => {
  try {
    const feedback = await db.getAllFeedback();
    const rows = feedback.map((f, i) => {
      const name = [f.first_name, f.last_name].filter(Boolean).join(' ') || f.email || 'Unknown';
      const date = new Date(f.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
      const time = new Date(f.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
      const typeBadge = f.type === 'Bug Report'
        ? '<span style="background:rgba(239,68,68,0.15);color:#f87171;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">Bug</span>'
        : '<span style="background:rgba(59,130,246,0.15);color:#60a5fa;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">Idea</span>';
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(name)}</td>
        <td>${typeBadge}</td>
        <td style="max-width:400px;word-wrap:break-word;">${esc(f.message)}</td>
        <td>${date} <span style="color:#888;">${time} CT</span></td>
      </tr>`;
    }).join('');

    res.send(adminPage('Feedback', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Feedback</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Feedback</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value">${feedback.length}</div>
      <div class="label">Total Submissions</div>
    </div>
    <div class="stat glass">
      <div class="value">${feedback.filter(f => f.type === 'Bug Report').length}</div>
      <div class="label">Bug Reports</div>
    </div>
    <div class="stat glass">
      <div class="value">${feedback.filter(f => f.type !== 'Bug Report').length}</div>
      <div class="label">Ideas</div>
    </div>
  </div>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead><tr><th>#</th><th>User</th><th>Type</th><th>Message</th><th>Date</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);">No feedback yet</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('The Feedback page displays every bug report and improvement idea submitted by users through the Send Feedback form in their Profile tab. Each submission is saved to your database with the user\'s name, the type of feedback (Bug Report or Improvement Idea), their full message, and the date and time it was submitted. Feedback is not visible to other users — only you can see it here. Use this page to prioritize which bugs to fix and which features to build next based on real user input. The stats at the top give you a quick breakdown of total submissions, bug reports, and ideas. This replaced the old FormSubmit integration, so all feedback is now stored internally and never leaves your server.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 2. Retention Dashboard
// ============================================================
router.get('/retention', adminAuth, async (req, res) => {
  try {
    const stats = await db.getRetentionStats();
    const pct = (val) => stats.totalUsers > 0 ? ((val / stats.totalUsers) * 100).toFixed(1) : '0.0';

    res.send(adminPage('Retention', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Retention Dashboard</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Retention Dashboard</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value">${stats.totalUsers}</div>
      <div class="label">Total Users</div>
    </div>
    <div class="stat glass">
      <div class="value">${stats.day1}</div>
      <div class="label">Day 1 Retained (${pct(stats.day1)}%)</div>
    </div>
    <div class="stat glass">
      <div class="value">${stats.day7}</div>
      <div class="label">Day 7 Retained (${pct(stats.day7)}%)</div>
    </div>
    <div class="stat glass">
      <div class="value">${stats.day30}</div>
      <div class="label">Day 30 Retained (${pct(stats.day30)}%)</div>
    </div>
  </div>
  <div class="glass" style="padding:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;color:rgba(255,255,255,0.7);">How Retention is Measured</h3>
    <div style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.8;">
      <p><strong style="color:#fff;">Day 1:</strong> Users who logged a workout exactly 1 day after signing up.</p>
      <p><strong style="color:#fff;">Day 7:</strong> Users who logged a workout between 6-8 days after signing up.</p>
      <p><strong style="color:#fff;">Day 30:</strong> Users who logged a workout between 29-31 days after signing up.</p>
      <p style="margin-top:12px;">Demo accounts are excluded from all calculations.</p>
    </div>
  </div>
  ${helpBlock('Retention measures how many users come back to the app after signing up. Day 1 Retention counts users who logged at least one workout exactly one day after creating their account — this tells you whether users find value on their first real day. Day 7 Retention counts users who returned between 6-8 days after signup, indicating whether the app has enough stickiness to keep them through the first week. Day 30 Retention measures users who came back around a month later, which is the strongest signal of long-term product-market fit. Industry benchmarks for fitness apps: Day 1 is typically 20-30%, Day 7 is 10-15%, and Day 30 is 5-10%. If your numbers are below these, focus on improving the onboarding experience and adding engagement features like push notifications and streak tracking. Percentages are calculated against total registered users (excluding demo accounts).')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 3. Referral Breakdown
// ============================================================
router.get('/referrals', adminAuth, async (req, res) => {
  try {
    const data = await db.getReferralBreakdown();
    const total = data.reduce((sum, d) => sum + parseInt(d.count), 0);
    const maxCount = data.length > 0 ? parseInt(data[0].count) : 1;
    const bars = data.map(d => {
      const count = parseInt(d.count);
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      const width = ((count / maxCount) * 100).toFixed(0);
      return `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:13px;color:#fff;font-weight:600;">${d.source}</span>
          <span style="font-size:13px;color:rgba(255,255,255,0.5);">${count} (${pct}%)</span>
        </div>
        <div style="background:rgba(255,255,255,0.08);border-radius:6px;height:24px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#ef4444,#f97316);height:100%;width:${width}%;border-radius:6px;transition:width 0.3s;"></div>
        </div>
      </div>`;
    }).join('');

    res.send(adminPage('Referral Breakdown', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Referral Breakdown</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Referral Breakdown</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value">${total}</div>
      <div class="label">Total Users</div>
    </div>
    <div class="stat glass">
      <div class="value">${data.length}</div>
      <div class="label">Referral Sources</div>
    </div>
  </div>
  <div class="glass" style="padding:24px;">
    ${bars || '<p style="color:rgba(255,255,255,0.3);text-align:center;">No referral data yet</p>'}
  </div>
  ${helpBlock('Referral Breakdown shows where your users discovered WillFit. This data comes from the "How did you hear about us?" dropdown on the signup form. Each bar represents a referral source with its user count and percentage of total signups. Sources include Facebook/Instagram Ad, YouTube Ad, TikTok, Google Search, Friend/Word of Mouth (which also captures who referred them), and Other (with a custom text field). Users who selected "Friend" will show as "Friend: [name]" if they provided a referral name. Use this data to understand which marketing channels are driving the most signups and allocate your ad spend accordingly. If "Unknown" has a high count, those are users who signed up before the referral field was added or skipped it. UTM parameters from ad links are tracked separately in the User Sign Ups table for more granular campaign-level attribution.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 4. Device Breakdown
// ============================================================
router.get('/devices', adminAuth, async (req, res) => {
  try {
    const data = await db.getDeviceBreakdown();
    const total = data.reduce((sum, d) => sum + parseInt(d.count), 0);
    const maxCount = data.length > 0 ? parseInt(data[0].count) : 1;
    const bars = data.map(d => {
      const count = parseInt(d.count);
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
      const width = ((count / maxCount) * 100).toFixed(0);
      return `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:13px;color:#fff;font-weight:600;">${d.device}</span>
          <span style="font-size:13px;color:rgba(255,255,255,0.5);">${count} (${pct}%)</span>
        </div>
        <div style="background:rgba(255,255,255,0.08);border-radius:6px;height:24px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);height:100%;width:${width}%;border-radius:6px;transition:width 0.3s;"></div>
        </div>
      </div>`;
    }).join('');

    res.send(adminPage('Device Breakdown', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Device Breakdown</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Device Breakdown</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value">${total}</div>
      <div class="label">Total Users</div>
    </div>
    <div class="stat glass">
      <div class="value">${data.length}</div>
      <div class="label">Device Types</div>
    </div>
  </div>
  <div class="glass" style="padding:24px;">
    ${bars || '<p style="color:rgba(255,255,255,0.3);text-align:center;">No device data yet</p>'}
  </div>
  ${helpBlock('Device Breakdown shows what devices and browsers your users are signing up from. On the web, this is detected automatically from the browser\'s User-Agent header and shows results like "iPhone (Safari)", "Windows (Chrome)", or "Mac (Safari)". When the app is converted to a native iOS app via Capacitor, it will capture richer device information including the exact model (e.g. "iPhone 15 Pro") and OS version (e.g. "iOS 18.2"). This data helps you prioritize which platforms to test on and optimize for. If most of your users are on iPhone Safari, that\'s your primary testing target. If you see a lot of Android users, you may want to consider building an Android version as well. "Unknown" entries are from users who signed up before device tracking was added.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 5. Workout Library Manager
// ============================================================
router.get('/workouts', adminAuth, async (req, res) => {
  try {
    const programs = await db.getWorkoutLibrary();
    const rows = programs.map((p, i) => {
      const isGlobal = p.user_id === null;
      const badge = isGlobal
        ? '<span style="background:rgba(34,197,94,0.15);color:#4ade80;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">Global</span>'
        : '<span style="background:rgba(59,130,246,0.15);color:#60a5fa;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">User</span>';
      return `<tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.description || '—'}</td>
        <td>${badge}</td>
        <td>${p.template_count}</td>
        <td>${new Date(p.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })}</td>
      </tr>`;
    }).join('');

    res.send(adminPage('Workout Library', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Workout Library</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Workout Library</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value">${programs.length}</div>
      <div class="label">Total Programs</div>
    </div>
    <div class="stat glass">
      <div class="value">${programs.filter(p => p.user_id === null).length}</div>
      <div class="label">Global Programs</div>
    </div>
    <div class="stat glass">
      <div class="value">${programs.reduce((sum, p) => sum + parseInt(p.template_count), 0)}</div>
      <div class="label">Total Templates</div>
    </div>
  </div>
  <div class="glass" style="padding:14px 20px;margin-bottom:24px;border-left:3px solid #f59e0b;">
    <p style="color:#fbbf24;font-size:13px;">Read-only view. Editing coming soon.</p>
  </div>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Description</th><th>Type</th><th>Templates</th><th>Created</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:rgba(255,255,255,0.3);">No programs yet</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('The Workout Library shows every program in the WillFit database. Programs labeled "Global" are the pre-built workout programs that ship with the app (like Push Pull Legs, Upper/Lower, Bro Split, etc.) and are visible to all users. Programs labeled "User" are custom programs created by individual users — each user can only see their own custom programs. The Templates column shows how many individual workouts exist within each program. This page is currently read-only, meaning you can browse but not edit programs from the dashboard. In the future, this will be expanded to allow creating, editing, and deleting programs directly from here without needing to modify the code. To add new global programs today, they need to be added as seed data in the server\'s initDb.js file.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 6. Announcement Manager
// ============================================================
router.get('/announcements', adminAuth, async (req, res) => {
  try {
    const announcements = await db.getAnnouncements();
    const rows = announcements.map((a) => {
      const statusBadge = a.active
        ? '<span style="background:rgba(34,197,94,0.15);color:#4ade80;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">Active</span>'
        : '<span style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">Inactive</span>';
      const date = new Date(a.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
      return `<tr>
        <td>${a.id}</td>
        <td style="max-width:400px;word-wrap:break-word;">${esc(a.message)}</td>
        <td>${statusBadge}</td>
        <td>${date}</td>
        <td>
          <form method="POST" action="/admin/announcements/toggle" style="display:inline;">
            <input type="hidden" name="id" value="${a.id}" />
            <input type="hidden" name="active" value="${a.active ? 'false' : 'true'}" />
            <button type="submit" class="btn-ghost" style="margin:0;padding:6px 12px;font-size:11px;">${a.active ? 'Deactivate' : 'Activate'}</button>
          </form>
          <form method="POST" action="/admin/announcements/delete" style="display:inline;margin-left:4px;">
            <input type="hidden" name="id" value="${a.id}" />
            <button type="submit" class="delete-btn" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </form>
        </td>
      </tr>`;
    }).join('');

    res.send(adminPage('Announcements', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Announcements</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Announcement Manager</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="glass" style="padding:24px;margin-bottom:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.7);">Create New Announcement</h3>
    <form method="POST" action="/admin/announcements/create" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
      <div style="flex:1;min-width:300px;">
        <label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;font-weight:600;">Message</label>
        <input type="text" name="message" placeholder="Enter announcement message..." required
          style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;" />
      </div>
      <button type="submit" class="btn" style="margin:0;padding:10px 20px;font-size:13px;">Publish</button>
    </form>
    <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:8px;">Publishing a new announcement will deactivate all previous ones.</p>
  </div>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead><tr><th>ID</th><th>Message</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);">No announcements yet</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('Announcements let you broadcast a message to all WillFit users. When you publish an announcement, it becomes the active announcement and any previously active announcement is automatically deactivated — only one announcement can be active at a time. Active announcements can be displayed as a banner in the app (via the /feedback/announcement API endpoint). Announcements are not permanent — you can deactivate them at any time by clicking the Deactivate button, which hides them from users without deleting them. You can also reactivate old announcements or delete them entirely. Common uses: maintenance notices ("The app will be down for maintenance tonight at 10pm"), new feature announcements ("We just launched the 1RM Estimator!"), or community messages ("Join our March fitness challenge!"). Deleted announcements cannot be recovered.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/announcements/create', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  try {
    await db.createAnnouncement(req.body.message);
    res.redirect('/admin/announcements');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/announcements/toggle', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  try {
    await db.toggleAnnouncement(Number(req.body.id), req.body.active === 'true');
    res.redirect('/admin/announcements');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/announcements/delete', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  try {
    await db.deleteAnnouncement(Number(req.body.id));
    res.redirect('/admin/announcements');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 7. Feature Flags
// ============================================================
router.get('/flags', adminAuth, async (req, res) => {
  try {
    const flags = await db.getFeatureFlags();
    const rows = flags.map((f) => {
      const statusBadge = f.enabled
        ? '<span style="background:rgba(34,197,94,0.15);color:#4ade80;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">ON</span>'
        : '<span style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.4);padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;">OFF</span>';
      return `<tr>
        <td style="font-family:monospace;font-size:13px;color:#f97316;">${f.key}</td>
        <td>${f.description || '—'}</td>
        <td>${statusBadge}</td>
        <td>
          <form method="POST" action="/admin/flags/toggle" style="display:inline;">
            <input type="hidden" name="key" value="${f.key}" />
            <input type="hidden" name="enabled" value="${f.enabled ? 'false' : 'true'}" />
            <button type="submit" class="btn-ghost" style="margin:0;padding:6px 12px;font-size:11px;">${f.enabled ? 'Disable' : 'Enable'}</button>
          </form>
          <form method="POST" action="/admin/flags/delete" style="display:inline;margin-left:4px;">
            <input type="hidden" name="key" value="${f.key}" />
            <button type="submit" class="delete-btn" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </form>
        </td>
      </tr>`;
    }).join('');

    res.send(adminPage('Feature Flags', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Feature Flags</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Feature Flags</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="glass" style="padding:24px;margin-bottom:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.7);">Add New Flag</h3>
    <form method="POST" action="/admin/flags/create" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
      <div style="flex:1;min-width:160px;">
        <label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;font-weight:600;">Key</label>
        <input type="text" name="key" placeholder="e.g. dark_mode_v2" required
          style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;" />
      </div>
      <div style="flex:1;min-width:200px;">
        <label style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;font-weight:600;">Description</label>
        <input type="text" name="description" placeholder="What does this flag do?"
          style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;" />
      </div>
      <button type="submit" class="btn" style="margin:0;padding:10px 20px;font-size:13px;">Add Flag</button>
    </form>
  </div>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead><tr><th>Key</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.3);">No feature flags yet</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('Feature Flags allow you to turn features on or off in the app without deploying new code. Each flag has a unique key (like "ai_workout_generator" or "premium_analytics"), a description of what it controls, and an on/off toggle. When you add a flag, it starts as OFF. The app can check these flags via the API to decide whether to show or hide certain features. This is useful for: gradually rolling out new features to test them before a full launch, quickly disabling a broken feature without a code deploy, enabling premium features for specific conditions, or running A/B tests. Flags persist in the database, so they survive server restarts. To use a flag in the app code, query the /feedback/flags endpoint (or add a dedicated endpoint) and conditionally render UI based on the flag\'s enabled state. Deleting a flag removes it permanently — if the app code references it, the feature will fall back to its default behavior.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/flags/create', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  try {
    await db.setFeatureFlag(req.body.key, false, req.body.description || '');
    res.redirect('/admin/flags');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/flags/toggle', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  try {
    const flags = await db.getFeatureFlags();
    const existing = flags.find(f => f.key === req.body.key);
    await db.setFeatureFlag(req.body.key, req.body.enabled === 'true', existing?.description || '');
    res.redirect('/admin/flags');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/flags/delete', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  try {
    await db.deleteFeatureFlag(req.body.key);
    res.redirect('/admin/flags');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 8. Error Log
// ============================================================
router.get('/errors', adminAuth, async (req, res) => {
  try {
    // Import errorLog from index.js
    let errors = [];
    try {
      const { errorLog } = await import('../index.js');
      errors = errorLog || [];
    } catch (_) {
      // errorLog may not be available if imported differently
    }

    const rows = errors.map((e, i) => {
      const date = new Date(e.timestamp).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
      const time = new Date(e.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', second: '2-digit' });
      return `<tr>
        <td>${i + 1}</td>
        <td><span style="font-family:monospace;font-size:12px;color:#f97316;">${e.method}</span> ${e.url}</td>
        <td style="max-width:400px;word-wrap:break-word;color:#f87171;">${e.message}</td>
        <td>${date} <span style="color:#888;">${time} CT</span></td>
      </tr>`;
    }).join('');

    res.send(adminPage('Error Log', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Error Log</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Error Log</h2>
    <p>Showing last ${errors.length} errors (in-memory, resets on server restart)</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value">${errors.length}</div>
      <div class="label">Errors Captured</div>
    </div>
  </div>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead><tr><th>#</th><th>Endpoint</th><th>Error</th><th>Time</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.3);">No errors captured. That\'s a good thing!</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('The Error Log captures the last 50 server errors that occurred while the app is running. Each entry shows the HTTP method and URL that triggered the error, the error message, and the timestamp. This log is stored in memory (RAM), not in the database, which means it resets every time the server restarts or Render redeploys. This is intentional — it keeps the database clean and only captures recent, relevant errors. If the table is empty, that means no unhandled errors have occurred since the last server restart, which is a good sign. Common errors you might see: database connection timeouts, failed API calls to external services (like Resend for emails or ip-api for geolocation), or malformed request data from the client. For persistent error logging, consider integrating a service like Sentry or LogRocket in the future.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 9. Health Check
// ============================================================
router.get('/health', adminAuth, async (req, res) => {
  try {
    let dbStatus = 'Connected';
    let dbLatency = '—';
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      dbLatency = `${Date.now() - start}ms`;
    } catch (_) {
      dbStatus = 'Disconnected';
    }

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    const secs = Math.floor(uptime % 60);
    const uptimeStr = `${hours}h ${mins}m ${secs}s`;

    const mem = process.memoryUsage();
    const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

    res.send(adminPage('Health Check', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Health Check</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Health Check</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value" style="font-size:24px;">${dbStatus === 'Connected' ? '<span style="-webkit-text-fill-color:#4ade80;">Connected</span>' : '<span style="-webkit-text-fill-color:#f87171;">Down</span>'}</div>
      <div class="label">Database</div>
    </div>
    <div class="stat glass">
      <div class="value" style="font-size:24px;">${dbLatency}</div>
      <div class="label">DB Latency</div>
    </div>
    <div class="stat glass">
      <div class="value" style="font-size:24px;">${uptimeStr}</div>
      <div class="label">Server Uptime</div>
    </div>
  </div>
  <div class="glass" style="padding:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.7);">System Info</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;">Node Version</div>
        <div style="font-size:14px;color:#fff;font-weight:600;">${process.version}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;">Heap Used</div>
        <div style="font-size:14px;color:#fff;font-weight:600;">${formatMB(mem.heapUsed)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;">Heap Total</div>
        <div style="font-size:14px;color:#fff;font-weight:600;">${formatMB(mem.heapTotal)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;">RSS</div>
        <div style="font-size:14px;color:#fff;font-weight:600;">${formatMB(mem.rss)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;">External</div>
        <div style="font-size:14px;color:#fff;font-weight:600;">${formatMB(mem.external)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);margin-bottom:4px;">Platform</div>
        <div style="font-size:14px;color:#fff;font-weight:600;">${process.platform} ${process.arch}</div>
      </div>
    </div>
  </div>
  ${helpBlock('Health Check gives you a real-time snapshot of the server and database status. The Database indicator shows whether PostgreSQL is reachable — "Connected" in green means everything is working, "Down" in red means the database is unreachable. DB Latency shows how long it takes to ping the database in milliseconds — under 50ms is excellent, 50-200ms is normal for a cloud database, over 500ms may indicate issues. Server Uptime shows how long the current server process has been running since the last deploy or restart. Under System Info: Node Version shows the JavaScript runtime version, Heap Used and Heap Total show how much memory the application is consuming (if Heap Used approaches Heap Total, the app may need more memory), RSS (Resident Set Size) is the total memory allocated by the OS, External is memory used by C++ objects bound to JavaScript, and Platform shows the operating system. On Render, this will typically show "linux x64".')}
  `));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 10. Active Users
// ============================================================
router.get('/active', adminAuth, async (req, res) => {
  try {
    const data = await db.getActiveUsers();
    const rows = data.recentUsers.map((u, i) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || `User #${u.user_id}`;
      const date = new Date(u.last_session).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
      const time = new Date(u.last_session).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(name)}</td>
        <td>${u.email || '—'}</td>
        <td>${date} <span style="color:#888;">${time} CT</span></td>
      </tr>`;
    }).join('');

    res.send(adminPage('Active Users', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Active Users</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Active Users</h2>
    <p>Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value">${data.last24h}</div>
      <div class="label">Last 24 Hours</div>
    </div>
    <div class="stat glass">
      <div class="value">${data.last7d}</div>
      <div class="label">Last 7 Days</div>
    </div>
    <div class="stat glass">
      <div class="value">${data.last30d}</div>
      <div class="label">Last 30 Days</div>
    </div>
  </div>
  <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;color:rgba(255,255,255,0.7);">Users Active in Last 7 Days</h3>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Last Session</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.3);">No active users in this period</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('Active Users shows how many unique users have logged at least one workout session within different time windows. Last 24 Hours is your daily active user (DAU) count — this is the most important engagement metric. Last 7 Days gives you a weekly active user (WAU) count, smoothing out day-to-day fluctuations. Last 30 Days is your monthly active user (MAU) count, the standard metric investors and app stores look at. The table below lists every user who was active in the last 7 days, sorted by their most recent session. A healthy ratio is DAU/MAU above 20% — this means at least 1 in 5 monthly users comes back every day. If this ratio is low, consider adding engagement features like push notification reminders, streak tracking, or social features. Demo accounts are excluded from all counts.')}`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 11. Revenue Dashboard (Placeholder)
// ============================================================
router.get('/revenue', adminAuth, (req, res) => {
  res.send(adminPage('Revenue Dashboard', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Revenue Dashboard</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Revenue Dashboard</h2>
  </div>
  <div class="glass" style="padding:48px;text-align:center;">
    <div style="font-size:48px;margin-bottom:20px;">💰</div>
    <h3 style="font-size:20px;font-weight:700;margin-bottom:12px;">Coming Soon</h3>
    <p style="color:rgba(255,255,255,0.4);font-size:14px;max-width:400px;margin:0 auto;line-height:1.8;">Revenue tracking will appear here when paid plans are launched. This will include MRR, total revenue, plan distribution, and growth charts.</p>
  </div>
  ${helpBlock('The Revenue Dashboard will become active once paid subscription plans are integrated into WillFit using Stripe. When launched, this page will display: Monthly Recurring Revenue (MRR) — the total amount of subscription income per month; Total Revenue — cumulative lifetime revenue; Plan Distribution — a breakdown of how many users are on each plan tier (Free, Pro, Lifetime); Growth Charts — visual trends of revenue over time showing month-over-month growth; Churn Rate — the percentage of paying users who cancel each month; and Average Revenue Per User (ARPU). To set up revenue tracking, you will need to create a Stripe account, configure subscription products, add Stripe webhooks to the server, and store subscription status on each user record. See the monetization plan for detailed implementation steps.')}`));
});

// ============================================================
// 12. Subscription Manager (Placeholder)
// ============================================================
router.get('/subscriptions', adminAuth, (req, res) => {
  res.send(adminPage('Subscription Manager', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Subscription Manager</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Subscription Manager</h2>
  </div>
  <div class="glass" style="padding:48px;text-align:center;">
    <div style="font-size:48px;margin-bottom:20px;">💳</div>
    <h3 style="font-size:20px;font-weight:700;margin-bottom:12px;">Coming Soon</h3>
    <p style="color:rgba(255,255,255,0.4);font-size:14px;max-width:400px;margin:0 auto;line-height:1.8;">Subscription management will appear here when paid plans are launched. This will include user plan management, cancellations, and billing history.</p>
  </div>
  ${helpBlock('The Subscription Manager will allow you to view and manage individual user subscriptions once paid plans are live. Features will include: viewing each user\'s current plan (Free, Pro, or Elite); manually upgrading or downgrading a user\'s plan for customer support situations; issuing refunds or credits through Stripe; viewing payment history and invoice details for each user; canceling subscriptions on behalf of users who request it; and identifying users whose payments have failed so you can send them a reminder. This page integrates with Stripe\'s customer and subscription APIs. Until paid plans are configured, this page serves as a placeholder. To begin accepting payments, set up Stripe Connect, create subscription products, and add the billing routes to the server.')}`));
});

// ============================================================
// Pending Builds
// ============================================================
const PENDING_BUILDS = [
  // Payments & Monetization
  { category: 'Payments & Monetization', name: 'Stripe Integration', desc: 'Subscription billing, one-time purchases, webhooks for payment events', status: 'not_started' },
  { category: 'Payments & Monetization', name: 'Subscription Tiers (Free/Pro/Elite)', desc: 'Feature gating based on user plan — Free (basic), Pro (advanced features), Elite (everything + priority)', status: 'not_started' },
  { category: 'Payments & Monetization', name: 'Web-to-App Pro Upgrade Flow', desc: 'In-app screen directing users to will-fit.shop to subscribe via Stripe — avoids Apple\'s 15-30% cut', status: 'not_started' },

  // AI Features
  { category: 'AI Features (Claude API)', name: 'AI Workout Generator', desc: 'Generate personalized workouts based on user goals, experience, equipment, and PR history using Claude API', status: 'not_started' },
  { category: 'AI Features (Claude API)', name: 'AI Help Chatbot', desc: 'In-app chatbot that answers questions about how to use the app, exercise form, and workout advice', status: 'not_started' },

  // Legal & Compliance
  { category: 'Legal & Compliance', name: 'Terms of Service', desc: 'Required by app stores and payment processors', status: 'not_started' },
  { category: 'Legal & Compliance', name: 'Privacy Policy', desc: 'Required by law (GDPR, CCPA) — must explain all data collection', status: 'not_started' },
  { category: 'Legal & Compliance', name: 'Cookie Consent Banner', desc: 'Required in EU for any tracking/analytics', status: 'not_started' },
  { category: 'Legal & Compliance', name: 'Account Deletion', desc: 'Required by Apple App Store — let users delete their own account', status: 'not_started' },
  { category: 'Legal & Compliance', name: 'Data Export', desc: 'Let users download their data (GDPR right to portability)', status: 'not_started' },

  // Security
  { category: 'Security', name: 'Rate Limiting', desc: 'Prevent brute force login attempts and API abuse', status: 'not_started' },
  { category: 'Security', name: 'Input Sanitization', desc: 'Protect against XSS in admin dashboard and user-submitted content', status: 'not_started' },
  { category: 'Security', name: 'Password Strength Requirements', desc: 'Enforce minimum length, complexity on signup', status: 'not_started' },

  // App Store
  { category: 'App Store Submission', name: 'App Store Screenshots', desc: 'Required screenshots for App Store listing', status: 'not_started' },
  { category: 'App Store Submission', name: 'App Icon (1024x1024)', desc: 'High-res icon for App Store', status: 'not_started' },
  { category: 'App Store Submission', name: 'App Store Description & Keywords', desc: 'ASO (App Store Optimization) for discoverability', status: 'not_started' },
  { category: 'App Store Submission', name: 'Age Rating Declaration', desc: 'Self-declare content rating for App Store', status: 'not_started' },
  { category: 'App Store Submission', name: 'App Review Guidelines Compliance', desc: 'Ensure app meets all Apple review requirements', status: 'not_started' },

  // Infrastructure
  { category: 'Infrastructure & Scale', name: 'Database Backups', desc: 'Render free tier has no auto-backup — need paid or manual backups', status: 'not_started' },
  { category: 'Infrastructure & Scale', name: 'Paid Render Tier', desc: 'Free tier sleeps after inactivity — paid stays up 24/7', status: 'not_started' },
  { category: 'Infrastructure & Scale', name: 'CDN for Static Assets', desc: 'Faster load times globally via CloudFront or similar', status: 'not_started' },
  { category: 'Infrastructure & Scale', name: 'Error Monitoring (Sentry)', desc: 'Production error tracking with alerts and stack traces', status: 'not_started' },

  // User Experience
  { category: 'User Experience', name: 'Push Notifications', desc: 'Workout reminders, streak warnings, rest day suggestions', status: 'not_started' },
  { category: 'User Experience', name: 'Email Flows', desc: 'Workout summaries, weekly reports, re-engagement emails for inactive users', status: 'not_started' },
  { category: 'User Experience', name: 'Onboarding Tutorial', desc: 'Guide new users through creating their first workout', status: 'not_started' },
  { category: 'User Experience', name: 'App Rating Prompt', desc: 'Ask happy users to rate on App Store after completing workouts', status: 'not_started' },

  // Analytics & Growth
  { category: 'Analytics & Growth', name: 'Google Analytics / Mixpanel', desc: 'Detailed user behavior tracking beyond the admin dashboard', status: 'not_started' },
  { category: 'Analytics & Growth', name: 'A/B Testing Framework', desc: 'Test different onboarding flows, pricing pages, and UI variants', status: 'not_started' },
  { category: 'Analytics & Growth', name: 'Referral Program', desc: 'Reward users for inviting friends with credits or free months', status: 'not_started' },

  // Optional
  { category: 'Optional', name: 'Apple In-App Purchases', desc: 'Native iOS IAP for in-app subscriptions — Apple takes 15-30%. Optional if using web-only Stripe payments and directing users to will-fit.shop', status: 'not_started' },
  { category: 'Optional', name: 'Receipt Validation', desc: 'Verify App Store receipts server-side to prevent fraud — only needed if using Apple IAP', status: 'not_started' },
  { category: 'Optional', name: 'Google Play Billing', desc: 'Native Android IAP if an Android app is built — Google takes 15-30%', status: 'not_started' },
];

router.get('/builds', adminAuth, async (req, res) => {
  // Load statuses from DB (override defaults)
  let savedStatuses = {};
  try {
    const saved = await db.getAdminSetting('build_statuses');
    if (saved) savedStatuses = JSON.parse(saved);
  } catch {}

  const builds = PENDING_BUILDS.map(b => ({
    ...b,
    status: savedStatuses[b.name] || b.status,
  }));

  const total = builds.length;
  const completed = builds.filter(b => b.status === 'completed').length;
  const inProgress = builds.filter(b => b.status === 'in_progress').length;
  const notStarted = builds.filter(b => b.status === 'not_started').length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Group by category
  const categories = [];
  const seen = new Set();
  for (const b of builds) {
    if (!seen.has(b.category)) {
      seen.add(b.category);
      categories.push(b.category);
    }
  }

  function statusBadge(status) {
    if (status === 'completed') return '<span style="background:rgba(34,197,94,0.15);color:#4ade80;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;">Done</span>';
    if (status === 'in_progress') return '<span style="background:rgba(59,130,246,0.15);color:#60a5fa;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;">In Progress</span>';
    return '<span style="background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;">Not Started</span>';
  }

  function statusSelect(name, current) {
    const opts = ['not_started', 'in_progress', 'completed'];
    const labels = { not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' };
    return '<form method="POST" action="/admin/builds/update" style="display:inline;">'
      + '<input type="hidden" name="name" value="' + name.replace(/"/g, '&quot;') + '" />'
      + '<select name="status" onchange="this.form.submit()" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-family:inherit;cursor:pointer;outline:none;">'
      + opts.map(o => '<option value="' + o + '"' + (o === current ? ' selected' : '') + ' style="background:#111;">' + labels[o] + '</option>').join('')
      + '</select></form>';
  }

  const sections = categories.map(cat => {
    const items = builds.filter(b => b.category === cat);
    const rows = items.map(b => `<tr>
      <td style="font-weight:600;">${b.name}</td>
      <td style="color:rgba(255,255,255,0.5);font-size:12px;max-width:350px;">${b.desc}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${statusSelect(b.name, b.status)}</td>
    </tr>`).join('');
    return `
      <h3 style="font-size:14px;font-weight:700;margin:24px 0 10px;color:rgba(255,255,255,0.6);">${cat}</h3>
      <div class="glass table-wrap" style="border-radius:16px;margin-bottom:8px;">
      <table>
        <thead><tr><th>Feature</th><th>Description</th><th>Status</th><th>Update</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>`;
  }).join('');

  // Progress bar
  const progressBar = `
    <div class="glass" style="padding:20px 24px;margin-bottom:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:600;color:#fff;">Launch Progress</span>
        <span style="font-size:13px;font-weight:700;color:#4ade80;">${pct}%</span>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:6px;height:10px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#22c55e,#4ade80);height:100%;width:${pct}%;border-radius:6px;transition:width 0.3s;"></div>
      </div>
    </div>`;

  res.send(adminPage('Pending Builds', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Pending Builds</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Pending Builds</h2>
    <p>Track features and requirements needed for launch</p>
  </div>
  <div class="stats" style="margin-top:8px;">
    <div class="stat glass">
      <div class="value">${total}</div>
      <div class="label">Total Items</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#4ade80;">${completed}</div>
      <div class="label">Completed</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#60a5fa;">${inProgress}</div>
      <div class="label">In Progress</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:rgba(255,255,255,0.35);">${notStarted}</div>
      <div class="label">Not Started</div>
    </div>
  </div>
  ${progressBar}
  ${sections}
  ${helpBlock('Pending Builds is your launch checklist. It tracks every feature, integration, and requirement that needs to be completed before WillFit is ready for a full production launch on the App Store. Each item has a status that you can update using the dropdown: Not Started (gray), In Progress (blue), or Completed (green). Status changes are saved to the database and persist across sessions. The progress bar at the top shows your overall completion percentage. Categories are organized by priority: Payments & Monetization for revenue generation, AI Features for the Claude API-powered workout generator and help chatbot, Legal & Compliance for app store and legal requirements, Security for protecting user data, App Store Submission for Apple requirements, Infrastructure for scaling and reliability, User Experience for engagement features, and Analytics & Growth for marketing tools. Update statuses as you complete each item to track your progress toward launch.')}
  `));
});

router.post('/builds/update', express.urlencoded({ extended: false }), adminAuth, async (req, res) => {
  try {
    let saved = {};
    try {
      const existing = await db.getAdminSetting('build_statuses');
      if (existing) saved = JSON.parse(existing);
    } catch {}
    saved[req.body.name] = req.body.status;
    await db.setAdminSetting('build_statuses', JSON.stringify(saved));
    res.redirect('/admin/builds');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
