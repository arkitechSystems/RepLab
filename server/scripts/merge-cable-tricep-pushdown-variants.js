// One-off merge: collapse three duplicate library entries into one canonical
// "Cable Tricep Pushdown" row. All three names refer to the same physical
// exercise; only the canonical should survive.
//
//   Canonical (kept):   "Cable Tricep Pushdown"
//   Duplicates (merged): "Cable Tricep Pushdowns"
//                        "Cable Tricep Pushdowns (Pyramid)"
//
// Migration steps, all inside a single transaction:
//   1. Resolve canonical exercise.id and the duplicate exercise.ids
//   2. UPDATE template_exercises so every ref (by exercise_id OR by .name)
//      now points to the canonical id and carries the canonical name
//   3. UPDATE session_entries so every ref by exercise_id points to canonical
//   4. UPDATE personal_bests so every ref (by exercise_id OR exercise_name)
//      points to canonical (duplicate PR rows for the same user are LEFT in
//      place; the PB comparison logic — higher weight wins, tiebreak on
//      higher reps — will surface the strongest one organically)
//   5. Ensure the canonical row's muscle_group is "Triceps"
//   6. DELETE the duplicate exercise rows
//
// Default is --dry-run (no writes, BEGIN/ROLLBACK). Pass --apply to commit.
//
// Run:
//   cd server
//   node --env-file=.env scripts/merge-cable-tricep-pushdown-variants.js          (dry-run)
//   node --env-file=.env scripts/merge-cable-tricep-pushdown-variants.js --apply  (commit)

import pool from '../dbPool.js';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

const CANONICAL_NAME = 'Cable Tricep Pushdown';
const DUPLICATE_NAMES = [
  'Cable Tricep Pushdowns',
  'Cable Tricep Pushdowns (Pyramid)',
];
const TARGET_MUSCLE = 'Triceps';

async function main() {
  console.log('────────────────────────────────────────────────────────');
  console.log(' REPLAB master library — merge Cable Tricep Pushdown variants');
  console.log('────────────────────────────────────────────────────────');
  console.log(`Mode: ${APPLY ? 'APPLY (commit transaction)' : 'DRY-RUN (rollback at end)'}\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. Resolve canonical + duplicate ids ───
    const canRes = await client.query(
      `SELECT id, name, muscle_group FROM exercises
       WHERE LOWER(name) = LOWER($1) AND created_by IS NULL
       LIMIT 1`,
      [CANONICAL_NAME]
    );
    if (!canRes.rowCount) {
      console.error(`❌ Canonical exercise "${CANONICAL_NAME}" not found in master library. Aborting.`);
      await client.query('ROLLBACK');
      return;
    }
    const canonical = canRes.rows[0];
    console.log(`Canonical: id=${canonical.id} "${canonical.name}" muscle_group="${canonical.muscle_group}"`);

    const dupRes = await client.query(
      `SELECT id, name, muscle_group FROM exercises
       WHERE LOWER(name) = ANY($1::text[]) AND created_by IS NULL`,
      [DUPLICATE_NAMES.map((n) => n.toLowerCase())]
    );
    if (!dupRes.rowCount) {
      console.log('\nNo duplicate variants found in the master library. Nothing to merge.');
      await client.query('ROLLBACK');
      return;
    }
    const duplicateIds = dupRes.rows.map((r) => r.id);
    console.log(`\nDuplicates to merge:`);
    for (const d of dupRes.rows) {
      console.log(`  id=${d.id} "${d.name}" muscle_group="${d.muscle_group}"`);
    }

    // ─── 2. template_exercises ───
    const teRes = await client.query(
      `UPDATE template_exercises
       SET exercise_id = $1, name = $2
       WHERE exercise_id = ANY($3::int[])
          OR LOWER(name) = ANY($4::text[])`,
      [canonical.id, CANONICAL_NAME, duplicateIds, DUPLICATE_NAMES.map((n) => n.toLowerCase())]
    );
    console.log(`\ntemplate_exercises rows remapped: ${teRes.rowCount}`);

    // ─── 3. session_entries ───
    const seRes = await client.query(
      `UPDATE session_entries
       SET exercise_id = $1
       WHERE exercise_id = ANY($2::int[])`,
      [canonical.id, duplicateIds]
    );
    console.log(`session_entries  rows remapped: ${seRes.rowCount}`);

    // ─── 4. personal_bests ───
    const pbRes = await client.query(
      `UPDATE personal_bests
       SET exercise_id = $1, exercise_name = $2
       WHERE exercise_id = ANY($3::int[])
          OR LOWER(exercise_name) = ANY($4::text[])`,
      [canonical.id, CANONICAL_NAME, duplicateIds, DUPLICATE_NAMES.map((n) => n.toLowerCase())]
    );
    console.log(`personal_bests   rows remapped: ${pbRes.rowCount}`);

    // ─── 5. canonical muscle_group → Triceps (if not already) ───
    if (canonical.muscle_group !== TARGET_MUSCLE) {
      await client.query(
        `UPDATE exercises SET muscle_group = $1 WHERE id = $2 AND created_by IS NULL`,
        [TARGET_MUSCLE, canonical.id]
      );
      console.log(`Canonical muscle_group: "${canonical.muscle_group}" → "${TARGET_MUSCLE}"`);
    } else {
      console.log(`Canonical muscle_group: already "${TARGET_MUSCLE}" ✓`);
    }

    // ─── 6. Delete duplicate exercises ───
    const delRes = await client.query(
      `DELETE FROM exercises
       WHERE id = ANY($1::int[]) AND created_by IS NULL`,
      [duplicateIds]
    );
    console.log(`exercises rows deleted: ${delRes.rowCount}`);

    if (APPLY) {
      await client.query('COMMIT');
      console.log('\n✓ Transaction committed. Merge complete.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDRY-RUN: transaction rolled back. Pass --apply to commit.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Migration failed — transaction rolled back. Error:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
