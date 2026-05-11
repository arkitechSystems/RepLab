import { Router } from 'express';
import db from '../db.js';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { templateId, date, entries, notes, workoutData, confirmOverwrite } = req.body;
    if (!templateId || !date || !entries || !entries.length) {
      return res.status(400).json({ error: 'templateId, date, and entries are required' });
    }
    const result = await db.createSession(
      req.userId,
      templateId,
      date,
      entries,
      notes,
      workoutData,
      { confirmOverwrite: confirmOverwrite === true }
    );
    res.status(201).json(result);
  } catch (err) {
    // Structured 409 — caller tried to overwrite a session that already has
    // logged entries without setting confirmOverwrite. Surface the details
    // payload so the client can render its confirmation modal with accurate
    // counts.
    if (err && err.code === 'OVERWRITE_REQUIRES_CONFIRMATION' && err.details) {
      return res.status(409).json(err.details);
    }
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

// POST /sessions/start-empty — Create an empty "custom" template in the
// user's "My Workouts" program and assign it to the given date. Returns the
// new templateId so the client can navigate straight into the session.
// Does not touch any existing session rows for the date — that's handled by
// db.createSession's overwrite-protection contract when the user actually
// logs entries.
router.post('/start-empty', authMiddleware, async (req, res) => {
  const { name, date } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date in YYYY-MM-DD format is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find-or-create the user's "My Workouts" program
    const programName = 'My Workouts';
    let programId;
    const { rows: existingProgram } = await client.query(
      'SELECT id FROM programs WHERE user_id = $1 AND name = $2',
      [req.userId, programName]
    );
    if (existingProgram.length > 0) {
      programId = existingProgram[0].id;
    } else {
      const { rows: [newProg] } = await client.query(
        'INSERT INTO programs (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
        [req.userId, programName, '']
      );
      programId = newProg.id;
    }

    // De-duplicate the name within the program (case-insensitive)
    const baseName = name.trim();
    let finalName = baseName;
    let suffix = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { rows: dupe } = await client.query(
        'SELECT id FROM templates WHERE program_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
        [programId, finalName]
      );
      if (dupe.length === 0) break;
      finalName = `${baseName} (${suffix})`;
      suffix += 1;
    }

    // Next sort_order for the program
    const { rows: sortRows } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM templates WHERE program_id = $1',
      [programId]
    );
    const sortOrder = sortRows[0].next_sort;

    // Empty template — no exercises
    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING id',
      [req.userId, programId, finalName, '', sortOrder]
    );

    // Replace whatever was on that day with the new template
    await client.query(
      `INSERT INTO schedule_days (user_id, schedule_date, template_id, is_rest)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (user_id, schedule_date)
       DO UPDATE SET template_id = $3, is_rest = FALSE`,
      [req.userId, date, tmpl.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ templateId: tmpl.id, finalName });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('start-empty error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
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

// Heartbeat fired on every set completion. Feeds the idle-reminder push
// checker (server/pushScheduler.js) and clears any previously-sent reminder
// flag so a rejoined session can earn a fresh reminder if they walk away again.
router.post('/activity', authMiddleware, async (req, res) => {
  try {
    const { templateId, date } = req.body;
    if (!templateId || !date) return res.status(400).json({ error: 'templateId and date required' });
    await pool.query(
      `UPDATE sessions
       SET last_activity_at = NOW(), reminder_sent_at = NULL
       WHERE user_id = $1 AND template_id = $2 AND date = $3 AND completed = FALSE`,
      [req.userId, Number(templateId), date]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('sessions/activity error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Progressive overload — every (exercise, weight) the user has logged on
// 2+ distinct dates with all set entries. Drives the /progress page.
// Sits before the /:id route so the literal string isn't swallowed.
router.get('/progress-overload', authMiddleware, async (req, res) => {
  try {
    const groups = await db.getSameWeightRepeats(req.userId);
    res.json(groups);
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
