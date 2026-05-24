import pool from './dbPool.js';
import crypto from 'crypto';

// Password reset tokens are high-entropy random strings. We hash them with
// SHA-256 before storing so a DB leak can't be used to reset any account.
// SHA-256 (not bcrypt) is correct here because the underlying token is already
// 256 bits of randomness, and deterministic hashing lets us index the lookup.
function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// Look up master `exercises.id` for a batch of names. Returns Map of
// lowercase-name → id, with null entries for names that didn't resolve.
// Filters by `(created_by IS NULL OR created_by = $userId)` so custom
// exercises stay private — user A's custom never resolves for user B.
// Pass userId so customs can be matched; pass null/undefined to skip the
// user-scope check (admin / global contexts).
async function resolveExerciseIdsForNames(client, names, userId) {
  const out = new Map();
  if (!names || names.length === 0) return out;
  const distinct = [...new Set(names.filter(Boolean).map((n) => String(n).trim()))];
  if (distinct.length === 0) return out;
  const userClause = userId
    ? 'AND (created_by IS NULL OR created_by = $2)'
    : 'AND created_by IS NULL';
  const params = userId ? [distinct.map((n) => n.toLowerCase()), userId] : [distinct.map((n) => n.toLowerCase())];
  // DISTINCT ON keeps one row per lowercase-name when colliding rows still
  // exist (shouldn't post-Path-A, but defensive). Prefers master library
  // (created_by IS NULL) over the user's own customs on collision.
  const { rows } = await client.query(
    `SELECT DISTINCT ON (LOWER(name)) LOWER(name) AS lname, id
       FROM exercises
       WHERE LOWER(name) = ANY($1::text[]) ${userClause}
       ORDER BY LOWER(name), CASE WHEN created_by IS NULL THEN 0 ELSE 1 END, id ASC`,
    params
  );
  for (const r of rows) out.set(r.lname, r.id);
  for (const n of distinct) {
    const k = n.toLowerCase();
    if (!out.has(k)) out.set(k, null);
  }
  return out;
}

async function batchInsertTemplateExercises(client, templateId, exercises, userId) {
  // Resolve every distinct name once up front so the batch INSERT can
  // dual-write exercise_id. Names that don't resolve (a custom the user
  // hasn't created yet, or a typo) get exercise_id = NULL — schema allows
  // it and old read paths still work via the name column.
  const names = exercises
    .filter((ex) => !ex.isSectionHeader)
    .map((ex) => ex.name);
  const idByName = await resolveExerciseIdsForNames(client, names, userId);
  const idFor = (name) => idByName.get(String(name).trim().toLowerCase()) ?? null;

  const values = [];
  const params = [];
  let paramIdx = 1;
  for (let sortOrder = 0; sortOrder < exercises.length; sortOrder++) {
    const ex = exercises[sortOrder];
    if (ex.isSectionHeader) {
      // Section headers carry exercise_id = NULL — `name` is a section label.
      values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9})`);
      params.push(templateId, null, ex.name, 'straight', 1, 0, 0, sortOrder, true, ex.sectionNotes || '');
      paramIdx += 10;
      continue;
    }
    const sets = ex.sets || [{ reps: 10, weight: 0 }];
    const setType = ex.setType || 'straight';
    const resolvedId = idFor(ex.name);
    for (let i = 0; i < sets.length; i++) {
      values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9})`);
      params.push(templateId, resolvedId, ex.name, setType, i + 1, sets[i].reps || 10, sets[i].weight || 0, sortOrder, false, '');
      paramIdx += 10;
    }
  }
  if (values.length > 0) {
    await client.query(
      `INSERT INTO template_exercises (template_id, exercise_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ${values.join(', ')}`,
      params
    );
  }
}

// Sync the structural exercise list of a session into `template_exercises`
// — but ONLY when:
//   1. The template is owned by `userId` (user_id matches; never library/global)
//   2. The template currently has ZERO rows in `template_exercises`
//
// This makes "Start Empty Workout" templates show up as real, runnable
// workouts in My Workouts once the user has actually populated the session.
// After the first save, the template gains its initial exercise list and is
// no longer empty — subsequent saves are no-ops because the empty-check
// fails. If the user later edits the template via the template editor, those
// edits stick because we only seed when empty.
//
// Must run inside an existing transaction (`client` already has BEGIN) so a
// rollback of the session save also rolls back the template seed. Best-effort:
// the caller should swallow errors — the session is the source of truth.
async function syncEmptyTemplateFromWorkoutData(client, userId, templateId, workoutData) {
  if (!templateId || !workoutData || !Array.isArray(workoutData.exercises)) return;

  // Combined ownership + emptiness check in one round-trip. Returns a row
  // iff the template is owned by this user AND has no template_exercises
  // rows. user_id IS NOT NULL excludes library templates defensively.
  const { rows } = await client.query(
    `SELECT t.id
       FROM templates t
      WHERE t.id = $1
        AND t.user_id = $2
        AND NOT EXISTS (
          SELECT 1 FROM template_exercises te WHERE te.template_id = t.id
        )`,
    [templateId, userId]
  );
  if (rows.length === 0) return;

  // Translate workoutData.exercises (sets carry plannedReps / suggestedWeight)
  // into the shape batchInsertTemplateExercises expects (sets carry reps /
  // weight). Section headers pass straight through — the helper already
  // handles isSectionHeader rows.
  const normalized = workoutData.exercises.map((ex) => {
    if (ex && ex.isSectionHeader) {
      return {
        name: ex.name,
        isSectionHeader: true,
        sectionNotes: ex.sectionNotes || '',
      };
    }
    const sets = Array.isArray(ex && ex.sets) ? ex.sets : [];
    return {
      name: ex && ex.name,
      setType: (ex && ex.setType) || 'straight',
      sets: sets.map((s) => ({
        reps: s && s.plannedReps != null ? s.plannedReps : 10,
        // Seed the template's suggestedWeight from whatever weight the user
        // logged in this first session — gives a sensible starting point
        // when they re-run this workout.
        weight: s && s.suggestedWeight != null ? s.suggestedWeight : 0,
      })),
    };
  }).filter((ex) => ex && typeof ex.name === 'string' && ex.name.trim());

  if (normalized.length === 0) return;

  await batchInsertTemplateExercises(client, templateId, normalized, userId);
}

// Wipe-and-rebuild PB rows for one (user, template) using whatever
// session_entries currently exist across that user's sessions for the
// template. Called inside an existing transaction (`client` must already
// have BEGIN issued) after a destructive overwrite. The PB upsert path
// elsewhere only ratchets PBs up via GREATEST, so without this rebuild a
// destructive overwrite would leave stale rows pointing at deleted entries.
//
// Limitation: session_entries does not store set_type, so we can't filter
// out drop-sets / rest-pause sets at recompute time. The original insert
// path skipped non-straight sets when computing best-rep PBs from in-memory
// entries; here we use whatever survives in DB. In practice the only
// callers writing non-straight sets are inside the same session that gets
// overwritten, so the loss is negligible.
async function rebuildPBsForTemplateOnClient(client, userId, templateId) {
  await client.query(
    'DELETE FROM personal_bests WHERE user_id = $1 AND template_id = $2',
    [userId, templateId]
  );

  // For each (exercise_name, weight) tuple across surviving sessions for
  // this user+template, find the max reps. That tuple becomes the PB row.
  // Only completed sets count as PRs — planned/pre-filled sets are
  // explicitly excluded (is_completed=FALSE) so a user writing down their
  // plan ahead of time can't accidentally set a PR they didn't actually lift.
  // MAX(se.exercise_id) FILTER (WHERE not null) picks any non-null id for
  // each (name, weight) group — they should all be the same id post-Path-A,
  // but MAX is defensive against any rows that have NULL.
  const { rows } = await client.query(
    `SELECT se.exercise_name AS exercise_name,
            MAX(se.exercise_id) AS exercise_id,
            se.weight AS best_weight,
            MAX(se.reps) AS best_reps
       FROM session_entries se
       JOIN sessions s ON s.id = se.session_id
      WHERE s.user_id = $1
        AND s.template_id = $2
        AND se.weight > 0
        AND se.reps > 0
        AND se.is_completed = TRUE
      GROUP BY se.exercise_name, se.weight`,
    [userId, templateId]
  );

  if (rows.length === 0) return;

  const values = [];
  const params = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const off = i * 6;
    values.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5}, $${off + 6})`);
    params.push(userId, templateId, r.exercise_id ?? null, r.exercise_name, r.best_weight, r.best_reps);
  }
  await client.query(
    `INSERT INTO personal_bests (user_id, template_id, exercise_id, exercise_name, best_weight, best_reps)
     VALUES ${values.join(', ')}`,
    params
  );
}

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
      `SELECT id, email, phone, first_name, last_name, gender, username, role, plan, trial_end, referral_source, referral_code, zip_code, signup_city, signup_state, signup_device, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at FROM users
       WHERE email NOT LIKE '%@willfit.demo' OR email IS NULL
       ORDER BY created_at DESC
       LIMIT 500`
    );
    const now = new Date();
    return rows.map((u) => {
      const trialEnd = u.trial_end ? new Date(u.trial_end) : null;
      const inTrial = trialEnd && trialEnd > now;
      const daysLeft = inTrial ? Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) : null;
      return { id: u.id, email: u.email, phone: u.phone, firstName: u.first_name, lastName: u.last_name, gender: u.gender, username: u.username, role: u.role || 'client', plan: u.plan || 'Free', freeTrial: inTrial ? 'Active' : 'No', trialDaysLeft: daysLeft != null ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : '—', referralSource: u.referral_source, referralCode: u.referral_code, zipCode: u.zip_code, signupCity: u.signup_city, signupState: u.signup_state, signupDevice: u.signup_device, utmSource: u.utm_source, utmMedium: u.utm_medium, utmCampaign: u.utm_campaign, utmContent: u.utm_content, utmTerm: u.utm_term, createdAt: u.created_at };
    });
  },

  async getTrainersWithStatus() {
    const { rows } = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.username, u.plan, u.role, u.created_at,
              ta.id AS application_id, ta.status AS application_status, ta.created_at AS applied_at
       FROM users u
       LEFT JOIN trainer_applications ta ON ta.user_id = u.id
       WHERE u.role = 'trainer' OR ta.id IS NOT NULL
       ORDER BY COALESCE(ta.created_at, u.created_at) DESC`
    );
    return rows.map((u) => ({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      phone: u.phone,
      username: u.username,
      plan: u.plan || 'Free',
      role: u.role || 'client',
      applicationId: u.application_id || null,
      trainerStatus: u.role === 'trainer' && !u.application_status ? 'approved'
        : u.application_status || 'pending',
      appliedAt: u.applied_at,
      createdAt: u.created_at,
    }));
  },

  async getDailyStats(startDate, endDate) {
    const start = startDate || new Date().toISOString().slice(0, 10);
    const end = endDate || start;
    // Comparison period: same length range immediately before
    const rangeMs = new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime() + 86400000;
    const prevEnd = new Date(new Date(start + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
    const prevStart = new Date(new Date(start + 'T00:00:00Z').getTime() - rangeMs).toISOString().slice(0, 10);

    const notDemo = `(email NOT LIKE '%@willfit.demo' OR email IS NULL)`;
    const notDemoU = `(u.email NOT LIKE '%@willfit.demo' OR u.email IS NULL)`;

    const { rows: [totalRow] } = await pool.query(
      `SELECT COUNT(*) FROM users WHERE ${notDemo}`
    );
    const { rows: [currentUsers] } = await pool.query(
      `SELECT COUNT(*) FROM users WHERE ${notDemo} AND created_at::date BETWEEN $1 AND $2`, [start, end]
    );
    const { rows: [prevUsers] } = await pool.query(
      `SELECT COUNT(*) FROM users WHERE ${notDemo} AND created_at::date BETWEEN $1 AND $2`, [prevStart, prevEnd]
    );
    const { rows: [currentSessions] } = await pool.query(
      `SELECT COUNT(*) FROM sessions s JOIN users u ON s.user_id = u.id WHERE ${notDemoU} AND s.created_at::date BETWEEN $1 AND $2`, [start, end]
    );
    const { rows: [prevSessions] } = await pool.query(
      `SELECT COUNT(*) FROM sessions s JOIN users u ON s.user_id = u.id WHERE ${notDemoU} AND s.created_at::date BETWEEN $1 AND $2`, [prevStart, prevEnd]
    );
    const { rows: [activeRow] } = await pool.query(
      `SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON s.user_id = u.id WHERE ${notDemoU} AND s.created_at::date BETWEEN $1 AND $2`, [start, end]
    );
    const { rows: [activePrevRow] } = await pool.query(
      `SELECT COUNT(DISTINCT s.user_id) FROM sessions s JOIN users u ON s.user_id = u.id WHERE ${notDemoU} AND s.created_at::date BETWEEN $1 AND $2`, [prevStart, prevEnd]
    );
    const { rows: recentSignups } = await pool.query(
      `SELECT first_name, last_name, email, phone, signup_city, signup_state, created_at FROM users WHERE ${notDemo} AND created_at::date BETWEEN $1 AND $2 ORDER BY created_at DESC`, [start, end]
    );

    return {
      totalUsers: parseInt(totalRow.count),
      newUsersCurrent: parseInt(currentUsers.count),
      newUsersPrev: parseInt(prevUsers.count),
      workoutsCurrent: parseInt(currentSessions.count),
      workoutsPrev: parseInt(prevSessions.count),
      activeUsersCurrent: parseInt(activeRow.count),
      activeUsersPrev: parseInt(activePrevRow.count),
      recentSignups,
      prevStart, prevEnd,
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

  async setResetToken(userId, token, expires, requestIp = null, userAgent = null) {
    const tokenHash = hashResetToken(token);
    await pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [tokenHash, expires, userId]);
    // Audit: one row per request. used_at stays NULL until the token is consumed.
    await pool.query(
      `INSERT INTO password_reset_log (user_id, token_hash, request_ip, user_agent) VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, requestIp, userAgent]
    ).catch(() => { /* logging failure must not block reset flow */ });
  },

  async findUserByResetToken(token) {
    const tokenHash = hashResetToken(token);
    const { rows } = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [tokenHash]);
    if (!rows[0]) return null;
    return { id: rows[0].id, email: rows[0].email, phone: rows[0].phone, passwordHash: rows[0].password_hash, tokenVersion: rows[0].token_version ?? 0 };
  },

  async markResetTokenUsed(token, useIp = null) {
    // Mark the most recent unused log row for this token as used.
    // No-op if no matching row (e.g. log table didn't exist when the token
    // was issued).
    const tokenHash = hashResetToken(token);
    await pool.query(
      `UPDATE password_reset_log
         SET used_at = NOW(), use_ip = $2
       WHERE id = (
         SELECT id FROM password_reset_log
          WHERE token_hash = $1 AND used_at IS NULL
          ORDER BY requested_at DESC LIMIT 1
       )`,
      [tokenHash, useIp]
    ).catch(() => { /* never block the reset flow on audit-log failure */ });
  },

  // ---- Account deletion confirmation tokens (web /delete-account flow) ----
  // Same hash-and-store discipline as the reset token: the raw token only
  // lives in the email link; the DB only holds the SHA-256 so a leak can't
  // be replayed.
  async createAccountDeletionToken(userId, token, expires, requestIp = null) {
    const tokenHash = hashResetToken(token);
    await pool.query(
      `INSERT INTO account_deletion_tokens (user_id, token_hash, expires_at, request_ip)
       VALUES ($1, $2, $3, $4)`,
      [userId, tokenHash, expires, requestIp]
    );
  },

  async findAccountDeletionToken(token) {
    const tokenHash = hashResetToken(token);
    const { rows } = await pool.query(
      `SELECT id, user_id, expires_at, used_at FROM account_deletion_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  async markAccountDeletionTokenUsed(tokenId) {
    await pool.query(
      `UPDATE account_deletion_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenId]
    ).catch(() => { /* never block the deletion flow on audit-log failure */ });
  },

  async updatePassword(userId, passwordHash) {
    // Bump token_version so every JWT issued before this reset becomes invalid.
    // authMiddleware compares the JWT's tokenVersion to the user's current one.
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, token_version = token_version + 1 WHERE id = $2',
      [passwordHash, userId]
    );
  },

  async bumpTokenVersion(userId) {
    // Invalidate every access AND refresh JWT previously issued for this user.
    // Used by /auth/logout so a logged-out device's cached refresh token can no
    // longer mint new access tokens. Same mechanism updatePassword uses.
    await pool.query(
      'UPDATE users SET token_version = token_version + 1 WHERE id = $1',
      [userId]
    );
  },

  async deleteUser(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Delete in order to respect foreign key constraints.
      // shared_programs is explicit (not CASCADE) because its FK constraints
      // in initDb.js don't set ON DELETE CASCADE. Without this, deleted
      // users would leave orphaned share records — a GDPR erasure breach.
      await client.query('DELETE FROM shared_programs WHERE sender_id = $1 OR recipient_id = $1', [id]);
      await client.query('DELETE FROM feedback WHERE user_id = $1', [id]);
      await client.query('DELETE FROM trainer_login_history WHERE user_id = $1', [id]);
      await client.query('DELETE FROM challenge_entries WHERE user_id = $1', [id]);
      await client.query('DELETE FROM schedule_days WHERE user_id = $1', [id]);
      await client.query('DELETE FROM personal_bests WHERE user_id = $1', [id]);
      await client.query('DELETE FROM session_entries WHERE session_id IN (SELECT id FROM sessions WHERE user_id = $1)', [id]);
      await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      await client.query('DELETE FROM template_exercises WHERE template_id IN (SELECT id FROM templates WHERE user_id = $1)', [id]);
      await client.query('DELETE FROM templates WHERE user_id = $1', [id]);
      await client.query('DELETE FROM programs WHERE user_id = $1', [id]);
      await client.query('DELETE FROM user_metrics WHERE user_id = $1', [id]);
      await client.query('DELETE FROM ai_usage WHERE user_id = $1', [id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async findUserById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!rows[0]) return null;
    const u = rows[0];
    return { id: u.id, accountId: u.account_id ?? null, email: u.email, phone: u.phone, passwordHash: u.password_hash, firstName: u.first_name, lastName: u.last_name, username: u.username, role: u.role || 'client', plan: u.plan || 'Free', trialEnd: u.trial_end || null, profilePhoto: u.profile_photo || null, timezone: u.timezone || 'UTC', tokenVersion: u.token_version ?? 0 };
  },

  async findUserByUsername(username) {
    const { rows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  },

  async findUserByIdentifier(identifier) {
    // Match by email, phone, or username (case-insensitive on username
    // since LOWER() normalizes stored value; route lowercases input).
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR phone = $1 OR LOWER(username) = $1',
      [identifier]
    );
    if (!rows[0]) return null;
    const u = rows[0];
    return { id: u.id, accountId: u.account_id ?? null, email: u.email, phone: u.phone, passwordHash: u.password_hash, firstName: u.first_name, lastName: u.last_name, username: u.username, role: u.role || 'client', plan: u.plan || 'Free', trialEnd: u.trial_end || null, profilePhoto: u.profile_photo || null, timezone: u.timezone || 'UTC', createdAt: u.created_at, tokenVersion: u.token_version ?? 0 };
  },

  async createUser({ email, phone, passwordHash, firstName, lastName, gender, username, referralSource, referralCode, zipCode, timezone, signupCity, signupState, signupDevice, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }) {
    const { rows } = await pool.query(
      `INSERT INTO users (email, phone, password_hash, first_name, last_name, gender, username, referral_source, referral_code, zip_code, timezone, signup_city, signup_state, signup_device, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [email || null, phone || null, passwordHash, firstName || null, lastName || null, gender || null, username || null, referralSource || null, referralCode || null, zipCode || null, timezone || 'UTC', signupCity || null, signupState || null, signupDevice || null, utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null, utmTerm || null]
    );
    const u = rows[0];
    return { id: u.id, email: u.email, phone: u.phone, passwordHash: u.password_hash, firstName: u.first_name, lastName: u.last_name, gender: u.gender, username: u.username, role: u.role || 'client', referralSource: u.referral_source, referralCode: u.referral_code, zipCode: u.zip_code, timezone: u.timezone || 'UTC', signupCity: u.signup_city, signupState: u.signup_state, signupDevice: u.signup_device, utmSource: u.utm_source, utmMedium: u.utm_medium, utmCampaign: u.utm_campaign, utmContent: u.utm_content, utmTerm: u.utm_term, createdAt: u.created_at, tokenVersion: u.token_version ?? 0 };
  },

  // Programs
  async getPrograms(userId) {
    // LEFT JOIN against program_name_abbreviations so callers can use the
    // short display name without a second round-trip. Programs without a
    // matching abbreviation row get short_name = NULL and the client falls
    // back to the full name.
    const { rows } = await pool.query(
      `SELECT p.*, pna.short_name AS short_name
         FROM programs p
         LEFT JOIN program_name_abbreviations pna ON pna.full_name = p.name
        WHERE p.user_id IS NULL OR p.user_id = $1
        ORDER BY p.sort_order, p.id`,
      [userId]
    );
    return rows.map((p) => ({ id: p.id, userId: p.user_id, name: p.name, shortName: p.short_name || null, description: p.description || '', sortOrder: p.sort_order || 0, programType: p.program_type || 'other', isFeatured: p.is_featured || false, cardioAccelerationEnabled: !!p.cardio_acceleration_enabled, programDetails: p.program_details || null, createdAt: p.created_at }));
  },

  async createProgram(userId, name, description = '') {
    const { rows } = await pool.query(
      'INSERT INTO programs (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, description]
    );
    const p = rows[0];
    return { id: p.id, userId: p.user_id, name: p.name, description: p.description || '', createdAt: p.created_at };
  },

  async updateProgram(userId, programId, name) {
    const { rows } = await pool.query(
      'UPDATE programs SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name, programId, userId]
    );
    if (!rows[0]) return null;
    const p = rows[0];
    return { id: p.id, userId: p.user_id, name: p.name, description: p.description || '', createdAt: p.created_at };
  },

  async deleteProgram(userId, programId) {
    const { rowCount } = await pool.query('DELETE FROM programs WHERE id = $1 AND user_id = $2', [programId, userId]);
    return rowCount > 0;
  },

  async deleteTemplate(userId, templateId) {
    const { rowCount } = await pool.query('DELETE FROM templates WHERE id = $1 AND user_id = $2', [templateId, userId]);
    return rowCount > 0;
  },

  async reorderTemplates(userId, programId, orderedIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Verify program ownership
      const { rows: progRows } = await client.query('SELECT id FROM programs WHERE id = $1 AND user_id = $2', [programId, userId]);
      if (progRows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(
          'UPDATE templates SET sort_order = $1 WHERE id = $2 AND program_id = $3',
          [i, orderedIds[i], programId]
        );
      }
      await client.query('COMMIT');
      return true;
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
        if (ex.is_section_header) {
          grouped.push({ name: ex.name, isSectionHeader: true, sectionNotes: ex.section_notes || '', sortOrder: ex.sort_order, sets: [] });
          continue;
        }
        const key = `${ex.name}::${ex.sort_order}`;
        if (!seen.has(key)) {
          seen.set(key, grouped.length);
          grouped.push({
            name: ex.name,
            setType: ex.set_type || 'straight',
            sortOrder: ex.sort_order,
            repRange: ex.rep_range || '',
            exerciseDescription: ex.exercise_description || '',
            videoUrl: ex.video_url || '',
            programNotes: ex.program_notes || '',
            sets: [],
          });
        }
        grouped[seen.get(key)].sets.push({
          setNumber: ex.set_number,
          plannedReps: ex.planned_reps,
          suggestedWeight: Number(ex.suggested_weight),
          setType: ex.set_type || 'straight',
        });
      }

      return {
        id: t.id,
        userId: t.user_id,
        programId: t.program_id,
        name: t.name,
        description: t.description,
        isRest: t.is_rest,
        isPrehab: !!t.is_prehab,
        prehabTemplateId: t.prehab_template_id || null,
        sortOrder: t.sort_order,
        groupId: t.group_id || null,
        phase: t.phase || null,
        exercises: grouped,
      };
    });
  },

  async updateTemplate(userId, templateId, name, description, exercises) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'UPDATE templates SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
        [name, description, templateId, userId]
      );
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      // Remove old exercises and batch insert new ones
      await client.query('DELETE FROM template_exercises WHERE template_id = $1', [templateId]);
      if (exercises) {
        await batchInsertTemplateExercises(client, templateId, exercises, userId);
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
        await batchInsertTemplateExercises(client, templateId, exercises, userId);
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

  // Schedule (date-based)
  async getSchedule(userId, fromDate, toDate) {
    const { rows } = await pool.query(
      `SELECT sd.schedule_date, sd.template_id, sd.is_rest AS day_is_rest, t.name AS template_name, t.is_rest AS template_is_rest
       FROM schedule_days sd
       LEFT JOIN templates t ON t.id = sd.template_id
       WHERE sd.user_id = $1 AND sd.schedule_date IS NOT NULL
         AND sd.schedule_date >= $2 AND sd.schedule_date <= $3
       ORDER BY sd.schedule_date`,
      [userId, fromDate, toDate]
    );
    return rows.map((r) => {
      // Format date as YYYY-MM-DD string for client consistency
      const d = r.schedule_date;
      const dateStr = d instanceof Date
        ? d.toISOString().slice(0, 10)
        : String(d).slice(0, 10);
      return {
        date: dateStr,
        templateId: r.template_id,
        templateName: r.template_name || null,
        isRest: r.day_is_rest || r.template_is_rest || false,
      };
    });
  },

  async setDefaultSchedule(_userId) {
    // New users start with a blank schedule
  },

  async updateSchedule(userId, schedule) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const day of schedule) {
        if (day.templateId == null && !day.isRest) {
          // Delete the row if clearing a date
          await client.query(
            `DELETE FROM schedule_days WHERE user_id = $1 AND schedule_date = $2`,
            [userId, day.date]
          );
        } else {
          await client.query(
            `INSERT INTO schedule_days (user_id, schedule_date, template_id, is_rest)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, schedule_date)
             DO UPDATE SET template_id = $3, is_rest = $4`,
            [userId, day.date, day.templateId || null, day.isRest || false]
          );
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async clearScheduleFrom(userId, fromDate) {
    await pool.query(
      `DELETE FROM schedule_days WHERE user_id = $1 AND schedule_date >= $2`,
      [userId, fromDate]
    );
  },

  // Sessions
  //
  // Overwrite-protection contract:
  //   - If no existing session row for (user, template, date): create.
  //   - If existing row has zero session_entries: silently overwrite (this is
  //     the in-progress autosave path right after /sessions/initialize seeds a
  //     blank shell).
  //   - If existing row has entries AND options.confirmOverwrite === true:
  //     destructive overwrite, then sweep & recompute PBs (since the upsert
  //     elsewhere only ratchets PBs upward — without a sweep, deleting entries
  //     would leave stale PB rows pointing at nothing).
  //   - If existing row has entries AND confirmOverwrite is not set: throw a
  //     structured error so the route layer can return HTTP 409 with details
  //     for the client modal.
  async createSession(userId, templateId, date, entries, notes, workoutData, options = {}) {
    const confirmOverwrite = options.confirmOverwrite === true;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Reuse existing session for same workout+date, or create a new one
      const { rows: existing } = await client.query(
        'SELECT id FROM sessions WHERE user_id = $1 AND template_id = $2 AND date = $3',
        [userId, templateId, date]
      );

      let sessionId;
      let didDestructiveOverwrite = false;
      if (existing.length > 0) {
        sessionId = existing[0].id;

        // Distinguish "session shell from /sessions/initialize" (all zero-
        // weight, zero-rep, not-completed entries) from a session that has
        // actual logged data. Only the latter counts as a row that requires
        // overwrite confirmation. This also matches what the user thinks of
        // as "logged" — they typed a number or marked a set complete.
        const { rows: countRows } = await client.query(
          `SELECT COUNT(*)::INT AS n
             FROM session_entries
            WHERE session_id = $1
              AND (weight > 0 OR reps > 0 OR is_completed = TRUE)`,
          [sessionId]
        );
        const existingEntryCount = countRows[0]?.n || 0;

        if (existingEntryCount > 0 && !confirmOverwrite) {
          // Roll back the open transaction before bubbling — we haven't
          // mutated anything yet, but BEGIN is open and we'll release the
          // client in finally.
          await client.query('ROLLBACK');

          // Gather PB count + completed timestamp + distinct exercise names
          // for the error payload so the client modal can show accurate copy.
          // Run sequentially on the same client to avoid pg protocol pipelining
          // surprises right after a ROLLBACK.
          const pbCountRes = await client.query(
            'SELECT COUNT(*)::INT AS n FROM personal_bests WHERE user_id = $1 AND template_id = $2',
            [userId, templateId]
          );
          // sessions table has last_activity_at + created_at, not a dedicated
          // completed_at column. Prefer last_activity_at since for a completed
          // session that's the time of the last edit / completion. Falls back
          // to created_at when activity isn't tracked (legacy rows).
          const sessionMetaRes = await client.query(
            'SELECT COALESCE(last_activity_at, created_at) AS completed_at FROM sessions WHERE id = $1',
            [sessionId]
          );
          const exNamesRes = await client.query(
            // Only surface exercises with actual logged data — matches the
            // entriesCount filter above, so the modal copy stays consistent.
            `SELECT DISTINCT exercise_name
               FROM session_entries
              WHERE session_id = $1
                AND (weight > 0 OR reps > 0 OR is_completed = TRUE)
              ORDER BY exercise_name`,
            [sessionId]
          );

          const err = new Error('OVERWRITE_REQUIRES_CONFIRMATION');
          err.code = 'OVERWRITE_REQUIRES_CONFIRMATION';
          err.details = {
            code: 'OVERWRITE_REQUIRES_CONFIRMATION',
            sessionId,
            entriesCount: existingEntryCount,
            prCount: pbCountRes.rows[0]?.n || 0,
            completedAt: sessionMetaRes.rows[0]?.completed_at || null,
            exerciseNames: exNamesRes.rows.map((r) => r.exercise_name),
          };
          throw err;
        }

        if (existingEntryCount > 0) didDestructiveOverwrite = true;

        await client.query('DELETE FROM session_entries WHERE session_id = $1', [sessionId]);
        await client.query(
          'UPDATE sessions SET notes = $1, workout_data = $2, last_activity_at = NOW(), reminder_sent_at = NULL WHERE id = $3',
          [JSON.stringify(notes || {}), workoutData ? JSON.stringify(workoutData) : null, sessionId]
        );
      } else {
        const { rows: sessionRows } = await client.query(
          'INSERT INTO sessions (user_id, template_id, date, notes, workout_data, last_activity_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
          [userId, templateId, date, JSON.stringify(notes || {}), workoutData ? JSON.stringify(workoutData) : null]
        );
        sessionId = sessionRows[0].id;
      }

      // Batch insert session entries. Resolve all distinct exercise names to
      // master library ids once up front (user-scoped — customs stay private),
      // then dual-write exercise_id alongside exercise_name. Unresolved names
      // get NULL — schema allows it, old read paths still work via the name.
      if (entries.length > 0) {
        const idByName = await resolveExerciseIdsForNames(
          client,
          entries.map((e) => e.exerciseName),
          userId
        );
        const values = [];
        const params = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const off = i * 7;
          const exId = idByName.get(String(entry.exerciseName).trim().toLowerCase()) ?? null;
          values.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5}, $${off + 6}, $${off + 7})`);
          params.push(sessionId, exId, entry.exerciseName, entry.setNumber, entry.weight || 0, entry.reps || 0, entry.isCompleted || false);
        }
        await client.query(
          `INSERT INTO session_entries (session_id, exercise_id, exercise_name, set_number, weight, reps, is_completed) VALUES ${values.join(', ')}`,
          params
        );
      }

      // Track best reps per exercise per weight for PB updates (straight,
      // *completed* sets only — planned/pre-filled sets never count as PRs).
      const bestRepsAtWeight = new Map();
      for (const entry of entries) {
        if (entry.setType && entry.setType !== 'straight') continue;
        if (!entry.isCompleted) continue;
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

      // PB strategy:
      //   - Normal path (insert / overwrite of an empty shell): upsert PBs
      //     using GREATEST so they only ratchet upward.
      //   - Destructive-overwrite path (an explicitly-confirmed clobber of a
      //     session that already had entries): wipe PBs for this template and
      //     rebuild from the surviving session_entries. The plain upsert is
      //     unsafe here because deleted entries may have been the source of
      //     PB rows that no longer correspond to any logged set.
      if (didDestructiveOverwrite) {
        await rebuildPBsForTemplateOnClient(client, userId, templateId);
      } else {
        // Resolve exercise_ids in one batch so the per-PB upsert doesn't
        // round-trip a SELECT for each. ON CONFLICT key stays on
        // (user_id, template_id, exercise_name, best_weight) — see
        // idx_personal_bests_upsert. exercise_id is set on both INSERT
        // and DO UPDATE so prior NULL rows get filled in too.
        const pbIdByName = await resolveExerciseIdsForNames(
          client,
          [...bestRepsAtWeight.values()].map((b) => b.exerciseName),
          userId
        );
        for (const [, best] of bestRepsAtWeight) {
          const exId = pbIdByName.get(String(best.exerciseName).trim().toLowerCase()) ?? null;
          await client.query(
            `INSERT INTO personal_bests (user_id, template_id, exercise_id, exercise_name, best_weight, best_reps)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, template_id, exercise_name, best_weight)
             DO UPDATE SET
               best_reps = GREATEST(personal_bests.best_reps, $6),
               achieved_at = CASE WHEN $6 > personal_bests.best_reps THEN NOW() ELSE personal_bests.achieved_at END,
               exercise_id = COALESCE(personal_bests.exercise_id, EXCLUDED.exercise_id)`,
            [userId, templateId, exId, best.exerciseName, best.weight, best.reps]
          );
        }
      }

      // Seed an empty user-owned template with the session's exercise list
      // so "Start Empty Workout" templates surface in My Workouts populated
      // with whatever the user actually logged. Idempotent — the helper
      // bails when the template already has template_exercises rows or
      // isn't owned by this user. Wrapped in a SAVEPOINT so a failure here
      // can be rolled back independently without aborting the outer
      // transaction (pg marks transactions aborted on any query error,
      // which would then cause COMMIT to fail). The session is the source
      // of truth — a template-seed bug must not block a legitimate save.
      await client.query('SAVEPOINT template_sync');
      try {
        await syncEmptyTemplateFromWorkoutData(client, userId, templateId, workoutData);
        await client.query('RELEASE SAVEPOINT template_sync');
      } catch (syncErr) {
        try { await client.query('ROLLBACK TO SAVEPOINT template_sync'); } catch (_) {}
        try { await client.query('RELEASE SAVEPOINT template_sync'); } catch (_) {}
        console.error('syncEmptyTemplateFromWorkoutData failed:', syncErr);
      }

      await client.query('COMMIT');
      return { id: sessionId };
    } catch (err) {
      // Don't double-rollback: when we throw OVERWRITE_REQUIRES_CONFIRMATION
      // we already rolled back above before grabbing the metadata for the
      // error payload. ROLLBACK on a transaction that's not open is harmless
      // in pg, but errors from the metadata queries themselves would surface
      // as confusing rollback failures otherwise.
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  },

  // Public wrapper: rebuilds PBs for (userId, templateId) using its own
  // connection. Useful for ad-hoc cleanup if a destructive overwrite happens
  // outside createSession (none today, but the contract is here for future
  // use and matches the spec).
  async recomputePBsForTemplate(userId, templateId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await rebuildPBsForTemplateOnClient(client, userId, templateId);
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      client.release();
    }
  },

  async getSessions(userId) {
    // total_volume + exercise_count count completed sets only — planned/pre-filled
    // sets are excluded so a user writing down plans ahead of time doesn't inflate
    // their history totals or community feed stats. The weight > 0 guard excludes
    // bodyweight sets (weight = -1 sentinel), which would otherwise produce a
    // negative contribution to volume.
    const { rows } = await pool.query(
      `SELECT s.id, s.date, s.template_id, s.created_at, s.completed,
              COALESCE(t.name, 'Unknown') AS template_name,
              COALESCE(SUM(se.weight * se.reps) FILTER (WHERE se.is_completed = TRUE AND se.weight > 0), 0)::NUMERIC AS total_volume,
              COUNT(DISTINCT se.exercise_name) FILTER (WHERE se.is_completed = TRUE) AS exercise_count
       FROM sessions s
       LEFT JOIN templates t ON t.id = s.template_id
       LEFT JOIN session_entries se ON se.session_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id, t.name
       ORDER BY s.date DESC, s.created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      templateId: r.template_id,
      createdAt: r.created_at,
      completed: r.completed,
      templateName: r.template_name,
      totalVolume: Number(r.total_volume) || 0,
      exerciseCount: Number(r.exercise_count) || 0,
    }));
  },

  async getSession(userId, sessionId) {
    const { rows: sessionRows } = await pool.query(
      `SELECT s.id, s.date, s.template_id, s.created_at, s.last_activity_at, s.workout_data,
              s.completed,
              COALESCE(t.name, 'Unknown') AS template_name,
              p.name AS program_name,
              EXTRACT(EPOCH FROM (s.last_activity_at - s.created_at))::INT AS elapsed_secs
       FROM sessions s
       LEFT JOIN templates t ON t.id = s.template_id
       LEFT JOIN programs p ON p.id = t.program_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sessionId, userId]
    );
    if (!sessionRows[0]) return null;

    const session = sessionRows[0];
    // Includes planned + completed entries — surfaces user-typed data to the
    // session-detail / summary views so they show what was logged, not just
    // what was lifted.
    const { rows: entries } = await pool.query(
      'SELECT * FROM session_entries WHERE session_id = $1 ORDER BY id',
      [sessionId]
    );

    const workoutData = typeof session.workout_data === 'string' ? JSON.parse(session.workout_data) : (session.workout_data || null);

    return {
      id: session.id,
      date: session.date,
      templateId: session.template_id,
      createdAt: session.created_at,
      lastActivityAt: session.last_activity_at,
      // First-save → last-save duration. Approximation, but it's the only
      // duration we have for completed sessions (the live timer is in
      // localStorage and isn't persisted).
      elapsedSecs: Math.max(0, session.elapsed_secs || 0),
      completed: !!session.completed,
      templateName: workoutData?.name || session.template_name,
      programName: session.program_name || null,
      workoutData,
      entries: entries.map((e) => ({
        id: e.id,
        sessionId: e.session_id,
        exerciseName: e.exercise_name,
        setNumber: e.set_number,
        weight: Number(e.weight),
        reps: e.reps,
        isCompleted: e.is_completed || false,
      })),
    };
  },

  async getSessionByTemplateAndDate(userId, templateId, date) {
    const { rows: sessionRows } = await pool.query(
      'SELECT id, notes, completed, workout_data FROM sessions WHERE user_id = $1 AND template_id = $2 AND date = $3',
      [userId, templateId, date]
    );
    if (!sessionRows[0]) return null;

    const session = sessionRows[0];
    // Includes planned + completed entries — the active session UI restores
    // pre-filled values too so the user sees what they typed before tapping
    // Begin Workout.
    const { rows: entries } = await pool.query(
      'SELECT * FROM session_entries WHERE session_id = $1 ORDER BY id',
      [session.id]
    );

    const notes = typeof session.notes === 'string' ? JSON.parse(session.notes) : (session.notes || {});
    const workoutData = typeof session.workout_data === 'string' ? JSON.parse(session.workout_data) : (session.workout_data || null);

    return {
      id: session.id,
      completed: session.completed || false,
      notes,
      workoutData,
      entries: entries.map((e) => ({
        exerciseName: e.exercise_name,
        setNumber: e.set_number,
        weight: Number(e.weight),
        reps: e.reps,
        isCompleted: e.is_completed || false,
      })),
    };
  },

  // Get the best weight/reps per exercise+set from completed sessions for a template.
  // "Best" = highest weight wins; if tied, highest reps wins.
  // Returns: { "Exercise Name": { 1: { weight, reps }, 2: { weight, reps } } }
  async getBestPerformanceByGroup(userId, groupId) {
    if (!groupId) return {};
    // completed sets only — feeds /sessions/initialize, so planned/pre-filled
    // values would otherwise re-seed themselves into the next session's plans.
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (se.exercise_name, se.set_number)
         se.exercise_name, se.set_number, se.weight, se.reps
       FROM session_entries se
       JOIN sessions s ON se.session_id = s.id
       JOIN templates t ON s.template_id = t.id
       WHERE s.user_id = $1
         AND t.group_id = $2
         AND s.completed = TRUE
         AND se.is_completed = TRUE
         AND se.weight > 0
         AND se.reps > 0
       ORDER BY se.exercise_name, se.set_number,
                se.weight DESC, se.reps DESC`,
      [userId, groupId]
    );
    const result = {};
    for (const r of rows) {
      if (!result[r.exercise_name]) result[r.exercise_name] = {};
      result[r.exercise_name][r.set_number] = {
        weight: Number(r.weight),
        reps: r.reps,
      };
    }
    return result;
  },

  async getBestPerformanceByTemplate(userId, templateId) {
    // completed sets only — feeds /sessions/initialize, so planned/pre-filled
    // values would otherwise re-seed themselves into the next session's plans.
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (se.exercise_name, se.set_number)
         se.exercise_name, se.set_number, se.weight, se.reps
       FROM session_entries se
       JOIN sessions s ON se.session_id = s.id
       WHERE s.user_id = $1
         AND s.template_id = $2
         AND s.completed = TRUE
         AND se.is_completed = TRUE
         AND se.weight > 0
         AND se.reps > 0
       ORDER BY se.exercise_name, se.set_number,
                se.weight DESC, se.reps DESC`,
      [userId, templateId]
    );
    const result = {};
    for (const r of rows) {
      if (!result[r.exercise_name]) result[r.exercise_name] = {};
      result[r.exercise_name][r.set_number] = {
        weight: Number(r.weight),
        reps: r.reps,
      };
    }
    return result;
  },

  async getLastSessionEntries(userId, templateId) {
    const { rows: sessions } = await pool.query(
      `SELECT id FROM sessions WHERE user_id = $1 AND template_id = $2 AND completed = TRUE ORDER BY date DESC LIMIT 1`,
      [userId, templateId]
    );
    if (sessions.length === 0) return {};
    const sessionId = sessions[0].id;
    // completed sets only — drives weight suggestions, so planned/pre-filled
    // sets must not be treated as "what they did last time".
    const { rows: entries } = await pool.query(
      `SELECT exercise_name, set_number, weight, reps FROM session_entries WHERE session_id = $1 AND is_completed = TRUE ORDER BY exercise_name, set_number`,
      [sessionId]
    );
    const result = {};
    for (const e of entries) {
      if (!result[e.exercise_name]) result[e.exercise_name] = [];
      result[e.exercise_name].push({ setNumber: e.set_number, weight: Number(e.weight), reps: Number(e.reps) });
    }
    return result;
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
      "SELECT id, template_id, date FROM sessions WHERE user_id = $1 AND completed = TRUE",
      [userId]
    );
    // Defensive YYYY-MM-DD format. Today `sessions.date` is TEXT so r.date
    // arrives as a string; if the column ever migrates to DATE the driver
    // returns a Date instance, and the client's `c.date === todayStr`
    // comparison would silently start failing. Normalize at the boundary so
    // the API contract doesn't depend on the column type.
    return rows.map((r) => ({
      id: r.id,
      templateId: r.template_id,
      date: r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : String(r.date).slice(0, 10),
    }));
  },

  // Progressive overload data: every (exercise, weight) the user has logged
  // on 2+ distinct dates, with all set entries grouped by date. Powers the
  // /progress page's set-by-set pills viz so users can see whether their
  // reps at the same weight are climbing/flat/declining over time.
  async getSameWeightRepeats(userId) {
    // completed sets only — planned/pre-filled values would otherwise show
    // up as fake data points on the progressive-overload chart.
    const { rows } = await pool.query(
      `SELECT s.date, se.exercise_name, se.set_number, se.weight, se.reps
       FROM session_entries se
       JOIN sessions s ON s.id = se.session_id
       WHERE s.user_id = $1
         AND s.completed = TRUE
         AND se.is_completed = TRUE
         AND se.weight > 0
         AND se.reps > 0
       ORDER BY s.date ASC, se.exercise_name ASC, se.set_number ASC`,
      [userId]
    );
    // Group by (exercise, weight). Single-date groups are returned too — the
    // client renders them in a neutral/gray state to indicate "no comparison
    // yet" until the same lift is repeated on another date.
    const byKey = new Map();
    for (const r of rows) {
      const w = Number(r.weight);
      const key = `${r.exercise_name}__${w}`;
      if (!byKey.has(key)) byKey.set(key, { exercise: r.exercise_name, weight: w, occurrences: [] });
      byKey.get(key).occurrences.push({ date: r.date, reps: r.reps, setNumber: r.set_number });
    }
    return [...byKey.values()];
  },

  // Exercise history (for smart weight suggestions)
  async getExerciseHistoryBatch(userId, exerciseNames, limit = 3) {
    if (!exerciseNames.length) return {};

    // completed sets only — feeds getWeightSuggestion(), so planned values
    // would otherwise drive bogus "you did X last time" suggestions.
    const { rows } = await pool.query(
      `SELECT se.exercise_name, s.date, se.set_number, se.weight, se.reps
       FROM session_entries se
       JOIN sessions s ON se.session_id = s.id
       WHERE s.user_id = $1
         AND LOWER(se.exercise_name) = ANY(SELECT LOWER(unnest($2::text[])))
         AND se.is_completed = TRUE
         AND se.weight > 0 AND se.reps > 0
       ORDER BY se.exercise_name, s.date DESC, se.set_number ASC`,
      [userId, exerciseNames]
    );

    // Group by exercise name, then by session date, limit to N most recent sessions
    const result = {};
    for (const row of rows) {
      const name = row.exercise_name;
      if (!result[name]) result[name] = {};
      const dateKey = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
      if (!result[name][dateKey]) result[name][dateKey] = [];
      result[name][dateKey].push({ setNumber: row.set_number, weight: Number(row.weight), reps: row.reps });
    }

    // Flatten: keep only the most recent N sessions per exercise
    const output = {};
    for (const [name, dates] of Object.entries(result)) {
      const sortedDates = Object.keys(dates).sort().reverse().slice(0, limit);
      output[name] = sortedDates.map(d => ({ date: d, sets: dates[d] }));
    }
    return output;
  },

  // Personal Bests
  async getPBs(userId, templateId) {
    let query = `SELECT pb.*, s.id AS session_id
      FROM personal_bests pb
      LEFT JOIN sessions s ON s.user_id = pb.user_id
        AND s.template_id = pb.template_id
        AND s.date = TO_CHAR(pb.achieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      WHERE pb.user_id = $1`;
    const params = [userId];
    if (templateId) {
      query += ' AND pb.template_id = $2';
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
      sessionId: pb.session_id || null,
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
      videoId: e.video_id || null,
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
  // Challenges
  async getChallengeLeaderboard(challenge) {
    const { rows } = await pool.query(
      `SELECT ce.id, ce.value, ce.created_at,
              u.id AS user_id, u.first_name, u.last_name, u.username, u.profile_photo
       FROM challenge_entries ce
       JOIN users u ON ce.user_id = u.id
       WHERE ce.challenge = $1
       ORDER BY ce.value DESC, ce.created_at ASC`,
      [challenge]
    );
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      value: r.value,
      firstName: r.first_name,
      lastName: r.last_name,
      username: r.username,
      photoUrl: r.profile_photo || null,
      createdAt: r.created_at,
    }));
  },

  async getUserChallengeEntry(userId, challenge) {
    const { rows } = await pool.query(
      'SELECT * FROM challenge_entries WHERE user_id = $1 AND challenge = $2',
      [userId, challenge]
    );
    return rows[0] || null;
  },

  // ── Subscription methods ──
  async getSubscriptionByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ($2, $3) ORDER BY created_at DESC LIMIT 1',
      [userId, 'active', 'past_due']
    );
    return rows[0] || null;
  },

  async createSubscription({ userId, stripeSubscriptionId, stripeCustomerId, plan, billingInterval, status, currentPeriodEnd }, client = pool) {
    const { rows } = await client.query(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, source, plan, billing_interval, status, current_period_end)
       VALUES ($1, $2, $3, 'stripe', $4, $5, $6, $7)
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = $6, current_period_end = $7, updated_at = NOW()
       RETURNING *`,
      [userId, stripeSubscriptionId, stripeCustomerId, plan, billingInterval, status, currentPeriodEnd]
    );
    return rows[0];
  },

  async updateSubscriptionByStripeId(stripeSubscriptionId, updates, client = pool) {
    const allowedColumns = ['status', 'plan', 'billing_interval', 'current_period_end', 'cancel_at_period_end', 'canceled_at'];
    const fields = [];
    const params = [stripeSubscriptionId];
    let idx = 2;
    for (const [key, value] of Object.entries(updates)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (!allowedColumns.includes(col)) continue;
      fields.push(`${col} = $${idx}`);
      params.push(value);
      idx++;
    }
    fields.push('updated_at = NOW()');
    await client.query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE stripe_subscription_id = $1`,
      params
    );
  },

  async updateUserPlan(userId, plan, client = pool) {
    await client.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);
  },

  async setUserStripeCustomerId(userId, customerId) {
    await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, userId]);
  },

  async getUserByStripeCustomerId(customerId, client = pool) {
    const { rows } = await client.query('SELECT * FROM users WHERE stripe_customer_id = $1', [customerId]);
    return rows[0] || null;
  },

  async postChallengeEntry(userId, challenge, value) {
    // Upsert: one entry per user per challenge
    const { rows: existing } = await pool.query(
      'SELECT id FROM challenge_entries WHERE user_id = $1 AND challenge = $2',
      [userId, challenge]
    );
    if (existing.length > 0) {
      await pool.query(
        'UPDATE challenge_entries SET value = $1, created_at = NOW() WHERE id = $2',
        [value, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO challenge_entries (user_id, challenge, value) VALUES ($1, $2, $3)',
        [userId, challenge, value]
      );
    }
  },

  // ── Sharing ──────────────────────────────────────────

  async findUserByUsernameOrEmail(identifier) {
    const trimmed = identifier.trim().toLowerCase().replace(/^@/, '');
    const { rows } = await pool.query(
      'SELECT id, username, first_name, last_name FROM users WHERE LOWER(username) = $1 OR email = $1 OR phone = $1 LIMIT 1',
      [trimmed]
    );
    return rows[0] || null;
  },

  async createShare(senderId, recipientId, programId) {
    const { rows } = await pool.query(
      'INSERT INTO shared_programs (source_program_id, sender_id, recipient_id) VALUES ($1, $2, $3) RETURNING *',
      [programId, senderId, recipientId]
    );
    return rows[0];
  },

  async getPendingShares(userId) {
    const { rows } = await pool.query(
      `SELECT sp.id, sp.source_program_id, sp.status, sp.created_at,
              sp.type, sp.template_id, sp.message,
              u.username AS sender_username, u.first_name AS sender_first_name,
              u.last_name AS sender_last_name, u.profile_photo AS sender_photo,
              u.email AS sender_email,
              p.name AS program_name,
              t.name AS template_name
       FROM shared_programs sp
       JOIN users u ON u.id = sp.sender_id
       LEFT JOIN programs p ON p.id = sp.source_program_id
       LEFT JOIN templates t ON t.id = sp.template_id
       WHERE sp.recipient_id = $1 AND sp.status = 'pending'
       ORDER BY sp.created_at DESC`,
      [userId]
    );
    return rows.map(r => {
      const firstName = r.sender_first_name || '';
      const lastName = r.sender_last_name || '';
      const username = r.sender_username || '';
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || username || r.sender_email || 'Unknown';
      return {
        id: r.id,
        type: r.type || 'program',
        sourceProgramId: r.source_program_id,
        templateId: r.template_id,
        message: r.message,
        senderUsername: username,
        senderName: fullName,
        senderPhoto: r.sender_photo || null,
        programName: r.program_name || r.template_name || 'Deleted Program',
        templateName: r.template_name,
        createdAt: r.created_at,
      };
    });
  },

  async acceptShare(shareId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Verify share
      const { rows: shares } = await client.query(
        "SELECT * FROM shared_programs WHERE id = $1 AND recipient_id = $2 AND status = 'pending'",
        [shareId, userId]
      );
      if (shares.length === 0) throw new Error('Share not found or already processed');
      const share = shares[0];

      // Get source program
      const { rows: progRows } = await client.query('SELECT * FROM programs WHERE id = $1', [share.source_program_id]);
      if (progRows.length === 0) throw new Error('Source program no longer exists');
      const srcProg = progRows[0];

      if (srcProg.user_id !== share.sender_id) throw new Error('Sender does not own the source program');

      // Copy program
      const { rows: newProgRows } = await client.query(
        'INSERT INTO programs (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [userId, srcProg.name, srcProg.description || '']
      );
      const newProgId = newProgRows[0].id;

      // Copy templates
      const { rows: srcTemplates } = await client.query(
        'SELECT * FROM templates WHERE program_id = $1 ORDER BY sort_order', [share.source_program_id]
      );
      for (const tmpl of srcTemplates) {
        const { rows: newTmplRows } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [userId, newProgId, tmpl.name, tmpl.description || '', tmpl.is_rest, tmpl.sort_order]
        );
        const newTmplId = newTmplRows[0].id;

        // Copy exercises. The source rows already have exercise_id populated
        // (post-Path-B-step-1 backfill), so we just propagate it. No need to
        // re-resolve by name — this is a verbatim copy of an existing
        // template slot.
        const { rows: srcExercises } = await client.query(
          'SELECT * FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number', [tmpl.id]
        );
        if (srcExercises.length > 0) {
          const values = [];
          const params = [];
          let pi = 1;
          for (const ex of srcExercises) {
            values.push(`($${pi}, $${pi+1}, $${pi+2}, $${pi+3}, $${pi+4}, $${pi+5}, $${pi+6}, $${pi+7}, $${pi+8}, $${pi+9})`);
            params.push(newTmplId, ex.exercise_id ?? null, ex.name, ex.set_type, ex.set_number, ex.planned_reps, ex.suggested_weight, ex.sort_order, ex.is_section_header || false, ex.section_notes || '');
            pi += 10;
          }
          await client.query(
            `INSERT INTO template_exercises (template_id, exercise_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ${values.join(', ')}`,
            params
          );
        }
      }

      // Update share status
      await client.query(
        "UPDATE shared_programs SET status = 'accepted', copied_program_id = $1 WHERE id = $2",
        [newProgId, shareId]
      );

      await client.query('COMMIT');
      return { id: newProgId, name: srcProg.name };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getAcceptedShares(userId) {
    const { rows } = await pool.query(
      `SELECT sp.copied_program_id,
              u.username AS sender_username, u.first_name AS sender_first_name,
              u.last_name AS sender_last_name, u.profile_photo AS sender_photo,
              u.email AS sender_email
       FROM shared_programs sp
       JOIN users u ON u.id = sp.sender_id
       WHERE sp.recipient_id = $1 AND sp.status = 'accepted' AND sp.copied_program_id IS NOT NULL`,
      [userId]
    );
    const map = {};
    for (const r of rows) {
      const firstName = r.sender_first_name || '';
      const lastName = r.sender_last_name || '';
      const username = r.sender_username || '';
      map[r.copied_program_id] = {
        senderUsername: username,
        senderName: firstName && lastName ? `${firstName} ${lastName}` : firstName || username || r.sender_email || 'Unknown',
        senderPhoto: r.sender_photo || null,
      };
    }
    return map;
  },

  async declineShare(shareId, userId) {
    const { rowCount } = await pool.query(
      "UPDATE shared_programs SET status = 'declined' WHERE id = $1 AND recipient_id = $2 AND status = 'pending'",
      [shareId, userId]
    );
    return rowCount > 0;
  },

  // ---------------- Feed reactions ----------------

  async getFeedReactions(userId, itemIds) {
    if (!itemIds?.length) return { aggregates: {}, mine: {} };

    // Aggregate counts per reaction per item.
    const { rows: aggRows } = await pool.query(
      `SELECT item_id, reaction, COUNT(*)::INT AS n
         FROM feed_reactions
        WHERE item_id = ANY($1::text[])
        GROUP BY item_id, reaction`,
      [itemIds]
    );
    const aggregates = {};
    for (const r of aggRows) {
      if (!aggregates[r.item_id]) aggregates[r.item_id] = { fire: 0, flex: 0, hundo: 0, clap: 0 };
      aggregates[r.item_id][r.reaction] = r.n;
    }

    // Current user's own reaction per item.
    const { rows: mineRows } = await pool.query(
      `SELECT item_id, reaction FROM feed_reactions WHERE user_id = $1 AND item_id = ANY($2::text[])`,
      [userId, itemIds]
    );
    const mine = {};
    for (const r of mineRows) mine[r.item_id] = r.reaction;

    return { aggregates, mine };
  },

  async setFeedReaction(userId, itemId, reaction) {
    if (reaction === null || reaction === undefined) {
      await pool.query(
        `DELETE FROM feed_reactions WHERE user_id = $1 AND item_id = $2`,
        [userId, itemId]
      );
      return null;
    }
    await pool.query(
      `INSERT INTO feed_reactions (user_id, item_id, reaction)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, item_id)
       DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()`,
      [userId, itemId, reaction]
    );
    return reaction;
  },
};

export default db;
