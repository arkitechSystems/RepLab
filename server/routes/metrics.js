import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const metrics = db.getMetrics(req.userId);
  res.json(metrics);
});

router.put('/', authMiddleware, (req, res) => {
  const { height, weight, bodyFat, maxBench, maxSquat, maxDeadlift } = req.body;
  const result = db.updateMetrics(req.userId, {
    height: height ?? null,
    weight: weight ?? null,
    bodyFat: bodyFat ?? null,
    maxBench: maxBench ?? null,
    maxSquat: maxSquat ?? null,
    maxDeadlift: maxDeadlift ?? null,
  });
  res.json(result);
});

export default router;
