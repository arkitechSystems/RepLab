import pool from './dbPool.js';

const db = {
  // Admin settings
  async getAdminSetting(key) {
    const { rows } = await pool.query('SELECT value FROM admin_settings WHERE key = $1', [key]);
    return rows[0]?.value || null;
  },

  async setAdminSetting(key, value) {
    await pool.query(
      `INSERT INTO admin_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, value]
    );
  },

  // Users
  async getAllUsers() {
    const { rows } = await pool.query(
      `SELECT id, email, phone, first_name, last_name, gender, username, plan, referral_source, referral_code, zip_code, signup_city, signup_state, signup_device, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at FROM users
       WHERE email NOT LIKE '%@willfit.demo' OR email IS NULL
       ORDER BY created_at DESC`
    );
    return rows.map((u) => ({ id: u.id, email: u.email, phone: u.phone, firstName: u.first_name, lastName: u.last_name, gender: u.gender, username: u.username, plan: u.plan || 'Free', referralSource: u.referral_source, referralCode: u.referral_code, zipCode: u.zip_code, signupCity: u.signup_city, signupState: u.signup_state, signupDevice: u.signup_device, utmSource: u.utm_source, utmMedium: u.utm_medium, utmCampaign: u.utm_campaign, utmContent: u.utm_content, utmTerm: u.utm_term, createdAt: u.created_at }));
  },

  async getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Total users (excluding demo)
    const { rows: [totalRow] } = await pool.query(
      `SELECT COUNT(*) FROM users WHERE email NOT LIKE '%@willfit.demo' OR email IS NULL`
    );
    // New users today
    const { rows: [todayUsersRow] } = await pool.query(
      `SELECT COUNT(*) FROM users WHERE (email NOT LIKE '%@willfit.demo' OR email IS NULL) AND created_at::date = $1`, [today]
    );
    // New users yesterday
    const { rows: [yesterdayUsersRow] } = await pool.query(
      `SELECT COUNT(*) FROM users WHERE (email NOT LIKE '%@willfit.demo' OR email IS NULL) AND created_at::date = $1`, [yesterday]
    );
    // Workouts completed today
    const { rows: [todaySessionsRow] } = await pool.query(
      `SELECT COUNT(*) FROM sessions s JOIN users u ON s.user_id = u.id WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL) AND s.created_at::date = $1`, [today]
    );
    // Workouts completed yesterday
    const { rows: [yesterdaySessionsRow] } = await pool.query(
      `SELECT COUNT(*) FROM sessions s JOIN users u ON s.user_id = u.id WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL) AND s.created_at::date = $1`, [yesterday]
    );
    // Active users today (distinct users who logged a session)
    const { rows: [activeRow] } = await pool.query(
      `SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON s.user_id = u.id WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL) AND s.created_at::date = $1`, [today]
    );
    // Active users yesterday
    const { rows: [activeYesterdayRow] } = await pool.query(
      `SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON s.user_id = u.id WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL) AND s.created_at::date = $1`, [yesterday]
    );
    // Recent signups (last 24h with details)
    const { rows: recentSignups } = await pool.query(
      `SELECT first_name, last_name, email, phone, signup_city, signup_state, created_at FROM users WHERE (email NOT LIKE '%@willfit.demo' OR email IS NULL) AND created_at >= NOW() - INTERVAL '24 hours' ORDER BY created_at DESC`
    );

    return {
      totalUsers: parseInt(totalRow.count),
      newUsersToday: parseInt(todayUsersRow.count),
      newUsersYesterday: parseInt(yesterdayUsersRow.count),
      workoutsToday: parseInt(todaySessionsRow.count),
      workoutsYesterday: parseInt(yesterdaySessionsRow.count),
      activeUsersToday: parseInt(activeRow.count),
      activeUsersYesterday: parseInt(activeYesterdayRow.count),
      recentSignups,
    };
  },

  async getSessionAnalytics() {
    // All completed sessions with user info
    const { rows: sessions } = await pool.query(`
      SELECT s.id, s.user_id, s.template_id, s.date, s.completed, s.created_at,
             t.name AS template_name,
             u.email, u.first_name, u.last_name, u.username
      FROM sessions s
      LEFT JOIN templates t ON s.template_id = t.id
      JOIN users u ON s.user_id = u.id
      WHERE u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL
      ORDER BY s.created_at DESC
    `);
    return sessions.map((s) => ({
      id: s.id,
      userId: s.user_id,
      templateId: s.template_id,
      templateName: s.template_name,
      date: s.date,
      completed: s.completed,
      createdAt: s.created_at,
      email: s.email,
      firstName: s.first_name,
      lastName: s.last_name,
      username: s.username,
    }));
  },

  async setResetToken(userId, token, expires) {
    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expires, userId]);
  },

  async findUserByResetToken(token) {
    const { rows } = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]);
    if (!rows[0]) return null;
    return { id: rows[0].id, email: rows[0].email, phone: rows[0].phone, passwordHash: rows[0].password_hash };
  },

  async updatePassword(userId, passwordHash) {
    await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2', [passwordHash, userId]);
  },

  async deleteUser(id) {
    // Delete in order to respect foreign key constraints
    await pool.query('DELETE FROM schedule WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM personal_bests WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM session_entries WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)', [id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM template_exercises WHERE template_id IN (SELECT id FROM templates WHERE user_id = $1)', [id]);
    await pool.query('DELETE FROM templates WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM programs WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM metrics WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  },

  async findUserById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!rows[0]) return null;
    return { id: rows[0].id, email: rows[0].email, phone: rows[0].phone, passwordHash: rows[0].password_hash };
  },

  async findUserByUsername(username) {
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  },

  async findUserByIdentifier(identifier) {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $1',
      [identifier]
    );
    if (!rows[0]) return null;
    const u = rows[0];
    return { id: u.id, email: u.email, phone: u.phone, passwordHash: u.password_hash, firstName: u.first_name, lastName: u.last_name, username: u.username, plan: u.plan || 'Free', createdAt: u.created_at };
  },

  async createUser({ email, phone, passwordHash, firstName, lastName, gender, username, referralSource, referralCode, zipCode, signupCity, signupState, signupDevice, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }) {
    const { rows } = await pool.query(
      `INSERT INTO users (email, phone, password_hash, first_name, last_name, gender, username, referral_source, referral_code, zip_code, signup_city, signup_state, signup_device, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [email || null, phone || null, passwordHash, firstName || null, lastName || null, gender || null, username || null, referralSource || null, referralCode || null, zipCode || null, signupCity || null, signupState || null, signupDevice || null, utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null, utmTerm || null]
    );
    const u = rows[0];
    return { id: u.id, email: u.email, phone: u.phone, passwordHash: u.password_hash, firstName: u.first_name, lastName: u.last_name, gender: u.gender, username: u.username, referralSource: u.referral_source, referralCode: u.referral_code, zipCode: u.zip_code, signupCity: u.signup_city, signupState: u.signup_state, signupDevice: u.signup_device, utmSource: u.utm_source, utmMedium: u.utm_medium, utmCampaign: u.utm_campaign, utmContent: u.utm_content, utmTerm: u.utm_term, createdAt: u.created_at };
  },

  // Programs
  async getPrograms(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM programs WHERE user_id IS NULL OR user_id = $1 ORDER BY id',
      [userId]
    );
    return rows.map((p) => ({ id: p.id, userId: p.user_id, name: p.name, description: p.description || '', createdAt: p.created_at }));
  },

  async createProgram(userId, name, description = '') {
    const { rows } = await pool.query(
      'INSERT INTO programs (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, description]
    );
    const p = rows[0];
    return { id: p.id, userId: p.user_id, name: p.name, description: p.description || '', createdAt: p.created_at };
  },

  async updateProgram(programId, name) {
    const { rows } = await pool.query(
      'UPDATE programs SET name = $1 WHERE id = $2 RETURNING *',
      [name, programId]
    );
    if (!rows[0]) return null;
    const p = rows[0];
    return { id: p.id, userId: p.user_id, name: p.name, description: p.description || '', createdAt: p.created_at };
  },

  async deleteProgram(programId) {
    const { rowCount } = await pool.query('DELETE FROM programs WHERE id = $1', [programId]);
    return rowCount > 0;
  },

  async deleteTemplate(templateId) {
    const { rowCount } = await pool.query('DELETE FROM templates WHERE id = $1', [templateId]);
    return rowCount > 0;
  },

  async reorderTemplates(programId, orderedIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(
          'UPDATE templates SET sort_order = $1 WHERE id = $2 AND program_id = $3',
          [i, orderedIds[i], programId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Templates
  async getTemplates(userId) {
    // Get all templates visible to this user
    const { rows: templates } = await pool.query(
      'SELECT * FROM templates WHERE user_id IS NULL OR user_id = $1 ORDER BY sort_order',
      [userId]
    );

    if (templates.length === 0) return [];

    // Get all exercises for these templates
    const templateIds = templates.map((t) => t.id);
    const { rows: exercises } = await pool.query(
      `SELECT * FROM template_exercises WHERE template_id = ANY($1) ORDER BY sort_order, set_number`,
      [templateIds]
    );

    // Group exercises by template
    const exercisesByTemplate = new Map();
    for (const ex of exercises) {
      if (!exercisesByTemplate.has(ex.template_id)) exercisesByTemplate.set(ex.template_id, []);
      exercisesByTemplate.get(ex.template_id).push(ex);
    }

    return templates.map((t) => {
      const tExercises = exercisesByTemplate.get(t.id) || [];
      const grouped = [];
      const seen = new Map();
      for (const ex of tExercises) {
        if (!seen.has(ex.name)) {
          seen.set(ex.name, grouped.length);
          grouped.push({ name: ex.name, setType: ex.set_type || 'straight', sortOrder: ex.sort_order, repRange: ex.rep_range || '', sets: [] });
        }
        grouped[seen.get(ex.name)].sets.push({
          setNumber: ex.set_number,
          plannedReps: ex.planned_reps,
          suggestedWeight: Number(ex.suggested_weight),
        });
      }

      return {
        id: t.id,
        programId: t.program_id,
        name: t.name,
        description: t.description,
        isRest: t.is_rest,
        sortOrder: t.sort_order,
        exercises: grouped,
      };
    });
  },

  async updateTemplate(templateId, name, description, exercises) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'UPDATE templates SET name = $1, description = $2 WHERE id = $3 RETURNING *',
        [name, description, templateId]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      // Remove old exercises
      await client.query('DELETE FROM template_exercises WHERE template_id = $1', [templateId]);

      // Insert new exercises
      if (exercises) {
        for (let sortOrder = 0; sortOrder < exercises.length; sortOrder++) {
          const ex = exercises[sortOrder];
          const sets = ex.sets || [{ reps: 10, weight: 0 }];
          const setType = ex.setType || 'straight';
          for (let i = 0; i < sets.length; i++) {
            await client.query(
              'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [templateId, ex.name, setType, i + 1, sets[i].reps || 10, sets[i].weight || 0, sortOrder]
            );
          }
        }
      }

      await client.query('COMMIT');
      return { id: templateId, name, description };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async createTemplate(userId, name, description, exercises, programId, isRest) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get next sortOrder for this program
      const { rows: orderRows } = await client.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM templates WHERE program_id = $1',
        [programId || null]
      );
      const sortOrder = orderRows[0].next_order;

      const { rows } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [userId, programId || null, name, description || '', isRest || false, sortOrder]
      );
      const templateId = rows[0].id;

      if (exercises) {
        for (let exSortOrder = 0; exSortOrder < exercises.length; exSortOrder++) {
          const ex = exercises[exSortOrder];
          const sets = ex.sets || [{ reps: 10, weight: 0 }];
          const setType = ex.setType || 'straight';
          for (let i = 0; i < sets.length; i++) {
            await client.query(
              'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [templateId, ex.name, setType, i + 1, sets[i].reps || 10, sets[i].weight || 0, exSortOrder]
            );
          }
        }
      }

      await client.query('COMMIT');
      return { id: templateId, name, description };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Schedule
  async getSchedule(userId) {
    const { rows } = await pool.query(
      `SELECT sd.day_of_week, sd.template_id, t.name AS template_name, t.is_rest
       FROM schedule_days sd
       LEFT JOIN templates t ON t.id = sd.template_id
       WHERE sd.user_id = $1
       ORDER BY sd.day_of_week`,
      [userId]
    );
    return rows.map((r) => ({
      dayOfWeek: r.day_of_week,
      templateId: r.template_id,
      templateName: r.template_name || 'Unknown',
      isRest: r.is_rest || false,
    }));
  },

  async setDefaultSchedule(_userId) {
    // New users start with a blank schedule
  },

  async updateSchedule(userId, schedule) {
    for (const day of schedule) {
      // Try to update existing, insert if not found
      const { rowCount } = await pool.query(
        'UPDATE schedule_days SET template_id = $1 WHERE user_id = $2 AND day_of_week = $3',
        [day.templateId, userId, day.dayOfWeek]
      );
      if (rowCount === 0) {
        await pool.query(
          'INSERT INTO schedule_days (user_id, day_of_week, template_id) VALUES ($1, $2, $3)',
          [userId, day.dayOfWeek, day.templateId]
        );
      }
    }
  },

  // Sessions
  async createSession(userId, templateId, date, entries, notes) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Reuse existing session for same workout+date, or create a new one
      const { rows: existing } = await client.query(
        'SELECT id FROM sessions WHERE user_id = $1 AND template_id = $2 AND date = $3',
        [userId, templateId, date]
      );

      let sessionId;
      if (existing.length > 0) {
        sessionId = existing[0].id;
        await client.query('DELETE FROM session_entries WHERE session_id = $1', [sessionId]);
        await client.query('UPDATE sessions SET notes = $1 WHERE id = $2', [JSON.stringify(notes || {}), sessionId]);
      } else {
        const { rows: sessionRows } = await client.query(
          'INSERT INTO sessions (user_id, template_id, date, notes) VALUES ($1, $2, $3, $4) RETURNING id',
          [userId, templateId, date, JSON.stringify(notes || {})]
        );
        sessionId = sessionRows[0].id;
      }

      // Track best reps per exercise per weight
      const bestRepsAtWeight = new Map();

      for (const entry of entries) {
        await client.query(
          'INSERT INTO session_entries (session_id, exercise_name, set_number, weight, reps) VALUES ($1, $2, $3, $4, $5)',
          [sessionId, entry.exerciseName, entry.setNumber, entry.weight || 0, entry.reps || 0]
        );

        const w = entry.weight || 0;
        const r = entry.reps || 0;
        if (w > 0 && r > 0) {
          const key = `${entry.exerciseName}::${w}`;
          const current = bestRepsAtWeight.get(key);
          if (!current || r > current.reps) {
            bestRepsAtWeight.set(key, { exerciseName: entry.exerciseName, weight: w, reps: r });
          }
        }
      }

      // Update PBs — one record per exercise per weight
      for (const [, best] of bestRepsAtWeight) {
        const { rows: existingPBs } = await client.query(
          'SELECT * FROM personal_bests WHERE user_id = $1 AND template_id = $2 AND exercise_name = $3 AND best_weight = $4',
          [userId, templateId, best.exerciseName, best.weight]
        );

        if (existingPBs.length > 0) {
          const existing = existingPBs[0];
          if (best.reps > existing.best_reps) {
            await client.query(
              'UPDATE personal_bests SET best_reps = $1, achieved_at = NOW() WHERE id = $2',
              [best.reps, existing.id]
            );
          }
        } else {
          await client.query(
            'INSERT INTO personal_bests (user_id, template_id, exercise_name, best_weight, best_reps) VALUES ($1, $2, $3, $4, $5)',
            [userId, templateId, best.exerciseName, best.weight, best.reps]
          );
        }
      }

      await client.query('COMMIT');
      return { id: sessionId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getSessions(userId) {
    const { rows } = await pool.query(
      `SELECT s.id, s.date, s.template_id, s.created_at, COALESCE(t.name, 'Unknown') AS template_name
       FROM sessions s
       LEFT JOIN templates t ON t.id = s.template_id
       WHERE s.user_id = $1
       ORDER BY s.date DESC, s.created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      templateId: r.template_id,
      createdAt: r.created_at,
      templateName: r.template_name,
    }));
  },

  async getSession(userId, sessionId) {
    const { rows: sessionRows } = await pool.query(
      `SELECT s.id, s.date, s.template_id, s.created_at, COALESCE(t.name, 'Unknown') AS template_name
       FROM sessions s
       LEFT JOIN templates t ON t.id = s.template_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sessionId, userId]
    );
    if (!sessionRows[0]) return null;

    const session = sessionRows[0];
    const { rows: entries } = await pool.query(
      'SELECT * FROM session_entries WHERE session_id = $1 ORDER BY exercise_name, set_number',
      [sessionId]
    );

    return {
      id: session.id,
      date: session.date,
      templateId: session.template_id,
      createdAt: session.created_at,
      templateName: session.template_name,
      entries: entries.map((e) => ({
        id: e.id,
        sessionId: e.session_id,
        exerciseName: e.exercise_name,
        setNumber: e.set_number,
        weight: Number(e.weight),
        reps: e.reps,
      })),
    };
  },

  async getSessionByTemplateAndDate(userId, templateId, date) {
    const { rows: sessionRows } = await pool.query(
      'SELECT id, notes, completed FROM sessions WHERE user_id = $1 AND template_id = $2 AND date = $3',
      [userId, templateId, date]
    );
    if (!sessionRows[0]) return null;

    const sessionId = sessionRows[0].id;
    const sessionNotes = sessionRows[0].notes;
    const { rows: entries } = await pool.query(
      'SELECT * FROM session_entries WHERE session_id = $1 ORDER BY exercise_name, set_number',
      [sessionId]
    );

    return {
      id: sessionId,
      completed: sessionRows[0].completed || false,
      notes: typeof sessionNotes === 'string' ? JSON.parse(sessionNotes) : (sessionNotes || {}),
      entries: entries.map((e) => ({
        exerciseName: e.exercise_name,
        setNumber: e.set_number,
        weight: Number(e.weight),
        reps: e.reps,
      })),
    };
  },

  async toggleSessionComplete(userId, templateId, date, completed) {
    const { rows } = await pool.query(
      'UPDATE sessions SET completed = $1 WHERE user_id = $2 AND template_id = $3 AND date = $4 RETURNING id',
      [completed, userId, templateId, date]
    );
    return rows[0] || null;
  },

  async getCompletedSessions(userId) {
    const { rows } = await pool.query(
      "SELECT template_id, date FROM sessions WHERE user_id = $1 AND completed = TRUE",
      [userId]
    );
    return rows.map((r) => ({ templateId: r.template_id, date: r.date }));
  },

  // Personal Bests
  async getPBs(userId, templateId) {
    let query = 'SELECT * FROM personal_bests WHERE user_id = $1';
    const params = [userId];
    if (templateId) {
      query += ' AND template_id = $2';
      params.push(Number(templateId));
    }
    const { rows } = await pool.query(query, params);
    return rows.map((pb) => ({
      id: pb.id,
      userId: pb.user_id,
      templateId: pb.template_id,
      exerciseName: pb.exercise_name,
      bestWeight: Number(pb.best_weight),
      bestReps: pb.best_reps,
      achievedAt: pb.achieved_at,
    }));
  },

  // User Metrics
  async getMetrics(userId) {
    const { rows } = await pool.query('SELECT * FROM user_metrics WHERE user_id = $1', [userId]);
    if (!rows[0]) {
      return { userId, height: null, weight: null, bodyFat: null, maxBench: null, maxSquat: null, maxDeadlift: null };
    }
    const m = rows[0];
    return {
      userId: m.user_id,
      height: m.height != null ? Number(m.height) : null,
      weight: m.weight != null ? Number(m.weight) : null,
      bodyFat: m.body_fat != null ? Number(m.body_fat) : null,
      maxBench: m.max_bench != null ? Number(m.max_bench) : null,
      maxSquat: m.max_squat != null ? Number(m.max_squat) : null,
      maxDeadlift: m.max_deadlift != null ? Number(m.max_deadlift) : null,
    };
  },

  // AI usage
  async logAIUsage(userId, inputTokens, outputTokens, model, costCents) {
    await pool.query(
      'INSERT INTO ai_usage (user_id, input_tokens, output_tokens, model, cost_cents) VALUES ($1, $2, $3, $4, $5)',
      [userId, inputTokens, outputTokens, model, costCents]
    );
  },

  async getAIUsageStats() {
    const { rows: [total] } = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(input_tokens),0) as input, COALESCE(SUM(output_tokens),0) as output, COALESCE(SUM(cost_cents),0) as cost FROM ai_usage');
    const { rows: [today] } = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(cost_cents),0) as cost FROM ai_usage WHERE created_at::date = CURRENT_DATE");
    const { rows: [month] } = await pool.query("SELECT COUNT(*) as count, COALESCE(SUM(cost_cents),0) as cost FROM ai_usage WHERE created_at >= date_trunc('month', CURRENT_DATE)");
    const { rows: recent } = await pool.query(`
      SELECT a.*, u.email, u.first_name, u.last_name
      FROM ai_usage a LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT 50
    `);
    return {
      totalRequests: parseInt(total.count),
      totalInputTokens: parseInt(total.input),
      totalOutputTokens: parseInt(total.output),
      totalCostCents: parseFloat(total.cost),
      todayRequests: parseInt(today.count),
      todayCostCents: parseFloat(today.cost),
      monthRequests: parseInt(month.count),
      monthCostCents: parseFloat(month.cost),
      recent,
    };
  },

  // Feedback
  async saveFeedback(userId, type, message) {
    await pool.query('INSERT INTO feedback (user_id, type, message) VALUES ($1, $2, $3)', [userId, type, message]);
  },
  async getAllFeedback() {
    const { rows } = await pool.query(`
      SELECT f.*, u.email, u.first_name, u.last_name
      FROM feedback f LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.created_at DESC
    `);
    return rows;
  },

  // Announcements
  async getAnnouncements() {
    const { rows } = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    return rows;
  },
  async getActiveAnnouncement() {
    const { rows } = await pool.query('SELECT * FROM announcements WHERE active = TRUE ORDER BY created_at DESC LIMIT 1');
    return rows[0] || null;
  },
  async createAnnouncement(message) {
    await pool.query('UPDATE announcements SET active = FALSE');
    await pool.query('INSERT INTO announcements (message, active) VALUES ($1, TRUE)', [message]);
  },
  async deleteAnnouncement(id) {
    await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
  },
  async toggleAnnouncement(id, active) {
    await pool.query('UPDATE announcements SET active = $1 WHERE id = $2', [active, id]);
  },

  // Feature flags
  async getFeatureFlags() {
    const { rows } = await pool.query('SELECT * FROM feature_flags ORDER BY key');
    return rows;
  },
  async setFeatureFlag(key, enabled, description) {
    await pool.query(
      `INSERT INTO feature_flags (key, enabled, description) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET enabled = $2, description = $3`,
      [key, enabled, description || '']
    );
  },
  async deleteFeatureFlag(key) {
    await pool.query('DELETE FROM feature_flags WHERE key = $1', [key]);
  },

  // Retention stats
  async getRetentionStats() {
    const { rows: day1 } = await pool.query(`
      SELECT COUNT(DISTINCT s.user_id) as retained FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
      AND s.created_at::date = u.created_at::date + INTERVAL '1 day'
    `);
    const { rows: day7 } = await pool.query(`
      SELECT COUNT(DISTINCT s.user_id) as retained FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
      AND s.created_at::date BETWEEN u.created_at::date + INTERVAL '6 days' AND u.created_at::date + INTERVAL '8 days'
    `);
    const { rows: day30 } = await pool.query(`
      SELECT COUNT(DISTINCT s.user_id) as retained FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
      AND s.created_at::date BETWEEN u.created_at::date + INTERVAL '29 days' AND u.created_at::date + INTERVAL '31 days'
    `);
    const { rows: [total] } = await pool.query(`SELECT COUNT(*) FROM users WHERE email NOT LIKE '%@willfit.demo' OR email IS NULL`);
    return {
      totalUsers: parseInt(total.count),
      day1: parseInt(day1[0].retained),
      day7: parseInt(day7[0].retained),
      day30: parseInt(day30[0].retained),
    };
  },

  // Active users
  async getActiveUsers() {
    const { rows: [day1] } = await pool.query(`
      SELECT COUNT(DISTINCT s.user_id) as count FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
      AND s.created_at >= NOW() - INTERVAL '1 day'
    `);
    const { rows: [day7] } = await pool.query(`
      SELECT COUNT(DISTINCT s.user_id) as count FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
      AND s.created_at >= NOW() - INTERVAL '7 days'
    `);
    const { rows: [day30] } = await pool.query(`
      SELECT COUNT(DISTINCT s.user_id) as count FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
      AND s.created_at >= NOW() - INTERVAL '30 days'
    `);
    const { rows: recentUsers } = await pool.query(`
      SELECT DISTINCT ON (s.user_id) s.user_id, u.email, u.first_name, u.last_name, s.created_at as last_session
      FROM sessions s JOIN users u ON s.user_id = u.id
      WHERE (u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)
      AND s.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY s.user_id, s.created_at DESC
    `);
    return {
      last24h: parseInt(day1.count),
      last7d: parseInt(day7.count),
      last30d: parseInt(day30.count),
      recentUsers,
    };
  },

  // Referral breakdown
  async getReferralBreakdown() {
    const { rows } = await pool.query(`
      SELECT COALESCE(referral_source, 'Unknown') as source, COUNT(*) as count
      FROM users WHERE email NOT LIKE '%@willfit.demo' OR email IS NULL
      GROUP BY COALESCE(referral_source, 'Unknown')
      ORDER BY count DESC
    `);
    return rows;
  },

  // Device breakdown
  async getDeviceBreakdown() {
    const { rows } = await pool.query(`
      SELECT COALESCE(signup_device, 'Unknown') as device, COUNT(*) as count
      FROM users WHERE email NOT LIKE '%@willfit.demo' OR email IS NULL
      GROUP BY COALESCE(signup_device, 'Unknown')
      ORDER BY count DESC
    `);
    return rows;
  },

  // Exercise library
  async getExercises(userId, { search, muscle, limit } = {}) {
    let query = 'SELECT * FROM exercises WHERE (created_by IS NULL OR created_by = $1)';
    const params = [userId];
    let paramIdx = 2;

    if (muscle) {
      query += ` AND muscle_group = $${paramIdx}`;
      params.push(muscle);
      paramIdx++;
    }

    if (search) {
      query += ` AND name ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    query += ' ORDER BY is_custom ASC, name ASC';

    if (limit) {
      query += ` LIMIT $${paramIdx}`;
      params.push(limit);
    }

    const { rows } = await pool.query(query, params);
    return rows.map(e => ({
      id: e.id,
      name: e.name,
      muscle: e.muscle_group,
      tags: e.tags || [],
      isCustom: e.is_custom,
      createdBy: e.created_by,
    }));
  },

  async createExercise(userId, name, muscleGroup, tags = []) {
    // Check for existing first
    const existing = await this.findExerciseByName(name, userId);
    if (existing) return existing;

    const { rows } = await pool.query(
      `INSERT INTO exercises (name, muscle_group, tags, is_custom, created_by)
       VALUES ($1, $2, $3, TRUE, $4) RETURNING *`,
      [name, muscleGroup, tags, userId]
    );
    const e = rows[0];
    return { id: e.id, name: e.name, muscle: e.muscle_group, tags: e.tags, isCustom: true, createdBy: e.created_by };
  },

  async findExerciseByName(name, userId) {
    const { rows } = await pool.query(
      'SELECT * FROM exercises WHERE LOWER(name) = LOWER($1) AND (created_by IS NULL OR created_by = $2) LIMIT 1',
      [name, userId]
    );
    if (!rows[0]) return null;
    const e = rows[0];
    return { id: e.id, name: e.name, muscle: e.muscle_group, tags: e.tags || [], isCustom: e.is_custom, createdBy: e.created_by };
  },

  async getMuscleGroups() {
    const { rows } = await pool.query('SELECT DISTINCT muscle_group FROM exercises ORDER BY muscle_group');
    return rows.map(r => r.muscle_group);
  },

  // Workout library (all programs with template counts)
  async getWorkoutLibrary() {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.description, p.user_id,
        COUNT(t.id) as template_count,
        p.created_at
      FROM programs p
      LEFT JOIN templates t ON t.program_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at
    `);
    return rows;
  },

  async updateMetrics(userId, metrics) {
    await pool.query(
      `INSERT INTO user_metrics (user_id, height, weight, body_fat, max_bench, max_squat, max_deadlift, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         height = $2, weight = $3, body_fat = $4, max_bench = $5, max_squat = $6, max_deadlift = $7, updated_at = NOW()`,
      [userId, metrics.height, metrics.weight, metrics.bodyFat, metrics.maxBench, metrics.maxSquat, metrics.maxDeadlift]
    );
    return this.getMetrics(userId);
  },
};

export default db;
