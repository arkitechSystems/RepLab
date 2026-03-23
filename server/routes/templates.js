import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const templates = await db.getTemplates(req.userId);
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, exercises, programId, isRest } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    const result = await db.createTemplate(req.userId, name, description || '', exercises, programId, isRest);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Must come before /:id routes
router.put('/reorder', authMiddleware, async (req, res) => {
  try {
    const { programId, templateIds } = req.body;
    if (!programId || !Array.isArray(templateIds)) {
      return res.status(400).json({ error: 'programId and templateIds array are required' });
    }
    const ok = await db.reorderTemplates(req.userId, programId, templateIds);
    if (!ok) return res.status(404).json({ error: 'Program not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, exercises } = req.body;
    const templateId = Number(req.params.id);
    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    const result = await db.updateTemplate(req.userId, templateId, name, description || '', exercises);
    if (!result) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const templateId = Number(req.params.id);
    const result = await db.deleteTemplate(req.userId, templateId);
    if (!result) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
