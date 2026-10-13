import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../validation.js';
import { metricsBody } from '../schemas/misc.js';

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

// Each metric is a number in range or null to clear it — checked and
// normalized by metricsBody (schemas/misc.js).
router.put('/', authMiddleware, validateBody(metricsBody), async (req, res) => {
  try {
    const result = await db.updateMetrics(req.userId, req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
