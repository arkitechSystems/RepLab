import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const programs = await db.getPrograms(req.userId);
    res.json(programs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Program name is required' });
    }
    const result = await db.createProgram(req.userId, name, description || '');
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const programId = Number(req.params.id);
    if (!name) {
      return res.status(400).json({ error: 'Program name is required' });
    }
    const result = await db.updateProgram(req.userId, programId, name);
    if (!result) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const programId = Number(req.params.id);
    const result = await db.deleteProgram(req.userId, programId);
    if (!result) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
