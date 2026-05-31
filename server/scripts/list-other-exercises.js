// Lists every exercise currently classified under muscle_group = 'Other'
// (case-insensitive match). Separates library exercises (created_by NULL)
// from user customs so the admin can re-classify the library ones once and
// fix the user customs too. Read-only — no writes.
//
// Run with:
//   node --env-file=.env server/scripts/list-other-exercises.js

import pool from '../dbPool.js';

async function main() {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.muscle_group, e.is_custom, e.created_by,
            u.email AS owner_email, u.username AS owner_username
       FROM exercises e
       LEFT JOIN users u ON u.id = e.created_by
      WHERE LOWER(COALESCE(e.muscle_group, '')) = 'other'
         OR e.muscle_group IS NULL
         OR e.muscle_group = ''
   ORDER BY e.created_by NULLS FIRST, e.name ASC`
  );

  if (rows.length === 0) {
    console.log('No exercises classified as Other.');
    return;
  }

  const library = rows.filter((r) => r.created_by === null);
  const customs = rows.filter((r) => r.created_by !== null);

  if (library.length > 0) {
    console.log(`\n=== LIBRARY exercises (created_by IS NULL) — ${library.length} ===`);
    for (const r of library) {
      const muscle = r.muscle_group == null ? '<NULL>' : (r.muscle_group === '' ? '<empty>' : r.muscle_group);
      console.log(`  [${r.id}] ${r.name}  (muscle: ${muscle})`);
    }
  }

  if (customs.length > 0) {
    console.log(`\n=== USER CUSTOM exercises — ${customs.length} ===`);
    for (const r of customs) {
      const muscle = r.muscle_group == null ? '<NULL>' : (r.muscle_group === '' ? '<empty>' : r.muscle_group);
      const owner = r.owner_username ? `@${r.owner_username}` : r.owner_email;
      console.log(`  [${r.id}] ${r.name}  (muscle: ${muscle}, owner: ${owner})`);
    }
  }

  console.log(`\nTotal: ${rows.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Query failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
