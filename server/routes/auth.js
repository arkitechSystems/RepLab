import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { generateToken } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../email.js';

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
    const { identifier, password, firstName, lastName, phone: extraPhone, gender, username, referralSource, referralCode } = req.body;

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
    });

    await db.setDefaultSchedule(user.id);
    if (user.email) sendWelcomeEmail(user.email);

    const token = generateToken(user);
    res.status(201).json({ token, user: userResponse(user) });
  } catch (err) {
    console.error(err);
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
    const email = `demo_${Date.now()}@willfit.demo`;
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

export default router;
