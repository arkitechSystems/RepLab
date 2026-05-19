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

// Short-lived access token. Kept short so a leaked token has a tight blast
// radius; the refresh token extends the effective session to 30 days.
export const ACCESS_TOKEN_TTL = '15m';
// Long-lived refresh token. Used only against /auth/refresh, never as an
// access token (the `type` claim is checked there).
export const REFRESH_TOKEN_TTL = '30d';

export function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role || 'client',
      tokenVersion: user.tokenVersion ?? 0,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      tokenVersion: user.tokenVersion ?? 0,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
}

// Backwards-compatible alias. Existing callers (e.g. admin password reset,
// change-password route) continue to work — they now receive an access token.
export function generateToken(user) {
  return generateAccessToken(user);
}

export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  // A refresh token must never be usable as an access token and vice versa.
  // Without this check an attacker who stole an access token could POST it to
  // /auth/refresh and get a new 15-min access token indefinitely.
  if (decoded.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }
  return decoded;
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    if (process.env.DEBUG_AUTH === '1') console.warn('[auth] 401 no-bearer', req.method, req.originalUrl);
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Reject refresh tokens presented as access tokens. Pre-existing tokens
    // (issued before this change) have no `type` claim — treat those as
    // access tokens for backwards compatibility during rollout.
    if (decoded.type && decoded.type !== 'access') {
      if (process.env.DEBUG_AUTH === '1') console.warn('[auth] 401 wrong-type', { type: decoded.type, userId: decoded.userId, url: req.originalUrl });
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify user still exists AND that this JWT hasn't been invalidated by a
    // password change. token_version is bumped in db.updatePassword so every
    // JWT issued before the reset has a stale version and is rejected here.
    const { rows } = await pool.query('SELECT id, token_version FROM users WHERE id = $1', [decoded.userId]);
    if (rows.length === 0) {
      if (process.env.DEBUG_AUTH === '1') console.warn('[auth] 401 user-not-found', { userId: decoded.userId, url: req.originalUrl });
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    const currentVersion = rows[0].token_version ?? 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== currentVersion) {
      if (process.env.DEBUG_AUTH === '1') console.warn('[auth] 401 version-mismatch', { userId: decoded.userId, jwtV: tokenVersion, dbV: currentVersion, url: req.originalUrl });
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role || 'client';
    next();
  } catch (err) {
    if (process.env.DEBUG_AUTH === '1') console.warn('[auth] 401 verify-failed', err.name, err.message, 'url=', req.originalUrl, 'hdr-len=', (header || '').length);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
