import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, (req, res) => {
  const templates = db.getTemplates(req.userId);
  res.json(templates);
});

router.put('/:id', authMiddleware, (req, res) => {
  const { name, description, exercises } = req.body;
  const templateId = Number(req.params.id);

  if (!name) {
    return res.status(400).json({ error: 'Template name is required' });
  }

  const result = db.updateTemplate(templateId, name, description || '', exercises);
  if (!result) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(result);
});

router.post('/', authMiddleware, (req, res) => {
  const { name, description, exercises, programId, isRest } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Template name is required' });
  }

  const result = db.createTemplate(req.userId, name, description || '', exercises, programId, isRest);
  res.status(201).json(result);
});

export default router;
