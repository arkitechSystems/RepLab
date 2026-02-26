import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const metrics = await db.getMetrics(req.userId);
    res.json(metrics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    const { height, weight, bodyFat, maxBench, maxSquat, maxDeadlift } = req.body;
    const result = await db.updateMetrics(req.userId, {
      height: height ?? null,
      weight: weight ?? null,
      bodyFat: bodyFat ?? null,
      maxBench: maxBench ?? null,
      maxSquat: maxSquat ?? null,
      maxDeadlift: maxDeadlift ?? null,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
