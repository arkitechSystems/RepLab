import { Router } from 'express';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../validation.js';
import { cardioBody } from '../schemas/misc.js';

const router = Router();

// Body checks + normalization (type, duration, distance, calories, heart
// rate, notes, metadata, session_id): cardioBody / sanitizeCardio in
// schemas/misc.js.

// GET /cardio?session_id=X — list entries for a session
// GET /cardio?from=YYYY-MM-DD&to=YYYY-MM-DD — date-range list (uses created_at)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { session_id, from, to } = req.query;
    if (session_id) {
      const sid = Number(session_id);
      if (!Number.isInteger(sid)) return res.status(400).json({ error: 'session_id must be an integer' });
      const { rows } = await pool.query(
        `SELECT id, user_id, session_id, cardio_type, duration_secs, distance_m,
                calories, avg_heart_rate, notes, metadata, sort_order, created_at
           FROM cardio_entries
          WHERE user_id = $1 AND session_id = $2
          ORDER BY sort_order, id`,
        [req.userId, sid]
      );
      return res.json(rows);
    }
    if (from && to) {
      const { rows } = await pool.query(
        `SELECT id, user_id, session_id, cardio_type, duration_secs, distance_m,
                calories, avg_heart_rate, notes, metadata, sort_order, created_at
           FROM cardio_entries
          WHERE user_id = $1 AND created_at::date BETWEEN $2::date AND $3::date
          ORDER BY created_at DESC`,
        [req.userId, from, to]
      );
      return res.json(rows);
    }
    // Default: last 30 days
    const { rows } = await pool.query(
      `SELECT id, user_id, session_id, cardio_type, duration_secs, distance_m,
              calories, avg_heart_rate, notes, metadata, sort_order, created_at
         FROM cardio_entries
        WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /cardio error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cardio — create
router.post('/', authMiddleware, validateBody(cardioBody), async (req, res) => {
  try {
    const data = req.body;

    if (data.session_id != null) {
      // Verify the session belongs to this user before linking.
      const { rows } = await pool.query(
        'SELECT id FROM sessions WHERE id = $1 AND user_id = $2',
        [data.session_id, req.userId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    }

    // Append to end of any existing cardio entries on this session for stable
    // ordering. Standalone entries (no session) sort by id.
    let nextSortOrder = 0;
    if (data.session_id != null) {
      const { rows } = await pool.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM cardio_entries WHERE user_id = $1 AND session_id = $2',
        [req.userId, data.session_id]
      );
      nextSortOrder = rows[0].next;
    }

    const { rows: inserted } = await pool.query(
      `INSERT INTO cardio_entries
         (user_id, session_id, cardio_type, duration_secs, distance_m,
          calories, avg_heart_rate, notes, metadata, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, session_id, cardio_type, duration_secs, distance_m,
                 calories, avg_heart_rate, notes, metadata, sort_order, created_at`,
      [
        req.userId,
        data.session_id,
        data.cardio_type,
        data.duration_secs,
        data.distance_m,
        data.calories,
        data.avg_heart_rate,
        data.notes,
        data.metadata,
        nextSortOrder,
      ]
    );
    res.status(201).json(inserted[0]);
  } catch (err) {
    console.error('POST /cardio error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /cardio/:id — update
router.put('/:id', authMiddleware, validateBody(cardioBody), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const data = req.body;

    const { rowCount, rows } = await pool.query(
      `UPDATE cardio_entries
          SET cardio_type    = $3,
              duration_secs  = $4,
              distance_m     = $5,
              calories       = $6,
              avg_heart_rate = $7,
              notes          = $8,
              metadata       = $9
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, session_id, cardio_type, duration_secs, distance_m,
                  calories, avg_heart_rate, notes, metadata, sort_order, created_at`,
      [
        id,
        req.userId,
        data.cardio_type,
        data.duration_secs,
        data.distance_m,
        data.calories,
        data.avg_heart_rate,
        data.notes,
        data.metadata,
      ]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Cardio entry not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /cardio/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /cardio/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const { rowCount } = await pool.query(
      'DELETE FROM cardio_entries WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Cardio entry not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /cardio/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
