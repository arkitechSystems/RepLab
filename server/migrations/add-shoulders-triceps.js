// One-time migration: Add Shoulders/Triceps workout to Will's Hypertrophy program
// Run with: node --env-file=.env server/migrations/add-shoulders-triceps.js

import pool from '../dbPool.js';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find Will's hypertrophy program
    const { rows: programs } = await client.query(
      "SELECT p.id, p.name FROM programs p JOIN users u ON u.id = p.user_id WHERE LOWER(u.first_name) = 'will' AND LOWER(p.name) LIKE '%hypertrophy%' LIMIT 1"
    );
    if (programs.length === 0) {
      console.error('Could not find hypertrophy program for user Will');
      await client.query('ROLLBACK');
      process.exit(1);
    }
    const programId = programs[0].id;
    console.log(`Found program: "${programs[0].name}" (id=${programId})`);

    // Find the chest workout sort_order in this program to insert after it
    const { rows: chestTemplates } = await client.query(
      "SELECT id, name, sort_order FROM templates WHERE program_id = $1 AND LOWER(name) LIKE '%chest%' ORDER BY sort_order LIMIT 1",
      [programId]
    );
    let insertSortOrder;
    if (chestTemplates.length > 0) {
      insertSortOrder = chestTemplates[0].sort_order + 1;
      console.log(`Inserting after "${chestTemplates[0].name}" (sort_order=${chestTemplates[0].sort_order})`);

      // Shift subsequent templates to make room
      await client.query(
        'UPDATE templates SET sort_order = sort_order + 1 WHERE program_id = $1 AND sort_order >= $2',
        [programId, insertSortOrder]
      );
    } else {
      // No chest workout found — append at end
      const { rows: maxRows } = await client.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM templates WHERE program_id = $1',
        [programId]
      );
      insertSortOrder = maxRows[0].next_order;
      console.log('No chest workout found, appending at end');
    }

    // Get user_id for the program owner
    const { rows: progOwner } = await client.query('SELECT user_id FROM programs WHERE id = $1', [programId]);
    const userId = progOwner[0].user_id;

    // Create the Shoulders/Triceps template
    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING id',
      [userId, programId, 'Shoulders/Triceps', '', insertSortOrder]
    );
    const templateId = tmpl.id;
    console.log(`Created template "Shoulders/Triceps" (id=${templateId}, sort_order=${insertSortOrder})`);

    // Insert exercises
    let exerciseSortOrder = 0;

    // Section Header: Warm Up
    await client.query(
      'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ($1, $2, 1, 0, 0, $3, TRUE, $4)',
      [templateId, 'Warm Up', exerciseSortOrder++, '1st set is to test your 1 rep max. Each week, increase the weight until failure, then remain at that weight until you get stronger.']
    );

    // DB Shoulder Press — 4 sets (2 warm up, 1 warm up, 1 touch up)
    const dbShoulderPressSets = [
      { reps: 20, weight: 20, type: 'warm_up' },
      { reps: 5, weight: 50, type: 'warm_up' },
      { reps: 5, weight: 75, type: 'warm_up' },
      { reps: 1, weight: 100, type: 'straight' },
    ];
    for (let i = 0; i < dbShoulderPressSets.length; i++) {
      const s = dbShoulderPressSets[i];
      await client.query(
        'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [templateId, 'DB Shoulder Press', s.type, i + 1, s.reps, s.weight, exerciseSortOrder]
      );
    }
    exerciseSortOrder++;

    // Banded Shoulder Press — 3 sets
    for (let i = 0; i < 3; i++) {
      await client.query(
        'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [templateId, 'Banded Shoulder Press', 'straight', i + 1, 8, 50, exerciseSortOrder]
      );
    }
    exerciseSortOrder++;

    // Upright Dips (Triceps) — 3 reg + 2 drop sets
    const dipsSets = [
      { reps: 8, weight: 70, type: 'straight' },
      { reps: 8, weight: 70, type: 'straight' },
      { reps: 8, weight: 70, type: 'straight' },
      { reps: 3, weight: 45, type: 'drop' },
      { reps: 10, weight: 0, type: 'drop' },
    ];
    for (let i = 0; i < dipsSets.length; i++) {
      const s = dipsSets[i];
      await client.query(
        'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [templateId, 'Upright Dips (Triceps)', s.type, i + 1, s.reps, s.weight, exerciseSortOrder]
      );
    }
    exerciseSortOrder++;

    // Cable Tricep Pushdowns — 3 sets
    for (let i = 0; i < 3; i++) {
      await client.query(
        'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [templateId, 'Cable Tricep Pushdowns', 'straight', i + 1, 8, 0, exerciseSortOrder]
      );
    }
    exerciseSortOrder++;

    // Cable Front Raises — 3 sets
    for (let i = 0; i < 3; i++) {
      await client.query(
        'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [templateId, 'Cable Front Raises', 'straight', i + 1, 10, 0, exerciseSortOrder]
      );
    }
    exerciseSortOrder++;

    // Cable Lateral Raises — 3 sets
    for (let i = 0; i < 3; i++) {
      await client.query(
        'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [templateId, 'Cable Lateral Raises', 'straight', i + 1, 10, 0, exerciseSortOrder]
      );
    }
    exerciseSortOrder++;

    // Close Grip Pushups — 1 set rest-pause
    await client.query(
      'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, exercise_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [templateId, 'Close Grip Pushups', 'rest_pause', 1, 0, 0, exerciseSortOrder, 'As many as possible in 2 minutes']
    );

    await client.query('COMMIT');
    console.log('Successfully added Shoulders/Triceps workout!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
