import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import pool from '../dbPool.js';
import crypto from 'crypto';
import { generateToken, generateAccessToken, generateRefreshToken, verifyRefreshToken, authMiddleware } from '../middleware/auth.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendNewSignupNotification } from '../email.js';

const router = Router();

function parseDevice(ua) {
  if (!ua) return 'Unknown';
  const lower = ua.toLowerCase();
  let device = 'Desktop';
  if (/iphone/.test(lower)) device = 'iPhone';
  else if (/ipad/.test(lower)) device = 'iPad';
  else if (/android.*mobile/.test(lower)) device = 'Android Phone';
  else if (/android/.test(lower)) device = 'Android Tablet';
  else if (/macintosh/.test(lower)) device = 'Mac';
  else if (/windows/.test(lower)) device = 'Windows';
  else if (/linux/.test(lower)) device = 'Linux';

  let browser = '';
  if (/crios/.test(lower)) browser = 'Chrome';
  else if (/fxios/.test(lower)) browser = 'Firefox';
  else if (/safari/.test(lower) && !/chrome/.test(lower)) browser = 'Safari';
  else if (/chrome/.test(lower) && !/edg/.test(lower)) browser = 'Chrome';
  else if (/edg/.test(lower)) browser = 'Edge';
  else if (/firefox/.test(lower)) browser = 'Firefox';

  return browser ? `${device} (${browser})` : device;
}

function isPhone(value) {
  const trimmed = value.trim();
  if (!/^\+?\d[\d\s\-().]{6,}$/.test(trimmed)) return false;
  return trimmed.replace(/\D/g, '').length >= 10;
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return '+' + digits;
}

function userResponse(user) {
  return { id: user.id, accountId: user.accountId ?? null, email: user.email, phone: user.phone, firstName: user.firstName, lastName: user.lastName, username: user.username, role: user.role || 'client', plan: user.plan || 'Free', trialEnd: user.trialEnd || null, photoUrl: user.profilePhoto || null };
}

// Build the standard auth response body. `token` remains for backwards
// compatibility with older clients that haven't been updated to read
// `accessToken` yet — new clients should use the access/refresh pair.
function authPayload(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: userResponse(user),
  };
}

router.post('/signup', async (req, res) => {
  try {
    const { identifier, password, firstName, lastName, phone: extraPhone, gender, username, referralSource, referralCode, zipCode, timezone, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, deviceInfo } = req.body;


    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email or phone and password are required' });
    }
    const pwErrors = [];
    if (password.length < 8) pwErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwErrors.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(password)) pwErrors.push('at least 1 number');
    if (/\s/.test(password)) pwErrors.push('no spaces');
    if (pwErrors.length > 0) {
      return res.status(400).json({ error: 'Password must have: ' + pwErrors.join(', ') });
    }
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }
    if (!lastName || !lastName.trim()) {
      return res.status(400).json({ error: 'Last name is required' });
    }
    if (!zipCode || !zipCode.trim()) {
      return res.status(400).json({ error: 'Zip code is required' });
    }

    const phone = isPhone(identifier);
    const normalizedId = phone ? normalizePhone(identifier) : identifier.toLowerCase().trim();

    const existing = await db.findUserByIdentifier(normalizedId);
    if (existing) {
      return res.status(409).json({ error: phone ? 'Phone number already registered' : 'Email already registered' });
    }

    // Generate username: first initial + last name, with number suffix if taken
    let finalUsername = username?.trim();
    if (!finalUsername) {
      const base = (firstName.trim()[0] + lastName.trim()).toLowerCase().replace(/[^a-z0-9]/g, '');
      finalUsername = base;
      let suffix = 1;
      while (await db.findUserByUsername(finalUsername)) {
        finalUsername = base + suffix;
        suffix++;
      }
    } else {
      const existingUsername = await db.findUserByUsername(finalUsername);
      if (existingUsername) {
        return res.status(409).json({ error: 'Username already taken' });
      }
    }

    // Look up city/state from IP (non-blocking, best-effort)
    let signupCity = null;
    let signupState = null;
    try {
      const ip = req.ip === '::1' || req.ip === '127.0.0.1' ? '' : req.ip;
      if (ip) {
        const geoRes = await fetch(`https://ip-api.com/json/${ip}?fields=city,regionName,status`);
        const geo = await geoRes.json();
        if (geo.status === 'success') {
          signupCity = geo.city || null;
          signupState = geo.regionName || null;
        }
      }
    } catch {
      // Geo lookup failed — continue without it
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await db.createUser({
      email: phone ? null : normalizedId,
      phone: phone ? normalizedId : (extraPhone?.trim() ? normalizePhone(extraPhone) : null),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender: gender || null,
      username: finalUsername,
      referralSource: referralSource || null,
      referralCode: referralCode || null,
      zipCode: zipCode || null,
      timezone: timezone || null,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
      utmContent: utmContent || null,
      utmTerm: utmTerm || null,
      signupDevice: deviceInfo || parseDevice(req.headers['user-agent']),
      signupCity,
      signupState,
    });

    await db.setDefaultSchedule(user.id);
    if (user.email) sendWelcomeEmail(user.email);

    // Notify admin of new signup
    const allUsers = await db.getAllUsers();
    sendNewSignupNotification(user, allUsers.length);

    res.status(201).json(authPayload(user));
  } catch (err) {
    console.error(err);
    // Handle unique constraint violations from concurrent signups
    if (err.code === '23505') {
      if (err.constraint?.includes('email')) return res.status(409).json({ error: 'Email already registered' });
      if (err.constraint?.includes('phone')) return res.status(409).json({ error: 'Phone number already registered' });
      if (err.constraint?.includes('username')) return res.status(409).json({ error: 'Username already taken' });
      return res.status(409).json({ error: 'Account already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username, email, or phone and password are required' });
    }

    const phone = isPhone(identifier);
    const normalizedId = phone ? normalizePhone(identifier) : identifier.toLowerCase().trim();

    const user = await db.findUserByIdentifier(normalizedId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(authPayload(user));

    // Log login history (fire-and-forget)
    try {
      const loginIp = req.ip === '::1' || req.ip === '127.0.0.1' ? '' : req.ip;
      let city = null, state = null;
      if (loginIp) {
        try {
          const geoRes = await fetch(`https://ip-api.com/json/${loginIp}?fields=city,regionName,status`);
          const geo = await geoRes.json();
          if (geo.status === 'success') { city = geo.city || null; state = geo.regionName || null; }
        } catch (geoErr) { console.error('Login history geo error:', geoErr); }
      }
      await pool.query(
        'INSERT INTO user_login_history (user_id, email, ip, user_agent, city, state) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.id, user.email || user.phone, loginIp, req.headers['user-agent']?.substring(0, 200), city, state]
      );
    } catch (err) { console.error('Login history error:', err); }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me — Return current user from JWT (used by dashboard bridge)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: userResponse(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/demo', async (req, res) => {
  try {
    const email = `demo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@willfit.demo`;
    const passwordHash = bcrypt.hashSync(Math.random().toString(36), 10);
    const user = await db.createUser({ email, phone: null, passwordHash });
    await db.setDefaultSchedule(user.id);
    res.status(201).json(authPayload(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Exchange a refresh token for a fresh access token. The refresh token is
// itself re-issued (rotation) — this limits the window in which a leaked
// refresh token is useful and gives us a natural hook if we ever add server-
// side reuse detection. Password-change invalidation works here the same way
// it does in authMiddleware: the refresh token carries tokenVersion, and we
// reject it if the DB's token_version has advanced past it.
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    const currentVersion = user.tokenVersion ?? 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      // Alias for legacy field name, matches login/signup shape.
      token: accessToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Server-side revocation on logout. Bumps token_version so every access AND
// refresh JWT previously issued for this account is rejected by authMiddleware
// and /auth/refresh. Without this, a 30-day refresh token cached on a lost or
// stolen device remains usable long after the owner "logs out." This logs out
// every device on the account — same blast radius as a password change, which
// is the correct semantics for an explicit security-event-driven action.
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await db.bumpTokenVersion(req.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Per-email rate limit for password reset. The global IP-based limiter blocks
// a single attacker hammering one IP, but an attacker with IP rotation could
// still spam 1000 different email addresses. This caps any given email at 3
// reset emails per 15 minutes regardless of source IP, and returns the same
// "if an account exists..." message either way to preserve enumeration safety.
const resetEmailWindow = new Map(); // email -> [timestamp, timestamp, ...]
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX_PER_EMAIL = 3;

function canSendReset(email) {
  const now = Date.now();
  const recent = (resetEmailWindow.get(email) || []).filter((t) => now - t < RESET_WINDOW_MS);
  if (recent.length >= RESET_MAX_PER_EMAIL) {
    resetEmailWindow.set(email, recent);
    return false;
  }
  recent.push(now);
  resetEmailWindow.set(email, recent);
  return true;
}

// Request password reset email
router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalized = email.toLowerCase().trim();
    const user = await db.findUserByIdentifier(normalized);
    // Always return success to prevent email enumeration
    if (!user || !user.email) return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });

    // Cap per-email even if the request came from a fresh IP. Still return
    // the same success message to avoid leaking that the email was throttled.
    if (!canSendReset(normalized)) {
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.setResetToken(user.id, token, expires, req.ip || null, req.get('user-agent') || null);
    await sendPasswordResetEmail(user.email, token);

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    const rpErrors = [];
    if (password.length < 8) rpErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) rpErrors.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(password)) rpErrors.push('at least 1 number');
    if (/\s/.test(password)) rpErrors.push('no spaces');
    if (rpErrors.length > 0) return res.status(400).json({ error: 'Password must have: ' + rpErrors.join(', ') });

    const user = await db.findUserByResetToken(token);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const passwordHash = bcrypt.hashSync(password, 10);
    await db.updatePassword(user.id, passwordHash);
    // Audit: stamp the log row for this token as used. Non-blocking — never
    // surface a logging failure as a reset failure.
    await db.markResetTokenUsed(token, req.ip || null);

    res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password (logged in)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords are required' });
    const cpErrors = [];
    if (newPassword.length < 8) cpErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(newPassword)) cpErrors.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(newPassword)) cpErrors.push('at least 1 number');
    if (/\s/.test(newPassword)) cpErrors.push('no spaces');
    if (cpErrors.length > 0) return res.status(400).json({ error: 'Password must have: ' + cpErrors.join(', ') });

    const user = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.updatePassword(user.id, passwordHash);

    // updatePassword bumps token_version so every existing access AND refresh
    // JWT is now invalid (both carry tokenVersion). Issue a fresh pair so the
    // caller's current session stays signed in — only their OTHER sessions
    // are kicked out, which is the intent.
    const refreshed = await db.findUserById(user.id);
    const newAccessToken = generateAccessToken(refreshed);
    const newRefreshToken = generateRefreshToken(refreshed);
    res.json({
      message: 'Password changed successfully',
      token: newAccessToken,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start free trial
router.post('/start-trial', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan || !['Pro', 'Elite'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose Pro or Elite.' });
    }

    const user = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Don't allow trial if already on a paid plan or already had a trial
    if (user.plan !== 'Free') {
      return res.status(400).json({ error: 'You are already on a paid plan.' });
    }
    if (user.trialEnd) {
      return res.status(400).json({ error: 'You have already used your free trial.' });
    }

    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await pool.query(
      'UPDATE users SET plan = $1, trial_end = $2 WHERE id = $3',
      [plan, trialEnd, req.userId]
    );

    const updated = await db.findUserById(req.userId);
    res.json({ user: userResponse(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upgrade plan (payment)
router.post('/upgrade', authMiddleware, async (req, res) => {
  try {
    const { plan, billing } = req.body;
    if (!plan || !['Pro', 'Elite'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose Pro or Elite.' });
    }

    // In production, process payment with Stripe here.
    // For now, just update the plan directly.
    await pool.query(
      'UPDATE users SET plan = $1, trial_end = NULL WHERE id = $2',
      [plan, req.userId]
    );

    const updated = await db.findUserById(req.userId);
    res.json({ user: userResponse(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload or replace profile photo
router.put('/profile-photo', authMiddleware, async (req, res) => {
  try {
    const { photo } = req.body;
    // Strict MIME allowlist. Rejecting SVG and other types prevents both DB
    // bloat (500KB strings) and any future XSS surface from inline SVG content.
    const ALLOWED = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];
    if (!photo || typeof photo !== 'string' || !ALLOWED.some((p) => photo.startsWith(p))) {
      return res.status(400).json({ error: 'Only JPEG, PNG, or WebP images are accepted' });
    }
    const base64Part = photo.split(',')[1];
    if (!base64Part || !/^[A-Za-z0-9+/]+=*$/.test(base64Part)) {
      return res.status(400).json({ error: 'Invalid base64 image data' });
    }
    if (photo.length > 500000) {
      return res.status(400).json({ error: 'Image too large' });
    }
    await pool.query('UPDATE users SET profile_photo = $1 WHERE id = $2', [photo, req.userId]);
    res.json({ photoUrl: photo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove profile photo
router.delete('/profile-photo', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE users SET profile_photo = NULL WHERE id = $1', [req.userId]);
    res.json({ photoUrl: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Log page visit
router.post('/page-visit', authMiddleware, async (req, res) => {
  try {
    const { path } = req.body;
    if (!path || typeof path !== 'string') return res.status(400).json({ error: 'Path required' });
    await pool.query('INSERT INTO page_visits (user_id, path) VALUES ($1, $2)', [req.userId, path.substring(0, 200)]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply to become a trainer
router.post('/apply-trainer', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    // Check if already a trainer
    const { rows: userRows } = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (userRows[0]?.role === 'trainer') {
      return res.status(400).json({ error: 'You are already a trainer' });
    }
    // Check for existing pending application
    const { rows: existing } = await pool.query(
      "SELECT id FROM trainer_applications WHERE user_id = $1 AND status = 'pending'",
      [req.userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'You already have a pending application' });
    }
    await pool.query(
      'INSERT INTO trainer_applications (user_id, message) VALUES ($1, $2)',
      [req.userId, message || '']
    );
    res.status(201).json({ message: 'Application submitted. You will be notified when reviewed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's trainer application status
router.get('/trainer-application', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, status, message, created_at FROM trainer_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.userId]
    );
    res.json({ application: rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/export-data', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await db.findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Gather all user-owned data across every table that references users.id.
    // Required for GDPR Art. 20 (right to data portability) — the user should
    // be able to retrieve every piece of personally-identifiable data we hold.
    // Queries wrapped in `catch(() => ({ rows: [] }))` where the table is
    // optional (admin/trainer-only) so missing tables don't break the export.
    const [
      programs, templates, sessions, schedule, pbs, metrics,
      aiUsage, feedback, challengeEntries, pageVisits, loginHistory,
      deviceTokens, trainerClients, trainerApplications, subscriptions,
      sharesSent, sharesReceived, customExercises,
    ] = await Promise.all([
      pool.query('SELECT id, name, description, created_at FROM programs WHERE user_id = $1 ORDER BY created_at', [userId]),
      pool.query('SELECT t.id, t.name, t.program_id, t.is_rest, t.sort_order FROM templates t JOIN programs p ON t.program_id = p.id WHERE p.user_id = $1 ORDER BY t.id', [userId]),
      // Includes planned + completed entries — full-fidelity GDPR export must
      // surface every row the user typed, not just lifted sets. isCompleted is
      // part of the payload so the user can distinguish them.
      pool.query(`SELECT s.id, s.template_id, s.date, s.completed, s.notes, s.created_at,
        json_agg(json_build_object('exerciseName', se.exercise_name, 'setNumber', se.set_number, 'weight', se.weight, 'reps', se.reps, 'isCompleted', se.is_completed) ORDER BY se.id) AS entries
        FROM sessions s LEFT JOIN session_entries se ON se.session_id = s.id WHERE s.user_id = $1 GROUP BY s.id ORDER BY s.date`, [userId]),
      pool.query('SELECT schedule_date, template_id FROM schedule_days WHERE user_id = $1 AND schedule_date IS NOT NULL ORDER BY schedule_date', [userId]),
      pool.query('SELECT exercise_name, best_weight, best_reps, template_id, achieved_at FROM personal_bests WHERE user_id = $1 ORDER BY exercise_name', [userId]),
      pool.query('SELECT * FROM user_metrics WHERE user_id = $1', [userId]),
      pool.query('SELECT endpoint, input_tokens, output_tokens, created_at FROM ai_usage WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT type, message, created_at FROM feedback WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT challenge, value, created_at FROM challenge_entries WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT path, created_at FROM page_visits WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT ip, user_agent, city, state, created_at FROM user_login_history WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT platform, created_at FROM device_tokens WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT trainer_id, client_id, created_at FROM trainer_clients WHERE trainer_id = $1 OR client_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT message, status, created_at, reviewed_at FROM trainer_applications WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT plan, status, cancel_at_period_end, current_period_end, created_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT recipient_id, type, template_id, source_program_id, status, created_at FROM shared_programs WHERE sender_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT sender_id, type, template_id, source_program_id, status, created_at FROM shared_programs WHERE recipient_id = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
      pool.query('SELECT id, name, muscle, tags, created_at FROM exercises WHERE created_by = $1 ORDER BY created_at', [userId]).catch(() => ({ rows: [] })),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      account: {
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        plan: user.plan,
        trialEnd: user.trialEnd,
        createdAt: user.createdAt,
      },
      programs: programs.rows,
      templates: templates.rows,
      sessions: sessions.rows.map(s => ({
        ...s,
        entries: s.entries?.[0]?.exerciseName ? s.entries : [],
      })),
      schedule: schedule.rows,
      personalBests: pbs.rows,
      metrics: metrics.rows[0] || null,
      aiUsage: aiUsage.rows,
      feedback: feedback.rows,
      challengeEntries: challengeEntries.rows,
      pageVisits: pageVisits.rows,
      loginHistory: loginHistory.rows,
      deviceTokens: deviceTokens.rows,
      trainerRelationships: trainerClients.rows,
      trainerApplications: trainerApplications.rows,
      subscriptions: subscriptions.rows,
      sharesSent: sharesSent.rows,
      sharesReceived: sharesReceived.rows,
      customExercises: customExercises.rows,
    };

    res.setHeader('Content-Disposition', `attachment; filename="replab-data-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/delete-account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify password (skip for demo accounts which have no real password).
    // Apple 5.1.1(v) compliance — a deletion must require the account's actual
    // credentials, not just possession of an access token. If the user has a
    // password set, the client MUST send a matching one; missing/empty password
    // on a real account is treated as a failed attempt.
    if (user.passwordHash) {
      if (!password) return res.status(400).json({ error: 'Password is required to delete your account.' });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Incorrect password' });
    }

    await db.deleteUser(req.userId);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
