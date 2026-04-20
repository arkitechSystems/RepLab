import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const MAX_NAME_LEN = 200;
const MAX_DESCRIPTION_LEN = 5000;

function validateProgramName(name) {
  if (typeof name !== 'string' || !name.trim()) return 'Program name is required';
  if (name.length > MAX_NAME_LEN) return `Program name must be ${MAX_NAME_LEN} characters or fewer`;
  return null;
}
function validateProgramDescription(description) {
  if (description == null) return null;
  if (typeof description !== 'string') return 'Description must be a string';
  if (description.length > MAX_DESCRIPTION_LEN) return `Description must be ${MAX_DESCRIPTION_LEN} characters or fewer`;
  return null;
}

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
    const nameErr = validateProgramName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });
    const descErr = validateProgramDescription(description);
    if (descErr) return res.status(400).json({ error: descErr });
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
    const nameErr = validateProgramName(name);
    if (nameErr) return res.status(400).json({ error: nameErr });
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
