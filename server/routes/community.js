import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { parseCommunityItemKey } from '../communityItems.js';
import { notifyCommunityLike } from '../communityLikeNotifier.js';

const router = Router();

const MAX_LIMIT = 100;
const MAX_SINCE_DAYS = 90;

// GET /community/feed?limit=50&sinceDays=30
// Cross-user feed of PRs, program starts, and completed workouts.
// Returns { items: [...], authors: { [userId]: { name, photoUrl } } }. Each
// item carries likeCount, likedByMe, and isMine for the viewer.
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIMIT);
    const sinceDays = Math.min(Math.max(parseInt(req.query.sinceDays, 10) || 30, 1), MAX_SINCE_DAYS);
    const feed = await db.getCommunityFeed({ limit, sinceDays, viewerId: req.userId });
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

// PUT /community/likes/:itemKey  (itemKey like "pr-123") — like, idempotent.
// Only items currently shown in the feed can be liked, and never your own.
// The first-ever like by this user on the item notifies the owner (batched;
// see communityLikeNotifier.js). Returns { liked, likeCount }.
router.put('/likes/:itemKey', authMiddleware, async (req, res) => {
  try {
    const key = parseCommunityItemKey(req.params.itemKey);
    if (!key) return res.status(400).json({ error: 'Invalid item' });
    const item = await db.getCommunityItem(key.type, key.id);
    if (!item) return res.status(404).json({ error: 'That activity is no longer available' });
    if (item.ownerId === req.userId) {
      return res.status(403).json({ error: "You can't like your own activity" });
    }
    const { firstTime } = await db.likeCommunityItem(req.userId, key.type, key.id, item.ownerId);
    // Fire-and-forget; the notifier logs its own failures.
    if (firstTime) notifyCommunityLike(req.userId, item).catch(() => {});
    res.json({ liked: true, likeCount: await db.countCommunityLikes(key.type, key.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /community/likes/:itemKey — unlike (no-op if not liked).
router.delete('/likes/:itemKey', authMiddleware, async (req, res) => {
  try {
    const key = parseCommunityItemKey(req.params.itemKey);
    if (!key) return res.status(400).json({ error: 'Invalid item' });
    await db.unlikeCommunityItem(req.userId, key.type, key.id);
    res.json({ liked: false, likeCount: await db.countCommunityLikes(key.type, key.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /community/notifications -> { likes } (Profile "Likes on my activity")
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    res.json(await db.getCommunityNotificationSettings(req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /community/notifications  body: { likes: boolean }
router.put('/notifications', authMiddleware, async (req, res) => {
  try {
    const { likes } = req.body || {};
    if (typeof likes !== 'boolean') {
      return res.status(400).json({ error: 'likes must be a boolean' });
    }
    res.json(await db.setCommunityLikeNotifications(req.userId, likes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
