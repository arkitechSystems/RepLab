// One-off master-library edits requested 2026-10-05:
//   1. Cable External Rotation → Shoulders, video 1N76I2Plbjk.
//   2. Raised Arm Cable External Rotation → Shoulders, video 6xGIVNYBIwE.
// Videos set here are marked video_linked_by = 'admin'. Master rows only
// (created_by IS NULL); users' custom exercises are never touched.
//
// Dry run (default) prints what it would do:
//   node --env-file=.env scripts/library-edits-2026-10-05.js
// Apply:
//   node --env-file=.env scripts/library-edits-2026-10-05.js --apply

import pool from '../dbPool.js';

const APPLY = process.argv.includes('--apply');

const EDITS = [
  { match: ['cable external rotation'], insertName: 'Cable External Rotation', muscle: 'Shoulders', videoId: '1N76I2Plbjk' },
  { match: ['raised arm cable external rotation'], insertName: 'Raised Arm Cable External Rotation', muscle: 'Shoulders', videoId: '6xGIVNYBIwE' },
];

async function main() {
  console.log(APPLY ? 'APPLYING changes\n' : 'DRY RUN — nothing will change (add --apply to save)\n');

  const { rows: groups } = await pool.query(
    `SELECT muscle_group, COUNT(*)::int AS n FROM exercises WHERE created_by IS NULL GROUP BY 1 ORDER BY 1`
  );
  const groupNames = groups.map((g) => g.muscle_group);
  console.log('Muscle groups in the master library:', groupNames.join(', '), '\n');
  if (!groupNames.includes('Shoulders')) {
    console.log('⚠ No "Shoulders" group found. Stopping without changes.');
    return;
  }

  // Similar names, so a near-duplicate (e.g. "Cable External Rotations")
  // is spotted before --apply adds a second row.
  const { rows: similar } = await pool.query(
    `SELECT id, name, muscle_group, video_id FROM exercises
      WHERE created_by IS NULL AND name ILIKE '%external rotation%'
      ORDER BY name`
  );
  console.log('Similar exercises already in the library:');
  for (const r of similar) console.log(`  #${r.id} "${r.name}" (${r.muscle_group}) video=${r.video_id || '—'}`);
  console.log('');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of EDITS) {
      const { rows } = await client.query(
        `SELECT id, name, muscle_group, video_id, video_linked_by FROM exercises
          WHERE created_by IS NULL AND LOWER(TRIM(name)) = ANY($1::text[])
          ORDER BY id`,
        [e.match]
      );
      if (rows.length === 0) {
        console.log(`+ "${e.insertName}" not found → add it to ${e.muscle}${e.videoId ? ` with video ${e.videoId}` : ''}`);
        if (APPLY) {
          const ins = await client.query(
            `INSERT INTO exercises (name, muscle_group, tags, video_id, video_linked_by, is_custom, created_by)
             VALUES ($1, $2, '{}', $3, $4, FALSE, NULL) RETURNING id`,
            [e.insertName, e.muscle, e.videoId, e.videoId ? 'admin' : null]
          );
          console.log(`  ✓ added id=${ins.rows[0].id}`);
        }
        continue;
      }
      for (const r of rows) {
        const changes = [];
        if (r.muscle_group !== e.muscle) changes.push(`group "${r.muscle_group}" → "${e.muscle}"`);
        if (e.videoId && r.video_id !== e.videoId) changes.push(`video ${r.video_id || '(none)'} → ${e.videoId}`);
        if (changes.length === 0) { console.log(`= #${r.id} "${r.name}" already correct`); continue; }
        console.log(`~ #${r.id} "${r.name}": ${changes.join('; ')}`);
        if (APPLY) {
          await client.query(
            e.videoId
              ? `UPDATE exercises SET muscle_group = $1, video_id = $2, video_linked_by = 'admin' WHERE id = $3`
              : `UPDATE exercises SET muscle_group = $1 WHERE id = $2`,
            e.videoId ? [e.muscle, e.videoId, r.id] : [e.muscle, r.id]
          );
          console.log('  ✓ updated');
        }
      }
    }
    await client.query(APPLY ? 'COMMIT' : 'ROLLBACK');
    if (APPLY) console.log('\nDone.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
