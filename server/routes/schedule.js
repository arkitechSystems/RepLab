import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const days = db.getSchedule(req.userId);
  res.json(days);
});

router.put('/', authMiddleware, (req, res) => {
  const { schedule } = req.body;

  if (!schedule || !Array.isArray(schedule)) {
    return res.status(400).json({ error: 'Schedule array is required' });
  }

  db.updateSchedule(req.userId, schedule);
  res.json({ success: true });
});

export default router;
