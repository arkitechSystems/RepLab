import { Router } from 'express';
import db from '../db.js';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const days = await db.getSchedule(req.userId);
    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const { schedule } = req.body;
    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ error: 'Schedule array is required' });
    }
    for (const day of schedule) {
      if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        return res.status(400).json({ error: 'dayOfWeek must be an integer 0-6' });
      }
      if (day.templateId !== undefined && day.templateId !== null &&
          (!Number.isInteger(day.templateId) || day.templateId < 1)) {
        return res.status(400).json({ error: 'templateId must be a positive integer' });
      }
    }

    // Verify all templateIds belong to user or are global
    const templateIds = schedule.map(s => s.templateId).filter(id => id != null);
    if (templateIds.length > 0) {
      const { rows } = await pool.query(
        'SELECT id, user_id FROM templates WHERE id = ANY($1::int[])',
        [templateIds]
      );
      const foundIds = new Set(rows.map(r => r.id));
      for (const tid of templateIds) {
        if (!foundIds.has(tid)) {
          return res.status(400).json({ error: 'Invalid template in schedule' });
        }
      }
      for (const row of rows) {
        if (row.user_id !== null && row.user_id !== req.userId) {
          return res.status(403).json({ error: 'Template does not belong to you' });
        }
      }
    }

    await db.updateSchedule(req.userId, schedule);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
