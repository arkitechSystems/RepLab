import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const pbs = await db.getPBs(req.userId, req.query.templateId);
    res.json(pbs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const pool = (await import('../dbPool.js')).default;
    const userId = req.userId;

    const [totalPRs, prsThisMonth, heaviest, improved] = await Promise.all([
      // Total PRs
      pool.query('SELECT COUNT(*) AS count FROM personal_bests WHERE user_id = $1', [userId]),
      // PRs this month
      pool.query(
        `SELECT COUNT(*) AS count FROM personal_bests WHERE user_id = $1 AND achieved_at >= date_trunc('month', CURRENT_DATE)`,
        [userId]
      ),
      // Heaviest single lift
      pool.query(
        `SELECT exercise_name, best_weight, best_reps FROM personal_bests WHERE user_id = $1 ORDER BY best_weight DESC LIMIT 1`,
        [userId]
      ),
      // Most improved exercise (biggest weight range)
      pool.query(
        `SELECT exercise_name, MAX(best_weight) - MIN(best_weight) AS improvement
         FROM personal_bests WHERE user_id = $1
         GROUP BY exercise_name HAVING COUNT(*) > 1
         ORDER BY improvement DESC LIMIT 1`,
        [userId]
      ),
    ]);

    res.json({
      totalPRs: Number(totalPRs.rows[0]?.count || 0),
      prsThisMonth: Number(prsThisMonth.rows[0]?.count || 0),
      heaviestLift: heaviest.rows[0] || null,
      mostImproved: improved.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-body-part', authMiddleware, async (req, res) => {
  try {
    const pool = (await import('../dbPool.js')).default;
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (e.muscle_group)
         e.muscle_group, pb.exercise_name, pb.best_weight, pb.best_reps
       FROM personal_bests pb
       JOIN exercises e ON LOWER(e.name) = LOWER(pb.exercise_name)
       WHERE pb.user_id = $1
       ORDER BY e.muscle_group, pb.best_weight DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Every PB row with muscle_group attached, ordered for client-side grouping:
// muscle_group → exercise_name → descending weight.
router.get('/all-by-muscle', authMiddleware, async (req, res) => {
  try {
    const pool = (await import('../dbPool.js')).default;
    const { rows } = await pool.query(
      `SELECT e.muscle_group, pb.exercise_name, pb.best_weight, pb.best_reps,
              pb.template_id, pb.achieved_at
       FROM personal_bests pb
       JOIN exercises e ON LOWER(e.name) = LOWER(pb.exercise_name)
       WHERE pb.user_id = $1
       ORDER BY e.muscle_group, pb.exercise_name, pb.best_weight DESC, pb.best_reps DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
