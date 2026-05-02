// Shared utilities for library-program migrations.
//
// Background: a handful of migrations used to do
//
//   DELETE FROM templates WHERE program_id = $1
//
// to clear an old version of a featured program before reinserting the new
// one. Because `personal_bests.template_id` is `ON DELETE CASCADE` in the
// schema, that DELETE silently nukes every user's PBs against the old
// templates. Re-running such a migration on production wipes user PR history
// with no warning.
//
// The architecturally-right fix is to UPDATE existing templates in place
// (matched by `sort_order` within `program_id`) so PBs survive any re-run
// that doesn't structurally remove a day. The helpers below support that:
//
//   - fetchLibraryProgramTemplates(client, programId)
//       → Map<sortOrder, { id, name, sortOrder, isPrehab, isRest }>
//   - replaceTemplateExercises(client, templateId, exercises, columns)
//       → bulk-replaces template_exercises rows for a single template
//   - cascadeDeleteOrphanedLibraryTemplates(client, templateIds, opts)
//       → removes templates that disappeared from the new payload (with the
//         same CONFIRM_PB_LOSS guard)
//
// `deleteLibraryProgramTemplatesWithGuard` is kept for backward compat but
// is deprecated in favor of the in-place pattern above.

/**
 * Returns a map of existing library templates for `programId`, keyed by
 * sort_order. Match by sort_order (not name) because names get tweaked
 * between versions but the slot identity stays put — and that's the key
 * that lets us preserve PBs across re-runs.
 *
 * @param {import('pg').PoolClient} client
 * @param {number} programId
 * @returns {Promise<Map<number, { id: number, name: string, sortOrder: number, isPrehab: boolean, isRest: boolean }>>}
 */
export async function fetchLibraryProgramTemplates(client, programId) {
  const { rows } = await client.query(
    `SELECT id, name, sort_order, COALESCE(is_prehab, FALSE) AS is_prehab, is_rest
       FROM templates
      WHERE program_id = $1`,
    [programId]
  );
  const out = new Map();
  for (const r of rows) {
    out.set(r.sort_order, {
      id: r.id,
      name: r.name,
      sortOrder: r.sort_order,
      isPrehab: r.is_prehab,
      isRest: r.is_rest,
    });
  }
  return out;
}

/**
 * Replaces all template_exercises rows for a single template in place.
 * Deletes existing rows, then bulk-inserts the new payload using a single
 * parameterized statement (no string-interpolated values).
 *
 * @param {import('pg').PoolClient} client
 * @param {number} templateId
 * @param {Array<Object>} exercises - one object per row to insert; keys must
 *   match `columns` exactly (excluding template_id, which is supplied here).
 * @param {string[]} columns - column names for the insert, in the order the
 *   values should appear. `template_id` is always the first column and is
 *   provided by this helper — do NOT include it in `columns`.
 */
export async function replaceTemplateExercises(client, templateId, exercises, columns) {
  await client.query('DELETE FROM template_exercises WHERE template_id = $1', [templateId]);
  if (!exercises.length) return;

  const colCount = columns.length + 1; // +1 for template_id
  const values = [];
  const params = [];
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const off = i * colCount;
    const placeholders = [`$${off + 1}`];
    params.push(templateId);
    for (let c = 0; c < columns.length; c++) {
      placeholders.push(`$${off + 2 + c}`);
      params.push(ex[columns[c]]);
    }
    values.push(`(${placeholders.join(', ')})`);
  }

  const allCols = ['template_id', ...columns].join(', ');
  await client.query(
    `INSERT INTO template_exercises (${allCols}) VALUES ${values.join(', ')}`,
    params
  );
}

/**
 * Removes a list of templates whose sort_order disappeared from the new
 * migration payload. Refuses to proceed unless `CONFIRM_PB_LOSS=yes` is set
 * if any user PBs would cascade — same guard pattern as
 * `deleteLibraryProgramTemplatesWithGuard`.
 *
 * @param {import('pg').PoolClient} client
 * @param {number[]} templateIds
 * @param {{ migrationName: string }} opts
 */
export async function cascadeDeleteOrphanedLibraryTemplates(client, templateIds, { migrationName }) {
  if (!templateIds.length) return { rowCount: 0 };

  // Count user PBs that would cascade-delete.
  const { rows: [{ pb_count }] } = await client.query(
    `SELECT COUNT(*)::INT AS pb_count
       FROM personal_bests
      WHERE template_id = ANY($1::int[])`,
    [templateIds]
  );

  // Count distinct users who would lose data.
  const { rows: [{ user_count }] } = await client.query(
    `SELECT COUNT(DISTINCT user_id)::INT AS user_count
       FROM personal_bests
      WHERE template_id = ANY($1::int[])`,
    [templateIds]
  );

  if (pb_count > 0) {
    const confirmEnv = String(process.env.CONFIRM_PB_LOSS || '').toLowerCase();
    if (confirmEnv !== 'yes') {
      throw new Error(
        `[${migrationName}] Removing ${templateIds.length} orphaned templates ` +
        `(ids=${templateIds.join(',')}) would cascade-delete ${pb_count} ` +
        `personal_bests rows across ${user_count} users.\n` +
        `Re-run with CONFIRM_PB_LOSS=yes to proceed, or restructure the migration ` +
        `so the affected sort_order slots are preserved.`
      );
    }
    console.warn(
      `[${migrationName}] CONFIRM_PB_LOSS=yes — cascade-deleting ${pb_count} PBs across ${user_count} users for ${templateIds.length} orphaned templates.`
    );
  }

  return client.query(
    'DELETE FROM templates WHERE id = ANY($1::int[])',
    [templateIds]
  );
}

/**
 * @deprecated Prefer the in-place upsert pattern using
 *   {@link fetchLibraryProgramTemplates}, per-template UPDATE +
 *   {@link replaceTemplateExercises}, and a final
 *   {@link cascadeDeleteOrphanedLibraryTemplates} sweep. This helper still
 *   wipes every PB attached to the program even when the migration could
 *   have updated rows in place; it's kept only for any caller that hasn't
 *   been refactored yet.
 */
export async function deleteLibraryProgramTemplatesWithGuard(client, programId, { migrationName }) {
  // Count user PBs that would cascade-delete.
  const { rows: [{ pb_count }] } = await client.query(
    `SELECT COUNT(*)::INT AS pb_count
       FROM personal_bests pb
       JOIN templates t ON t.id = pb.template_id
      WHERE t.program_id = $1`,
    [programId]
  );

  // Count distinct users who would lose data.
  const { rows: [{ user_count }] } = await client.query(
    `SELECT COUNT(DISTINCT pb.user_id)::INT AS user_count
       FROM personal_bests pb
       JOIN templates t ON t.id = pb.template_id
      WHERE t.program_id = $1`,
    [programId]
  );

  if (pb_count > 0) {
    const confirmEnv = String(process.env.CONFIRM_PB_LOSS || '').toLowerCase();
    if (confirmEnv !== 'yes') {
      throw new Error(
        `[${migrationName}] DELETE FROM templates WHERE program_id = ${programId} would cascade-delete ` +
        `${pb_count} personal_bests rows across ${user_count} users.\n` +
        `Re-run with CONFIRM_PB_LOSS=yes to proceed, or rewrite the migration to UPDATE templates in place.`
      );
    }
    console.warn(
      `[${migrationName}] CONFIRM_PB_LOSS=yes — cascade-deleting ${pb_count} PBs across ${user_count} users.`
    );
  }

  return client.query(
    'DELETE FROM templates WHERE program_id = $1',
    [programId]
  );
}
