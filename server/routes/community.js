import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const MAX_LIMIT = 100;
const MAX_SINCE_DAYS = 90;

// GET /community/feed?limit=50&sinceDays=30
// Cross-user feed of PRs, program starts, and completed workouts.
// Returns { items: [...], authors: { [userId]: { name, photoUrl } } }
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIMIT);
    const sinceDays = Math.min(Math.max(parseInt(req.query.sinceDays, 10) || 30, 1), MAX_SINCE_DAYS);
    const feed = await db.getCommunityFeed({ limit, sinceDays });
    res.json(feed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Keep in sync with COMMUNITY_SETTING_KEYS in db.js.
const SETTING_KEYS = new Set(['all', 'pr', 'program', 'workout', 'custom']);

// GET /community/settings -> { all, pr, program, workout, custom } (booleans)
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    res.json(await db.getCommunitySettings(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /community/settings  body: { category, enabled, removePast? }
// category is 'all' (master) or one feed category. removePast only applies
// when turning off: it hides everything already posted in that category.
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { category, enabled, removePast } = req.body || {};
    if (!SETTING_KEYS.has(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    if (removePast !== undefined && typeof removePast !== 'boolean') {
      return res.status(400).json({ error: 'removePast must be a boolean' });
    }
    const settings = await db.setCommunitySharing(req.userId, category, enabled, !enabled && removePast === true);
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
