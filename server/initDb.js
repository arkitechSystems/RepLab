import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './dbPool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function initDb() {
  // Run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
  console.log('Database schema initialized');

  // Seed default program if none exist
  const { rows } = await pool.query('SELECT COUNT(*) FROM programs');
  if (parseInt(rows[0].count) === 0) {
    await seedDefaults();
  }
}

async function seedDefaults() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create default program
    const { rows: [program] } = await client.query(
      'INSERT INTO programs (user_id, name) VALUES (NULL, $1) RETURNING id',
      ['Push, Pull, Legs']
    );
    const programId = program.id;

    const templates = [
      {
        name: 'Push',
        description: 'Chest, Shoulders, Triceps',
        isRest: false,
        sortOrder: 0,
        exercises: [
          { name: 'Barbell Bench Press', sets: [{ reps: 10, weight: 135 }, { reps: 8, weight: 155 }, { reps: 6, weight: 175 }, { reps: 6, weight: 175 }] },
          { name: 'Incline Dumbbell Press', sets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 50 }, { reps: 8, weight: 55 }] },
          { name: 'Seated Shoulder Press (DB)', sets: [{ reps: 12, weight: 40 }, { reps: 10, weight: 45 }, { reps: 8, weight: 50 }] },
          { name: 'Lateral Raises', sets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 20 }, { reps: 12, weight: 25 }] },
          { name: 'Cable Tricep Pushdown', sets: [{ reps: 12, weight: 60 }, { reps: 12, weight: 70 }, { reps: 10, weight: 80 }] },
          { name: 'Overhead Tricep Extension (rope)', sets: [{ reps: 12, weight: 50 }, { reps: 10, weight: 60 }, { reps: 10, weight: 60 }] },
        ],
      },
      {
        name: 'Pull',
        description: 'Back, Rear Delts, Biceps',
        isRest: false,
        sortOrder: 1,
        exercises: [
          { name: 'Lat Pulldown', sets: [{ reps: 12, weight: 120 }, { reps: 10, weight: 140 }, { reps: 8, weight: 160 }] },
          { name: 'Barbell Row', sets: [{ reps: 10, weight: 135 }, { reps: 8, weight: 155 }, { reps: 8, weight: 155 }] },
          { name: 'Seated Cable Row', sets: [{ reps: 12, weight: 120 }, { reps: 12, weight: 130 }, { reps: 10, weight: 140 }] },
          { name: 'Face Pulls', sets: [{ reps: 15, weight: 50 }, { reps: 15, weight: 60 }, { reps: 12, weight: 70 }] },
          { name: 'Barbell Curl', sets: [{ reps: 12, weight: 65 }, { reps: 10, weight: 75 }, { reps: 8, weight: 85 }] },
          { name: 'Hammer Curl (DB)', sets: [{ reps: 12, weight: 30 }, { reps: 10, weight: 35 }, { reps: 10, weight: 35 }] },
        ],
      },
      {
        name: 'Legs',
        description: 'Quads, Hamstrings, Glutes, Calves',
        isRest: false,
        sortOrder: 2,
        exercises: [
          { name: 'Back Squat', sets: [{ reps: 10, weight: 185 }, { reps: 8, weight: 205 }, { reps: 6, weight: 225 }, { reps: 6, weight: 225 }] },
          { name: 'Romanian Deadlift', sets: [{ reps: 10, weight: 135 }, { reps: 10, weight: 155 }, { reps: 8, weight: 185 }] },
          { name: 'Leg Press', sets: [{ reps: 12, weight: 270 }, { reps: 12, weight: 320 }, { reps: 10, weight: 360 }] },
          { name: 'Leg Curl', sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 100 }, { reps: 10, weight: 110 }] },
          { name: 'Leg Extension', sets: [{ reps: 12, weight: 110 }, { reps: 12, weight: 120 }, { reps: 10, weight: 130 }] },
          { name: 'Standing Calf Raise', sets: [{ reps: 15, weight: 140 }, { reps: 15, weight: 160 }, { reps: 12, weight: 180 }] },
        ],
      },
      {
        name: 'Rest',
        description: 'Recovery Day',
        isRest: true,
        sortOrder: 3,
        exercises: [],
      },
    ];

    for (const t of templates) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [programId, t.name, t.description, t.isRest, t.sortOrder]
      );

      let exSortOrder = 0;
      for (const ex of t.exercises) {
        for (let i = 0; i < ex.sets.length; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
            [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight, exSortOrder]
          );
        }
        exSortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log('Seeded default workout templates');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
