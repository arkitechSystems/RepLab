import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /feedback — Submit feedback from client app
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, message } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: 'type and message are required' });
    }
    await db.saveFeedback(req.userId, type, message);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /feedback/announcement — Get active announcement for client
router.get('/announcement', authMiddleware, async (req, res) => {
  try {
    const announcement = await db.getActiveAnnouncement();
    res.json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
