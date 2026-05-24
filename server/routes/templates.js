import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Reject absurdly long strings before they hit the DB. Without these caps, an
// authenticated attacker could POST a 10 MB workout name and bloat the DB.
const MAX_NAME_LEN = 200;
const MAX_DESCRIPTION_LEN = 5000;
const MAX_EXERCISES_PER_TEMPLATE = 100;

function validateTemplatePayload({ name, description, exercises }) {
  if (typeof name !== 'string' || !name.trim()) return 'Template name is required';
  if (name.length > MAX_NAME_LEN) return `Template name must be ${MAX_NAME_LEN} characters or fewer`;
  if (description != null && typeof description !== 'string') return 'Description must be a string';
  if (description && description.length > MAX_DESCRIPTION_LEN) return `Description must be ${MAX_DESCRIPTION_LEN} characters or fewer`;
  if (exercises != null) {
    if (!Array.isArray(exercises)) return 'Exercises must be an array';
    if (exercises.length > MAX_EXERCISES_PER_TEMPLATE) return `Max ${MAX_EXERCISES_PER_TEMPLATE} exercises per template`;
    for (const ex of exercises) {
      if (ex && typeof ex.name === 'string' && ex.name.length > MAX_NAME_LEN) {
        return `Exercise name must be ${MAX_NAME_LEN} characters or fewer`;
      }
    }
  }
  return null;
}

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
    const validationError = validateTemplatePayload({ name, description, exercises });
    if (validationError) return res.status(400).json({ error: validationError });
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
    const validationError = validateTemplatePayload({ name, description, exercises });
    if (validationError) return res.status(400).json({ error: validationError });
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

// Move a template to a different program. Body: { programId: number }.
// Owner-only (enforced in db.moveTemplateToProgram via WHERE user_id = $).
// Target program must also belong to the requesting user, so library
// programs (user_id IS NULL) can never be a destination.
router.put('/:id/program', authMiddleware, async (req, res) => {
  try {
    const templateId = Number(req.params.id);
    const programId = Number(req.body?.programId);
    if (!Number.isInteger(templateId) || templateId <= 0) {
      return res.status(400).json({ error: 'Invalid template id' });
    }
    if (!Number.isInteger(programId) || programId <= 0) {
      return res.status(400).json({ error: 'programId is required' });
    }
    const result = await db.moveTemplateToProgram(req.userId, templateId, programId);
    if (!result) {
      return res.status(404).json({ error: 'Template or target program not found' });
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
