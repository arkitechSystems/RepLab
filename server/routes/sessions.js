import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, (req, res) => {
  const { templateId, date, entries } = req.body;

  if (!templateId || !date || !entries || !entries.length) {
    return res.status(400).json({ error: 'templateId, date, and entries are required' });
  }

  const result = db.createSession(req.userId, templateId, date, entries);
  res.status(201).json(result);
});

router.get('/', authMiddleware, (req, res) => {
  const sessions = db.getSessions(req.userId);
  res.json(sessions);
});

router.get('/:id', authMiddleware, (req, res) => {
  const session = db.getSession(req.userId, Number(req.params.id));
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

export default router;
