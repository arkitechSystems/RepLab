import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import crypto from 'crypto';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendNewSignupNotification } from '../email.js';

const router = Router();

function isPhone(value) {
  return /^\+?\d[\d\s\-().]{6,}$/.test(value.trim());
}

function normalizePhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return '+' + digits;
}

function userResponse(user) {
  return { id: user.id, email: user.email, phone: user.phone, firstName: user.firstName, lastName: user.lastName, username: user.username };
}

router.post('/signup', async (req, res) => {
  try {
    const { identifier, password, firstName, lastName, phone: extraPhone, gender, username, referralSource, referralCode, zipCode } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email or phone and password are required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }
    if (!lastName || !lastName.trim()) {
      return res.status(400).json({ error: 'Last name is required' });
    }

    const phone = isPhone(identifier);
    const normalizedId = phone ? normalizePhone(identifier) : identifier.toLowerCase().trim();

    const existing = await db.findUserByIdentifier(normalizedId);
    if (existing) {
      return res.status(409).json({ error: phone ? 'Phone number already registered' : 'Email already registered' });
    }

    // Check username uniqueness if provided
    const finalUsername = username?.trim() || `user${Date.now().toString(36)}`;
    if (username?.trim()) {
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
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,status`);
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
      signupCity,
      signupState,
    });

    await db.setDefaultSchedule(user.id);
    if (user.email) sendWelcomeEmail(user.email);

    // Notify admin of new signup
    const allUsers = await db.getAllUsers();
    sendNewSignupNotification(user, allUsers.length);

    const token = generateToken(user);
    res.status(201).json({ token, user: userResponse(user) });
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
      return res.status(400).json({ error: 'Email or phone and password are required' });
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

    const token = generateToken(user);
    res.json({ token, user: userResponse(user) });
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
    const token = generateToken(user);
    res.status(201).json({ token, user: userResponse(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset email
router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await db.findUserByIdentifier(email.toLowerCase().trim());
    // Always return success to prevent email enumeration
    if (!user || !user.email) return res.json({ message: 'If an account exists with that email, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.setResetToken(user.id, token, expires);
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
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

    const user = await db.findUserByResetToken(token);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const passwordHash = bcrypt.hashSync(password, 10);
    await db.updatePassword(user.id, passwordHash);

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
    if (newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });

    const user = await db.findUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.updatePassword(user.id, passwordHash);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
