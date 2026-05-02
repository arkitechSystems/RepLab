// Shared utilities for library-program "wipe and rebuild" migrations.
//
// Background: a handful of migrations do
//
//   DELETE FROM templates WHERE program_id = $1
//
// to clear an old version of a featured program before reinserting the new
// one. Because `personal_bests.template_id` is `ON DELETE CASCADE` in the
// schema, that DELETE silently nukes every user's PBs against the old
// templates. Re-running such a migration on production wipes user PR history
// with no warning.
//
// `deleteLibraryProgramTemplatesWithGuard` wraps the destructive DELETE
// behind a count + an explicit env-var confirmation. If any user PBs would
// cascade, the helper throws unless `CONFIRM_PB_LOSS=yes` is set. Migrations
// stay short (one call), and dev/admin must consciously opt in to the loss.
//
// Usage inside a migration:
//
//   import { deleteLibraryProgramTemplatesWithGuard } from './_utils.js';
//   ...
//   await deleteLibraryProgramTemplatesWithGuard(client, programId, {
//     migrationName: 'replace-robin-gallant-glute-hypertrophy',
//   });
//
// Run protected:                              node server/migrations/foo.js
// Run with intentional PB loss accepted:      CONFIRM_PB_LOSS=yes node server/migrations/foo.js
//
// Long-term: prefer migrating templates in-place (UPDATE existing rows by
// name match within program_id) so PBs don't even need to cascade. This
// helper is the safety net for the legacy wipe-and-rebuild pattern.

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
