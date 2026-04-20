import jwt from 'jsonwebtoken';
import pool from '../dbPool.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error(
    `JWT_SECRET must be at least 32 characters (got ${process.env.JWT_SECRET.length}). ` +
    `Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
  );
}
const JWT_SECRET = process.env.JWT_SECRET;

export function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role || 'client',
      tokenVersion: user.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists AND that this JWT hasn't been invalidated by a
    // password change. token_version is bumped in db.updatePassword so every
    // JWT issued before the reset has a stale version and is rejected here.
    const { rows } = await pool.query('SELECT id, token_version FROM users WHERE id = $1', [decoded.userId]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    const currentVersion = rows[0].token_version ?? 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role || 'client';
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
