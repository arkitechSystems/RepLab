import { Router } from 'express';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const PLATFORMS = new Set(['ios', 'android']);
// install_id is a client-generated UUID; allow a little slack for other
// formats but keep it to a safe charset so junk can't be stored.
const INSTALL_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const MAX_VERSION_LEN = 32;

function cleanInstallId(raw) {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return INSTALL_ID_RE.test(id) ? id : null;
}

// POST /installs — report a native app install (first launch). No auth: the
// app reports before the user has an account. Idempotent on install_id so
// the client can safely retry until it gets a 2xx.
router.post('/', async (req, res) => {
  try {
    const installId = cleanInstallId(req.body?.installId);
    if (!installId) return res.status(400).json({ error: 'Invalid installId' });

    const platform = String(req.body?.platform || '').trim().toLowerCase();
    if (!PLATFORMS.has(platform)) return res.status(400).json({ error: 'Invalid platform' });

    const rawVersion = req.body?.appVersion;
    const appVersion = typeof rawVersion === 'string' && rawVersion.trim()
      ? rawVersion.trim().slice(0, MAX_VERSION_LEN)
      : null;

    await pool.query(
      `INSERT INTO app_installs (install_id, platform, app_version)
       VALUES ($1, $2, $3)
       ON CONFLICT (install_id) DO NOTHING`,
      [installId, platform, appVersion]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /installs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /installs/link — attach the logged-in user to an install. Only links
// an install that isn't already linked to someone (first account wins), so
// a leaked install id can't be used to re-point another user's install.
// Returns ok even when there's nothing to update (e.g. already linked to
// this user) so the client marks it done and stops retrying.
router.post('/link', authMiddleware, async (req, res) => {
  try {
    const installId = cleanInstallId(req.body?.installId);
    if (!installId) return res.status(400).json({ error: 'Invalid installId' });

    const { rows } = await pool.query(
      `UPDATE app_installs
         SET user_id = $2, linked_at = NOW()
       WHERE install_id = $1 AND user_id IS NULL
       RETURNING id`,
      [installId, req.userId]
    );
    if (rows.length > 0) return res.json({ ok: true, linked: true });

    const { rows: existing } = await pool.query(
      'SELECT user_id FROM app_installs WHERE install_id = $1',
      [installId]
    );
    if (existing.length === 0) {
      // Install row not reported yet — client should report first, then retry.
      return res.status(404).json({ error: 'Install not found' });
    }
    return res.json({ ok: true, linked: existing[0].user_id === req.userId });
  } catch (err) {
    console.error('POST /installs/link error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
