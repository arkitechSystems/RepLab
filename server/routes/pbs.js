import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const pbs = db.getPBs(req.userId, req.query.templateId);
  res.json(pbs);
});

export default router;
