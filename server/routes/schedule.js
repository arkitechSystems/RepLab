import { Router } from 'express';
import db from '../db.js';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params are required (YYYY-MM-DD)' });
    }
    const days = await db.getSchedule(req.userId, from, to);
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
      if (!day.date || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
        return res.status(400).json({ error: 'Each entry must have a date in YYYY-MM-DD format' });
      }
      if (day.templateId !== undefined && day.templateId !== null &&
          (!Number.isInteger(day.templateId) || day.templateId < 1)) {
        return res.status(400).json({ error: 'templateId must be a positive integer' });
      }
    }

    // Normalize isRest flag
    for (const day of schedule) {
      if (day.isRest !== undefined && typeof day.isRest !== 'boolean') {
        return res.status(400).json({ error: 'isRest must be a boolean' });
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

// POST /schedule/shift — slide every schedule_days row from fromDate onward
// by one day in `direction`. Runs in one transaction over the full table so
// the cascade isn't bounded by whatever window the client happens to have
// loaded. Includes standalone rest days (template_id IS NULL, is_rest = TRUE).
router.post('/shift', authMiddleware, async (req, res) => {
  const { fromDate, direction } = req.body || {};
  if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return res.status(400).json({ error: 'fromDate in YYYY-MM-DD format is required' });
  }
  if (direction !== 'forward' && direction !== 'back') {
    return res.status(400).json({ error: "direction must be 'forward' or 'back'" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Order matters to avoid colliding with the (user_id, schedule_date)
    // unique index mid-loop: when sliding forward, update the latest row
    // first so its new slot is free; when sliding back, update the earliest
    // first so its new (earlier) slot is free.
    const orderDir = direction === 'forward' ? 'DESC' : 'ASC';
    const { rows } = await client.query(
      `SELECT id, schedule_date
       FROM schedule_days
       WHERE user_id = $1 AND schedule_date >= $2
       ORDER BY schedule_date ${orderDir}`,
      [req.userId, fromDate]
    );

    const deltaSql = direction === 'forward' ? `+ INTERVAL '1 day'` : `- INTERVAL '1 day'`;
    for (const row of rows) {
      await client.query(
        `UPDATE schedule_days
         SET schedule_date = schedule_date ${deltaSql}
         WHERE id = $1`,
        [row.id]
      );
    }

    await client.query('COMMIT');
    res.json({ shifted: rows.length });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('schedule/shift error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { from } = req.query;
    if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({ error: 'from query param is required (YYYY-MM-DD)' });
    }
    await db.clearScheduleFrom(req.userId, from);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
