// Read-only lookup: does the master library contain a Machine Incline Press?
// Matches loosely (ILIKE both keywords) so variations like "Incline Machine
// Press" or "Machine Incline Bench Press" also surface.

import pool from '../dbPool.js';

async function main() {
  const { rows } = await pool.query(
    `SELECT id, name, muscle_group, tags FROM exercises
     WHERE created_by IS NULL
       AND name ILIKE '%machine%'
       AND name ILIKE '%incline%'
     ORDER BY name`
  );
  if (!rows.length) {
    console.log('No master-library exercise matches "machine" + "incline".');
    return;
  }
  console.log(`Found ${rows.length} matching exercise(s):\n`);
  for (const r of rows) {
    console.log(`  id=${String(r.id).padEnd(5)} "${r.name}"  muscle_group="${r.muscle_group}"  tags=${JSON.stringify(r.tags)}`);
  }
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
