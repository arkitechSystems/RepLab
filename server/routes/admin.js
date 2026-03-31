import express, { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { Resend } from 'resend';
import { sendDailySummaryEmail } from '../email.js';
import pool from '../dbPool.js';
import { syncFromWger } from '../syncExercises.js';
import { exerciseCardScript } from '../exerciseCardBuilder.js';

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
        from: 'RepLab <noreply@will-fit.shop>',
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
  <title>RepLab Admin — Login</title>
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
    <div class="logo">REP<span>LAB</span></div>
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
  <title>RepLab Admin — ${title}</title>
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
    th { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); text-align: left; padding: 14px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; white-space: nowrap; }
    th:first-child { border-radius: 8px 0 0 0; }
    th:last-child { border-radius: 0 8px 0 0; }
    td { padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.04); font-size: 13px; color: rgba(255,255,255,0.8); white-space: nowrap; }
    tr:hover td { background: rgba(255,255,255,0.04); }
    tbody tr:nth-child(even) td { background: rgba(255,255,255,0.015); }
    tbody tr:nth-child(even):hover td { background: rgba(255,255,255,0.05); }

    /* Frozen columns */
    .sticky-col { position: sticky; z-index: 2; }
    .sticky-col-0 { left: 0; min-width: 40px; background: rgba(10,10,10,0.97); }
    .sticky-col-1 { left: 40px; min-width: 100px; background: rgba(10,10,10,0.97); }
    .sticky-col-2 { left: 140px; min-width: 120px; background: rgba(10,10,10,0.97); border-right: 1px solid rgba(255,255,255,0.08); }
    th.sticky-col { z-index: 3; background: rgba(20,20,20,0.98); }
    tr:hover .sticky-col-0, tr:hover .sticky-col-1, tr:hover .sticky-col-2 { background: rgba(20,20,20,0.97); }
    tbody tr:nth-child(even) .sticky-col-0, tbody tr:nth-child(even) .sticky-col-1, tbody tr:nth-child(even) .sticky-col-2 { background: rgba(14,14,14,0.97); }
    tbody tr:nth-child(even):hover .sticky-col-0, tbody tr:nth-child(even):hover .sticky-col-1, tbody tr:nth-child(even):hover .sticky-col-2 { background: rgba(20,20,20,0.97); }

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
  <a href="/admin" style="text-decoration:none;"><div class="logo" style="margin:0;color:#fff;">REP<span style="color:#ef4444;">LAB</span></div></a>
  <div style="flex:1;max-width:360px;margin:0 24px;position:relative;">
    <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/></svg>
    <input id="admin-search" type="text" placeholder="Search dashboard..." style="width:100%;padding:8px 12px 8px 36px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='rgba(239,68,68,0.6)';this.style.boxShadow='0 0 0 2px rgba(239,68,68,0.15)'" onblur="this.style.borderColor='rgba(255,255,255,0.1)';this.style.boxShadow='none'" />
  </div>
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
<script>
(function(){
  var input = document.getElementById('admin-search');
  if (!input) return;
  input.addEventListener('input', function() {
    var q = this.value.toLowerCase().trim();
    // Filter cards in card-grid
    var cards = document.querySelectorAll('.card-grid .card');
    cards.forEach(function(card) {
      var title = (card.querySelector('.card-title') || {}).textContent || '';
      var desc = (card.querySelector('.card-desc') || {}).textContent || '';
      var match = !q || title.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      card.style.display = match ? '' : 'none';
    });
    // Filter table rows if present
    var rows = document.querySelectorAll('table tbody tr');
    rows.forEach(function(row) {
      var text = row.textContent.toLowerCase();
      row.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
    // Filter sidebar links
    var links = document.querySelectorAll('.sidebar a:not(.sidebar-toggle button)');
    links.forEach(function(link) {
      var text = link.textContent.toLowerCase();
      link.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  });
})();
</script>
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
    <a href="/admin/trainers"${title === 'Trainer Central' ? ' class="active"' : ''}>Trainer Central</a>
    <a href="/admin/correspondence"${title === 'User Correspondence' ? ' class="active"' : ''}>Correspondence</a>
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
    <a href="/admin/custom-exercises"${title === 'Custom Exercises' ? ' class="active"' : ''}>Custom Exercises</a>
    <a href="/admin/exercise-library"${title === 'Exercise Library' ? ' class="active"' : ''}>Exercise Library</a>
  </div>
  <div class="sidebar-section" onclick="toggleSection('system')">
    <span>System</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
  </div>
  <div class="sidebar-links" id="section-system">
    <a href="/admin/health"${title === 'Health' ? ' class="active"' : ''}>Health Check</a>
    <a href="/admin/errors"${title === 'Errors' ? ' class="active"' : ''}>Error Log</a>
    <a href="/admin/monthly-costs"${title === 'Monthly Costs' ? ' class="active"' : ''}>Monthly Costs</a>
    <a href="/admin/revenue"${title === 'Revenue' ? ' class="active"' : ''}>Revenue</a>
    <a href="/admin/subscriptions"${title === 'Subscriptions' ? ' class="active"' : ''}>Subscriptions</a>
    <a href="/admin/workout-manager"${title === 'Workout Manager' || title === 'Create a Workout' || title === 'View Current Workouts' ? ' class="active"' : ''}>Workout Manager</a>
    <a href="/admin/trainer-logins"${title === 'Trainer Login History' ? ' class="active"' : ''}>Trainer Logins</a>
    <a href="/admin/user-logins"${title === 'User Login History' ? ' class="active"' : ''}>User Logins</a>
    <a href="/admin/page-visits"${title === 'Page Visits' ? ' class="active"' : ''}>Page Visits</a>
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
      <p>RepLab administration panel</p>
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
    <a class="card glass" href="/admin/daily-summary" style="border-color:rgba(34,197,94,0.25);">
      <div class="card-icon">📋</div>
      <div class="card-title">Daily Summary</div>
      <div class="card-desc">Today's stats, signups, workouts, active users, and day-over-day comparisons.</div>
    </a>
    <a class="card glass" href="/admin/trainers" style="border-color:rgba(168,85,247,0.25);">
      <div class="card-icon">🏋️‍♀️</div>
      <div class="card-title">Trainer Central</div>
      <div class="card-desc">Manage trainers, review applications, and view trainer details.</div>
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
    <a class="card glass" href="/admin/exercise-library" style="border-color:rgba(168,85,247,0.25);">
      <div class="card-icon">🎬</div>
      <div class="card-title">Exercise Library</div>
      <div class="card-desc">View all exercises and their video mappings.</div>
    </a>
    <a class="card glass" href="/admin/monthly-costs" style="border-color:rgba(59,130,246,0.25);">
      <div class="card-icon">📋</div>
      <div class="card-title">Monthly Costs</div>
      <div class="card-desc">Full breakdown of hosting, App Store, and infrastructure costs.</div>
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
    <a class="card glass" href="/admin/trainer-logins">
      <div class="card-icon">🔐</div>
      <div class="card-title">Trainer Login History</div>
      <div class="card-desc">View login activity on the trainer dashboard.</div>
    </a>
    <a class="card glass" href="/admin/user-logins">
      <div class="card-icon">👤</div>
      <div class="card-title">User Login History</div>
      <div class="card-desc">View user login activity with date range filtering.</div>
    </a>
    <a class="card glass" href="/admin/page-visits">
      <div class="card-icon">📊</div>
      <div class="card-title">Page Visits</div>
      <div class="card-desc">Track which pages users visit and when.</div>
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
      const rawKeys = users.length > 0
        ? Object.keys(users[0]).filter((k) => !skipKeys.has(k))
        : [];
      // Move username to first position, email to second, role after username
      const allKeys = rawKeys.filter(k => k !== 'username' && k !== 'email' && k !== 'role');
      if (rawKeys.includes('email')) allKeys.unshift('email');
      if (rawKeys.includes('username')) allKeys.unshift('username');
      // Insert role right after username (index 1)
      if (rawKeys.includes('role')) {
        const insertIdx = allKeys.indexOf('username') + 1;
        allKeys.splice(insertIdx, 0, 'role');
      }

      // Pretty labels: camelCase → Title Case
      const label = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

      const headerCells = `<th class="sticky-col sticky-col-0">#</th>` + allKeys.map((k, i) => {
        const stickyClass = i <= 1 ? ` class="sticky-col sticky-col-${i + 1}"` : '';
        return `<th${stickyClass} style="cursor:pointer;user-select:none;" onclick="sortTable(${i + 1})" title="Sort by ${label(k)}">${label(k)} <span style="opacity:0.3;font-size:9px;">⇅</span></th>`;
      }).join('') + `<th style="text-align:center;">Actions</th>`;

      const rows = users.map((u, i) => {
        const cells = allKeys.map((k, ci) => {
          const stickyClass = ci <= 1 ? ` class="sticky-col sticky-col-${ci + 1}"` : '';
          const val = u[k];
          if (val == null) return `<td${stickyClass}>—</td>`;
          if (k === 'createdAt' || k.endsWith('At')) return `<td${stickyClass}>${new Date(val).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' })} <span style="color:#888;">${new Date(val).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' })} CT</span></td>`;
          return `<td${stickyClass}>${esc(val)}</td>`;
        }).join('');
        const deleteBtn = `<td style="text-align:center;white-space:nowrap;">
          <button onclick="resetPassword(${u.id}, '${esc((u.email || u.phone || 'User #' + u.id)).replace(/'/g, "\\'")}')" class="reset-btn" title="Reset password">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          </button>
          <button onclick="deleteUser(${u.id}, '${(u.email || u.phone || 'User #' + u.id).replace(/'/g, "\\'")}')" class="delete-btn" title="Delete user">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </td>`;
        return `<tr><td class="sticky-col sticky-col-0">${i + 1}</td>${cells}${deleteBtn}</tr>`;
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
      link.download = 'replab_users_' + new Date().toISOString().slice(0,10) + '.csv';
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
    function resetPassword(id, name) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      const modal = document.createElement('div');
      modal.style.cssText = 'background:#fff;border-radius:16px;padding:28px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);';
      modal.innerHTML = '<h3 style="font-size:18px;font-weight:800;margin-bottom:6px;color:#000;">Reset Password</h3>'
        + '<p style="font-size:14px;color:#555;margin-bottom:16px;">Set a new password for <strong>' + name + '</strong></p>'
        + '<input id="reset-pw-input" type="text" placeholder="New password" style="width:100%;padding:10px 14px;border:2px solid #ddd;border-radius:8px;font-size:15px;outline:none;margin-bottom:8px;box-sizing:border-box;color:#000;" />'
        + '<p id="reset-pw-error" style="font-size:12px;color:#ef4444;margin-bottom:12px;min-height:16px;"></p>'
        + '<div style="display:flex;gap:10px;">'
        + '<button id="reset-cancel-btn" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;font-size:14px;font-weight:600;cursor:pointer;color:#000;">Cancel</button>'
        + '<button id="reset-confirm-btn" style="flex:1;padding:10px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Reset Password</button>'
        + '</div>';
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const input = document.getElementById('reset-pw-input');
      const confirmBtn = document.getElementById('reset-confirm-btn');
      const cancelBtn = document.getElementById('reset-cancel-btn');
      const errorEl = document.getElementById('reset-pw-error');
      input.focus();

      cancelBtn.addEventListener('click', () => document.body.removeChild(overlay));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

      confirmBtn.addEventListener('click', async () => {
        const pw = input.value;
        if (pw.length < 8) { errorEl.textContent = 'Must be at least 8 characters'; return; }
        if (!/[A-Z]/.test(pw)) { errorEl.textContent = 'Must contain an uppercase letter'; return; }
        if (!/[0-9]/.test(pw)) { errorEl.textContent = 'Must contain a number'; return; }
        if (/\\s/.test(pw)) { errorEl.textContent = 'Must not contain spaces'; return; }
        errorEl.textContent = '';
        confirmBtn.textContent = 'Resetting...';
        confirmBtn.disabled = true;
        try {
          const res = await fetch('/admin/users/' + id + '/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw })
          });
          const data = await res.json();
          if (res.ok) {
            document.body.removeChild(overlay);
            const banner = document.createElement('div');
            banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
            banner.textContent = 'Password reset for ' + name;
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 3000);
          } else {
            errorEl.textContent = data.error || 'Failed to reset password';
            confirmBtn.textContent = 'Reset Password';
            confirmBtn.disabled = false;
          }
        } catch (err) {
          errorEl.textContent = 'Failed: ' + err.message;
          confirmBtn.textContent = 'Reset Password';
          confirmBtn.disabled = false;
        }
      });
    }
  </script>
  <style>
    .delete-btn, .reset-btn { background: none; border: none; cursor: pointer; color: #999; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
    .delete-btn:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
    .reset-btn:hover { color: #60a5fa; background: rgba(96,165,250,0.1); }
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
  <div class="glass table-wrap" style="border-radius:16px;overflow-x:auto;">
  <table style="min-width:800px;">
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
  ${helpBlock('This page shows every registered user on RepLab, excluding demo accounts. Each row displays the information the user provided during signup, including their name, email or phone, username, zip code, gender, referral source, referral code, UTM marketing parameters (captured from ad links), their signup device and browser, the city and state detected from their IP address, and the exact date and time they created their account. You can delete a user by clicking the X icon in the Actions column — this permanently removes their account and all associated data including programs, workouts, sessions, and personal records. Use the Print button to save a PDF snapshot, Export to Excel to download a CSV file, or Fullscreen Table to expand the table for easier viewing on smaller screens. The table scrolls horizontally on mobile devices. All timestamps are shown in Central Time (CT).')}`));
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

// POST /admin/users/:id/reset-password — Admin resets a user's password
router.post('/users/:id/reset-password', adminAuth, express.json(), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID' });

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(password)) return res.status(400).json({ error: 'Password must contain an uppercase letter' });
    if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'Password must contain a number' });
    if (/\s/.test(password)) return res.status(400).json({ error: 'Password must not contain spaces' });

    const user = await db.findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hash = bcrypt.hashSync(password, 10);
    await db.updatePassword(userId, hash);
    res.json({ message: 'Password reset successfully' });
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
  ${helpBlock('Session Analytics gives you a high-level view of how your users are engaging with RepLab. Total Workouts counts every completed workout session across all users. Active Users shows unique users who have completed at least one workout. This Week and This Month filter those counts to recent time periods so you can spot trends. The Most Active Users table ranks users by how many workouts they have completed, helping you identify your power users. Most Popular Workouts shows which workout templates are being used most frequently, which can inform which types of programs to create more of. Recent Activity is a live feed of the last 20 workout sessions logged, showing who worked out, what they did, whether they completed it, and when. Demo accounts are excluded from all calculations.')}
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
  ${helpBlock('Referral Breakdown shows where your users discovered RepLab. This data comes from the "How did you hear about us?" dropdown on the signup form. Each bar represents a referral source with its user count and percentage of total signups. Sources include Facebook/Instagram Ad, YouTube Ad, TikTok, Google Search, Friend/Word of Mouth (which also captures who referred them), and Other (with a custom text field). Users who selected "Friend" will show as "Friend: [name]" if they provided a referral name. Use this data to understand which marketing channels are driving the most signups and allocate your ad spend accordingly. If "Unknown" has a high count, those are users who signed up before the referral field was added or skipped it. UTM parameters from ad links are tracked separately in the User Sign Ups table for more granular campaign-level attribution.')}`));
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
  ${helpBlock('The Workout Library shows every program in the RepLab database. Programs labeled "Global" are the pre-built workout programs that ship with the app (like Push Pull Legs, Upper/Lower, Bro Split, etc.) and are visible to all users. Programs labeled "User" are custom programs created by individual users — each user can only see their own custom programs. The Templates column shows how many individual workouts exist within each program. This page is currently read-only, meaning you can browse but not edit programs from the dashboard. In the future, this will be expanded to allow creating, editing, and deleting programs directly from here without needing to modify the code. To add new global programs today, they need to be added as seed data in the server\'s initDb.js file.')}`));
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
  ${helpBlock('Announcements let you broadcast a message to all RepLab users. When you publish an announcement, it becomes the active announcement and any previously active announcement is automatically deactivated — only one announcement can be active at a time. Active announcements can be displayed as a banner in the app (via the /feedback/announcement API endpoint). Announcements are not permanent — you can deactivate them at any time by clicking the Deactivate button, which hides them from users without deleting them. You can also reactivate old announcements or delete them entirely. Common uses: maintenance notices ("The app will be down for maintenance tonight at 10pm"), new feature announcements ("We just launched the 1RM Estimator!"), or community messages ("Join our March fitness challenge!"). Deleted announcements cannot be recovered.')}`));
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
// Monthly Costs Breakdown
// ============================================================
router.get('/monthly-costs', adminAuth, (req, res) => {
  res.send(adminPage('Monthly Costs', `
  <div class="breadcrumb"><a href="/admin">Dashboard</a> / Monthly Costs</div>
  <div class="header">
    <h1>Admin Dashboard</h1>
    <h2>Monthly Costs</h2>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px;">
    <div class="glass" style="padding:20px;border-left:3px solid #22c55e;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:8px;">Bare Minimum</div>
      <div style="font-size:28px;font-weight:800;color:#22c55e;">$22<span style="font-size:14px;color:rgba(255,255,255,0.4);">/mo</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">Hosting + Apple Developer</div>
    </div>
    <div class="glass" style="padding:20px;border-left:3px solid #3b82f6;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:8px;">Comfortable Production</div>
      <div style="font-size:28px;font-weight:800;color:#3b82f6;">$23<span style="font-size:14px;color:rgba(255,255,255,0.4);">/mo</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">+ Email + Push Notifications (free tiers)</div>
    </div>
    <div class="glass" style="padding:20px;border-left:3px solid #a855f7;">
      <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:8px;">Scaled (1,000+ Users)</div>
      <div style="font-size:28px;font-weight:800;color:#a855f7;">$113<span style="font-size:14px;color:rgba(255,255,255,0.4);">/mo</span></div>
      <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px;">Standard hosting + all paid services</div>
    </div>
  </div>

  <div class="glass" style="padding:24px;margin-bottom:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:#fff;">One-Time Costs</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Item</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Cost</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Apple Developer Account</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:right;">$99/year ($8.25/mo)</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Google Play Developer Account</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:right;">$25 one-time</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="glass" style="padding:24px;margin-bottom:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:#fff;">Hosting &amp; Infrastructure</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Item</th>
          <th style="text-align:center;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Current</th>
          <th style="text-align:center;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Production</th>
          <th style="text-align:center;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Scaled</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Render Web Service</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;text-align:center;">Free (sleeps)</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$7/mo</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$25/mo</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Render PostgreSQL</td>
          <td style="padding:10px 12px;font-size:13px;color:#f59e0b;text-align:center;">Free (90-day expiry)</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$7/mo</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$25/mo</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Custom Domain</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;" colspan="3">~$10-15/year</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#fff;">SSL Certificate</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;text-align:center;" colspan="3">Free (included by Render)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="glass" style="padding:24px;margin-bottom:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:#fff;">Apple &amp; Google Fees</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Item</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Cost</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Apple Developer Program</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:right;">$99/year ($8.25/mo)</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Apple In-App Purchase Cut</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:right;">30% of revenue (15% if &lt;$1M/yr)</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Google Play</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:right;">$25 one-time, then 15% of first $1M</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="glass" style="padding:24px;margin-bottom:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:#fff;">Optional Services</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <th style="text-align:left;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Service</th>
          <th style="text-align:center;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Free Tier</th>
          <th style="text-align:center;padding:8px 12px;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">Paid Tier</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Email (Resend/SendGrid)</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;text-align:center;">100/day free</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$20/mo</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Error Monitoring (Sentry)</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;text-align:center;">Free tier</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$26/mo</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Push Notifications (OneSignal)</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;text-align:center;">10K users free</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$9/mo+</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 12px;font-size:13px;color:#fff;">Analytics (PostHog/Mixpanel)</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;text-align:center;">Free tier</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">Varies</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#fff;">CDN/Images (Cloudflare)</td>
          <td style="padding:10px 12px;font-size:13px;color:#22c55e;text-align:center;">Free tier</td>
          <td style="padding:10px 12px;font-size:13px;color:#fff;text-align:center;">$5/mo+</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="glass" style="padding:24px;margin-bottom:24px;">
    <h3 style="font-size:16px;font-weight:700;margin-bottom:16px;color:#fff;">Revenue Break-Even</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
      <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Pro Plan ($9.99/mo)</div>
        <div style="font-size:13px;color:#fff;line-height:1.8;">
          10 subscribers = <span style="color:#22c55e;font-weight:700;">$70/mo</span> after Apple cut<br>
          25 subscribers = <span style="color:#22c55e;font-weight:700;">$175/mo</span> after Apple cut
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Break-Even Point</div>
        <div style="font-size:13px;color:#fff;line-height:1.8;">
          <span style="color:#f59e0b;font-weight:700;">3-4 Pro subscribers</span> covers bare minimum<br>
          <span style="color:#22c55e;font-weight:700;">12 Pro subscribers</span> covers scaled setup
        </div>
      </div>
    </div>
  </div>
  `));
});

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
  ${helpBlock('The Revenue Dashboard will become active once paid subscription plans are integrated into RepLab using Stripe. When launched, this page will display: Monthly Recurring Revenue (MRR) — the total amount of subscription income per month; Total Revenue — cumulative lifetime revenue; Plan Distribution — a breakdown of how many users are on each plan tier (Free, Pro, Lifetime); Growth Charts — visual trends of revenue over time showing month-over-month growth; Churn Rate — the percentage of paying users who cancel each month; and Average Revenue Per User (ARPU). To set up revenue tracking, you will need to create a Stripe account, configure subscription products, add Stripe webhooks to the server, and store subscription status on each user record. See the monetization plan for detailed implementation steps.')}`));
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
  ${helpBlock('Pending Builds is your launch checklist. It tracks every feature, integration, and requirement that needs to be completed before RepLab is ready for a full production launch on the App Store. Each item has a status that you can update using the dropdown: Not Started (gray), In Progress (blue), or Completed (green). Status changes are saved to the database and persist across sessions. The progress bar at the top shows your overall completion percentage. Categories are organized by priority: Payments & Monetization for revenue generation, AI Features for the Claude API-powered workout generator and help chatbot, Legal & Compliance for app store and legal requirements, Security for protecting user data, App Store Submission for Apple requirements, Infrastructure for scaling and reliability, User Experience for engagement features, and Analytics & Growth for marketing tools. Update statuses as you complete each item to track your progress toward launch.')}
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
    welcome: { subject: 'Welcome to RepLab!', html: 'Default welcome email template' },
    password_reset: { subject: 'Reset your RepLab password', html: 'Default password reset template' },
    admin_signup_notification: { subject: 'New RepLab Signup', html: 'Default admin notification template' },
    daily_summary: { subject: 'RepLab Daily Summary', html: 'Default daily summary template' },
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
    // Admin exercises go into master library (is_custom = false, created_by = null)
    const existing = await db.findExerciseByName(name.trim(), null);
    if (existing) return res.json(existing);
    const { rows } = await pool.query(
      'INSERT INTO exercises (name, muscle_group, tags, is_custom, created_by) VALUES ($1, $2, $3, FALSE, NULL) RETURNING *',
      [name.trim(), muscleGroup, []]
    );
    const e = rows[0];
    res.status(201).json({ id: e.id, name: e.name, muscle: e.muscle_group, tags: e.tags || [], isCustom: false, createdBy: null });
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
          <div style="flex:1;min-width:200px;">
            <label>Program</label>
            <input type="hidden" name="programId" id="program-value" value="" />
            <button type="button" id="program-btn" onclick="toggleProgramDropdown()" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
              <span id="program-label">— No Program —</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
            </button>
          </div>

        </div>
        <div style="margin-top:16px;">
          <label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
          <input type="text" name="description" placeholder="e.g. Chest, Shoulders, Triceps" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
      </div>
      <div id="exercises-container"></div>
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <button type="button" onclick="addExercise()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;">+ Add Exercise</button>
        <button type="button" onclick="addSectionHeader()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;border-color:rgba(255,255,255,0.15);">+ Add Section Header</button>
      </div>
      <button type="submit" class="btn" style="width:100%;padding:14px;font-size:15px;margin:0;">Save Workout</button>
    </form>

    <!-- Program Picker Modal (outside form to avoid stacking context issues) -->
    <div id="program-dropdown" style="display:none;position:fixed;inset:0;z-index:9998;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);" onclick="if(event.target===this)this.style.display='none'">
      <div style="padding:20px;max-width:400px;width:90%;border-radius:16px;max-height:70vh;display:flex;flex-direction:column;background:rgba(25,25,25,0.98);border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.8);">
        <h3 style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;">Select Program</h3>
        <div style="overflow-y:auto;flex:1;padding:4px 0;">
          <button type="button" onclick="selectProgram('','— No Program —')" style="width:100%;text-align:left;padding:12px 14px;border:none;background:none;color:rgba(255,255,255,0.5);font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.background='none'">— No Program —</button>
          ${programs.map(p => '<button type="button" onclick="selectProgram(\'' + p.id + '\',\'' + esc(p.name).replace(/'/g, "\\'") + '\')" style="width:100%;text-align:left;padding:12px 14px;border:none;background:none;color:#fff;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background=\'rgba(255,255,255,0.08)\'" onmouseout="this.style.background=\'none\'">' + esc(p.name) + '</button>').join('')}
          <div style="border-top:1px solid rgba(255,255,255,0.1);margin:8px 0;"></div>
          <button type="button" onclick="document.getElementById('program-dropdown').style.display='none';openNewProgramModal()" style="width:100%;text-align:left;padding:12px 14px;border:none;background:none;color:#ef4444;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;font-weight:600;" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='none'">+ New Program</button>
        </div>
      </div>
    </div>

    <!-- Set Type Picker Modal -->
    <div id="settype-modal" style="display:none;position:fixed;inset:0;z-index:9998;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);" onclick="if(event.target===this)this.style.display='none'">
      <div style="padding:16px;max-width:300px;width:85%;border-radius:16px;background:rgba(25,25,25,0.98);border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.8);">
        <h3 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:12px;">Set Type</h3>
        <div id="settype-options"></div>
      </div>
    </div>

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
      function toggleProgramDropdown() { document.getElementById('program-dropdown').style.display = 'flex'; }
      function selectProgram(id, name) { document.getElementById('program-value').value = id; document.getElementById('program-label').textContent = name; document.getElementById('program-btn').style.color = id ? '#fff' : 'rgba(255,255,255,0.5)'; document.getElementById('program-dropdown').style.display = 'none'; }

      function openNewProgramModal() { document.getElementById('new-program-name').value = ''; document.getElementById('new-program-desc').value = ''; document.getElementById('new-program-error').style.display = 'none'; document.getElementById('new-program-modal').style.display = 'flex'; }
      async function saveNewProgram() {
        var name = document.getElementById('new-program-name').value.trim();
        var desc = document.getElementById('new-program-desc').value.trim();
        var errDiv = document.getElementById('new-program-error');
        if (!name) { errDiv.textContent = 'Program name is required'; errDiv.style.display = 'block'; return; }
        errDiv.style.display = 'none';
        try {
          var resp = await fetch('${apiBase}/programs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, description: desc }) });
          var data = await resp.json();
          if (!resp.ok) { errDiv.textContent = data.error || 'Failed'; errDiv.style.display = 'block'; return; }
          var scrollDiv = document.getElementById('program-dropdown').querySelector('[style*="overflow-y"]');
          var sep = scrollDiv.querySelector('div[style*="border-top"]');
          var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = data.name;
          btn.style.cssText = 'width:100%;text-align:left;padding:12px 14px;border:none;background:none;color:#fff;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border-bottom:1px solid rgba(255,255,255,0.05);';
          btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.08)'; }; btn.onmouseout = function() { this.style.background = 'none'; };
          btn.onclick = function() { selectProgram(data.id, data.name); };
          scrollDiv.insertBefore(btn, sep); selectProgram(data.id, data.name);
          document.getElementById('new-program-modal').style.display = 'none';
        } catch (e) { errDiv.textContent = 'Something went wrong'; errDiv.style.display = 'block'; }
      }

      ${exerciseCardScript(apiBase)}

      addExercise();

      // AJAX form submit — stay on page after save
      document.getElementById('workout-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var form = this;
        var submitBtn = form.querySelector('[type="submit"]');
        var origText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) })
          .then(function(resp) {
            var existing = document.getElementById('save-msg');
            if (existing) existing.remove();
            var msg = document.createElement('div');
            msg.id = 'save-msg';
            msg.className = 'glass';
            msg.style.cssText = 'padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;';
            msg.innerHTML = '<p style="color:#4ade80;font-size:13px;">Workout saved successfully</p>';
            form.parentNode.insertBefore(msg, form);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(function() { if (msg.parentNode) msg.remove(); }, 4000);
          })
          .catch(function() {
            alert('Failed to save. Please try again.');
          })
          .finally(function() {
            submitBtn.textContent = origText;
            submitBtn.disabled = false;
          });
      });
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
      const exArray = Array.isArray(exercises) ? exercises : Object.values(exercises); let exSort = 0;
      const batchValues = [];
      const batchParams = [];
      let pi = 1;
      for (const ex of exArray) {
        if (!ex?.name?.trim()) continue;
        if (ex.isSectionHeader === '1') {
          batchValues.push(`($${pi}, $${pi+1}, $${pi+2}, $${pi+3}, $${pi+4}, $${pi+5}, $${pi+6}, $${pi+7}, $${pi+8})`);
          batchParams.push(tmpl.id, ex.name.trim(), 'straight', 1, 0, 0, exSort, true, ex.sectionNotes?.trim() || '');
          pi += 9;
          exSort++;
          continue;
        }
        const setType = ex.setType || 'straight';
        const sets = ex.sets ? (Array.isArray(ex.sets) ? ex.sets : Object.values(ex.sets)) : []; let setNum = 1;
        for (const set of sets) {
          if (!set) continue;
          batchValues.push(`($${pi}, $${pi+1}, $${pi+2}, $${pi+3}, $${pi+4}, $${pi+5}, $${pi+6}, $${pi+7}, $${pi+8})`);
          batchParams.push(tmpl.id, ex.name.trim(), setType, setNum++, parseInt(set.reps) || 10, parseInt(set.weight) || 0, exSort, false, '');
          pi += 9;
        }
        exSort++;
      }
      if (batchValues.length > 0) {
        await pool.query(
          `INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ${batchValues.join(', ')}`,
          batchParams
        );
      }
    }
    res.redirect('/admin/workout-manager/create?msg=Workout+"' + encodeURIComponent(workoutName.trim()) + '"+created+successfully');
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/create?error=Failed+to+create+workout'); }
});

// GET /admin/workout-manager/workouts — View current workouts
// Programs list
router.get('/workout-manager/workouts', adminAuth, async (req, res) => {
  try {
    const { rows: programs } = await pool.query(
      `SELECT p.id, p.name, p.description, p.sort_order,
        (SELECT COUNT(*) FROM templates t WHERE t.program_id = p.id AND t.is_rest = FALSE) AS workout_count,
        (SELECT COUNT(*) FROM templates t WHERE t.program_id = p.id) AS total_days
       FROM programs p WHERE p.user_id IS NULL ORDER BY p.sort_order, p.id`
    );

    const btnStyle = 'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,0.06);border:none;cursor:pointer;color:rgba(255,255,255,0.4);text-decoration:none;transition:all 0.15s;';
    let content = '';
    if (programs.length === 0) {
      content = '<div class="glass" style="padding:40px;text-align:center;"><p style="color:rgba(255,255,255,0.4);">No programs yet. <a href="/admin/workout-manager/create" style="color:#ef4444;text-decoration:none;font-weight:600;">Create your first workout</a></p></div>';
    } else {
      const thStyle = 'padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);';
      const rows = programs.map((p, i) => {
        const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
        const upLink = i > 0 ? '/admin/workout-manager/move-program/' + p.id + '?dir=up' : '';
        const downLink = i < programs.length - 1 ? '/admin/workout-manager/move-program/' + p.id + '?dir=down' : '';
        return '<tr style="' + rowBg + '">' +
          '<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;white-space:nowrap;">' +
            (upLink ? '<a href="' + upLink + '" style="' + btnStyle + '" onmouseover="this.style.color=\'#fff\';this.style.background=\'rgba(255,255,255,0.12)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.4)\';this.style.background=\'rgba(255,255,255,0.06)\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg></a>' : '<span style="' + btnStyle + 'opacity:0.2;cursor:default;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg></span>') +
            (downLink ? '<a href="' + downLink + '" style="' + btnStyle + 'margin-left:2px;" onmouseover="this.style.color=\'#fff\';this.style.background=\'rgba(255,255,255,0.12)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.4)\';this.style.background=\'rgba(255,255,255,0.06)\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg></a>' : '<span style="' + btnStyle + 'margin-left:2px;opacity:0.2;cursor:default;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg></span>') +
          '</td>' +
          '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);"><a href="/admin/workout-manager/program/' + p.id + '" style="color:#fff;text-decoration:none;font-weight:700;font-size:15px;" onmouseover="this.style.color=\'#ef4444\'" onmouseout="this.style.color=\'#fff\'">' + esc(p.name) + '</a></td>' +
          '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + (p.description ? esc(p.description) : '<span style="color:rgba(255,255,255,0.2);">—</span>') + '</td>' +
          '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
            '<span style="padding:4px 10px;border-radius:6px;background:rgba(239,68,68,0.1);font-size:11px;color:#ef4444;font-weight:700;">' + p.workout_count + ' workouts</span>' +
            '<span style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.06);font-size:11px;color:rgba(255,255,255,0.5);font-weight:600;margin-left:6px;">' + p.total_days + ' days</span>' +
          '</td>' +
        '</tr>';
      }).join('');
      content = '<div class="glass" style="border-radius:16px;overflow:hidden;"><div class="table-wrap"><table style="width:100%;border-collapse:collapse;"><thead><tr>' +
        '<th style="' + thStyle + 'width:70px;">Order</th>' +
        '<th style="' + thStyle + '">Program</th>' +
        '<th style="' + thStyle + '">Description</th>' +
        '<th style="' + thStyle + '">Workouts</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    }

    res.send(adminPage('View Current Workouts', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / <a href="/admin/workout-manager">Workout Manager</a> / Programs</div>
      <div class="header">
        <h1>Programs</h1>
        <p>${programs.length} program${programs.length !== 1 ? 's' : ''} in the Browse Workout Library &middot; Drag to reorder</p>
      </div>
      <a href="/admin/workout-manager/create" class="btn" style="margin-bottom:24px;">+ Create New Workout</a>
      ${req.query.msg ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;"><p style="color:#4ade80;font-size:13px;">' + esc(req.query.msg) + '</p></div>' : ''}
      ${content}
    `));
  } catch (err) { console.error(err); res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load programs.</p>')); }
});

// Workouts within a program
router.get('/workout-manager/program/:id', adminAuth, async (req, res) => {
  const programId = Number(req.params.id);
  try {
    const { rows: progRows } = await pool.query('SELECT id, name, description FROM programs WHERE id = $1', [programId]);
    if (!progRows[0]) return res.redirect('/admin/workout-manager/workouts');
    const program = progRows[0];

    const { rows: templates } = await pool.query(
      'SELECT t.id, t.name, t.description, t.is_rest, t.sort_order, (SELECT COUNT(*) FROM template_exercises te WHERE te.template_id = t.id) AS exercise_count FROM templates t WHERE t.program_id = $1 ORDER BY t.sort_order',
      [programId]
    );

    const btnStyle = 'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:rgba(255,255,255,0.06);border:none;cursor:pointer;color:rgba(255,255,255,0.4);text-decoration:none;transition:all 0.15s;';
    const rows = templates.map((t, i) => {
      const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
      const upLink = i > 0 ? '/admin/workout-manager/move/' + t.id + '?dir=up&programId=' + programId : '';
      const downLink = i < templates.length - 1 ? '/admin/workout-manager/move/' + t.id + '?dir=down&programId=' + programId : '';
      const orderBtns =
        '<td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;white-space:nowrap;">' +
          (upLink ? '<a href="' + upLink + '" style="' + btnStyle + '" onmouseover="this.style.color=\'#fff\';this.style.background=\'rgba(255,255,255,0.12)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.4)\';this.style.background=\'rgba(255,255,255,0.06)\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg></a>' : '<span style="' + btnStyle + 'opacity:0.2;cursor:default;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg></span>') +
          (downLink ? '<a href="' + downLink + '" style="' + btnStyle + 'margin-left:2px;" onmouseover="this.style.color=\'#fff\';this.style.background=\'rgba(255,255,255,0.12)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.4)\';this.style.background=\'rgba(255,255,255,0.06)\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg></a>' : '<span style="' + btnStyle + 'margin-left:2px;opacity:0.2;cursor:default;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg></span>') +
        '</td>';
      if (t.is_rest) {
        return '<tr style="' + rowBg + '">' + orderBtns + '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.3);font-style:italic;">Rest Day</td><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.2);">—</td><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.2);">—</td><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>';
      }
      return '<tr style="' + rowBg + '">' + orderBtns +
        '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:600;color:#fff;">' + esc(t.name) + '</td>' +
        '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + (t.description ? esc(t.description) : '<span style="color:rgba(255,255,255,0.2);">—</span>') + '</td>' +
        '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.6);font-weight:600;">' + t.exercise_count + ' exercises</span></td>' +
        '<td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;white-space:nowrap;">' +
          '<a href="/admin/workout-manager/edit/' + t.id + '" style="color:#ef4444;text-decoration:none;font-size:11px;font-weight:600;padding:6px 10px;border-radius:7px;border:1px solid rgba(239,68,68,0.3);margin-right:4px;" onmouseover="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseout="this.style.background=\'none\'">Edit</a>' +
          '<a href="/admin/workout-manager/copy/' + t.id + '?programId=' + programId + '" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:11px;font-weight:600;padding:6px 10px;border-radius:7px;border:1px solid rgba(255,255,255,0.1);margin-right:4px;" onmouseover="this.style.color=\'#3b82f6\';this.style.borderColor=\'rgba(59,130,246,0.3)\';this.style.background=\'rgba(59,130,246,0.08)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.5)\';this.style.borderColor=\'rgba(255,255,255,0.1)\';this.style.background=\'none\'">Copy</a>' +
          '<a href="/admin/workout-manager/delete/' + t.id + '?programId=' + programId + '" onclick="return confirm(\'Delete this workout and all its exercises? This cannot be undone.\')" style="color:rgba(255,255,255,0.3);text-decoration:none;font-size:11px;font-weight:600;padding:6px 10px;border-radius:7px;border:1px solid rgba(255,255,255,0.08);" onmouseover="this.style.color=\'#ef4444\';this.style.borderColor=\'rgba(239,68,68,0.3)\';this.style.background=\'rgba(239,68,68,0.08)\'" onmouseout="this.style.color=\'rgba(255,255,255,0.3)\';this.style.borderColor=\'rgba(255,255,255,0.08)\';this.style.background=\'none\'">Delete</a>' +
        '</td></tr>';
    }).join('');

    const nonRest = templates.filter(t => !t.is_rest).length;
    const thStyle = 'padding:12px 20px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);';

    res.send(adminPage('Program — ' + program.name, `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / <a href="/admin/workout-manager">Workout Manager</a> / <a href="/admin/workout-manager/workouts">Programs</a> / ${esc(program.name)}</div>
      <div class="header">
        <h1>${esc(program.name)}</h1>
        <p>${nonRest} workout${nonRest !== 1 ? 's' : ''} &middot; ${templates.length} total days${program.description ? ' &middot; ' + esc(program.description) : ''}</p>
      </div>
      ${req.query.msg ? '<div class="glass" style="padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;"><p style="color:#4ade80;font-size:13px;">' + esc(req.query.msg) + '</p></div>' : ''}
      ${templates.length > 0
        ? '<div class="glass" style="border-radius:16px;overflow:hidden;"><div class="table-wrap"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="${thStyle}width:70px;">Order</th><th style="${thStyle}">Workout</th><th style="${thStyle}">Description</th><th style="${thStyle}">Exercises</th><th style="${thStyle}width:200px;"></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : '<div class="glass" style="padding:40px;text-align:center;border-radius:16px;"><p style="color:rgba(255,255,255,0.4);">No workouts in this program yet.</p></div>'
      }
    `));
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/workouts'); }
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
    const { rows: exercises } = await pool.query('SELECT name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number', [templateId]);
    const exerciseMap = new Map();
    for (const ex of exercises) {
      if (ex.is_section_header) {
        exerciseMap.set(ex.sort_order, { name: ex.name, isSectionHeader: true, sectionNotes: ex.section_notes || '' });
        continue;
      }
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
              <input type="hidden" name="programId" id="program-value" value="${tmpl.program_id || ''}" />
              <button type="button" id="program-btn" onclick="toggleProgramDropdown()" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:${tmpl.program_id ? '#fff' : 'rgba(255,255,255,0.5)'};font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
                <span id="program-label">${tmpl.program_name ? esc(tmpl.program_name) : '— No Program —'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:0.4;"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
              </button>
            </div>
          </div>
          <div style="margin-top:16px;">
            <label>Description <span style="color:rgba(255,255,255,0.2);">(optional)</span></label>
            <input type="text" name="description" value="${esc(tmpl.description || '')}" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;" />
          </div>
        </div>
        <div id="exercises-container"></div>
        <div style="display:flex;gap:8px;margin-bottom:20px;">
          <button type="button" onclick="addExercise()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;">+ Add Exercise</button>
          <button type="button" onclick="addSectionHeader()" class="btn-ghost" style="flex:1;text-align:center;padding:14px;margin:0;border-color:rgba(255,255,255,0.15);">+ Add Section Header</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="submit" class="btn" style="flex:1;padding:14px;font-size:15px;margin:0;">Save Changes</button>
          <a href="/admin/workout-manager/workouts" class="btn-ghost" style="flex:none;padding:14px 24px;margin:0;text-align:center;">Cancel</a>
        </div>
      </form>

      <!-- Program Picker Modal for Edit page -->
      <div id="program-dropdown" style="display:none;position:fixed;inset:0;z-index:9998;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);" onclick="if(event.target===this)this.style.display='none'">
        <div style="padding:20px;max-width:400px;width:90%;border-radius:16px;max-height:70vh;display:flex;flex-direction:column;background:rgba(25,25,25,0.98);border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.8);">
          <h3 style="font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;">Select Program</h3>
          <div style="overflow-y:auto;flex:1;padding:4px 0;">
            ${programs.map(p => '<button type="button" onclick="selectProgram(\'' + p.id + '\',\'' + esc(p.name).replace(/'/g, "\\'") + '\')" style="width:100%;text-align:left;padding:12px 14px;border:none;background:none;color:#fff;font-size:14px;cursor:pointer;font-family:inherit;border-radius:8px;border-bottom:1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background=\'rgba(255,255,255,0.08)\'" onmouseout="this.style.background=\'none\'">' + esc(p.name) + '</button>').join('')}
          </div>
        </div>
      </div>

      <!-- Set Type Picker Modal for Edit page -->
      <div id="settype-modal" style="display:none;position:fixed;inset:0;z-index:9998;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);" onclick="if(event.target===this)this.style.display='none'">
        <div style="padding:16px;max-width:300px;width:85%;border-radius:16px;background:rgba(25,25,25,0.98);border:1px solid rgba(255,255,255,0.1);box-shadow:0 20px 60px rgba(0,0,0,0.8);">
          <h3 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:12px;">Set Type</h3>
          <div id="settype-options"></div>
        </div>
      </div>

      <!-- Custom Exercise Modal for Edit page -->
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
      <script>
        var EXISTING = ${JSON.stringify(exerciseList)};

        function toggleProgramDropdown() { document.getElementById('program-dropdown').style.display = 'flex'; }
        function selectProgram(id, name) { document.getElementById('program-value').value = id; document.getElementById('program-label').textContent = name; document.getElementById('program-btn').style.color = id ? '#fff' : 'rgba(255,255,255,0.5)'; document.getElementById('program-dropdown').style.display = 'none'; }

        ${exerciseCardScript(apiBase)}

        EXISTING.forEach(function(ex) {
          if (ex.isSectionHeader) { addSectionHeader(ex); }
          else { addExercise(ex); }
        });
        if (EXISTING.length === 0) addExercise();

        // AJAX form submit — stay on page after save
        document.querySelector('form').addEventListener('submit', function(e) {
          e.preventDefault();
          var form = this;
          var submitBtn = form.querySelector('[type="submit"]');
          var origText = submitBtn.textContent;
          submitBtn.textContent = 'Saving...';
          submitBtn.disabled = true;
          fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) })
            .then(function() {
              var existing = document.getElementById('save-msg');
              if (existing) existing.remove();
              var msg = document.createElement('div');
              msg.id = 'save-msg';
              msg.className = 'glass';
              msg.style.cssText = 'padding:12px 16px;border-left:3px solid #22c55e;margin-bottom:20px;';
              msg.innerHTML = '<p style="color:#4ade80;font-size:13px;">Changes saved successfully</p>';
              form.parentNode.insertBefore(msg, form);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(function() { if (msg.parentNode) msg.remove(); }, 4000);
            })
            .catch(function() { alert('Failed to save. Please try again.'); })
            .finally(function() { submitBtn.textContent = origText; submitBtn.disabled = false; });
        });
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
        if (ex.isSectionHeader === '1') {
          await pool.query(
            'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [templateId, ex.name.trim(), 'straight', 1, 0, 0, exSort, true, ex.sectionNotes?.trim() || '']
          );
          exSort++;
          continue;
        }
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
  const programId = req.query.programId;
  try {
    await pool.query('DELETE FROM templates WHERE id = $1', [Number(req.params.id)]);
    const redirectTo = programId ? '/admin/workout-manager/program/' + programId + '?msg=Workout+deleted' : '/admin/workout-manager/workouts?msg=Workout+deleted';
    res.redirect(redirectTo);
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/workouts'); }
});

// GET /admin/workout-manager/copy/:id — Duplicate workout
router.get('/workout-manager/copy/:id', adminAuth, async (req, res) => {
  const templateId = Number(req.params.id);
  const programId = req.query.programId;
  try {
    const { rows: tmplRows } = await pool.query('SELECT * FROM templates WHERE id = $1', [templateId]);
    if (!tmplRows[0]) return res.redirect('/admin/workout-manager/workouts');
    const tmpl = tmplRows[0];
    const { rows: sortRows } = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM templates WHERE program_id = $1', [tmpl.program_id]);
    const { rows: [newTmpl] } = await pool.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [tmpl.user_id, tmpl.program_id, tmpl.name + ' (Copy)', tmpl.description, tmpl.is_rest, sortRows[0].next_sort]
    );
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
    const redirectTo = programId ? '/admin/workout-manager/program/' + programId + '?msg=Workout+copied' : '/admin/workout-manager/workouts?msg=Workout+copied';
    res.redirect(redirectTo);
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/workouts'); }
});

// GET /admin/workout-manager/move-program/:id — Move program up or down
router.get('/workout-manager/move-program/:id', adminAuth, async (req, res) => {
  const programId = Number(req.params.id);
  const dir = req.query.dir;
  try {
    const { rows: programs } = await pool.query(
      'SELECT id, sort_order FROM programs WHERE user_id IS NULL ORDER BY sort_order, id'
    );
    // Normalize sort orders first (in case of duplicates)
    for (let i = 0; i < programs.length; i++) {
      if (programs[i].sort_order !== i) {
        await pool.query('UPDATE programs SET sort_order = $1 WHERE id = $2', [i, programs[i].id]);
        programs[i].sort_order = i;
      }
    }
    const idx = programs.findIndex(p => p.id === programId);
    if (idx === -1) return res.redirect('/admin/workout-manager/workouts');
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= programs.length) return res.redirect('/admin/workout-manager/workouts');
    const a = programs[idx];
    const b = programs[swapIdx];
    await pool.query('UPDATE programs SET sort_order = $1 WHERE id = $2', [b.sort_order, a.id]);
    await pool.query('UPDATE programs SET sort_order = $1 WHERE id = $2', [a.sort_order, b.id]);
    res.redirect('/admin/workout-manager/workouts');
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/workouts'); }
});

// GET /admin/workout-manager/move/:id — Move workout up or down
router.get('/workout-manager/move/:id', adminAuth, async (req, res) => {
  const templateId = Number(req.params.id);
  const dir = req.query.dir; // 'up' or 'down'
  const programId = req.query.programId;
  try {
    // Get all templates in this program ordered by sort_order
    const { rows: templates } = await pool.query(
      'SELECT id, sort_order FROM templates WHERE program_id = $1 ORDER BY sort_order',
      [programId]
    );
    const idx = templates.findIndex(t => t.id === templateId);
    if (idx === -1) return res.redirect('/admin/workout-manager/program/' + programId);

    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= templates.length) return res.redirect('/admin/workout-manager/program/' + programId);

    // Swap sort_order values
    const a = templates[idx];
    const b = templates[swapIdx];
    await pool.query('UPDATE templates SET sort_order = $1 WHERE id = $2', [b.sort_order, a.id]);
    await pool.query('UPDATE templates SET sort_order = $1 WHERE id = $2', [a.sort_order, b.id]);

    res.redirect('/admin/workout-manager/program/' + programId);
  } catch (err) { console.error(err); res.redirect('/admin/workout-manager/program/' + programId); }
});

// GET /admin/trainers — Trainer Central
router.get('/trainers', adminAuth, async (req, res) => {
  try {
    const trainers = await db.getTrainersWithStatus();

    const statusBadge = (status) => {
      const colors = {
        approved: 'background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.25);',
        pending: 'background:rgba(234,179,8,0.15);color:#facc15;border:1px solid rgba(234,179,8,0.25);',
        rejected: 'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25);',
      };
      const labels = { approved: 'Approved', pending: 'Application Pending', rejected: 'Denied' };
      const style = colors[status] || colors.pending;
      const label = labels[status] || status;
      return `<span style="${style}padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">${label}</span>`;
    };

    const thStyle = 'padding:12px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);';

    const tableRows = trainers.map((t, i) => {
      const date = t.appliedAt || t.createdAt;
      const dateStr = date
        ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })
        : '—';
      const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
      const tdStyle = 'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);';
      const actions = t.trainerStatus === 'pending' && t.applicationId
        ? `<form method="POST" action="/admin/trainer-applications/${t.applicationId}/approve" style="display:inline;"><button type="submit" style="padding:4px 12px;border-radius:6px;border:1px solid rgba(34,197,94,0.4);background:rgba(34,197,94,0.15);color:#4ade80;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">Approve</button></form>
           <form method="POST" action="/admin/trainer-applications/${t.applicationId}/deny" style="display:inline;margin-left:4px;"><button type="submit" style="padding:4px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.15);color:#f87171;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">Deny</button></form>`
        : '<span style="color:rgba(255,255,255,0.2);font-size:11px;">—</span>';
      return `<tr style="${rowBg}">
        <td style="${tdStyle}font-weight:600;color:#fff;">${esc(t.firstName || '—')}</td>
        <td style="${tdStyle}font-weight:600;color:#fff;">${esc(t.lastName || '—')}</td>
        <td style="${tdStyle}color:rgba(255,255,255,0.5);font-size:13px;">${esc(t.email || '—')}</td>
        <td style="${tdStyle}color:rgba(255,255,255,0.5);font-size:13px;">${esc(t.phone || '—')}</td>
        <td style="${tdStyle}color:rgba(255,255,255,0.5);font-size:13px;">${esc(t.username || '—')}</td>
        <td style="${tdStyle}font-size:13px;">${statusBadge(t.trainerStatus)}</td>
        <td style="${tdStyle}color:rgba(255,255,255,0.5);font-size:13px;">${esc(t.plan)}</td>
        <td style="${tdStyle}color:rgba(255,255,255,0.4);font-size:13px;">${dateStr}</td>
        <td style="${tdStyle}white-space:nowrap;">${actions}</td>
      </tr>`;
    }).join('');

    const approvedCount = trainers.filter(t => t.trainerStatus === 'approved').length;
    const pendingCount = trainers.filter(t => t.trainerStatus === 'pending').length;
    const deniedCount = trainers.filter(t => t.trainerStatus === 'rejected').length;

    res.send(adminPage('Trainer Central', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / Trainer Central</div>
      <div class="header">
        <h1>Trainer Central</h1>
        <p>Manage trainers and review applications</p>
      </div>
      <div class="stats-row" style="margin-bottom:24px;">
        <div class="stat glass">
          <div class="value">${trainers.length}</div>
          <div class="label">Total</div>
        </div>
        <div class="stat glass">
          <div class="value" style="color:#4ade80;">${approvedCount}</div>
          <div class="label">Approved</div>
        </div>
        <div class="stat glass">
          <div class="value" style="color:#facc15;">${pendingCount}</div>
          <div class="label">Pending</div>
        </div>
        <div class="stat glass">
          <div class="value" style="color:#f87171;">${deniedCount}</div>
          <div class="label">Denied</div>
        </div>
      </div>
      ${trainers.length === 0
        ? '<div class="glass" style="padding:40px;text-align:center;border-radius:16px;"><p style="color:rgba(255,255,255,0.4);">No trainers or applications yet.</p></div>'
        : `<div class="glass" style="border-radius:16px;overflow:hidden;">
            <div class="table-wrap">
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="${thStyle}">First Name</th>
                    <th style="${thStyle}">Last Name</th>
                    <th style="${thStyle}">Email</th>
                    <th style="${thStyle}">Phone</th>
                    <th style="${thStyle}">Username</th>
                    <th style="${thStyle}">Trainer Status</th>
                    <th style="${thStyle}">Plan</th>
                    <th style="${thStyle}">Date</th>
                    <th style="${thStyle}">Actions</th>
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
    res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load Trainer Central.</p>'));
  }
});

// GET /admin/trainer-logins — Trainer login history
router.get('/trainer-logins', adminAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tlh.id, tlh.email, tlh.ip, tlh.user_agent, tlh.created_at, tlh.city, tlh.state,
              u.first_name, u.last_name, u.username
       FROM trainer_login_history tlh
       LEFT JOIN users u ON tlh.user_id = u.id
       ORDER BY tlh.created_at DESC
       LIMIT 100`
    );

    const tableRows = rows.map((r, i) => {
      const name = r.first_name && r.last_name
        ? r.first_name + ' ' + r.last_name
        : r.username || r.email || 'Unknown';
      const location = [r.city, r.state].filter(Boolean).join(', ') || '—';
      const date = r.created_at
        ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
        : '—';
      const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
      return '<tr style="' + rowBg + '">' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:600;color:#fff;">' + esc(name) + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + esc(r.email || '—') + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + esc(location) + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);font-size:12px;font-family:monospace;">' + esc(r.ip || '—') + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + date + '</td>' +
      '</tr>';
    }).join('');

    const thStyle = 'padding:12px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);';

    res.send(adminPage('Trainer Login History', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / Trainer Login History</div>
      <div class="header">
        <h1>Trainer Login History</h1>
        <p>${rows.length} login${rows.length !== 1 ? 's' : ''} recorded &middot; Most recent 100</p>
      </div>
      ${rows.length === 0
        ? '<div class="glass" style="padding:40px;text-align:center;border-radius:16px;"><p style="color:rgba(255,255,255,0.4);">No trainer logins recorded yet.</p></div>'
        : '<div class="glass" style="border-radius:16px;overflow:hidden;"><div class="table-wrap"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="' + thStyle + '">User</th><th style="' + thStyle + '">Email</th><th style="' + thStyle + '">Location</th><th style="' + thStyle + '">IP</th><th style="' + thStyle + '">Date</th></tr></thead><tbody>' + tableRows + '</tbody></table></div></div>'
      }
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load trainer login history.</p>'));
  }
});

// GET /admin/user-logins — User login history with date range
router.get('/user-logins', adminAuth, async (req, res) => {
  try {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Parse date range
    let startDate = req.query.start || todayStr;
    let endDate = req.query.end || todayStr;
    if (!dateRegex.test(startDate)) startDate = todayStr;
    if (!dateRegex.test(endDate)) endDate = todayStr;
    if (startDate > todayStr) startDate = todayStr;
    if (endDate > todayStr) endDate = todayStr;
    if (startDate > endDate) startDate = endDate;

    // Calculate range length for navigation
    const startMs = new Date(startDate + 'T00:00:00Z').getTime();
    const endMs = new Date(endDate + 'T00:00:00Z').getTime();
    const rangeDays = Math.round((endMs - startMs) / 86400000) + 1;

    // Previous/next period links
    const prevStart = new Date(startMs - rangeDays * 86400000).toISOString().slice(0, 10);
    const prevEnd = new Date(startMs - 86400000).toISOString().slice(0, 10);
    const nextStart = new Date(endMs + 86400000).toISOString().slice(0, 10);
    const nextEnd = new Date(endMs + rangeDays * 86400000).toISOString().slice(0, 10);
    const canGoNext = nextStart <= todayStr;

    // Fetch logins in range
    const { rows } = await pool.query(
      `SELECT ulh.id, ulh.email, ulh.ip, ulh.user_agent, ulh.created_at, ulh.city, ulh.state,
              u.first_name, u.last_name, u.username
       FROM user_login_history ulh
       LEFT JOIN users u ON ulh.user_id = u.id
       WHERE ulh.created_at >= $1::date AND ulh.created_at < ($2::date + interval '1 day')
       ORDER BY ulh.created_at DESC`,
      [startDate, endDate]
    );

    // Count unique users
    const uniqueUsers = new Set(rows.map(r => r.email)).size;

    const tableRows = rows.map((r, i) => {
      const name = r.first_name && r.last_name
        ? esc(r.first_name + ' ' + r.last_name)
        : esc(r.username || r.email || 'Unknown');
      const location = [r.city, r.state].filter(Boolean).join(', ') || '—';
      const date = r.created_at
        ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
        : '—';
      const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
      return '<tr style="' + rowBg + '">' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:600;color:#fff;">' + name + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + esc(r.email || '—') + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;">' + esc(location) + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);font-size:12px;font-family:monospace;">' + esc(r.ip || '—') + '</td>' +
        '<td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:13px;white-space:nowrap;">' + date + '</td>' +
      '</tr>';
    }).join('');

    const thStyle = 'padding:12px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);';
    const presetBtnStyle = 'padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.6);font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.15s;';
    const activeBtnStyle = 'padding:6px 14px;border-radius:8px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.15);color:#ef4444;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600;';

    // Preset detection
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last7Start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const last30Start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const monthStart = todayStr.slice(0, 8) + '01';
    const isToday = startDate === todayStr && endDate === todayStr;
    const isYesterday = startDate === yesterday && endDate === yesterday;
    const isLast7 = startDate === last7Start && endDate === todayStr;
    const isLast30 = startDate === last30Start && endDate === todayStr;
    const isThisMonth = startDate === monthStart && endDate === todayStr;

    function presetBtn(label, s, e, active) {
      return '<a href="/admin/user-logins?start=' + s + '&end=' + e + '" style="' + (active ? activeBtnStyle : presetBtnStyle) + 'text-decoration:none;">' + label + '</a>';
    }

    res.send(adminPage('User Login History', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / User Login History</div>
      <div class="header">
        <h1>User Login History</h1>
        <p>${rows.length} login${rows.length !== 1 ? 's' : ''} &middot; ${uniqueUsers} unique user${uniqueUsers !== 1 ? 's' : ''}</p>
      </div>

      <!-- Date Range Controls -->
      <div class="glass" style="padding:16px 20px;border-radius:16px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <a href="/admin/user-logins?start=${prevStart}&end=${prevEnd}" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:18px;padding:4px 8px;">&larr;</a>
          <form method="GET" action="/admin/user-logins" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <input type="date" name="start" value="${startDate}" max="${todayStr}" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;" />
            <span style="color:rgba(255,255,255,0.3);">to</span>
            <input type="date" name="end" value="${endDate}" max="${todayStr}" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;" />
            <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">Go</button>
          </form>
          ${canGoNext ? '<a href="/admin/user-logins?start=' + nextStart + '&end=' + (nextEnd > todayStr ? todayStr : nextEnd) + '" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:18px;padding:4px 8px;">&rarr;</a>' : '<span style="color:rgba(255,255,255,0.15);font-size:18px;padding:4px 8px;">&rarr;</span>'}
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          ${presetBtn('Today', todayStr, todayStr, isToday)}
          ${presetBtn('Yesterday', yesterday, yesterday, isYesterday)}
          ${presetBtn('Last 7 Days', last7Start, todayStr, isLast7)}
          ${presetBtn('Last 30 Days', last30Start, todayStr, isLast30)}
          ${presetBtn('This Month', monthStart, todayStr, isThisMonth)}
        </div>
      </div>

      ${rows.length === 0
        ? '<div class="glass" style="padding:40px;text-align:center;border-radius:16px;"><p style="color:rgba(255,255,255,0.4);">No user logins recorded for this period.</p></div>'
        : '<div class="glass" style="border-radius:16px;overflow:hidden;"><div class="table-wrap"><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="' + thStyle + '">User</th><th style="' + thStyle + '">Email</th><th style="' + thStyle + '">Location</th><th style="' + thStyle + '">IP</th><th style="' + thStyle + '">Date</th></tr></thead><tbody>' + tableRows + '</tbody></table></div></div>'
      }
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load user login history.</p>'));
  }
});

// GET /admin/page-visits — Page visit analytics with date range
router.get('/page-visits', adminAuth, async (req, res) => {
  try {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const todayStr = new Date().toISOString().slice(0, 10);

    let startDate = req.query.start || todayStr;
    let endDate = req.query.end || todayStr;
    if (!dateRegex.test(startDate)) startDate = todayStr;
    if (!dateRegex.test(endDate)) endDate = todayStr;
    if (startDate > todayStr) startDate = todayStr;
    if (endDate > todayStr) endDate = todayStr;
    if (startDate > endDate) startDate = endDate;

    const startMs = new Date(startDate + 'T00:00:00Z').getTime();
    const endMs = new Date(endDate + 'T00:00:00Z').getTime();
    const rangeDays = Math.round((endMs - startMs) / 86400000) + 1;
    const prevStart = new Date(startMs - rangeDays * 86400000).toISOString().slice(0, 10);
    const prevEnd = new Date(startMs - 86400000).toISOString().slice(0, 10);
    const nextStart = new Date(endMs + 86400000).toISOString().slice(0, 10);
    const nextEnd = new Date(endMs + rangeDays * 86400000).toISOString().slice(0, 10);
    const canGoNext = nextStart <= todayStr;

    // Page visit summary (grouped by path)
    const { rows: summary } = await pool.query(
      `SELECT pv.path, COUNT(*)::int AS visits, COUNT(DISTINCT pv.user_id)::int AS unique_users
       FROM page_visits pv
       WHERE pv.created_at >= $1::date AND pv.created_at < ($2::date + interval '1 day')
       GROUP BY pv.path ORDER BY visits DESC`,
      [startDate, endDate]
    );

    // Detailed log (most recent 200)
    const { rows: details } = await pool.query(
      `SELECT pv.path, pv.created_at, u.first_name, u.last_name, u.username, u.email
       FROM page_visits pv
       LEFT JOIN users u ON pv.user_id = u.id
       WHERE pv.created_at >= $1::date AND pv.created_at < ($2::date + interval '1 day')
       ORDER BY pv.created_at DESC LIMIT 200`,
      [startDate, endDate]
    );

    const totalVisits = summary.reduce((s, r) => s + r.visits, 0);
    const totalUnique = new Set(details.map(d => d.email)).size;

    const thStyle = 'padding:12px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:700;background:rgba(255,255,255,0.04);border-bottom:2px solid rgba(255,255,255,0.08);';
    const presetBtnStyle = 'padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.6);font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.15s;';
    const activeBtnStyle = 'padding:6px 14px;border-radius:8px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.15);color:#ef4444;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600;';

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last7Start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const last30Start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const monthStart = todayStr.slice(0, 8) + '01';
    const isToday = startDate === todayStr && endDate === todayStr;
    const isYesterday = startDate === yesterday && endDate === yesterday;
    const isLast7 = startDate === last7Start && endDate === todayStr;
    const isLast30 = startDate === last30Start && endDate === todayStr;
    const isThisMonth = startDate === monthStart && endDate === todayStr;

    function presetBtn(label, s, e, active) {
      return '<a href="/admin/page-visits?start=' + s + '&end=' + e + '" style="' + (active ? activeBtnStyle : presetBtnStyle) + 'text-decoration:none;">' + label + '</a>';
    }

    // Summary table rows
    const summaryRows = summary.map((r, i) => {
      const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
      const td = 'padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);';
      return `<tr style="${rowBg}">
        <td style="${td}font-weight:600;color:#fff;">${esc(r.path)}</td>
        <td style="${td}color:rgba(255,255,255,0.5);text-align:center;">${r.visits}</td>
        <td style="${td}color:rgba(255,255,255,0.5);text-align:center;">${r.unique_users}</td>
      </tr>`;
    }).join('');

    // Detail table rows
    const detailRows = details.map((r, i) => {
      const name = r.first_name && r.last_name ? esc(r.first_name + ' ' + r.last_name) : esc(r.username || r.email || 'Unknown');
      const date = r.created_at
        ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
        : '—';
      const rowBg = i % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : '';
      const td = 'padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.06);';
      return `<tr style="${rowBg}">
        <td style="${td}color:#fff;font-weight:600;font-size:13px;">${name}</td>
        <td style="${td}color:rgba(255,255,255,0.5);font-size:13px;">${esc(r.path)}</td>
        <td style="${td}color:rgba(255,255,255,0.4);font-size:13px;white-space:nowrap;">${date}</td>
      </tr>`;
    }).join('');

    res.send(adminPage('Page Visits', `
      <div class="breadcrumb"><a href="/admin">Dashboard</a> / Page Visits</div>
      <div class="header">
        <h1>Page Visits</h1>
        <p>${totalVisits} visit${totalVisits !== 1 ? 's' : ''} &middot; ${totalUnique} unique user${totalUnique !== 1 ? 's' : ''}</p>
      </div>

      <!-- Date Range Controls -->
      <div class="glass" style="padding:16px 20px;border-radius:16px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <a href="/admin/page-visits?start=${prevStart}&end=${prevEnd}" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:18px;padding:4px 8px;">&larr;</a>
          <form method="GET" action="/admin/page-visits" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <input type="date" name="start" value="${startDate}" max="${todayStr}" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;" />
            <span style="color:rgba(255,255,255,0.3);">to</span>
            <input type="date" name="end" value="${endDate}" max="${todayStr}" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:13px;font-family:inherit;outline:none;" />
            <button type="submit" style="padding:8px 16px;border-radius:8px;border:none;background:#ef4444;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">Go</button>
          </form>
          ${canGoNext ? '<a href="/admin/page-visits?start=' + nextStart + '&end=' + (nextEnd > todayStr ? todayStr : nextEnd) + '" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:18px;padding:4px 8px;">&rarr;</a>' : '<span style="color:rgba(255,255,255,0.15);font-size:18px;padding:4px 8px;">&rarr;</span>'}
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          ${presetBtn('Today', todayStr, todayStr, isToday)}
          ${presetBtn('Yesterday', yesterday, yesterday, isYesterday)}
          ${presetBtn('Last 7 Days', last7Start, todayStr, isLast7)}
          ${presetBtn('Last 30 Days', last30Start, todayStr, isLast30)}
          ${presetBtn('This Month', monthStart, todayStr, isThisMonth)}
        </div>
      </div>

      <!-- Summary by Page -->
      <h2 style="font-size:16px;font-weight:700;color:rgba(255,255,255,0.7);margin-bottom:12px;">Pages</h2>
      ${summary.length === 0
        ? '<div class="glass" style="padding:40px;text-align:center;border-radius:16px;margin-bottom:24px;"><p style="color:rgba(255,255,255,0.4);">No page visits recorded for this period.</p></div>'
        : `<div class="glass" style="border-radius:16px;overflow:hidden;margin-bottom:24px;">
            <div class="table-wrap"><table style="width:100%;border-collapse:collapse;">
              <thead><tr><th style="${thStyle}">Page</th><th style="${thStyle}text-align:center;">Visits</th><th style="${thStyle}text-align:center;">Unique Users</th></tr></thead>
              <tbody>${summaryRows}</tbody>
            </table></div></div>`
      }

      <!-- Detail Log -->
      <h2 style="font-size:16px;font-weight:700;color:rgba(255,255,255,0.7);margin-bottom:12px;">Recent Activity</h2>
      ${details.length === 0
        ? '<div class="glass" style="padding:40px;text-align:center;border-radius:16px;"><p style="color:rgba(255,255,255,0.4);">No activity for this period.</p></div>'
        : `<div class="glass" style="border-radius:16px;overflow:hidden;">
            <div class="table-wrap"><table style="width:100%;border-collapse:collapse;">
              <thead><tr><th style="${thStyle}">User</th><th style="${thStyle}">Page</th><th style="${thStyle}">Time</th></tr></thead>
              <tbody>${detailRows}</tbody>
            </table></div></div>`
      }
    `));
  } catch (err) {
    console.error(err);
    res.status(500).send(adminPage('Error', '<p style="color:#f87171;">Failed to load page visits.</p>'));
  }
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

// GET /admin/daily-summary — Daily Summary page (supports ?start=&end= for range, or ?date= for single day)
router.get('/daily-summary', adminAuth, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    // Support both ?date=X (single day) and ?start=X&end=Y (range)
    let startDate, endDate;
    if (req.query.start && dateRe.test(req.query.start)) {
      startDate = req.query.start;
      endDate = (req.query.end && dateRe.test(req.query.end)) ? req.query.end : startDate;
    } else if (req.query.date && dateRe.test(req.query.date)) {
      startDate = req.query.date;
      endDate = startDate;
    } else {
      startDate = todayStr;
      endDate = todayStr;
    }
    // Clamp end to today
    if (endDate > todayStr) endDate = todayStr;
    if (startDate > endDate) startDate = endDate;
    const isRange = startDate !== endDate;
    const isSingleToday = !isRange && startDate === todayStr;

    const stats = await db.getDailyStats(startDate, endDate);

    // Arrow navigation (shift by range length)
    const rangeMs = new Date(endDate + 'T00:00:00Z').getTime() - new Date(startDate + 'T00:00:00Z').getTime() + 86400000;
    const prevEnd = new Date(new Date(startDate + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
    const prevStart = new Date(new Date(startDate + 'T00:00:00Z').getTime() - rangeMs).toISOString().slice(0, 10);
    const nextStart = new Date(new Date(endDate + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    const nextEndMs = new Date(endDate + 'T00:00:00Z').getTime() + rangeMs;
    const nextEndClamped = new Date(Math.min(nextEndMs, new Date(todayStr + 'T00:00:00Z').getTime())).toISOString().slice(0, 10);
    const canGoNext = endDate < todayStr;

    // Build nav URLs
    const prevUrl = isRange ? `/admin/daily-summary?start=${prevStart}&end=${prevEnd}` : `/admin/daily-summary?date=${prevStart}`;
    const nextUrl = isRange ? `/admin/daily-summary?start=${nextStart}&end=${nextEndClamped}` : `/admin/daily-summary?date=${nextStart}`;

    // Custom exercises in range
    let customExercises = [];
    try {
      const { rows } = await pool.query(`
        SELECT e.name, e.muscle_group AS muscle, u.email, u.first_name, u.last_name, e.created_at
        FROM exercises e JOIN users u ON e.created_by = u.id
        WHERE e.created_at::date BETWEEN $1 AND $2
        ORDER BY e.created_at DESC
      `, [startDate, endDate]);
      customExercises = rows;
    } catch {}

    // Custom exercises in previous period for comparison
    let customExPrev = 0;
    try {
      const { rows: [row] } = await pool.query(
        `SELECT COUNT(*) FROM exercises WHERE created_by IS NOT NULL AND created_at::date BETWEEN $1 AND $2`,
        [stats.prevStart, stats.prevEnd]
      );
      customExPrev = parseInt(row.count);
    } catch {}

    // Workouts detail (sessions with user + template info)
    let workoutDetails = [];
    try {
      const { rows } = await pool.query(`
        SELECT s.created_at, t.name AS template_name, u.first_name, u.last_name, u.email
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN templates t ON s.template_id = t.id
        WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
          AND s.created_at::date BETWEEN $1 AND $2
        ORDER BY s.created_at DESC
      `, [startDate, endDate]);
      workoutDetails = rows;
    } catch {}

    // Active users detail (distinct users with session counts)
    let activeUserDetails = [];
    try {
      const { rows } = await pool.query(`
        SELECT u.first_name, u.last_name, u.email, COUNT(s.id) AS session_count,
               MAX(s.created_at) AS last_session
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
          AND s.created_at::date BETWEEN $1 AND $2
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY session_count DESC
      `, [startDate, endDate]);
      activeUserDetails = rows;
    } catch {}

    // Error log (only for today)
    let errorsInRange = [];
    if (isSingleToday) {
      try {
        const { errorLog: log } = await import('../index.js');
        errorsInRange = (log || []).filter(e => e.timestamp?.startsWith(todayStr));
      } catch {}
    }

    // Feedback in range
    let feedbackInRange = [];
    try {
      const { rows } = await pool.query(`
        SELECT f.type, f.message, f.created_at, u.email, u.first_name, u.last_name
        FROM feedback f JOIN users u ON f.user_id = u.id
        WHERE f.created_at::date BETWEEN $1 AND $2
        ORDER BY f.created_at DESC
      `, [startDate, endDate]);
      feedbackInRange = rows;
    } catch {}

    // Feedback in previous period for comparison
    let feedbackPrev = 0;
    try {
      const { rows: [row] } = await pool.query(
        `SELECT COUNT(*) FROM feedback WHERE created_at::date BETWEEN $1 AND $2`,
        [stats.prevStart, stats.prevEnd]
      );
      feedbackPrev = parseInt(row.count);
    } catch {}

    function delta(current, previous) {
      const diff = current - previous;
      if (diff > 0) return `<span style="color:#22c55e;font-weight:700;">+${diff} &#9650;</span>`;
      if (diff < 0) return `<span style="color:#ef4444;font-weight:700;">${diff} &#9660;</span>`;
      return `<span style="color:#888;">0 &#8212;</span>`;
    }

    const fmtDate = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const displayLabel = isRange ? `${fmtDate(startDate)} — ${fmtDate(endDate)}` : fmtDate(startDate);
    const compLabel = isRange ? `${fmtDate(stats.prevStart)} — ${fmtDate(stats.prevEnd)}` : fmtDate(stats.prevEnd);

    // Preset URLs
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const last7Start = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const last30Start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const monthStart = todayStr.slice(0, 8) + '01';

    // Build detail table row helpers
    const td = (text, extra = '') => `<td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;${extra}">${text}</td>`;
    const tdFade = (text) => td(text, 'color:rgba(255,255,255,0.5);');
    const tdDim = (text) => td(text, 'color:rgba(255,255,255,0.4);');
    const fmtTime = (dt) => new Date(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const fmtDayTime = (dt) => { const d = new Date(dt); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
    const timeCol = (dt) => isRange ? fmtDayTime(dt) : fmtTime(dt);

    const signupRows = stats.recentSignups.map(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
      const loc = [u.signup_city, u.signup_state].filter(Boolean).join(', ') || '—';
      return `<tr>${td(name)}${tdFade(u.email || u.phone || '—')}${tdFade(loc)}${tdDim(timeCol(u.created_at))}</tr>`;
    }).join('');

    const workoutRows = workoutDetails.map(w => {
      const name = [w.first_name, w.last_name].filter(Boolean).join(' ') || '—';
      return `<tr>${td(name)}${tdFade(w.email || '—')}${tdFade(w.template_name || '—')}${tdDim(timeCol(w.created_at))}</tr>`;
    }).join('');

    const activeUserRows = activeUserDetails.map(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
      return `<tr>${td(name)}${tdFade(u.email || '—')}${td(u.session_count, 'text-align:center;')}${tdDim(timeCol(u.last_session))}</tr>`;
    }).join('');

    const customExRows = customExercises.map(e => {
      const name = [e.first_name, e.last_name].filter(Boolean).join(' ') || '—';
      return `<tr>${td(e.name)}${tdFade(e.muscle || '—')}${tdFade(name)}${tdDim(timeCol(e.created_at))}</tr>`;
    }).join('');

    const feedbackRows = feedbackInRange.map(f => {
      const name = [f.first_name, f.last_name].filter(Boolean).join(' ') || '—';
      const typeColor = f.type === 'bug' ? '#ef4444' : '#3b82f6';
      const typeLabel = f.type === 'bug' ? 'Bug' : 'Idea';
      return `<tr>${td(`<span style="color:${typeColor};font-weight:600;">${typeLabel}</span>`)}${td(f.message)}${tdFade(name)}${tdDim(timeCol(f.created_at))}</tr>`;
    }).join('');

    const errorRows = errorsInRange.slice(0, 20).map(e => {
      const time = fmtTime(e.timestamp);
      return `<tr>${td(`${e.method} ${e.url}`, 'color:#ef4444;font-weight:600;')}${td(e.message)}${tdDim(time)}</tr>`;
    }).join('');

    // Clickable number helper — wraps a count as a link that scrolls to + toggles a detail section
    const clickNum = (count, sectionId) => count > 0
      ? `<a href="#${sectionId}" onclick="event.preventDefault();var s=document.getElementById('${sectionId}');s.style.display=s.style.display==='none'?'block':'block';s.scrollIntoView({behavior:'smooth',block:'start'});" style="color:#60a5fa;text-decoration:underline;cursor:pointer;">${count}</a>`
      : `${count}`;

    // Detail section header
    const thStyle = 'text-align:left;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.08);';

    // Preset button style helper
    const presetBtn = (label, url, active) => `<a href="${url}" style="padding:4px 10px;border-radius:6px;font-size:12px;text-decoration:none;color:${active ? '#fff' : 'rgba(255,255,255,0.4)'};background:${active ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.05)'};border:1px solid ${active ? 'rgba(96,165,250,0.4)' : 'transparent'};">${label}</a>`;

    // Determine which preset is active
    const isPresetToday = startDate === todayStr && endDate === todayStr;
    const isPresetYesterday = startDate === yesterday && endDate === yesterday;
    const isPresetLast7 = startDate === last7Start && endDate === todayStr;
    const isPresetLast30 = startDate === last30Start && endDate === todayStr;
    const isPresetMonth = startDate === monthStart && endDate === todayStr;

    // Build export data JSON (embedded in page for client-side export)
    const exportData = {
      title: 'RepLab Daily Summary',
      period: displayLabel,
      summary: {
        'Total Users': stats.totalUsers,
        'New Signups': stats.newUsersCurrent,
        'New Signups (Prev)': stats.newUsersPrev,
        'Workouts': stats.workoutsCurrent,
        'Workouts (Prev)': stats.workoutsPrev,
        'Active Users': stats.activeUsersCurrent,
        'Active Users (Prev)': stats.activeUsersPrev,
        'Custom Exercises': customExercises.length,
        'Custom Exercises (Prev)': customExPrev,
        'Feedback': feedbackInRange.length,
        'Feedback (Prev)': feedbackPrev,
        'Errors': errorsInRange.length,
      },
      signups: stats.recentSignups.map(u => ({
        Name: [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
        Contact: u.email || u.phone || '—',
        Location: [u.signup_city, u.signup_state].filter(Boolean).join(', ') || '—',
        Time: timeCol(u.created_at),
      })),
      workouts: workoutDetails.map(w => ({
        User: [w.first_name, w.last_name].filter(Boolean).join(' ') || '—',
        Contact: w.email || '—',
        Template: w.template_name || '—',
        Time: timeCol(w.created_at),
      })),
      activeUsers: activeUserDetails.map(u => ({
        User: [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
        Contact: u.email || '—',
        Sessions: parseInt(u.session_count),
        'Last Active': timeCol(u.last_session),
      })),
      exercises: customExercises.map(e => ({
        Exercise: e.name,
        Muscle: e.muscle || '—',
        'Created By': [e.first_name, e.last_name].filter(Boolean).join(' ') || '—',
        Time: timeCol(e.created_at),
      })),
      feedback: feedbackInRange.map(f => ({
        Type: f.type === 'bug' ? 'Bug' : 'Idea',
        Message: f.message,
        From: [f.first_name, f.last_name].filter(Boolean).join(' ') || '—',
        Time: timeCol(f.created_at),
      })),
      errors: errorsInRange.map(e => ({
        Endpoint: `${e.method} ${e.url}`,
        Error: e.message,
        Time: fmtTime(e.timestamp),
      })),
    };

    res.send(adminPage('Daily Summary', `
    <style>
      .detail-section { margin-bottom:24px; }
      .detail-section .detail-body { display:block; }
      .clickable-count { color:#60a5fa; text-decoration:underline; cursor:pointer; }
      .clickable-count:hover { color:#93bbfc; }
      .date-controls { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:10px; }
      .preset-bar { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .export-bar { display:flex; gap:8px; margin-bottom:16px; }
      .export-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid rgba(255,255,255,0.12); text-decoration:none; transition:all 0.15s; }
      .export-btn:hover { transform:translateY(-1px); }
      .export-btn.pdf { background:rgba(239,68,68,0.15); color:#ef4444; border-color:rgba(239,68,68,0.3); }
      .export-btn.pdf:hover { background:rgba(239,68,68,0.25); }
      .export-btn.excel { background:rgba(34,197,94,0.15); color:#22c55e; border-color:rgba(34,197,94,0.3); }
      .export-btn.excel:hover { background:rgba(34,197,94,0.25); }
    </style>
    <script id="exportData" type="application/json">${JSON.stringify(exportData).replace(/<\//g, '<\\/')}</script>
    <div class="breadcrumb" style="display:flex;justify-content:space-between;align-items:center;">
      <a href="/admin">← Dashboard</a>
      <div class="export-bar">
        <button onclick="exportPDF()" class="export-btn pdf">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          PDF
        </button>
        <button onclick="exportExcel()" class="export-btn excel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="16" y2="9"/></svg>
          Excel
        </button>
      </div>
    </div>
    <div class="header">
      <h1>Daily Summary</h1>
      <p style="color:rgba(255,255,255,0.5);margin-top:4px;">${displayLabel}</p>

      <!-- Date controls -->
      <div class="date-controls">
        <a href="${prevUrl}" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:20px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.05);">&#8592;</a>
        <div style="display:flex;align-items:center;gap:6px;">
          <input type="date" id="startDate" value="${startDate}" max="${todayStr}"
            style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:6px 10px;border-radius:6px;font-size:13px;cursor:pointer;" />
          <span style="color:rgba(255,255,255,0.3);">to</span>
          <input type="date" id="endDate" value="${endDate}" max="${todayStr}"
            style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#fff;padding:6px 10px;border-radius:6px;font-size:13px;cursor:pointer;" />
          <button onclick="applyRange()" style="background:rgba(96,165,250,0.2);border:1px solid rgba(96,165,250,0.4);color:#60a5fa;padding:6px 14px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600;">Go</button>
        </div>
        ${canGoNext ? `<a href="${nextUrl}" style="color:rgba(255,255,255,0.5);text-decoration:none;font-size:20px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.05);">&#8594;</a>` : `<span style="color:rgba(255,255,255,0.15);font-size:20px;padding:4px 8px;">&#8594;</span>`}
      </div>

      <!-- Presets -->
      <div class="preset-bar">
        ${presetBtn('Today', '/admin/daily-summary', isPresetToday)}
        ${presetBtn('Yesterday', `/admin/daily-summary?date=${yesterday}`, isPresetYesterday)}
        ${presetBtn('Last 7 Days', `/admin/daily-summary?start=${last7Start}&end=${todayStr}`, isPresetLast7)}
        ${presetBtn('Last 30 Days', `/admin/daily-summary?start=${last30Start}&end=${todayStr}`, isPresetLast30)}
        ${presetBtn('This Month', `/admin/daily-summary?start=${monthStart}&end=${todayStr}`, isPresetMonth)}
      </div>
    </div>

    <script>
    function applyRange() {
      var s = document.getElementById('startDate').value;
      var e = document.getElementById('endDate').value;
      if (!s) return;
      if (!e || e < s) e = s;
      if (s === e) {
        window.location.href = '/admin/daily-summary?date=' + s;
      } else {
        window.location.href = '/admin/daily-summary?start=' + s + '&end=' + e;
      }
    }
    function toggleDetail(id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
      el.scrollIntoView({behavior:'smooth', block:'nearest'});
    }
    </script>

    <!-- Top-level stats -->
    <div class="stats">
      <div class="stat glass">
        <div class="value">${stats.totalUsers}</div>
        <div class="label">Total Users</div>
      </div>
      <div class="stat glass">
        <div class="value">${clickNum(stats.workoutsCurrent, 'detail-workouts')}</div>
        <div class="label">Workouts</div>
      </div>
      <div class="stat glass">
        <div class="value">${clickNum(stats.activeUsersCurrent, 'detail-active')}</div>
        <div class="label">Active Users</div>
      </div>
    </div>

    <!-- Comparison table -->
    <div class="glass" style="padding:20px;margin-bottom:24px;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">${isRange ? 'Period Comparison' : 'Day-over-Day'}</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.08);">Metric</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.08);">${isSingleToday ? 'Today' : isRange ? 'Selected' : startDate}</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.08);">${isSingleToday ? 'Yesterday' : 'Previous'}</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);border-bottom:1px solid rgba(255,255,255,0.08);">Change</th>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:14px;font-weight:600;">New Signups</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;">${clickNum(stats.newUsersCurrent, 'detail-signups')}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;color:rgba(255,255,255,0.4);">${stats.newUsersPrev}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;">${delta(stats.newUsersCurrent, stats.newUsersPrev)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:14px;font-weight:600;border-top:1px solid rgba(255,255,255,0.06);">Workouts Logged</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${clickNum(stats.workoutsCurrent, 'detail-workouts')}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;color:rgba(255,255,255,0.4);border-top:1px solid rgba(255,255,255,0.06);">${stats.workoutsPrev}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${delta(stats.workoutsCurrent, stats.workoutsPrev)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:14px;font-weight:600;border-top:1px solid rgba(255,255,255,0.06);">Active Users</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${clickNum(stats.activeUsersCurrent, 'detail-active')}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;color:rgba(255,255,255,0.4);border-top:1px solid rgba(255,255,255,0.06);">${stats.activeUsersPrev}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${delta(stats.activeUsersCurrent, stats.activeUsersPrev)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:14px;font-weight:600;border-top:1px solid rgba(255,255,255,0.06);">Custom Exercises</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${clickNum(customExercises.length, 'detail-exercises')}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;color:rgba(255,255,255,0.4);border-top:1px solid rgba(255,255,255,0.06);">${customExPrev}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${delta(customExercises.length, customExPrev)}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:14px;font-weight:600;border-top:1px solid rgba(255,255,255,0.06);">Errors</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);${errorsInRange.length > 0 ? 'color:#ef4444;' : ''}">${clickNum(errorsInRange.length, 'detail-errors')}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;color:rgba(255,255,255,0.4);border-top:1px solid rgba(255,255,255,0.06);">—</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">—</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-size:14px;font-weight:600;border-top:1px solid rgba(255,255,255,0.06);">Feedback</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${clickNum(feedbackInRange.length, 'detail-feedback')}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;color:rgba(255,255,255,0.4);border-top:1px solid rgba(255,255,255,0.06);">${feedbackPrev}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;border-top:1px solid rgba(255,255,255,0.06);">${delta(feedbackInRange.length, feedbackPrev)}</td>
        </tr>
      </table>
      ${isRange ? `<p style="color:rgba(255,255,255,0.25);font-size:11px;margin-top:12px;">Compared to previous period: ${compLabel}</p>` : ''}
    </div>

    <!-- Detail: New Signups -->
    <div id="detail-signups" class="glass detail-section" style="padding:20px;display:none;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">New Signups (${stats.recentSignups.length})</h3>
      ${stats.recentSignups.length > 0 ? `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><th style="${thStyle}">Name</th><th style="${thStyle}">Contact</th><th style="${thStyle}">Location</th><th style="${thStyle}">Time</th></tr>
          ${signupRows}
        </table>
      </div>` : `<p style="color:rgba(255,255,255,0.3);font-size:13px;">No new signups in this period.</p>`}
    </div>

    <!-- Detail: Workouts -->
    <div id="detail-workouts" class="glass detail-section" style="padding:20px;display:none;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">Workouts Logged (${workoutDetails.length})</h3>
      ${workoutDetails.length > 0 ? `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><th style="${thStyle}">User</th><th style="${thStyle}">Contact</th><th style="${thStyle}">Template</th><th style="${thStyle}">Time</th></tr>
          ${workoutRows}
        </table>
      </div>` : `<p style="color:rgba(255,255,255,0.3);font-size:13px;">No workouts logged in this period.</p>`}
    </div>

    <!-- Detail: Active Users -->
    <div id="detail-active" class="glass detail-section" style="padding:20px;display:none;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">Active Users (${activeUserDetails.length})</h3>
      ${activeUserDetails.length > 0 ? `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><th style="${thStyle}">User</th><th style="${thStyle}">Contact</th><th style="${thStyle}text-align:center;">Sessions</th><th style="${thStyle}">Last Active</th></tr>
          ${activeUserRows}
        </table>
      </div>` : `<p style="color:rgba(255,255,255,0.3);font-size:13px;">No active users in this period.</p>`}
    </div>

    <!-- Detail: Custom Exercises -->
    <div id="detail-exercises" class="glass detail-section" style="padding:20px;display:none;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">Custom Exercises (${customExercises.length})</h3>
      ${customExercises.length > 0 ? `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><th style="${thStyle}">Exercise</th><th style="${thStyle}">Muscle</th><th style="${thStyle}">Created By</th><th style="${thStyle}">Time</th></tr>
          ${customExRows}
        </table>
      </div>` : `<p style="color:rgba(255,255,255,0.3);font-size:13px;">No custom exercises in this period.</p>`}
    </div>

    <!-- Detail: Feedback -->
    <div id="detail-feedback" class="glass detail-section" style="padding:20px;display:none;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;">Feedback (${feedbackInRange.length})</h3>
      ${feedbackInRange.length > 0 ? `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><th style="${thStyle}">Type</th><th style="${thStyle}">Message</th><th style="${thStyle}">From</th><th style="${thStyle}">Time</th></tr>
          ${feedbackRows}
        </table>
      </div>` : `<p style="color:rgba(255,255,255,0.3);font-size:13px;">No feedback in this period.</p>`}
    </div>

    <!-- Detail: Errors -->
    <div id="detail-errors" class="glass detail-section" style="padding:20px;display:none;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:${errorsInRange.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.6)'};text-transform:uppercase;letter-spacing:1px;">Errors (${errorsInRange.length})</h3>
      ${errorsInRange.length > 0 ? `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><th style="${thStyle}">Endpoint</th><th style="${thStyle}">Error</th><th style="${thStyle}">Time</th></tr>
          ${errorRows}
        </table>
      </div>` : `<p style="color:#4ade80;font-size:13px;">No errors in this period.</p>${!isSingleToday ? '<p style="color:rgba(255,255,255,0.25);font-size:11px;margin-top:8px;">Note: Error logs are only available in real-time for the current day.</p>' : ''}`}
    </div>

    <!-- Export libraries -->
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
    <script src="https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js"></script>
    <script src="https://unpkg.com/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js"></script>
    <script>
    function getExportData() {
      return JSON.parse(document.getElementById('exportData').textContent);
    }

    function exportExcel() {
      try {
        if (typeof XLSX === 'undefined') {
          alert('Excel library is still loading. Please wait a moment and try again.');
          return;
        }
        var d = getExportData();
        var wb = XLSX.utils.book_new();

        // Summary sheet
        var summaryRows = Object.entries(d.summary).map(function(e) { return { Metric: e[0], Value: e[1] }; });
        var ws = XLSX.utils.json_to_sheet(summaryRows);
        ws['!cols'] = [{ wch: 24 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Summary');

        // Detail sheets
        var sheets = [
          ['New Signups', d.signups],
          ['Workouts', d.workouts],
          ['Active Users', d.activeUsers],
          ['Custom Exercises', d.exercises],
          ['Feedback', d.feedback],
          ['Errors', d.errors],
        ];
        sheets.forEach(function(s) {
          if (s[1] && s[1].length > 0) {
            var sheet = XLSX.utils.json_to_sheet(s[1]);
            sheet['!cols'] = Object.keys(s[1][0]).map(function() { return { wch: 20 }; });
            XLSX.utils.book_append_sheet(wb, sheet, s[0]);
          }
        });

        var filename = 'RepLab_Summary_' + document.getElementById('startDate').value + '.xlsx';
        XLSX.writeFile(wb, filename);
      } catch (err) {
        alert('Excel export failed: ' + err.message);
      }
    }

    function exportPDF() {
      try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
          alert('PDF library is still loading. Please wait a moment and try again.');
          return;
        }
        var d = getExportData();
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        var pageW = doc.internal.pageSize.getWidth();
        var y = 16;

        // Title
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('RepLab Daily Summary', 14, y);
        y += 8;
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(120);
        doc.text(d.period, 14, y);
        y += 10;

        // Summary table
        doc.setTextColor(0);
        var summaryBody = [];
        var keys = Object.keys(d.summary);
        for (var i = 0; i < keys.length; i += 2) {
          var row = [keys[i], String(d.summary[keys[i]])];
          if (keys[i + 1]) {
            row.push(keys[i + 1], String(d.summary[keys[i + 1]]));
          } else {
            row.push('', '');
          }
          summaryBody.push(row);
        }
        doc.autoTable({
          startY: y,
          head: [['Metric', 'Value', 'Metric', 'Value']],
          body: summaryBody,
          theme: 'grid',
          headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 25 }, 2: { fontStyle: 'bold', cellWidth: 40 }, 3: { cellWidth: 25 } },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;

        // Detail sections
        var sections = [
          ['New Signups (' + d.signups.length + ')', d.signups],
          ['Workouts (' + d.workouts.length + ')', d.workouts],
          ['Active Users (' + d.activeUsers.length + ')', d.activeUsers],
          ['Custom Exercises (' + d.exercises.length + ')', d.exercises],
          ['Feedback (' + d.feedback.length + ')', d.feedback],
          ['Errors (' + d.errors.length + ')', d.errors],
        ];

        sections.forEach(function(sec) {
          if (!sec[1] || sec[1].length === 0) return;
          if (y > 260) { doc.addPage(); y = 16; }
          doc.setFontSize(12);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0);
          doc.text(sec[0], 14, y);
          y += 2;
          var heads = Object.keys(sec[1][0]);
          var body = sec[1].map(function(row) { return heads.map(function(h) { return String(row[h]); }); });
          doc.autoTable({
            startY: y,
            head: [heads],
            body: body,
            theme: 'striped',
            headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            margin: { left: 14, right: 14 },
          });
          y = doc.lastAutoTable.finalY + 10;
        });

        // Footer
        var pages = doc.internal.getNumberOfPages();
        for (var p = 1; p <= pages; p++) {
          doc.setPage(p);
          doc.setFontSize(8);
          doc.setTextColor(160);
          doc.text('RepLab Admin — Generated ' + new Date().toLocaleString(), 14, doc.internal.pageSize.getHeight() - 8);
          doc.text('Page ' + p + ' of ' + pages, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        }

        var filename = 'RepLab_Summary_' + document.getElementById('startDate').value + '.pdf';
        doc.save(filename);
      } catch (err) {
        alert('PDF export failed: ' + err.message);
      }
    }
    </script>
    `));
  } catch (err) {
    res.status(500).send(adminPage('Daily Summary', `
      <div class="breadcrumb"><a href="/admin">← Dashboard</a></div>
      <div class="glass" style="padding:20px;border-left:3px solid #ef4444;">
        <p style="color:#ef4444;">Failed to load daily summary: ${err.message}</p>
      </div>
    `));
  }
});

// POST /admin/test-daily-summary — send the daily summary email now
router.post('/test-daily-summary', adminAuth, async (req, res) => {
  try {
    const stats = await db.getDailyStats();
    await sendDailySummaryEmail(stats);
    res.json({ ok: true, message: 'Daily summary email sent' });
  } catch (err) {
    console.error('Test daily summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Trainer Application Management ───

// List trainer applications
router.get('/trainer-applications', adminAuth, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const { rows } = await pool.query(
      `SELECT ta.id, ta.user_id, ta.message, ta.status, ta.created_at, ta.reviewed_at,
              u.email, u.phone, u.first_name, u.last_name, u.username, u.plan, u.role
       FROM trainer_applications ta
       JOIN users u ON ta.user_id = u.id
       WHERE ta.status = $1
       ORDER BY ta.created_at DESC`,
      [status]
    );
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ applications: rows });
    }
    // HTML response for admin dashboard
    const appRows = rows.map(a => `
      <tr>
        <td>${a.first_name || ''} ${a.last_name || ''}</td>
        <td>${a.email || a.phone}</td>
        <td>${a.username || '—'}</td>
        <td>${a.plan}</td>
        <td>${a.message || '—'}</td>
        <td>${new Date(a.created_at).toLocaleDateString()}</td>
        <td>
          ${a.status === 'pending' ? `
            <form method="POST" action="/admin/trainer-applications/${a.id}/approve" style="display:inline">
              <button type="submit" class="btn btn-sm" style="background:#22c55e;color:#fff;padding:4px 12px;border-radius:6px;border:none;cursor:pointer">Approve</button>
            </form>
            <form method="POST" action="/admin/trainer-applications/${a.id}/deny" style="display:inline;margin-left:4px">
              <button type="submit" class="btn btn-sm" style="background:#ef4444;color:#fff;padding:4px 12px;border-radius:6px;border:none;cursor:pointer">Deny</button>
            </form>
          ` : a.status}
        </td>
      </tr>
    `).join('');
    res.send(`<!DOCTYPE html><html><head><title>Trainer Applications</title>
      <style>body{font-family:system-ui;background:#0a0a0a;color:#fff;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1)}th{color:#888;font-size:12px;text-transform:uppercase}a{color:#ef4444;text-decoration:none}.tabs{display:flex;gap:8px;margin-bottom:16px}.tab{padding:6px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);color:#999;text-decoration:none;font-size:13px}.tab.active{background:rgba(239,68,68,0.1);color:#ef4444;border-color:rgba(239,68,68,0.3)}</style>
    </head><body>
      <p><a href="/admin">&larr; Back to Admin</a></p>
      <h2>Trainer Applications</h2>
      <div class="tabs">
        <a class="tab ${status === 'pending' ? 'active' : ''}" href="?status=pending">Pending</a>
        <a class="tab ${status === 'approved' ? 'active' : ''}" href="?status=approved">Approved</a>
        <a class="tab ${status === 'denied' ? 'active' : ''}" href="?status=denied">Denied</a>
      </div>
      <table><thead><tr><th>Name</th><th>Email/Phone</th><th>Username</th><th>Plan</th><th>Message</th><th>Applied</th><th>Action</th></tr></thead>
      <tbody>${appRows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#666">No applications</td></tr>'}</tbody></table>
    </body></html>`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve trainer application
router.post('/trainer-applications/:id/approve', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT user_id FROM trainer_applications WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });

    const userId = rows[0].user_id;
    await pool.query("UPDATE trainer_applications SET status = 'approved', reviewed_at = NOW() WHERE id = $1", [id]);
    await pool.query("UPDATE users SET role = 'trainer' WHERE id = $1", [userId]);

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ message: 'Application approved' });
    }
    res.redirect('/admin/trainers');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deny trainer application
router.post('/trainer-applications/:id/deny', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE trainer_applications SET status = 'denied', reviewed_at = NOW() WHERE id = $1", [id]);

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ message: 'Application denied' });
    }
    res.redirect('/admin/trainers');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke trainer role (set back to client)
router.post('/users/:id/revoke-trainer', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE users SET role = 'client' WHERE id = $1", [id]);
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ message: 'Trainer role revoked' });
    }
    res.redirect('/admin/trainer-applications?status=approved');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /admin/exercise-library — View all exercises and video mappings
router.get('/exercise-library', adminAuth, async (req, res) => {
  try {
    // Query all global (non-custom) exercises including video_id
    const { rows } = await pool.query(
      'SELECT id, name, muscle_group, is_custom, tags, video_id FROM exercises ORDER BY name ASC'
    );

    const exercises = rows.map(e => ({
      id: e.id,
      name: e.name,
      muscle: e.muscle_group,
      isCustom: e.is_custom,
      tags: e.tags || [],
      video_id: e.video_id || '',
    }));

    const totalExercises = exercises.length;
    const mappedCount = exercises.filter(e => e.video_id).length;
    const unmappedCount = totalExercises - mappedCount;

    const exerciseRows = exercises.map(e => {
      const videoId = e.video_id;
      return `
        <div class="ex-row" data-exercise-row data-name="${e.name.toLowerCase()}" data-muscle="${(e.muscle || '').toLowerCase()}" data-has-video="${videoId ? 'yes' : 'no'}">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:#fff;font-size:14px;">${e.name}${e.isCustom ? ' <span style="font-size:10px;color:rgba(168,85,247,0.8);font-weight:700;vertical-align:middle;">CUSTOM</span>' : ''}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">${e.muscle || 'Unknown'}</div>
          </div>
          <div class="video-status" style="flex-shrink:0;margin-right:12px;">
            ${videoId
              ? `<span style="color:#22c55e;font-weight:600;">&#10003; Mapped</span>`
              : `<span style="color:#ef4444;font-weight:600;">No video</span>`
            }
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <input
              type="text"
              id="video-${e.id}"
              value="${videoId}"
              placeholder="YouTube video ID"
              style="width:180px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:12px;font-family:monospace;"
            />
            <button
              onclick="saveVideo(${e.id})"
              style="padding:6px 12px;border-radius:8px;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#22c55e;font-size:11px;font-weight:600;cursor:pointer;"
            >
              Save
            </button>
            ${videoId
              ? `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" class="video-link" data-video-id="${videoId}" style="color:#22c55e;font-size:12px;font-weight:600;text-decoration:none;cursor:pointer;">&#9654;</a>`
              : ''
            }
          </div>
        </div>`;
    }).join('');

    res.send(adminPage('Exercise Library', `
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.5px;">Exercise Library</h1>
      <p style="color:rgba(255,255,255,0.4);margin-top:4px;font-size:14px;">All exercises and their video mappings</p>

      <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap;">
        <div class="glass" style="padding:16px 20px;border-radius:12px;flex:1;min-width:140px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:600;">Total Exercises</div>
          <div style="font-size:28px;font-weight:800;margin-top:4px;">${totalExercises}</div>
        </div>
        <div class="glass" style="padding:16px 20px;border-radius:12px;flex:1;min-width:140px;border-color:rgba(34,197,94,0.2);">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:600;">Mapped Videos</div>
          <div style="font-size:28px;font-weight:800;margin-top:4px;color:#22c55e;">${mappedCount}</div>
        </div>
        <div class="glass" style="padding:16px 20px;border-radius:12px;flex:1;min-width:140px;border-color:rgba(239,68,68,0.2);">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.4);font-weight:600;">Unmapped</div>
          <div style="font-size:28px;font-weight:800;margin-top:4px;color:#ef4444;">${unmappedCount}</div>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-top:24px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="ex-search" placeholder="Search exercises..." style="flex:1;min-width:200px;padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;" />
        <select id="ex-muscle-filter" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;outline:none;">
          <option value="">All Muscles</option>
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:rgba(255,255,255,0.5);cursor:pointer;white-space:nowrap;">
          <input type="checkbox" id="ex-unmapped-only" style="accent-color:#ef4444;" />
          Unmapped only
        </label>
      </div>

      <div style="margin-top:8px;font-size:12px;color:rgba(255,255,255,0.3);" id="ex-count"></div>

      <div class="glass" style="margin-top:16px;border-radius:14px;overflow:hidden;max-height:70vh;overflow-y:auto;">
        <div id="ex-list">
          ${exerciseRows}
        </div>
      </div>

      <div id="video-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);" onclick="if(event.target===this){this.style.display='none';this.querySelector('iframe').src='';}">
        <div style="width:90%;max-width:640px;aspect-ratio:16/9;border-radius:12px;overflow:hidden;">
          <iframe id="video-iframe" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay"></iframe>
        </div>
      </div>

      <style>
        .ex-row {
          display:flex;align-items:center;gap:16px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;
        }
        .ex-row:hover { background:rgba(255,255,255,0.03); }
        .ex-row:last-child { border-bottom:none; }
        .ex-row.hidden { display:none; }
        .video-link:hover { text-decoration:underline !important; }
        #ex-search:focus { border-color:rgba(168,85,247,0.5); box-shadow:0 0 0 2px rgba(168,85,247,0.15); }
        #ex-muscle-filter option { background:#111; color:#fff; }
      </style>

      <script>
        async function saveVideo(exerciseId) {
          const input = document.getElementById('video-' + exerciseId);
          let videoId = input.value.trim();
          // Extract video ID from full YouTube URLs
          if (videoId.includes('youtube.com/watch')) {
            try {
              const url = new URL(videoId);
              videoId = url.searchParams.get('v') || videoId;
            } catch(e) {}
          } else if (videoId.includes('youtu.be/')) {
            videoId = videoId.split('youtu.be/')[1]?.split(/[?&]/)[0] || videoId;
          }
          input.value = videoId;

          try {
            const resp = await fetch('/admin/exercise-library/video/' + exerciseId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoId })
            });
            if (resp.ok) {
              // Update the status indicator
              const row = input.closest('[data-exercise-row]');
              const status = row?.querySelector('.video-status');
              if (status) {
                if (videoId) {
                  status.innerHTML = '<span style="color:#22c55e;font-weight:600;">&#10003; Mapped</span>';
                  row.dataset.hasVideo = 'yes';
                } else {
                  status.innerHTML = '<span style="color:#ef4444;font-weight:600;">No video</span>';
                  row.dataset.hasVideo = 'no';
                }
              }
              // Flash green briefly
              input.style.borderColor = '#22c55e';
              setTimeout(function() { input.style.borderColor = 'rgba(255,255,255,0.1)'; }, 1500);
            }
          } catch (err) {
            alert('Failed to save: ' + err.message);
          }
        }

        (function() {
          const rows = document.querySelectorAll('.ex-row');
          const searchInput = document.getElementById('ex-search');
          const muscleFilter = document.getElementById('ex-muscle-filter');
          const unmappedOnly = document.getElementById('ex-unmapped-only');
          const countEl = document.getElementById('ex-count');

          // Populate muscle filter
          const muscles = new Set();
          rows.forEach(r => { const m = r.dataset.muscle; if (m) muscles.add(m); });
          [...muscles].sort().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m.charAt(0).toUpperCase() + m.slice(1);
            muscleFilter.appendChild(opt);
          });

          function applyFilter() {
            const q = searchInput.value.toLowerCase().trim();
            const muscle = muscleFilter.value;
            const unmapped = unmappedOnly.checked;
            let shown = 0;
            rows.forEach(r => {
              const matchName = !q || r.dataset.name.includes(q);
              const matchMuscle = !muscle || r.dataset.muscle === muscle;
              const matchVideo = !unmapped || r.dataset.hasVideo === 'no';
              const visible = matchName && matchMuscle && matchVideo;
              r.classList.toggle('hidden', !visible);
              if (visible) shown++;
            });
            countEl.textContent = 'Showing ' + shown + ' of ' + rows.length + ' exercises';
          }

          searchInput.addEventListener('input', applyFilter);
          muscleFilter.addEventListener('change', applyFilter);
          unmappedOnly.addEventListener('change', applyFilter);
          applyFilter();

          // Video modal
          document.querySelectorAll('.video-link').forEach(link => {
            link.addEventListener('click', function(e) {
              e.preventDefault();
              const vid = this.dataset.videoId;
              const modal = document.getElementById('video-modal');
              document.getElementById('video-iframe').src = 'https://www.youtube.com/embed/' + vid + '?autoplay=1';
              modal.style.display = 'flex';
            });
          });
        })();
      </script>
    `));
  } catch (err) {
    console.error('Exercise library error:', err);
    res.status(500).send(adminPage('Exercise Library', `
      <h1 style="font-size:28px;font-weight:800;">Exercise Library</h1>
      <div class="glass" style="margin-top:24px;padding:20px;border-left:3px solid #ef4444;">
        <p style="color:#f87171;">Error loading exercises: ${err.message}</p>
      </div>
    `));
  }
});

// PUT /admin/exercise-library/video/:id — Update video_id for an exercise
router.put('/exercise-library/video/:id', adminAuth, express.json(), async (req, res) => {
  try {
    const { videoId } = req.body;
    await pool.query('UPDATE exercises SET video_id = $1 WHERE id = $2', [videoId || null, Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update video_id error:', err);
    res.status(500).json({ error: 'Failed to update video ID' });
  }
});

export default router;
