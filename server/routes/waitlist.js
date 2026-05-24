import { Router } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../dbPool.js';
import { sendWaitlistThankYouEmail } from '../email.js';

const router = Router();
// .trim() defends against env-var paste accidents (trailing newline / space).
// Matches the normalization in server/middleware/auth.js.
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

// Permissive email regex. Server-side validation isn't trying to be RFC 5322
// perfect — the goal is to reject obvious garbage. The actual delivery test
// happens when we eventually email the list.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Optional-auth: read req.headers.authorization if present; on success,
// populate req.userId and req.userEmail. Failures (missing/invalid token)
// silently fall through to the unauthenticated path so anyone can join the
// waiting list with just an email, even without an account.
async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    if (decoded?.type && decoded.type !== 'access') return next();
    const { rows } = await pool.query(
      'SELECT id, email, token_version FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (rows.length === 0) return next();
    const currentVersion = rows[0].token_version ?? 0;
    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== currentVersion) return next();
    req.userId = rows[0].id;
    req.userEmail = rows[0].email;
  } catch {
    // Bad token — treat as anonymous.
  }
  next();
}

// POST /waitlist — join the REPLAB Pro waiting list.
//
// Behavior:
//  - If a valid JWT is presented, we use the user's id + email from the
//    users table (ignoring any email in the body — prevents an authed user
//    from impersonating a different email).
//  - If no auth, the body must contain a valid email. We still try to
//    auto-link by matching the email to an existing user row, so the admin
//    view shows accurate "is this person a member" status.
//  - Re-submitting with the same email is idempotent (ON CONFLICT updates
//    the existing row's user_id/source rather than 409-ing).
router.post('/', optionalAuth, async (req, res) => {
  try {
    let email;
    let userId = null;
    let source = 'email';

    if (req.userId && req.userEmail) {
      email = String(req.userEmail).trim().toLowerCase();
      userId = req.userId;
      source = 'logged_in';
    } else {
      const raw = req.body?.email;
      if (!raw || typeof raw !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }
      email = raw.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      // Auto-link if this email already belongs to an account, so the admin
      // view's "member status" column resolves on first save.
      const { rows: matched } = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
        [email]
      );
      if (matched.length > 0) userId = matched[0].id;
    }

    const { rows } = await pool.query(
      `INSERT INTO pro_waiting_list (email, user_id, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET user_id = COALESCE(pro_waiting_list.user_id, EXCLUDED.user_id),
             source  = CASE
               WHEN pro_waiting_list.source = 'logged_in' THEN pro_waiting_list.source
               ELSE EXCLUDED.source
             END
       RETURNING id, email, user_id, source, created_at,
                 (xmax = 0) AS inserted`,
      [email, userId, source]
    );

    // Only send the thank-you on the first signup. Re-submitting with the
    // same email is idempotent at the DB level; xmax=0 means a brand-new
    // row (insert), non-zero means we hit the ON CONFLICT update path.
    // Fire-and-forget so a Resend hiccup doesn't 500 the join request.
    if (rows[0].inserted) {
      sendWaitlistThankYouEmail(email).catch((err) =>
        console.error('Waitlist thank-you email failed:', err.message)
      );
    }

    res.status(201).json({ ok: true, entry: rows[0] });
  } catch (err) {
    console.error('POST /waitlist error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /waitlist/me — for the logged-in user, returns whether they're on the
// waiting list. Useful for hiding the CTA on the landing page once a user
// has already joined.
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const userId = decoded.userId;
    const { rows } = await pool.query(
      `SELECT id, email, source, created_at FROM pro_waiting_list
        WHERE user_id = $1
        ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) return res.json({ joined: false });
    res.json({ joined: true, entry: rows[0] });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
