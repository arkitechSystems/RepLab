import { Router } from 'express';
import { Expo } from 'expo-server-sdk';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const expo = new Expo();

// Register a push token for the authenticated user
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const { pushToken, platform } = req.body;
    if (!pushToken) return res.status(400).json({ error: 'pushToken is required' });

    if (!Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({ error: 'Invalid Expo push token' });
    }

    await pool.query(
      `INSERT INTO device_tokens (user_id, push_token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (push_token) DO UPDATE SET user_id = $1, platform = $3, updated_at = NOW()`,
      [req.userId, pushToken, platform || 'ios']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Push register error:', err);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Unregister a push token (e.g. on logout)
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

// Send push notification to a specific user (internal use)
export async function sendPushToUser(userId, title, body, data = {}) {
  const { rows } = await pool.query(
    'SELECT push_token FROM device_tokens WHERE user_id = $1',
    [userId]
  );

  if (rows.length === 0) return;

  const messages = rows
    .filter((r) => Expo.isExpoPushToken(r.push_token))
    .map((r) => ({
      to: r.push_token,
      sound: 'default',
      title,
      body,
      data,
    }));

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('Push send error:', err);
    }
  }
}

export default router;
