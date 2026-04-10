import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { templateId, date, entries, notes, workoutData } = req.body;
    if (!templateId || !date || !entries || !entries.length) {
      return res.status(400).json({ error: 'templateId, date, and entries are required' });
    }
    const result = await db.createSession(req.userId, templateId, date, entries, notes, workoutData);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const sessions = await db.getSessions(req.userId);
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /sessions/initialize — Create initial session copy from template (no entries yet)
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const { templateId, date } = req.body;
    if (!templateId || !date) return res.status(400).json({ error: 'templateId and date required' });

    // Check if session already exists
    const existing = await db.getSessionByTemplateAndDate(req.userId, Number(templateId), date);
    if (existing) return res.json(existing);

    // Load template to copy
    const templates = await db.getTemplates(req.userId);
    const tmpl = templates.find(t => t.id === Number(templateId));
    if (!tmpl || tmpl.isRest) return res.status(404).json({ error: 'Template not found' });
    if (tmpl.userId && tmpl.userId !== req.userId) return res.status(403).json({ error: 'Template does not belong to you' });

    // Look up best previous performance per exercise/set from completed sessions.
    // If the template has a group_id, look up by group (links repeated workouts across weeks).
    // Otherwise fall back to template-level lookup.
    const previousBests = tmpl.groupId
      ? await db.getBestPerformanceByGroup(req.userId, tmpl.groupId)
      : await db.getBestPerformanceByTemplate(req.userId, Number(templateId));

    // Build workout_data — the independent copy, with previous bests as goals
    const workoutData = {
      name: tmpl.name,
      exercises: tmpl.exercises.map(ex => ({
        name: ex.name,
        setType: ex.setType || 'straight',
        ...(ex.exerciseDescription ? { exerciseDescription: ex.exerciseDescription } : {}),
        ...(ex.isSectionHeader ? { isSectionHeader: true, sectionNotes: ex.sectionNotes || '' } : {}),
        sets: ex.sets.map(s => {
          const best = previousBests[ex.name]?.[s.setNumber];
          return {
            setNumber: s.setNumber,
            plannedReps: best ? best.reps : (s.plannedReps ?? 10),
            suggestedWeight: best ? best.weight : (s.suggestedWeight ?? 0),
          };
        }),
      })),
    };

    // Build blank entries (weight: 0, reps: 0) so the session exists in DB
    const entries = [];
    for (const ex of tmpl.exercises) {
      for (const s of ex.sets) {
        entries.push({ exerciseName: ex.name, setNumber: s.setNumber, weight: 0, reps: 0 });
      }
    }

    // Create the session
    const result = await db.createSession(req.userId, Number(templateId), date, entries, {}, workoutData);

    // Return the full session
    const session = await db.getSessionByTemplateAndDate(req.userId, Number(templateId), date);
    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-template/:templateId/:date', authMiddleware, async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    if (!Number.isInteger(templateId) || templateId <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const session = await db.getSessionByTemplateAndDate(
      req.userId,
      templateId,
      req.params.date
    );
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/complete', authMiddleware, async (req, res) => {
  try {
    const { templateId, date, completed } = req.body;
    const result = await db.toggleSessionComplete(req.userId, templateId, date, completed);
    if (!result) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/completed', authMiddleware, async (req, res) => {
  try {
    const completed = await db.getCompletedSessions(req.userId);
    res.json(completed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch exercise history for smart weight suggestions
router.post('/exercise-history', authMiddleware, async (req, res) => {
  try {
    const { exerciseNames, limit } = req.body;
    if (!exerciseNames || !Array.isArray(exerciseNames)) {
      return res.status(400).json({ error: 'exerciseNames array is required' });
    }
    const history = await db.getExerciseHistoryBatch(req.userId, exerciseNames, limit || 3);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/last-entries/:templateId', authMiddleware, async (req, res) => {
  try {
    const entries = await db.getLastSessionEntries(req.userId, Number(req.params.templateId));
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const session = await db.getSession(req.userId, id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
