import { Router } from 'express';
import db from '../db.js';
import pool from '../dbPool.js';
import { authMiddleware } from '../middleware/auth.js';
import { notifyPRCelebration, notifyFirstWorkout } from '../postSessionPushes.js';
import { MAX_DAY_NAME_LEN } from '../workoutDayName.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { templateId, date, entries, notes, workoutData, confirmOverwrite } = req.body;
    if (!templateId || !date || !entries || !entries.length) {
      return res.status(400).json({ error: 'templateId, date, and entries are required' });
    }
    // Ownership gate: prevents a caller from saving a session that attaches
    // their data to another user's private template. Global (userId IS NULL)
    // templates are allowed. Matches the check at /sessions/initialize.
    const { rows: tmplRows } = await pool.query(
      'SELECT user_id FROM templates WHERE id = $1',
      [Number(templateId)]
    );
    if (tmplRows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (tmplRows[0].user_id != null && tmplRows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Template does not belong to you' });
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

    // Race-safe find-or-create of the user's "My Workouts" program.
    // DO UPDATE is a no-op forcing RETURNING to fire on conflict so we always
    // get the row id back. The ON CONFLICT WHERE clause must match the partial
    // unique index in initDb.js exactly.
    const programName = 'My Workouts';
    const { rows: [programRow] } = await client.query(
      `INSERT INTO programs (user_id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, lower(name)) WHERE user_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [req.userId, programName, '']
    );
    const programId = programRow.id;

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

    // Community feed "created a custom workout" event. The feed shows the
    // template's current name, so a later rename carries through.
    await db.recordCustomWorkoutCreated(req.userId, tmpl.id, client);

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

// Create the date's independent session copy from the template if it doesn't
// exist yet. Returns { status, session } — 200 existing, 201 created, 404/403
// with session null when the template can't be copied for this user. Shared
// by /initialize and the per-day rename (which may run before first open).
async function ensureSessionCopy(userId, templateId, date) {
  const existing = await db.getSessionByTemplateAndDate(userId, templateId, date);
  if (existing) return { status: 200, session: existing };

  // Load template to copy
  const templates = await db.getTemplates(userId);
  const tmpl = templates.find(t => t.id === templateId);
  if (!tmpl || tmpl.isRest) return { status: 404, error: 'Template not found', session: null };
  if (tmpl.userId && tmpl.userId !== userId) return { status: 403, error: 'Template does not belong to you', session: null };

  // Goal weight/reps seed: for each exercise, the greater-by-volume of the
  // user's last completed performance vs their all-time volume PR, matched by
  // exercise NAME across every workout (not scoped to this template). One
  // goal per exercise, applied to all its sets. See
  // db.getVolumeGoalsByExerciseName.
  const exerciseNames = tmpl.exercises
    .filter((ex) => !ex.isSectionHeader)
    .map((ex) => ex.name);
  const volumeGoals = await db.getVolumeGoalsByExerciseName(userId, exerciseNames);

  // Build workout_data — the independent copy, with previous bests as goals
  const workoutData = {
    name: tmpl.name,
    exercises: tmpl.exercises.map(ex => ({
      name: ex.name,
      setType: ex.setType || 'straight',
      ...(ex.exerciseDescription ? { exerciseDescription: ex.exerciseDescription } : {}),
      ...(ex.isSectionHeader ? { isSectionHeader: true, sectionNotes: ex.sectionNotes || '' } : {}),
      sets: ex.sets.map(s => {
        const goal = volumeGoals[ex.name];
        return {
          setNumber: s.setNumber,
          plannedReps: goal ? goal.reps : (s.plannedReps ?? 10),
          suggestedWeight: goal ? goal.weight : (s.suggestedWeight ?? 0),
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

  await db.createSession(userId, templateId, date, entries, {}, workoutData);
  const session = await db.getSessionByTemplateAndDate(userId, templateId, date);
  return { status: 201, session };
}

// POST /sessions/initialize — Create initial session copy from template (no entries yet)
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const { templateId, date } = req.body;
    if (!templateId || !date) return res.status(400).json({ error: 'templateId and date required' });
    const result = await ensureSessionCopy(req.userId, Number(templateId), date);
    if (!result.session) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /sessions/by-template/:templateId/:date/name  body: { name }
// Per-day rename from the session pencil. Sets sessions.custom_name on THIS
// date's session only — the template (and every other date that uses it)
// keeps its name. Only workouts the user created (templates.user_id = them),
// never rest days. Creates the date's session copy first if it hasn't been
// opened yet. Returns { templateId, date, customName }.
router.put('/by-template/:templateId/:date/name', authMiddleware, async (req, res) => {
  try {
    const templateId = Number(req.params.templateId);
    const { date } = req.params;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!Number.isInteger(templateId) || templateId <= 0) return res.status(400).json({ error: 'Invalid template id' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date in YYYY-MM-DD format is required' });
    if (!name) return res.status(400).json({ error: 'Workout name is required' });
    if (name.length > MAX_DAY_NAME_LEN) {
      return res.status(400).json({ error: `Workout name must be ${MAX_DAY_NAME_LEN} characters or fewer` });
    }

    const { rows: [tmpl] } = await pool.query(
      'SELECT user_id, COALESCE(is_rest, FALSE) AS is_rest FROM templates WHERE id = $1',
      [templateId]
    );
    if (!tmpl) return res.status(404).json({ error: 'Template not found' });
    // Global (RepLab) programs and anyone else's workouts can't be renamed.
    if (tmpl.user_id !== req.userId) return res.status(403).json({ error: 'Only workouts you created can be renamed' });
    if (tmpl.is_rest) return res.status(400).json({ error: 'Rest days can’t be renamed' });

    const ensured = await ensureSessionCopy(req.userId, templateId, date);
    if (!ensured.session) return res.status(ensured.status).json({ error: ensured.error });

    const saved = await db.setSessionCustomName(req.userId, templateId, date, name);
    if (!saved) return res.status(404).json({ error: 'Session not found' });
    res.json({ templateId, date, customName: saved.customName });
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

    // Post-complete pushes — fire-and-forget after the response goes out so
    // the client never blocks on FCM. Only run when transitioning to
    // completed; uncompleting silently no-ops.
    if (completed === true) {
      notifyPRCelebration(req.userId, result.id).catch(() => {});
      notifyFirstWorkout(req.userId).catch(() => {});
    }
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
