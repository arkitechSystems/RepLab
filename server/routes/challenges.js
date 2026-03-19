import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /challenges/:challenge/leaderboard
router.get('/:challenge/leaderboard', authMiddleware, async (req, res) => {
  try {
    const entries = await db.getChallengeLeaderboard(req.params.challenge);
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /challenges/:challenge/my-entry
router.get('/:challenge/my-entry', authMiddleware, async (req, res) => {
  try {
    const entry = await db.getUserChallengeEntry(req.userId, req.params.challenge);
    res.json(entry || { value: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /challenges/:challenge
router.post('/:challenge', authMiddleware, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || typeof value !== 'number' || value < 1) {
      return res.status(400).json({ error: 'A valid number is required' });
    }
    await db.postChallengeEntry(req.userId, req.params.challenge, value);
    const entries = await db.getChallengeLeaderboard(req.params.challenge);
    res.status(201).json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
