import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const programs = db.getPrograms(req.userId);
  res.json(programs);
});

router.post('/', authMiddleware, (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Program name is required' });
  }

  const result = db.createProgram(req.userId, name);
  res.status(201).json(result);
});

export default router;
