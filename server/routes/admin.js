import express, { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { Resend } from 'resend';
import pool from '../dbPool.js';
import { syncFromWger } from '../syncExercises.js';

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

    /* Sidebar */
    .sidebar {
      position: fixed; top: 49px; left: 0; bottom: 0; width: 200px; z-index: 50;
      background: rgba(10,10,10,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border-right: 1px solid rgba(255,255,255,0.06);
      overflow-y: auto; padding: 8px 0; transition: width 0.2s, transform 0.2s;
    }
    .sidebar.collapsed { width: 40px; overflow: hidden; }
    .sidebar.collapsed .sidebar-section,
    .sidebar.collapsed .sidebar-links,
    .sidebar.collapsed a:not(.sidebar-toggle button) { display: none; }
    .sidebar.collapsed .sidebar-toggle { justify-content: center; }
    .sidebar-toggle {
      display: flex; align-items: center; justify-content: flex-end; padding: 4px 12px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 4px;
    }
    .sidebar-toggle button {
      background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; padding: 6px;
      border-radius: 6px; transition: all 0.15s; display: flex; align-items: center; justify-content: center;
    }
    .sidebar-toggle button:hover { color: #fff; background: rgba(255,255,255,0.08); }
    .sidebar a {
      display: block; padding: 8px 20px; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.4);
      text-decoration: none; transition: all 0.15s; border-left: 2px solid transparent; white-space: nowrap;
    }
    .sidebar a:hover { color: #fff; background: rgba(255,255,255,0.05); border-left-color: rgba(239,68,68,0.4); }
    .sidebar a.active { color: #ef4444; background: rgba(239,68,68,0.08); border-left-color: #ef4444; font-weight: 700; }
    .sidebar-section {
      font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.2);
      padding: 12px 20px 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center;
      justify-content: space-between; user-select: none; transition: color 0.15s;
    }
    .sidebar-section:hover { color: rgba(255,255,255,0.4); }
    .sidebar-section .chevron { transition: transform 0.2s; }
    .sidebar-section.collapsed-section .chevron { transform: rotate(-90deg); }
    .sidebar-links { overflow: hidden; transition: max-height 0.25s ease; max-height: 500px; }
    .sidebar-links.hidden { max-height: 0; }
    .main-with-sidebar { margin-left: 200px; transition: margin-left 0.2s; }
    .main-with-sidebar.expanded { margin-left: 40px; }

    /* Scrollbar */
    html { overflow-y: scroll; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 5px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }

    @media (max-width: 768px) {
      .sidebar { width: 0; overflow: hidden; border-right: none; }
      .main-with-sidebar { margin-left: 0 !important; }
    }
    @media print {
      .sidebar { display: none; }
      .main-with-sidebar { margin-left: 0; }
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
<!-- Sidebar -->
<div class="sidebar" id="admin-sidebar">
  <div class="sidebar-toggle">
    <button id="sidebar-toggle-btn" onclick="toggleSidebar()" title="Toggle sidebar">
      <svg id="sidebar-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
    </button>
  </div>
  <div class="sidebar-section" onclick="toggleSection('overview')">
    <span>Overview</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-overview">
    <a href="/admin"${title === 'Dashboard' ? ' class="active"' : ''}>Dashboard</a>
    <a href="/admin/users?format=html"${title === 'Users' ? ' class="active"' : ''}>User Sign Ups</a>
    <a href="/admin/analytics"${title === 'Analytics' ? ' class="active"' : ''}>Session Analytics</a>
    <a href="/admin/builds"${title === 'Builds' ? ' class="active"' : ''}>Pending Builds</a>
    <a href="/admin/ai-usage"${title === 'AI Usage' ? ' class="active"' : ''}>AI Usage</a>
  </div>
  <div class="sidebar-section" onclick="toggleSection('users')">
    <span>Users</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-users">
    <a href="/admin/feedback"${title === 'Feedback' ? ' class="active"' : ''}>Feedback</a>
    <a href="/admin/retention"${title === 'Retention' ? ' class="active"' : ''}>Retention</a>
    <a href="/admin/active"${title === 'Active Users' ? ' class="active"' : ''}>Active Users</a>
    <a href="/admin/referrals"${title === 'Referrals' ? ' class="active"' : ''}>Referrals</a>
    <a href="/admin/devices"${title === 'Devices' ? ' class="active"' : ''}>Devices</a>
  </div>
  <div class="sidebar-section" onclick="toggleSection('content')">
    <span>Content</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-content">
    <a href="/admin/workouts"${title === 'Workouts' ? ' class="active"' : ''}>Workout Library</a>
    <a href="/admin/announcements"${title === 'Announcements' ? ' class="active"' : ''}>Announcements</a>
    <a href="/admin/flags"${title === 'Feature Flags' ? ' class="active"' : ''}>Feature Flags</a>
    <a href="/admin/correspondence"${title === 'User Correspondence' ? ' class="active"' : ''}>Correspondence</a>
    <a href="/admin/custom-exercises"${title === 'Custom Exercises' ? ' class="active"' : ''}>Custom Exercises</a>
  </div>
  <div class="sidebar-section" onclick="toggleSection('system')">
    <span>System</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-system">
    <a href="/admin/health"${title === 'Health' ? ' class="active"' : ''}>Health Check</a>
    <a href="/admin/errors"${title === 'Errors' ? ' class="active"' : ''}>Error Log</a>
    <a href="/admin/revenue"${title === 'Revenue' ? ' class="active"' : ''}>Revenue</a>
    <a href="/admin/subscriptions"${title === 'Subscriptions' ? ' class="active"' : ''}>Subscriptions</a>
    <a href="/admin/workout-manager"${title === 'Workout Manager' || title === 'Create a Workout' || title === 'View Current Workouts' ? ' class="active"' : ''}>Workout Manager</a>
  </div>
</div>
<script>
function toggleSidebar() {
  const sb = document.getElementById('admin-sidebar');
  const main = document.querySelector('.main-with-sidebar');
  const icon = document.getElementById('sidebar-toggle-icon');
  const collapsed = sb.classList.toggle('collapsed');
  main.classList.toggle('expanded', collapsed);
  icon.style.transform = collapsed ? 'rotate(180deg)' : '';
  try { localStorage.setItem('admin_sidebar', collapsed ? 'collapsed' : 'open'); } catch {}
}
function toggleSection(name) {
  const links = document.getElementById('section-' + name);
  const section = links.previousElementSibling;
  links.classList.toggle('hidden');
  section.classList.toggle('collapsed-section');
  try {
    const state = JSON.parse(localStorage.getItem('admin_sections') || '{}');
    state[name] = links.classList.contains('hidden');
    localStorage.setItem('admin_sections', JSON.stringify(state));
  } catch {}
}
// Restore state
try {
  if (localStorage.getItem('admin_sidebar') === 'collapsed') {
    document.getElementById('admin-sidebar').classList.add('collapsed');
    document.querySelector('.main-with-sidebar').classList.add('expanded');
    var ic = document.getElementById('sidebar-toggle-icon');
    if (ic) ic.style.transform = 'rotate(180deg)';
  }
  const sections = JSON.parse(localStorage.getItem('admin_sections') || '{}');
  for (const [name, hidden] of Object.entries(sections)) {
    if (hidden) {
      const el = document.getElementById('section-' + name);
      if (el) { el.classList.add('hidden'); el.previousElementSibling.classList.add('collapsed-section'); }
    }
  }
} catch {}
</script>
<div class="main-with-sidebar">
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

  // Read version from client
  let appVersion = '—';
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dir = path.dirname(fileURLToPath(import.meta.url));
    const versionPath = path.join(__dir, '..', '..', 'client', 'src', 'version.js');
    const content = fs.readFileSync(versionPath, 'utf-8');
    const match = content.match(/APP_VERSION\s*=\s*['"](.+?)['"]/);
    if (match) appVersion = match[1];
  } catch {}

  // Get app size (client dist folder)
  let appSize = '—';
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dir = path.dirname(fileURLToPath(import.meta.url));
    const distPath = path.join(__dir, '..', '..', 'client', 'dist');
    function dirSize(dirPath) {
      let size = 0;
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) size += dirSize(full);
        else size += fs.statSync(full).size;
      }
      return size;
    }
    const bytes = dirSize(distPath);
    if (bytes > 1024 * 1024) appSize = (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    else appSize = (bytes / 1024).toFixed(0) + ' KB';
  } catch {}

  res.send(adminPage('Dashboard', `
  <div class="header" style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1>Admin Dashboard</h1>
      <p>WillFit administration panel</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:700;color:#fff;">v${appVersion}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px;">App size: ${appSize}</div>
    </div>
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
    <a class="card glass" href="/admin/ai-usage">
      <div class="card-icon">🤖</div>
      <div class="card-title">AI Usage</div>
      <div class="card-desc">Track Claude API usage, costs, and request history.</div>
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
    <a class="card glass" href="/admin/correspondence">
      <div class="card-icon">📧</div>
      <div class="card-title">User Correspondence</div>
      <div class="card-desc">Edit welcome emails, notification templates, and text message content.</div>
    </a>
    <a class="card glass" href="/admin/custom-exercises">
      <div class="card-icon">🆕</div>
      <div class="card-title">Custom Exercises</div>
      <div class="card-desc">User-created exercises to review and add to the official library.</div>
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
    <a class="card glass" href="/admin/workout-manager" style="border-color:rgba(239,68,68,0.25);">
      <div class="card-icon">🏋️‍♂️</div>
      <div class="card-title">Workout Manager</div>
      <div class="card-desc">Create and manage workouts in the browse library. Workouts show up for all users.</div>
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

      const headerCells = `<th>#</th>` + allKeys.map((k, i) => `<th style="cursor:pointer;user-select:none;" onclick="sortTable(${i + 1})" title="Sort by ${label(k)}">${label(k)} <span style="opacity:0.3;font-size:9px;">⇅</span></th>`).join('') + `<th style="text-align:center;">Actions</th>`;

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
    let sortCol = -1;
    let sortAsc = true;
    function sortTable(colIdx) {
      const table = document.querySelector('table');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));

      if (sortCol === colIdx) {
        sortAsc = !sortAsc;
      } else {
        sortCol = colIdx;
        sortAsc = true;
      }

      rows.sort((a, b) => {
        const aCell = a.cells[colIdx];
        const bCell = b.cells[colIdx];
        if (!aCell || !bCell) return 0;
        let aVal = aCell.textContent.trim();
        let bVal = bCell.textContent.trim();

        // Try numeric sort
        const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ''));
        const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ''));
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortAsc ? aNum - bNum : bNum - aNum;
        }

        // Try date sort
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        if (!isNaN(aDate) && !isNaN(bDate) && aVal.length > 5) {
          return sortAsc ? aDate - bDate : bDate - aDate;
        }

        // Treat dashes as empty (sort to end)
        if (aVal === '—') aVal = '';
        if (bVal === '—') bVal = '';

        // String sort
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });

      // Re-number rows and re-append
      rows.forEach((row, i) => {
        row.cells[0].textContent = i + 1;
        tbody.appendChild(row);
      });

      // Update header arrows
      table.querySelectorAll('th span').forEach((s, i) => {
        if (i === colIdx - 1) {
          s.textContent = sortAsc ? '▲' : '▼';
          s.style.opacity = '1';
        } else {
          s.textContent = '⇅';
          s.style.opacity = '0.3';
        }
      });
    }

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
    <div class="stat glass" style="min-width:180px;">
      <div class="value">${users.length}</div>
      <div class="label">Total Users</div>
      <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;color:rgba(255,255,255,0.4);">Free</span>
          <span style="font-size:14px;font-weight:700;color:#4ade80;">${users.filter(u => (u.plan || 'Free') === 'Free').length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:11px;color:rgba(255,255,255,0.4);">Pro</span>
          <span style="font-size:14px;font-weight:700;color:#60a5fa;">${users.filter(u => u.plan === 'Pro').length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;color:rgba(255,255,255,0.4);">Elite</span>
          <span style="font-size:14px;font-weight:700;color:#c084fc;">${users.filter(u => u.plan === 'Elite').length}</span>
        </div>
      </div>
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
  <div class="stats">
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#4ade80;">$0.00</div>
      <div class="label">Revenue Today</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#4ade80;">$0.00</div>
      <div class="label">Revenue This Month</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#4ade80;">$0.00</div>
      <div class="label">Revenue YTD</div>
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

// ============================================================
// AI Usage Tracking
// ============================================================
router.get('/ai-usage', adminAuth, async (req, res) => {
  try {
    const stats = await db.getAIUsageStats();
    const fmt = (cents) => '$' + (cents / 100).toFixed(4);
    const fmtUsd = (cents) => '$' + (cents / 100).toFixed(2);

    const rows = stats.recent.map((r, i) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Unknown';
      const date = new Date(r.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });
      const time = new Date(r.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
      return `<tr>
        <td>${i + 1}</td>
        <td>${esc(name)}</td>
        <td>${r.model || '—'}</td>
        <td>${r.input_tokens?.toLocaleString() || 0}</td>
        <td>${r.output_tokens?.toLocaleString() || 0}</td>
        <td>${fmt(parseFloat(r.cost_cents || 0))}</td>
        <td>${date} <span style="color:#888;">${time} CT</span></td>
      </tr>`;
    }).join('');

    res.send(adminPage('AI Usage', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / AI Usage</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>AI Usage Tracking</h2>
    <p>Claude API usage and costs</p>
  </div>
  <div class="stats" style="margin-top:8px;">
    <div class="stat glass">
      <div class="value">${stats.totalRequests}</div>
      <div class="label">Total Requests</div>
    </div>
    <div class="stat glass">
      <div class="value">${stats.todayRequests}</div>
      <div class="label">Today</div>
    </div>
    <div class="stat glass">
      <div class="value">${stats.monthRequests}</div>
      <div class="label">This Month</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#4ade80;">${fmtUsd(stats.todayCostCents)}</div>
      <div class="label">Cost Today</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#4ade80;">${fmtUsd(stats.monthCostCents)}</div>
      <div class="label">Cost This Month</div>
    </div>
    <div class="stat glass">
      <div class="value" style="-webkit-text-fill-color:#4ade80;">${fmtUsd(stats.totalCostCents)}</div>
      <div class="label">Cost All Time</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat glass">
      <div class="value" style="font-size:20px;">${stats.totalInputTokens.toLocaleString()}</div>
      <div class="label">Total Input Tokens</div>
    </div>
    <div class="stat glass">
      <div class="value" style="font-size:20px;">${stats.totalOutputTokens.toLocaleString()}</div>
      <div class="label">Total Output Tokens</div>
    </div>
  </div>
  <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;color:rgba(255,255,255,0.7);">Recent Requests</h3>
  <div class="glass table-wrap" style="border-radius:16px;">
  <table>
    <thead><tr><th>#</th><th>User</th><th>Model</th><th>Input Tokens</th><th>Output Tokens</th><th>Cost</th><th>Date</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.3);">No AI requests yet</td></tr>'}</tbody>
  </table>
  </div>
  ${helpBlock('AI Usage tracks every request made to the Claude API through the AI Workout Generator. Each request logs the user who made it, the model used (currently Claude Haiku for cost efficiency), the number of input and output tokens consumed, the calculated cost, and the timestamp. Costs are calculated using Anthropic pricing: $0.25 per million input tokens and $1.25 per million output tokens for Haiku. A typical workout generation costs approximately $0.001 (one-tenth of a cent). The stats cards show request counts and costs for today, this month, and all time. Use this page to monitor usage patterns and ensure costs stay within budget. If costs are higher than expected, check if any users are generating an unusually high number of workouts. Consider adding per-user daily limits if needed.')}
    `));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/sync-exercises — pull new exercises from wger.de
router.post('/sync-exercises', adminAuth, async (req, res) => {
  try {
    const result = await syncFromWger();
    res.json(result);
  } catch (err) {
    console.error('Exercise sync error:', err);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
});

// GET /admin/correspondence — Email & SMS template editor
router.get('/correspondence', adminAuth, async (req, res) => {
  try {
    // Load saved templates from DB, fall back to defaults
    const { rows } = await pool.query('SELECT * FROM email_templates ORDER BY name');
    const templates = {};
    for (const r of rows) templates[r.name] = { subject: r.subject, html: r.html, updatedAt: r.updated_at };

    const defaultTemplates = [
      { name: 'welcome', label: 'Welcome Email', desc: 'Sent to new users upon sign up' },
      { name: 'password_reset', label: 'Password Reset', desc: 'Sent when a user requests a password reset' },
      { name: 'admin_signup_notification', label: 'Admin Signup Notification', desc: 'Sent to admin when a new user signs up' },
      { name: 'daily_summary', label: 'Daily Summary', desc: 'Daily analytics email sent to admin' },
    ];

    const cards = defaultTemplates.map(t => {
      const saved = templates[t.name];
      const lastEdited = saved?.updatedAt
        ? new Date(saved.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Never (using default)';
      return `<a class="card glass" href="/admin/correspondence/${t.name}" style="text-decoration:none;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div class="card-title" style="font-size:16px;">${t.label}</div>
            <div class="card-desc" style="margin-top:4px;">${t.desc}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </div>
        <div style="margin-top:12px;font-size:11px;color:rgba(255,255,255,0.3);">Last edited: ${lastEdited}</div>
      </a>`;
    }).join('');

    res.send(adminPage('User Correspondence', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / User Correspondence</div>
      <div class="header">
        <h1>User Correspondence</h1>
        <p>Edit the emails and messages sent to users. Changes take effect immediately.</p>
      </div>
      <div class="card-grid">${cards}</div>
      <div style="margin-top:24px;padding:16px 20px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);">
        <p style="font-size:12px;color:rgba(255,255,255,0.3);">
          <strong style="color:rgba(255,255,255,0.5);">Coming soon:</strong> SMS templates for text message notifications.
        </p>
      </div>
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load correspondence settings.</p>'));
  }
});

// GET /admin/correspondence/:name — Edit a specific email template
router.get('/correspondence/:name', adminAuth, async (req, res) => {
  const templateName = req.params.name;
  const labels = {
    welcome: 'Welcome Email',
    password_reset: 'Password Reset',
    admin_signup_notification: 'Admin Signup Notification',
    daily_summary: 'Daily Summary',
  };

  if (!labels[templateName]) {
    return res.redirect('/admin/correspondence');
  }

  // Load saved or use current default
  const { rows } = await pool.query('SELECT * FROM email_templates WHERE name = $1', [templateName]);
  const saved = rows[0];

  // Get defaults from email.js (approximate — show current content)
  const defaults = {
    welcome: { subject: 'Welcome to WillFit!', html: 'Default welcome email template' },
    password_reset: { subject: 'Reset your WillFit password', html: 'Default password reset template' },
    admin_signup_notification: { subject: 'New WillFit Signup', html: 'Default admin notification template' },
    daily_summary: { subject: 'WillFit Daily Summary', html: 'Default daily summary template' },
  };

  const current = saved || defaults[templateName];
  const msg = req.query.msg || '';

  res.send(adminPage(`Edit — ${labels[templateName]}`, `
    <div class="breadcrumb"><a href="/admin">Dashboard</a> / <a href="/admin/correspondence">Correspondence</a> / ${labels[templateName]}</div>
    <div class="header">
      <h1>${labels[templateName]}</h1>
      <p>Edit the subject line and HTML body. Use {{firstName}}, {{email}}, {{resetUrl}} as placeholders.</p>
    </div>
    ${msg ? `<div class="glass" style="padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;"><p style="color:#4ade80;font-size:13px;">${esc(msg)}</p></div>` : ''}
    <form method="POST" action="/admin/correspondence/${templateName}">
      <div class="glass" style="padding:24px;border-radius:16px;">
        <div style="margin-bottom:16px;">
          <label>Subject Line</label>
          <input type="text" name="subject" value="${esc(current.subject)}" required
            style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:16px;">
          <label>HTML Body</label>
          <textarea name="html" required rows="18"
            style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:'Space Mono',monospace;outline:none;resize:vertical;line-height:1.6;box-sizing:border-box;">${esc(current.html)}</textarea>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="submit" class="btn" style="margin:0;">Save Template</button>
          <a href="/admin/correspondence" class="btn-ghost" style="margin:0;text-align:center;">Cancel</a>
        </div>
      </div>
    </form>
  `));
});

// POST /admin/correspondence/:name — Save email template
router.post('/correspondence/:name', adminAuth, express.urlencoded({ extended: false }), async (req, res) => {
  const templateName = req.params.name;
  const { subject, html } = req.body;

  if (!subject || !html) {
    return res.redirect(`/admin/correspondence/${templateName}?msg=Subject+and+body+are+required`);
  }

  try {
    const { rows: existing } = await pool.query('SELECT id FROM email_templates WHERE name = $1', [templateName]);
    if (existing.length > 0) {
      await pool.query(
        'UPDATE email_templates SET subject = $1, html = $2, updated_at = NOW() WHERE name = $3',
        [subject, html, templateName]
      );
    } else {
      await pool.query(
        'INSERT INTO email_templates (name, subject, html) VALUES ($1, $2, $3)',
        [templateName, subject, html]
      );
    }
    res.redirect(`/admin/correspondence/${templateName}?msg=Template+saved+successfully`);
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/correspondence/${templateName}?msg=Failed+to+save+template`);
  }
});

// GET /admin/workout-manager — Workout manager home
router.get('/workout-manager', adminAuth, (req, res) => {
  res.send(adminPage('Workout Manager', `
    <div class="breadcrumb"><a href="/admin">Dashboard</a> / Workout Manager</div>
    <div class="header">
      <h1>Workout Manager</h1>
      <p>Create and manage workouts in the Browse Workout Library. Changes are visible to all users.</p>
    </div>
    <div class="glass" style="padding:16px 20px;margin-bottom:24px;border-left:3px solid #ef4444;">
      <p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;">Workouts created here will appear in the <strong style="color:#ef4444;">Browse Workout Library</strong> for all users.</p>
    </div>
    <div class="card-grid">
      <a class="card glass" href="/admin/workout-manager/create">
        <div class="card-icon">➕</div>
        <div class="card-title">Create a Workout</div>
        <div class="card-desc">Build a new workout from scratch. Add exercises, sets, reps, and weights.</div>
      </a>
      <a class="card glass" href="/admin/workout-manager/workouts">
        <div class="card-icon">📋</div>
        <div class="card-title">View Current Workouts</div>
        <div class="card-desc">Browse and manage existing programs and workouts in the library.</div>
      </a>
    </div>
  `));
});

// Admin workout manager API endpoints
router.get('/workout-manager/api/exercises', adminAuth, async (req, res) => {
  try {
    const exercises = await db.getExercises(null, { search: req.query.q, limit: 20 });
    res.json(exercises);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/workout-manager/api/muscle-groups', adminAuth, async (req, res) => {
  try {
    const groups = await db.getMuscleGroups();
    res.json(groups);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/workout-manager/api/exercises', adminAuth, express.json(), async (req, res) => {
  try {
    const { name, muscleGroup } = req.body;
    if (!name || !muscleGroup) return res.status(400).json({ error: 'Name and muscle group required' });
    const exercise = await db.createExercise(null, name.trim(), muscleGroup, []);
    res.status(201).json(exercise);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/workout-manager/api/programs', adminAuth, express.json(), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Program name is required' });
    const { rows: [program] } = await pool.query(
      'INSERT INTO programs (user_id, name, description) VALUES (NULL, $1, $2) RETURNING id, name',
      [name.trim(), description?.trim() || '']
    );
    res.status(201).json(program);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Program already exists' });
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /admin/workout-manager/create — Create workout (mirrors trainer)
router.get('/workout-manager/create', adminAuth, async (req, res) => {
  const msg = req.query.msg || '';
  const error = req.query.error || '';
  const { rows: programs } = await pool.query('SELECT id, name FROM programs WHERE user_id IS NULL ORDER BY name');
  const muscleGroups = await db.getMuscleGroups();

  // Reuse the same page structure as trainer, but with admin API paths
  const apiBase = '/admin/workout-manager/api';

  res.send(adminPage('Create a Workout', `
    <div class="breadcrumb"><a href="/admin">Dashboard</a> / <a href="/admin/workout-manager">Workout Manager</a> / Create</div>
    <div class="header">
      <h1>Create a Workout</h1>
      <p>Add exercises, sets, reps, and weights. This workout will be added to the Browse Workout Library.</p>
    </div>
    ${msg ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;"><p style="color:#4ade80;font-size:13px;">' + esc(msg) + '</p></div>' : ''}
    ${error ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #ef4444;margin-bottom:20px;"><p style="color:#f87171;font-size:13px;">' + esc(error) + '</p></div>' : ''}
    <form method="POST" action="/admin/workout-manager/create" id="workout-form">
      <div class="glass" style="padding:24px;border-radius:16px;margin-bottom:20px;overflow:visible;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <label>Workout Name</label>
            <input type="text" name="workoutName" placeholder="e.g. Upper Body A" required style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
          </div>
          <div style="flex:1;min-width:200px;position:relative;">
            <label>Program</label>
            <input type="hidden" name="programId" id="program-value" value="" />
            <button type="button" id="program-btn" onclick="toggleProgramDropdown()" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
              <span id="program-label">— No Program —</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
            </button>
            <div id="program-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:200;margin-top:4px;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.6);max-height:280px;overflow-y:auto;">
              <div style="padding:4px;">
                <button type="button" onclick="selectProgram('','— No Program —')" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:rgba(255,255,255,0.5);font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='none'">— No Program —</button>
                ${programs.map(p => '<button type="button" onclick="selectProgram(\'' + p.id + '\',\'' + esc(p.name).replace(/'/g, "\\'") + '\')" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;" onmouseover="this.style.background=\'rgba(255,255,255,0.08)\'" onmouseout="this.style.background=\'none\'">' + esc(p.name) + '</button>').join('')}
                <div style="border-top:1px solid rgba(255,255,255,0.08);margin:4px 0;"></div>
                <button type="button" onclick="document.getElementById('program-dropdown').style.display='none';openNewProgramModal()" style="width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#ef4444;font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;font-weight:600;" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='none'">+ New Program</button>
              </div>
            </div>
          </div>
        </div>
        <div style="margin-top:16px;">
          <label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
          <input type="text" name="description" placeholder="e.g. Chest, Shoulders, Triceps" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
      </div>
      <div id="exercises-container"></div>
      <button type="button" onclick="addExercise()" class="btn-ghost" style="width:100%;text-align:center;padding:14px;margin-bottom:20px;">+ Add Exercise</button>
      <button type="submit" class="btn" style="width:100%;padding:14px;font-size:15px;margin:0;">Save Workout</button>
    </form>

    <!-- Custom Exercise Modal -->
    <div id="custom-ex-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);" onclick="if(event.target===this)this.style.display='none'">
      <div class="glass" style="padding:24px;max-width:400px;width:90%;border-radius:16px;">
        <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px;">Add Custom Exercise</h3>
        <div style="margin-bottom:12px;"><label>Exercise Name</label>
          <input type="text" id="custom-ex-name" placeholder="e.g. Cable Lateral Raise" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:16px;"><label>Muscle Group</label>
          <select id="custom-ex-muscle" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
            ${muscleGroups.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('')}
          </select>
        </div>
        <button type="button" onclick="saveCustomExercise()" class="btn" style="margin:0;width:100%;padding:12px;font-size:14px;">Add Exercise</button>
      </div>
    </div>

    <!-- New Program Modal -->
    <div id="new-program-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);" onclick="if(event.target===this)this.style.display='none'">
      <div class="glass" style="padding:24px;max-width:400px;width:90%;border-radius:16px;">
        <h3 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px;">Create New Program</h3>
        <div style="margin-bottom:12px;"><label>Program Name</label>
          <input type="text" id="new-program-name" placeholder="e.g. 4-Week Strength Program" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:16px;"><label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
          <input type="text" id="new-program-desc" placeholder="e.g. Progressive overload focused" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div id="new-program-error" style="display:none;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px 14px;font-size:13px;color:#f87171;margin-bottom:12px;text-align:center;"></div>
        <div style="display:flex;gap:8px;">
          <button type="button" onclick="document.getElementById('new-program-modal').style.display='none'" class="btn-ghost" style="margin:0;flex:1;text-align:center;padding:12px;">Cancel</button>
          <button type="button" onclick="saveNewProgram()" class="btn" style="margin:0;flex:1;padding:12px;">Create</button>
        </div>
      </div>
    </div>

    <script>
      var API = '${apiBase}';

      function toggleProgramDropdown() { var d = document.getElementById('program-dropdown'); d.style.display = d.style.display === 'none' ? 'block' : 'none'; }
      function selectProgram(id, name) { document.getElementById('program-value').value = id; document.getElementById('program-label').textContent = name; document.getElementById('program-btn').style.color = id ? '#fff' : 'rgba(255,255,255,0.5)'; document.getElementById('program-dropdown').style.display = 'none'; }
      document.addEventListener('click', function(e) {
        if (!e.target.closest('#program-btn') && !e.target.closest('#program-dropdown')) document.getElementById('program-dropdown').style.display = 'none';
        if (!e.target.closest('[id^="ex-search-"]') && !e.target.closest('[id^="ex-results-"]')) document.querySelectorAll('[id^="ex-results-"]').forEach(function(d) { d.style.display = 'none'; });
        if (!e.target.closest('[id^="settype-btn-"]') && !e.target.closest('[id^="settype-dd-"]')) document.querySelectorAll('[id^="settype-dd-"]').forEach(function(d) { d.style.display = 'none'; });
      });

      function openNewProgramModal() { document.getElementById('new-program-name').value = ''; document.getElementById('new-program-desc').value = ''; document.getElementById('new-program-error').style.display = 'none'; document.getElementById('new-program-modal').style.display = 'flex'; }
      async function saveNewProgram() {
        var name = document.getElementById('new-program-name').value.trim();
        var desc = document.getElementById('new-program-desc').value.trim();
        var errDiv = document.getElementById('new-program-error');
        if (!name) { errDiv.textContent = 'Program name is required'; errDiv.style.display = 'block'; return; }
        errDiv.style.display = 'none';
        try {
          var resp = await fetch(API + '/programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, description: desc }) });
          var data = await resp.json();
          if (!resp.ok) { errDiv.textContent = data.error || 'Failed'; errDiv.style.display = 'block'; return; }
          var dd = document.getElementById('program-dropdown').querySelector('div');
          var sep = dd.querySelector('div[style*="border-top"]');
          var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = data.name;
          btn.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;border-radius:8px;';
          btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; }; btn.onmouseout = function() { this.style.background = 'none'; };
          btn.onclick = function() { selectProgram(data.id, data.name); };
          dd.insertBefore(btn, sep); selectProgram(data.id, data.name);
          document.getElementById('new-program-modal').style.display = 'none';
        } catch (e) { errDiv.textContent = 'Something went wrong'; errDiv.style.display = 'block'; }
      }

      var SET_TYPES = [
        { value: 'warm_up', label: 'Warm Up' }, { value: 'straight', label: 'Regular' }, { value: 'drop', label: 'Drop Set' },
        { value: 'rest_pause', label: 'Rest-Pause' }, { value: 'superset', label: 'Super Set' }, { value: 'alternating', label: 'Alternating' },
        { value: 'giant', label: 'Giant Set' }, { value: 'pre_exhaust', label: 'Pre-Exhaust' },
      ];
      function buildSetTypeButtons(exIdx) {
        return SET_TYPES.map(function(t) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = t.label;
          b.style.cssText = 'width:100%;text-align:left;padding:8px 12px;border:none;background:none;color:#fff;font-size:12px;cursor:pointer;font-family:inherit;border-radius:6px;';
          b.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; }; b.onmouseout = function() { this.style.background = 'none'; };
          b.onclick = function() { selectSetType(exIdx, t.value, t.label); };
          return b;
        });
      }
      function toggleSetTypeDD(i) { var d = document.getElementById('settype-dd-' + i); d.style.display = d.style.display === 'none' ? 'block' : 'none'; }
      function selectSetType(i, v, l) { document.getElementById('settype-val-' + i).value = v; document.getElementById('settype-label-' + i).textContent = l; document.getElementById('settype-dd-' + i).style.display = 'none'; }

      function mk(tag, css, attrs) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (attrs) Object.keys(attrs).forEach(function(k) { e[k] = attrs[k]; }); return e; }

      var exerciseCount = 0, searchTimeout = null, activeSearchIdx = null, setCounts = {};
      var inputCSS = 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;';

      function addExercise() {
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
        si.oninput = function() { searchExercises(idx, this.value); }; si.onfocus = function() { searchExercises(idx, this.value); };
        var rd = mk('div', 'display:none;position:absolute;top:100%;left:0;right:0;z-index:50;max-height:200px;overflow-y:auto;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:10px;margin-top:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5);');
        rd.id = 'ex-results-' + idx; sw.appendChild(si); sw.appendChild(rd); div.appendChild(sw);
        var str = mk('div', 'margin-top:12px;margin-bottom:12px;display:flex;gap:8px;align-items:center;position:relative;');
        var stl = mk('label', 'margin:0;font-size:11px;color:rgba(255,255,255,0.4);white-space:nowrap;'); stl.textContent = 'Set Type';
        var sth = mk('input'); sth.type = 'hidden'; sth.name = 'exercises[' + idx + '][setType]'; sth.id = 'settype-val-' + idx; sth.value = 'straight';
        var stb = mk('button', 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;', { type: 'button' });
        stb.id = 'settype-btn-' + idx; stb.onclick = function() { toggleSetTypeDD(idx); };
        var sbl = mk('span'); sbl.id = 'settype-label-' + idx; sbl.textContent = 'Regular'; stb.appendChild(sbl);
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
        container.appendChild(div); addSet(idx); addSet(idx); addSet(idx);
      }
      function addSet(exIdx) {
        if (!setCounts[exIdx]) setCounts[exIdx] = 0; var si = setCounts[exIdx]++;
        var sd = document.getElementById('sets-' + exIdx); var r = mk('div', 'display:flex;gap:8px;align-items:center;margin-bottom:6px;'); r.id = 'set-' + exIdx + '-' + si;
        var n = mk('span', 'font-size:13px;color:rgba(255,255,255,0.5);width:40px;text-align:center;font-weight:600;'); n.textContent = si + 1;
        var ri = mk('input', inputCSS); ri.type = 'number'; ri.name = 'exercises[' + exIdx + '][sets][' + si + '][reps]'; ri.placeholder = '10'; ri.value = '10';
        var wi = mk('input', inputCSS); wi.type = 'number'; wi.name = 'exercises[' + exIdx + '][sets][' + si + '][weight]'; wi.placeholder = '0'; wi.value = '0';
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
      addExercise();
    </script>
  `));
});

// POST /admin/workout-manager/create — Save workout
router.post('/workout-manager/create', adminAuth, express.urlencoded({ extended: true }), async (req, res) => {
  const { workoutName, description, programId, exercises } = req.body;
  if (!workoutName?.trim()) return res.redirect('/admin/workout-manager/create?error=Workout+name+is+required');
  try {
    let finalProgramId = programId ? Number(programId) : null;
    if (!finalProgramId) {
      const { rows: existing } = await pool.query("SELECT id FROM programs WHERE name = 'Admin Workouts' AND user_id IS NULL");
      if (existing.length > 0) { finalProgramId = existing[0].id; }
      else { const { rows: [p] } = await pool.query("INSERT INTO programs (user_id, name) VALUES (NULL, 'Admin Workouts') RETURNING id"); finalProgramId = p.id; }
    }
    const { rows: sortRows } = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM templates WHERE program_id = $1', [finalProgramId]);
    const { rows: [tmpl] } = await pool.query('INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id', [finalProgramId, workoutName.trim(), description?.trim() || '', sortRows[0].next_sort]);
    if (exercises && typeof exercises === 'object') {
      var exArray = Array.isArray(exercises) ? exercises : Object.values(exercises); var exSort = 0;
      for (const ex of exArray) {
        if (!ex?.name?.trim()) continue;
        var setType = ex.setType || 'straight';
        var sets = ex.sets ? (Array.isArray(ex.sets) ? ex.sets : Object.values(ex.sets)) : []; var setNum = 1;
        for (const set of sets) { if (!set) continue; await pool.query('INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', [tmpl.id, ex.name.trim(), setType, setNum++, parseInt(set.reps) || 10, parseInt(set.weight) || 0, exSort]); }
        exSort++;
      }
    }
    res.redirect('/admin/workout-manager/create?msg=Workout+"' + encodeURIComponent(workoutName.trim()) + '"+created+successfully');
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/create?error=Failed+to+create+workout'); }
});

// GET /admin/workout-manager/workouts — View current workouts
router.get('/workout-manager/workouts', adminAuth, async (req, res) => {
  try {
    const { rows: programs } = await pool.query('SELECT id, name, description FROM programs WHERE user_id IS NULL ORDER BY name');
    let content = '';
    if (programs.length === 0) {
      content = '<div class="glass" style="padding:40px;text-align:center;"><p style="color:rgba(255,255,255,0.4);">No programs yet. <a href="/admin/workout-manager/create" style="color:#ef4444;text-decoration:none;font-weight:600;">Create your first workout</a></p></div>';
    } else {
      for (const program of programs) {
        const { rows: templates } = await pool.query('SELECT t.id, t.name, t.description, t.is_rest, (SELECT COUNT(*) FROM template_exercises te WHERE te.template_id = t.id) AS exercise_count FROM templates t WHERE t.program_id = $1 ORDER BY t.sort_order', [program.id]);
        const rows = templates.map((t, i) => {
          const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
          if (t.is_rest) {
            return '<tr style="' + rowBg + '"><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.3);font-style:italic;">Rest Day</td><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">—</td><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">—</td><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>';
          }
          return '<tr style="' + rowBg + '">' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:600;color:#fff;">' + esc(t.name) + '</td>' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + (t.description ? esc(t.description) : '<span style="color:rgba(255,255,255,0.2);">—</span>') + '</td>' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.6);font-weight:600;">' + t.exercise_count + ' exercises</span></td>' +
            '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;white-space:nowrap;">' +
              '<a href="/admin/workout-manager/edit/' + t.id + '" style="color:#ef4444;text-decoration:none;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid rgba(239,68,68,0.3);margin-right:6px;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'none\'">Edit</a>' +
              '<a href="/admin/workout-manager/delete/' + t.id + '" onclick="return confirm(\'Delete this workout and all its exercises? This cannot be undone.\')" style="color:rgba(255,255,255,0.3);text-decoration:none;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);" onmouseover="this.style.color=\'#ef4444\';this.style.borderColor=\'rgba(239,68,68,0.3)\';this.style.background=\'rgba(239,68,68,0.08)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.3)\';this.style.borderColor=\'rgba(255,255,255,0.1)\';this.style.background=\'none\'">Delete</a>' +
            '</td></tr>';
        }).join('');
        const nonRest = templates.filter(t => !t.is_rest).length;
        content += '<div class="glass" style="border-radius:16px;overflow:hidden;margin-bottom:20px;"><div style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);"><h3 style="font-size:16px;font-weight:700;color:#fff;margin:0;">' + esc(program.name) + '</h3><p style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px;">' + nonRest + ' workouts' + (program.description ? ' &middot; ' + esc(program.description) : '') + '</p></div>' +
          (templates.length > 0 ? '<div class="table-wrap"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);">Workout</th><th style="padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);">Description</th><th style="padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);">Exercises</th><th style="padding:12px 20px;width:160px;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);"></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div style="padding:20px 24px;"><p style="color:rgba(255,255,255,0.3);font-size:13px;">No workouts yet.</p></div>') + '</div>';
      }
    }
    res.send(adminPage('View Current Workouts', '<div class="breadcrumb"><a href="/admin">Dashboard</a> / <a href="/admin/workout-manager">Workout Manager</a> / Workouts</div><div class="header"><h1>Current Workouts</h1><p>' + programs.length + ' programs in the Browse Workout Library</p></div><a href="/admin/workout-manager/create" class="btn" style="margin-bottom:24px;">+ Create New Workout</a>' + content));
  } catch (err) { console.error(err); res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load workouts.</p>')); }
});

// GET /admin/workout-manager/edit/:id — Edit workout
router.get('/workout-manager/edit/:id', adminAuth, async (req, res) => {
  const templateId = Number(req.params.id);
  const msg = req.query.msg || '';
  const error = req.query.error || '';
  try {
    const { rows: tmplRows } = await pool.query('SELECT t.*, p.name AS program_name FROM templates t LEFT JOIN programs p ON p.id = t.program_id WHERE t.id = $1', [templateId]);
    if (!tmplRows[0]) return res.redirect('/admin/workout-manager/workouts');
    const tmpl = tmplRows[0];
    const { rows: exercises } = await pool.query('SELECT name, set_type, set_number, planned_reps, suggested_weight, sort_order FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number', [templateId]);
    const exerciseMap = new Map();
    for (const ex of exercises) {
      if (!exerciseMap.has(ex.sort_order)) exerciseMap.set(ex.sort_order, { name: ex.name, setType: ex.set_type || 'straight', sets: [] });
      exerciseMap.get(ex.sort_order).sets.push({ reps: ex.planned_reps, weight: Number(ex.suggested_weight) });
    }
    const exerciseList = [...exerciseMap.values()];
    const { rows: programs } = await pool.query('SELECT id, name FROM programs WHERE user_id IS NULL ORDER BY name');
    const muscleGroups = await db.getMuscleGroups();
    const apiBase = '/admin/workout-manager/api';

    res.send(adminPage('Edit Workout', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / <a href="/admin/workout-manager">Workout Manager</a> / <a href="/admin/workout-manager/workouts">Workouts</a> / Edit</div>
      <div class="header">
        <h1>Edit Workout</h1>
        <p>Editing <strong style="color:#fff;">${esc(tmpl.name)}</strong>${tmpl.program_name ? ' in ' + esc(tmpl.program_name) : ''}</p>
      </div>
      ${msg ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;"><p style="color:#4ade80;font-size:13px;">' + esc(msg) + '</p></div>' : ''}
      ${error ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #ef4444;margin-bottom:20px;"><p style="color:#f87171;font-size:13px;">' + esc(error) + '</p></div>' : ''}
      <form method="POST" action="/admin/workout-manager/edit/${templateId}">
        <div class="glass" style="padding:24px;border-radius:16px;margin-bottom:20px;overflow:visible;">
          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label>Workout Name</label>
              <input type="text" name="workoutName" value="${esc(tmpl.name)}" required style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
            </div>
            <div style="flex:1;min-width:200px;">
              <label>Program</label>
              <select name="programId" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;">
                ${programs.map(p => '<option value="' + p.id + '"' + (p.id === tmpl.program_id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('')}
              </select>
            </div>
          </div>
          <div style="margin-top:16px;">
            <label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
            <input type="text" name="description" value="${esc(tmpl.description || '')}" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
          </div>
        </div>
        <div id="exercises-container"></div>
        <button type="button" onclick="addExercise()" class="btn-ghost" style="width:100%;text-align:center;padding:14px;margin-bottom:20px;">+ Add Exercise</button>
        <div style="display:flex;gap:8px;">
          <button type="submit" class="btn" style="flex:1;padding:14px;font-size:15px;margin:0;">Save Changes</button>
          <a href="/admin/workout-manager/workouts" class="btn-ghost" style="flex:none;padding:14px 24px;margin:0;text-align:center;">Cancel</a>
        </div>
      </form>
      <script>
        var API = '${apiBase}';
        var EXISTING = ${JSON.stringify(exerciseList)};
        var SET_TYPES = [
          { value: 'warm_up', label: 'Warm Up' }, { value: 'straight', label: 'Regular' }, { value: 'drop', label: 'Drop Set' },
          { value: 'rest_pause', label: 'Rest-Pause' }, { value: 'superset', label: 'Super Set' }, { value: 'alternating', label: 'Alternating' },
          { value: 'giant', label: 'Giant Set' }, { value: 'pre_exhaust', label: 'Pre-Exhaust' },
        ];
        var SET_SHORT = { warm_up: 'WU', straight: 'REG', drop: 'DS', rest_pause: 'RP', superset: 'SS', alternating: 'Alt', giant: 'Gia', pre_exhaust: 'PrEx' };
        function getSetTypeLabel(v) { var t = SET_TYPES.find(function(x) { return x.value === v; }); return t ? t.label : 'Regular'; }
        function mk(tag, css, attrs) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (attrs) Object.keys(attrs).forEach(function(k) { e[k] = attrs[k]; }); return e; }
        var exerciseCount = 0, searchTimeout = null, activeSearchIdx = null, setCounts = {};
        var inputCSS = 'flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;';
        document.addEventListener('click', function(e) {
          if (!e.target.closest('[id^="ex-search-"]') && !e.target.closest('[id^="ex-results-"]')) document.querySelectorAll('[id^="ex-results-"]').forEach(function(d) { d.style.display = 'none'; });
          if (!e.target.closest('[id^="st-btn-"]') && !e.target.closest('[id^="st-dd-"]')) document.querySelectorAll('[id^="st-dd-"]').forEach(function(d) { d.style.display = 'none'; });
        });
        function addExercise(prefill) {
          var idx = exerciseCount++; var container = document.getElementById('exercises-container');
          var card = mk('div', 'border-radius:12px;margin-bottom:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);');
          card.id = 'exercise-' + idx;
          var hdr = mk('div', 'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:8px;');
          var si = mk('input', 'flex:1;padding:0;border:none;background:none;color:#fff;font-size:14px;font-weight:600;font-family:inherit;outline:none;');
          si.type = 'text'; si.id = 'ex-search-' + idx; si.name = 'exercises[' + idx + '][name]'; si.placeholder = 'Search exercises...'; si.required = true; si.autocomplete = 'off';
          if (prefill) si.value = prefill.name;
          si.oninput = function() { searchExercises(idx, this.value); }; si.onfocus = function() { searchExercises(idx, this.value); };
          var rd = mk('div', 'display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:50;max-height:200px;overflow-y:auto;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);');
          rd.id = 'ex-results-' + idx;
          var sw = mk('div', 'flex:1;position:relative;'); sw.appendChild(si); sw.appendChild(rd);
          var rmBtn = mk('button', 'background:none;border:none;color:rgba(255,255,255,0.25);cursor:pointer;padding:4px;border-radius:6px;display:flex;', { type: 'button' });
          rmBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
          rmBtn.onmouseover = function() { this.style.color = '#ef4444'; }; rmBtn.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.25)'; };
          rmBtn.onclick = function() { var e = document.getElementById('exercise-' + idx); if (e) e.remove(); };
          hdr.appendChild(sw); hdr.appendChild(rmBtn); card.appendChild(hdr);
          var stH = mk('input'); stH.type = 'hidden'; stH.name = 'exercises[' + idx + '][setType]'; stH.id = 'settype-val-' + idx; stH.value = prefill ? prefill.setType : 'straight';
          card.appendChild(stH);
          var ch = mk('div', 'display:flex;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.04);');
          [{ t: 'Set', w: '36px' }, { t: 'Type', w: '72px' }, { t: 'Weight', f: '1' }, { t: 'Reps', f: '1' }, { t: '', w: '28px' }].forEach(function(c) {
            var sp = mk('span', 'font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.25);font-weight:600;text-align:center;' + (c.f ? 'flex:' + c.f + ';' : 'width:' + c.w + ';'));
            sp.textContent = c.t; ch.appendChild(sp);
          }); card.appendChild(ch);
          var sd = mk('div'); sd.id = 'sets-' + idx; card.appendChild(sd);
          var asb = mk('button', 'width:100%;padding:8px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.04);color:rgba(255,255,255,0.3);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;', { type: 'button' });
          asb.textContent = '+ Add Set'; asb.onmouseover = function() { this.style.color = '#fff'; }; asb.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.3)'; };
          asb.onclick = function() { addSet(idx); }; card.appendChild(asb);
          container.appendChild(card);
          if (prefill && prefill.sets.length > 0) prefill.sets.forEach(function(s) { addSet(idx, s.reps, s.weight); });
          else { addSet(idx); addSet(idx); addSet(idx); }
        }
        function addSet(exIdx, pr, pw) {
          if (!setCounts[exIdx]) setCounts[exIdx] = 0; var si = setCounts[exIdx]++;
          var sd = document.getElementById('sets-' + exIdx); var r = mk('div', 'display:flex;align-items:center;padding:6px 16px;border-bottom:1px solid rgba(255,255,255,0.03);' + (si % 2 === 0 ? 'background:rgba(255,255,255,0.015);' : ''));
          r.id = 'set-' + exIdx + '-' + si;
          var n = mk('span', 'width:36px;text-align:center;font-size:13px;color:rgba(255,255,255,0.4);font-weight:700;'); n.textContent = si + 1;
          var tw = mk('div', 'width:72px;position:relative;');
          var tb = mk('button', 'width:100%;padding:5px 4px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;font-family:inherit;cursor:pointer;text-align:center;outline:none;', { type: 'button' });
          tb.textContent = 'REG'; tb.id = 'st-btn-' + exIdx + '-' + si;
          var tdd = mk('div', 'display:none;position:absolute;top:100%;left:0;z-index:60;margin-top:2px;background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);padding:2px;min-width:120px;');
          tdd.id = 'st-dd-' + exIdx + '-' + si;
          tb.onclick = function() { tdd.style.display = tdd.style.display === 'none' ? 'block' : 'none'; };
          SET_TYPES.forEach(function(t) {
            var o = mk('button', 'width:100%;text-align:left;padding:6px 10px;border:none;background:none;color:#fff;font-size:11px;cursor:pointer;font-family:inherit;border-radius:5px;', { type: 'button' });
            o.textContent = t.label; o.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; }; o.onmouseout = function() { this.style.background = 'none'; };
            o.onclick = function() { tb.textContent = SET_SHORT[t.value] || 'REG'; tb.style.color = t.value === 'straight' ? 'rgba(255,255,255,0.6)' : '#ef4444'; document.getElementById('settype-val-' + exIdx).value = t.value; tdd.style.display = 'none'; };
            tdd.appendChild(o);
          }); tw.appendChild(tb); tw.appendChild(tdd);
          var wi = mk('input', inputCSS); wi.type = 'number'; wi.name = 'exercises[' + exIdx + '][sets][' + si + '][weight]'; wi.placeholder = '0'; wi.value = pw !== undefined ? pw : '0';
          var ri = mk('input', inputCSS); ri.type = 'number'; ri.name = 'exercises[' + exIdx + '][sets][' + si + '][reps]'; ri.placeholder = '10'; ri.value = pr !== undefined ? pr : '10';
          var db = mk('button', 'background:none;border:none;color:rgba(255,255,255,0.15);cursor:pointer;padding:4px;width:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;', { type: 'button' });
          db.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
          db.onmouseover = function() { this.style.color = '#ef4444'; }; db.onmouseout = function() { this.style.color = 'rgba(255,255,255,0.15)'; };
          db.onclick = function() { var e = document.getElementById('set-' + exIdx + '-' + si); if (e) e.remove(); };
          r.appendChild(n); r.appendChild(tw); r.appendChild(wi); r.appendChild(ri); r.appendChild(db); sd.appendChild(r);
        }
        function searchExercises(exIdx, query) {
          activeSearchIdx = exIdx; clearTimeout(searchTimeout);
          var rd = document.getElementById('ex-results-' + exIdx);
          if (!query || query.length < 1) { rd.style.display = 'none'; return; }
          searchTimeout = setTimeout(async function() {
            try {
              var resp = await fetch(API + '/exercises?q=' + encodeURIComponent(query));
              var exs = await resp.json(); rd.innerHTML = '';
              exs.forEach(function(ex) {
                var b = document.createElement('button'); b.type = 'button';
                b.style.cssText = 'width:100%;text-align:left;padding:10px 14px;border:none;background:none;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);';
                b.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; }; b.onmouseout = function() { this.style.background = 'none'; };
                b.onclick = function() { document.getElementById('ex-search-' + exIdx).value = ex.name; rd.style.display = 'none'; };
                b.textContent = ex.name; rd.appendChild(b);
              });
              rd.style.display = 'block';
            } catch (e) { console.error(e); }
          }, 200);
        }
        EXISTING.forEach(function(ex) { addExercise(ex); });
        if (EXISTING.length === 0) addExercise();
      </script>
    `));
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/workouts'); }
});

// POST /admin/workout-manager/edit/:id — Save edited workout
router.post('/workout-manager/edit/:id', adminAuth, express.urlencoded({ extended: true }), async (req, res) => {
  const templateId = Number(req.params.id);
  const { workoutName, description, programId, exercises } = req.body;
  if (!workoutName?.trim()) return res.redirect('/admin/workout-manager/edit/' + templateId + '?error=Name+is+required');
  try {
    await pool.query('UPDATE templates SET name = $1, description = $2, program_id = $3 WHERE id = $4', [workoutName.trim(), description?.trim() || '', programId ? Number(programId) : null, templateId]);
    await pool.query('DELETE FROM template_exercises WHERE template_id = $1', [templateId]);
    if (exercises && typeof exercises === 'object') {
      const exArray = Array.isArray(exercises) ? exercises : Object.values(exercises);
      let exSort = 0;
      for (const ex of exArray) {
        if (!ex?.name?.trim()) continue;
        const setType = ex.setType || 'straight';
        const sets = ex.sets ? (Array.isArray(ex.sets) ? ex.sets : Object.values(ex.sets)) : [];
        let setNum = 1;
        for (const set of sets) { if (!set) continue; await pool.query('INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', [templateId, ex.name.trim(), setType, setNum++, parseInt(set.reps) || 10, parseInt(set.weight) || 0, exSort]); }
        exSort++;
      }
    }
    res.redirect('/admin/workout-manager/edit/' + templateId + '?msg=Workout+updated+successfully');
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/edit/' + templateId + '?error=Failed+to+save'); }
});

// GET /admin/workout-manager/delete/:id — Delete workout
router.get('/workout-manager/delete/:id', adminAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM templates WHERE id = $1', [Number(req.params.id)]);
    res.redirect('/admin/workout-manager/workouts?msg=Workout+deleted');
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/workouts'); }
});

// GET /admin/custom-exercises — User-created exercises
router.get('/custom-exercises', adminAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.name, e.muscle_group, e.tags, e.created_at,
              u.username, u.first_name, u.last_name, u.email
       FROM exercises e
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.is_custom = TRUE
       ORDER BY e.created_at DESC`
    );

    const tableRows = rows.map(r => {
      const username = r.first_name && r.last_name
        ? `${r.first_name} ${r.last_name}`
        : r.username || r.email || 'Unknown';
      const date = r.created_at
        ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
        : '—';
      return `<tr>
        <td>${esc(username)}</td>
        <td style="font-weight:600;color:#fff;">${esc(r.name)}</td>
        <td>${esc(r.muscle_group)}</td>
        <td>${r.tags?.length ? esc(r.tags.join(', ')) : '—'}</td>
        <td>${date}</td>
      </tr>`;
    }).join('');

    res.send(adminPage('Custom Exercises', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / Custom Exercises</div>
      <div class="header">
        <h1>Custom Exercises</h1>
        <p>${rows.length} user-created exercise${rows.length !== 1 ? 's' : ''} — review and add to the official library</p>
      </div>
      ${rows.length === 0
        ? '<div class="glass" style="padding:40px;text-align:center;"><p style="color:rgba(255,255,255,0.4);font-size:14px;">No custom exercises yet. Users will create them during workout sessions.</p></div>'
        : `<div class="glass" style="border-radius:16px;overflow:hidden;">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Exercise Name</th>
                    <th>Muscle Group</th>
                    <th>Tags</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>${tableRows}</tbody>
              </table>
            </div>
          </div>`
      }
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load custom exercises.</p>'));
  }
});

export default router;
