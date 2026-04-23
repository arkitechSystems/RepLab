import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const VALID_REACTIONS = new Set(['fire', 'flex', 'hundo', 'clap']);
const MAX_IDS = 200;           // sanity cap on batch fetch
const MAX_ITEM_ID_LEN = 512;   // item_ids come from the client, keep bounded

// GET /feed/reactions?ids=a,b,c
// Returns { aggregates: { [id]: {fire, flex, hundo, clap} }, mine: { [id]: reaction } }
router.get('/', authMiddleware, async (req, res) => {
  try {
    const raw = (req.query.ids || '').toString();
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s.length <= MAX_ITEM_ID_LEN)
      .slice(0, MAX_IDS);
    const result = await db.getFeedReactions(req.userId, ids);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /feed/reactions   body: { itemId, reaction: 'fire'|'flex'|'hundo'|'clap'|null }
// null clears the current user's reaction on that item.
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { itemId, reaction } = req.body || {};
    if (!itemId || typeof itemId !== 'string' || itemId.length > MAX_ITEM_ID_LEN) {
      return res.status(400).json({ error: 'itemId is required' });
    }
    if (reaction !== null && !VALID_REACTIONS.has(reaction)) {
      return res.status(400).json({ error: 'invalid reaction' });
    }
    const saved = await db.setFeedReaction(req.userId, itemId, reaction);
    res.json({ reaction: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
