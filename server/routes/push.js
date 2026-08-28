import { Router } from 'express';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendFcmToTokens, isFcmConfigured } from '../pushProvider.js';

const router = Router();

const VALID_PLATFORMS = new Set(['ios', 'android', 'web']);

// Register a push token for the authenticated user.
// Capacitor's @capacitor-firebase/messaging plugin returns an FCM registration
// token directly on both iOS and Android — that's what firebase-admin (see
// pushProvider.js) expects for sends, so no per-platform handling is needed here.
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const { pushToken, platform } = req.body;
    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({ error: 'pushToken is required' });
    }
    const normalizedPlatform = VALID_PLATFORMS.has(platform) ? platform : 'ios';

    await pool.query(
      `INSERT INTO device_tokens (user_id, push_token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (push_token) DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
      [req.userId, pushToken, normalizedPlatform]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Push register error:', err);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

router.delete('/unregister', authMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ error: 'pushToken is required' });

    await pool.query(
      'DELETE FROM device_tokens WHERE push_token = $1 AND user_id = $2',
      [pushToken, req.userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Push unregister error:', err);
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

// Dormant until FCM credentials are wired — returns early with no-op so
// callers (e.g. idle-reminder scheduler) don't have to branch on configuration.
export async function sendPushToUser(userId, title, body, data = {}) {
  if (!isFcmConfigured()) return { sent: 0, skipped: true };

  const { rows } = await pool.query(
    'SELECT push_token, platform FROM device_tokens WHERE user_id = $1',
    [userId]
  );
  if (rows.length === 0) return { sent: 0, skipped: false };

  const tokens = rows.map((r) => r.push_token);
  const result = await sendFcmToTokens(tokens, { title, body, data });

  // Clean up tokens the provider rejected as unregistered — they won't recover
  // and will keep us wasting calls on every future send otherwise.
  if (result.invalidTokens && result.invalidTokens.length > 0) {
    await pool.query(
      'DELETE FROM device_tokens WHERE push_token = ANY($1::text[])',
      [result.invalidTokens]
    );
  }

  return { sent: result.sent, skipped: false };
}

export default router;
