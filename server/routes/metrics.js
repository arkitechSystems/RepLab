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

// Coerce and bound a numeric field. Accepts number or numeric string; rejects
// anything non-numeric, infinite, or outside a reasonable range. Returns null
// for empty/null/undefined so users can clear a field.
function parseMetric(value, { min = 0, max = 9999, label }) {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) throw new Error(`${label} must be a number`);
  if (num < min || num > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return num;
}

router.put('/', authMiddleware, async (req, res) => {
  try {
    const { height, weight, bodyFat, maxBench, maxSquat, maxDeadlift } = req.body;
    let parsed;
    try {
      parsed = {
        height: parseMetric(height, { min: 0, max: 120, label: 'Height' }),
        weight: parseMetric(weight, { min: 0, max: 1500, label: 'Weight' }),
        bodyFat: parseMetric(bodyFat, { min: 0, max: 100, label: 'Body fat' }),
        maxBench: parseMetric(maxBench, { min: 0, max: 2000, label: 'Max bench' }),
        maxSquat: parseMetric(maxSquat, { min: 0, max: 2000, label: 'Max squat' }),
        maxDeadlift: parseMetric(maxDeadlift, { min: 0, max: 2000, label: 'Max deadlift' }),
      };
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const result = await db.updateMetrics(req.userId, parsed);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
