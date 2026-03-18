import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './dbPool.js';
import SEED_EXERCISES from './seedExercises.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function initDb() {
  // Run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);

  // Migrations
  await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS set_type TEXT DEFAULT 'straight'`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS rep_range TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS exercise_description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE`);
  await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_source TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'Free'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_device TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_content TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_term TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS zip_code TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_city TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_state TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ`);

  await pool.query(`CREATE TABLE IF NOT EXISTS ai_usage (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    model TEXT,
    cost_cents NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // New tables for admin features
  await pool.query(`CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    description TEXT DEFAULT ''
  )`);

  // Rename Face Pulls to Cable Warm Up in Will's Pull 1
  await pool.query(`
    UPDATE template_exercises SET name = 'Cable Warm Up with Rope Attachment'
    WHERE name = 'Face Pulls' AND template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND sort_order = 0
  `, ["Will's Pull 1", "Will's PPL"]);

  // Remove Straight-Arm Pulldowns, Cable Rows, Hammer Curls (warm-up) from Will's Pull 1
  // and change Single-Arm Cable Curls to 1 set of 50
  await pool.query(`
    DELETE FROM template_exercises WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND name IN ('Straight-Arm Pulldowns', 'Cable Rows', 'Hammer Curls (warm-up)')
    AND sort_order IN (1, 2, 3)
  `, ["Will's Pull 1", "Will's PPL"]);

  await pool.query(`
    UPDATE template_exercises SET planned_reps = 50, exercise_description = '50 total reps per arm.'
    WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND name = 'Single-Arm Cable Curls'
  `, ["Will's Pull 1", "Will's PPL"]);

  // Delete extra sets for Single-Arm Cable Curls (keep only set_number 1)
  await pool.query(`
    DELETE FROM template_exercises WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND name = 'Single-Arm Cable Curls' AND set_number > 1
  `, ["Will's Pull 1", "Will's PPL"]);

  // Update warm-up superset descriptions in Will's Pull 1
  await pool.query(`
    UPDATE template_exercises SET exercise_description = 'Superset: Face Pulls, Straight-Arm Pulldowns, Cable Rows, Hammer Curls'
    WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND sort_order IN (0, 1, 2, 3)
  `, ["Will's Pull 1", "Will's PPL"]);

  // Exercises table + seed
  await pool.query(`CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_custom BOOLEAN DEFAULT FALSE,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows: exCount } = await pool.query('SELECT COUNT(*) FROM exercises');
  if (parseInt(exCount[0].count) === 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const ex of SEED_EXERCISES) {
        await client.query(
          'INSERT INTO exercises (name, muscle_group, tags, is_custom, created_by) VALUES ($1, $2, $3, FALSE, NULL)',
          [ex.name, ex.muscle, ex.tags]
        );
      }
      await client.query('COMMIT');
      console.log('Seeded exercise library');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('Database schema initialized');

  // Seed default program if none exist
  const { rows } = await pool.query('SELECT COUNT(*) FROM programs');
  if (parseInt(rows[0].count) === 0) {
    await seedDefaults();
  }

  // Seed Upper/Lower program if not already present
  const { rows: ulRows } = await pool.query("SELECT id FROM programs WHERE name = 'Upper/Lower' AND user_id IS NULL");
  if (ulRows.length === 0) {
    await seedUpperLower();
  }

  // Seed Bro Split program if not already present
  const { rows: bsRows } = await pool.query("SELECT id FROM programs WHERE name = 'Bro Split Workout' AND user_id IS NULL");
  if (bsRows.length === 0) {
    await seedBroSplit();
  }

  // Seed Booty Revolution Inspired if not already present
  const { rows: brRows } = await pool.query("SELECT id FROM programs WHERE name IN ('Booty Revolution Inspired', 'Glute Hypertrophy') AND user_id IS NULL");
  if (brRows.length === 0) {
    await seedBootyRevolution();
  }

  // Seed Will's PPL if not already present
  const { rows: wpplRows } = await pool.query("SELECT id FROM programs WHERE name = $1 AND user_id IS NULL", ["Will's PPL"]);
  if (wpplRows.length === 0) {
    await seedWillsPPL();
  }

  // Seed Will's Legs 2 into existing Will's PPL if not already present
  if (wpplRows.length > 0) {
    const pplId = wpplRows[0].id;
    const { rows: legs2Rows } = await pool.query(
      "SELECT id FROM templates WHERE name = $1 AND program_id = $2",
      ["Will's Legs 2", pplId]
    );
    if (legs2Rows.length === 0) {
      await seedWillsLegs2(pplId);
    }
  }

  // Seed Will's Push 1 into existing Will's PPL if not already present
  if (wpplRows.length > 0) {
    const pplId = wpplRows[0].id;
    const { rows: push1Rows } = await pool.query(
      "SELECT id FROM templates WHERE name = $1 AND program_id = $2",
      ["Will's Push 1", pplId]
    );
    if (push1Rows.length === 0) {
      await seedWillsPush1(pplId);
    }
  }

  // Challenge entries table
  await pool.query(`CREATE TABLE IF NOT EXISTS challenge_entries (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    value INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // Expand Will's PPL to 7-day cycle and 4 weeks (non-fatal if it fails)
  try {
    const { rows: pplRows } = await pool.query("SELECT id FROM programs WHERE name = $1 AND user_id IS NULL", ["Will's PPL"]);
    if (pplRows.length > 0) {
      const pplId = pplRows[0].id;
      // Expand to 7-day cycle
      const { rows: expandedCheck } = await pool.query(
        "SELECT id FROM templates WHERE program_id = $1 AND name IN ($2, $3)",
        [pplId, "Will's Push 2", "Rest Day"]
      );
      if (expandedCheck.length === 0) {
        await expandPPLto7Days(pplId);
      }
      // Expand to 4 weeks
      const { rows: week2Check } = await pool.query(
        "SELECT id FROM templates WHERE program_id = $1 AND name LIKE '%(Week 2)%'",
        [pplId]
      );
      if (week2Check.length === 0) {
        await expandPPLto4Weeks(pplId);
      }
    }
  } catch (err) {
    console.error('PPL expansion migration failed (non-fatal):', err.message);
  }

  // Seed ZJ's Workout if not already present
  const { rows: zjRows } = await pool.query("SELECT id FROM programs WHERE name = $1 AND user_id IS NULL", ["ZJ's Workout"]);
  if (zjRows.length === 0) {
    await seedZJsWorkout();
  }

  // Seed or expand Mike Mentzer Workout
  const { rows: mmRows } = await pool.query("SELECT id FROM programs WHERE name = $1 AND user_id IS NULL", ['Mike Mentzer Workout']);
  if (mmRows.length === 0) {
    await seedMikeMentzer();
  } else {
    // Expand to 28 days if still the old 4-template version
    const mmId = mmRows[0].id;
    const { rows: mmCount } = await pool.query("SELECT COUNT(*)::int AS cnt FROM templates WHERE program_id = $1", [mmId]);
    if (mmCount[0].cnt < 28) {
      try {
        await pool.query("DELETE FROM templates WHERE program_id = $1", [mmId]);
        await pool.query("UPDATE programs SET description = $1 WHERE id = $2", ['4-week Heavy Duty program — 4-day cycle with 1 working set to failure', mmId]);
        await seedMikeMentzerTemplates(mmId);
        console.log('Expanded Mike Mentzer Workout to 28 days');
      } catch (err) {
        console.error('Mike Mentzer expansion failed (non-fatal):', err.message);
      }
    }
  }

  // Expand Push, Pull, Legs to 6-week program (non-fatal)
  try {
    const { rows: pplBrowseRows } = await pool.query("SELECT id FROM programs WHERE name = $1 AND user_id IS NULL", ['Push, Pull, Legs']);
    if (pplBrowseRows.length > 0) {
      const pid = pplBrowseRows[0].id;
      const { rows: tmplCount } = await pool.query("SELECT COUNT(*)::int AS cnt FROM templates WHERE program_id = $1", [pid]);
      if (tmplCount[0].cnt < 42) {
        await expandBrowsePPLto6Weeks(pid);
      }
    }
  } catch (err) {
    console.error('Browse PPL expansion failed (non-fatal):', err.message);
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

    // Base week template: Push, Pull, Legs, Push, Pull, Legs, Rest
    const baseWorkouts = [
      {
        name: 'Push',
        description: 'Chest, Shoulders, Triceps',
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
        exercises: [
          { name: 'Back Squat', sets: [{ reps: 10, weight: 185 }, { reps: 8, weight: 205 }, { reps: 6, weight: 225 }, { reps: 6, weight: 225 }] },
          { name: 'Romanian Deadlift', sets: [{ reps: 10, weight: 135 }, { reps: 10, weight: 155 }, { reps: 8, weight: 185 }] },
          { name: 'Leg Press', sets: [{ reps: 12, weight: 270 }, { reps: 12, weight: 320 }, { reps: 10, weight: 360 }] },
          { name: 'Leg Curl', sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 100 }, { reps: 10, weight: 110 }] },
          { name: 'Leg Extension', sets: [{ reps: 12, weight: 110 }, { reps: 12, weight: 120 }, { reps: 10, weight: 130 }] },
          { name: 'Standing Calf Raise', sets: [{ reps: 15, weight: 140 }, { reps: 15, weight: 160 }, { reps: 12, weight: 180 }] },
        ],
      },
    ];

    // Generate 6 weeks: weight increases +5 lbs every 2 weeks
    // Weeks 1-2: base, Weeks 3-4: +5, Weeks 5-6: +10
    for (let week = 1; week <= 6; week++) {
      const weightBonus = Math.floor((week - 1) / 2) * 5; // 0, 0, 5, 5, 10, 10
      const weekOffset = (week - 1) * 7;
      const weekLabel = week > 1 ? ` (Week ${week})` : '';

      // 6 workouts per week: Push, Pull, Legs, Push, Pull, Legs
      for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
        const base = baseWorkouts[dayIdx % 3];
        const sortOrder = weekOffset + dayIdx;
        const name = `${base.name}${weekLabel}`;

        const { rows: [tmpl] } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
          [programId, name, base.description, sortOrder]
        );

        let exSortOrder = 0;
        for (const ex of base.exercises) {
          for (let i = 0; i < ex.sets.length; i++) {
            await client.query(
              'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
              [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight + weightBonus, exSortOrder]
            );
          }
          exSortOrder++;
        }
      }

      // Rest day at end of each week
      const restName = week > 1 ? `Rest (Week ${week})` : 'Rest';
      await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, TRUE, $4)',
        [programId, restName, 'Recovery Day', weekOffset + 6]
      );
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

async function seedUpperLower() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, 'Upper/Lower', '4-day upper/lower strength split') RETURNING id"
    );
    const programId = program.id;

    const workouts = [
      {
        name: 'Upper A',
        description: 'Bench, Pull-ups, OHP, Row, Curls, Triceps',
        sortOrder: 0,
        exercises: [
          { name: 'Bench Press', sets: 4, repRange: '6-8', description: 'Barbell press performed lying on a bench. Primary chest compound movement focusing on pressing strength. Keep shoulder blades retracted and drive through the chest.' },
          { name: 'Pull Ups', sets: 4, repRange: '6-10', description: 'Vertical pulling movement targeting the lats and upper back. Pull chest toward the bar and control the descent.' },
          { name: 'Overhead Press', sets: 3, repRange: '8-10', description: 'Standing barbell or dumbbell press targeting shoulders and triceps. Core should remain tight and avoid arching the lower back.' },
          { name: 'Dumbbell Row', sets: 3, repRange: '8-12', description: 'Single-arm horizontal pulling movement for the upper back. Pull elbow toward the hip while keeping the torso stable.' },
          { name: 'Bicep Curls', sets: 3, repRange: '10-12', description: 'Isolation movement targeting the biceps. Keep elbows close to the body and avoid swinging the weight.' },
          { name: 'Tricep Extensions', sets: 3, repRange: '10-12', description: 'Isolation movement for the triceps. Fully extend arms and control the lowering phase.' },
        ],
      },
      {
        name: 'Lower A',
        description: 'Squat, RDL, Split Squats, Hamstring Curl, Core',
        sortOrder: 1,
        exercises: [
          { name: 'Jump Squats', sets: 3, repRange: '5', description: 'Explosive plyometric exercise performed before heavy lifts. Squat down and explode upward to develop lower-body power.' },
          { name: 'Back Squat', sets: 4, repRange: '6-8', description: 'Primary lower body compound movement targeting quads, glutes, and core. Maintain a neutral spine and push knees outward.' },
          { name: 'Romanian Deadlift', sets: 3, repRange: '8-10', description: 'Hip hinge movement targeting hamstrings and glutes. Lower the bar by pushing hips back while keeping the back flat.' },
          { name: 'Bulgarian Split Squats', sets: 3, repRange: '8-10', description: 'Single-leg strength exercise improving balance and glute activation. Rear foot elevated on bench.' },
          { name: 'Hamstring Curl', sets: 3, repRange: '10-12', description: 'Isolation movement for hamstrings performed on a machine or stability ball.' },
          { name: 'Planks', sets: 3, repRange: '30-45s', description: 'Core stabilization exercise maintaining a straight line from head to heels.' },
        ],
      },
      {
        name: 'Upper B',
        description: 'Incline Press, Lat Pulldown, Shoulder Press, Cable Row',
        sortOrder: 2,
        exercises: [
          { name: 'Incline Bench Press', sets: 4, repRange: '8-10', description: 'Chest press performed on an incline bench emphasizing the upper chest.' },
          { name: 'Lat Pulldown', sets: 4, repRange: '8-12', description: 'Machine-based vertical pulling movement targeting the lats.' },
          { name: 'Dumbbell Shoulder Press', sets: 3, repRange: '8-10', description: 'Seated or standing shoulder press targeting deltoids.' },
          { name: 'Seated Cable Row', sets: 3, repRange: '8-12', description: 'Horizontal pulling movement targeting mid-back and rhomboids.' },
          { name: 'Hammer Curls', sets: 3, repRange: '10-12', description: 'Neutral grip curl targeting the brachialis and forearms.' },
          { name: 'Tricep Dips', sets: 3, repRange: '8-12', description: 'Bodyweight pressing movement targeting chest and triceps.' },
        ],
      },
      {
        name: 'Lower B',
        description: 'Front Squat, Hip Thrust, Lunges, Leg Curl, Core',
        sortOrder: 3,
        exercises: [
          { name: 'Box Jumps', sets: 3, repRange: '5', description: 'Explosive jumping movement improving lower-body power.' },
          { name: 'Front Squat', sets: 4, repRange: '6-8', description: 'Squat variation emphasizing quadriceps and core stability.' },
          { name: 'Hip Thrust', sets: 3, repRange: '8-10', description: 'Glute-focused compound lift performed with shoulders on a bench.' },
          { name: 'Walking Lunges', sets: 3, repRange: '10', description: 'Dynamic single-leg movement improving balance and leg strength.' },
          { name: 'Leg Curl', sets: 3, repRange: '10-12', description: 'Hamstring isolation movement.' },
          { name: 'Hanging Leg Raises', sets: 3, repRange: '10-15', description: 'Core exercise targeting lower abdominals.' },
        ],
      },
    ];

    for (const w of workouts) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
        [programId, w.name, w.description, w.sortOrder]
      );

      let sortOrder = 0;
      for (const ex of w.exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
            [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, sortOrder, ex.repRange, ex.description]
          );
        }
        sortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log('Seeded Upper/Lower program');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedBroSplit() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, 'Bro Split Workout', '5-day muscle group split') RETURNING id"
    );
    const programId = program.id;

    const workouts = [
      {
        name: 'Chest',
        description: 'Bench Press, Incline, Fly, Dips',
        sortOrder: 0,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, repRange: '5-8', description: 'Heavy compound chest movement that develops overall pressing strength and stimulates the chest, shoulders, and triceps.' },
          { name: 'Incline Dumbbell Press', sets: 3, repRange: '8-10', description: 'Targets the upper chest and allows a greater stretch than a barbell press.' },
          { name: 'Chest Fly', sets: 3, repRange: '10-12', description: 'Isolation movement focusing on chest contraction and stretch.' },
          { name: 'Chest Dips', sets: 3, repRange: '8-12', description: 'Bodyweight pressing movement that emphasizes the lower chest.' },
        ],
      },
      {
        name: 'Back',
        description: 'Pull-Ups, Barbell Row, Lat Pulldown, Face Pulls',
        sortOrder: 1,
        exercises: [
          { name: 'Pull-Ups', sets: 4, repRange: '6-10', description: 'Vertical pulling exercise targeting the lats and upper back.' },
          { name: 'Barbell Row', sets: 3, repRange: '6-8', description: 'Heavy horizontal pull that builds mid-back thickness.' },
          { name: 'Lat Pulldown', sets: 3, repRange: '8-12', description: 'Machine-based pulling movement emphasizing lat activation.' },
          { name: 'Face Pulls', sets: 3, repRange: '12-15', description: 'Targets rear delts and upper back for shoulder health and posture.' },
        ],
      },
      {
        name: 'Shoulders',
        description: 'Overhead Press, Lateral Raises, Rear Delt Fly',
        sortOrder: 2,
        exercises: [
          { name: 'Overhead Press', sets: 4, repRange: '6-8', description: 'Compound shoulder movement targeting the anterior delts and triceps.' },
          { name: 'Lateral Raises', sets: 4, repRange: '12-15', description: 'Isolation exercise that builds shoulder width by targeting the side delts.' },
          { name: 'Rear Delt Fly', sets: 3, repRange: '12-15', description: 'Targets the rear deltoids to balance shoulder development.' },
        ],
      },
      {
        name: 'Arms',
        description: 'Barbell Curls, Hammer Curls, Skull Crushers, Pushdowns',
        sortOrder: 3,
        exercises: [
          { name: 'Barbell Curls', sets: 3, repRange: '8-10', description: 'Primary biceps movement for overall arm development.' },
          { name: 'Hammer Curls', sets: 3, repRange: '10-12', description: 'Targets the brachialis and forearms.' },
          { name: 'Skull Crushers', sets: 3, repRange: '8-10', description: 'Triceps movement emphasizing elbow extension strength.' },
          { name: 'Tricep Pushdowns', sets: 3, repRange: '10-12', description: 'Isolation exercise focusing on triceps contraction.' },
        ],
      },
      {
        name: 'Legs',
        description: 'Squat, Leg Press, Extensions, Curls, Calves',
        sortOrder: 4,
        exercises: [
          { name: 'Back Squat', sets: 4, repRange: '5-8', description: 'Primary lower-body compound movement targeting quads, glutes, and core.' },
          { name: 'Leg Press', sets: 3, repRange: '8-12', description: 'Machine movement allowing heavy quad stimulation with less spinal loading.' },
          { name: 'Leg Extension', sets: 3, repRange: '10-12', description: 'Isolation exercise emphasizing the quadriceps.' },
          { name: 'Hamstring Curl', sets: 3, repRange: '10-12', description: 'Isolation movement targeting the hamstrings.' },
          { name: 'Standing Calf Raises', sets: 4, repRange: '12-15', description: 'Isolation exercise strengthening the calves.' },
        ],
      },
      {
        name: 'Rest',
        description: 'Recovery Day',
        sortOrder: 5,
        isRest: true,
        exercises: [],
      },
    ];

    for (const w of workouts) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [programId, w.name, w.description, w.isRest || false, w.sortOrder]
      );

      let sortOrder = 0;
      for (const ex of w.exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
            [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, sortOrder, ex.repRange, ex.description]
          );
        }
        sortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log('Seeded Bro Split Workout program');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedBootyRevolution() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, 'Glute Hypertrophy', '6-week glute-focused program built around hip thrusts, sumo squats, posterior chain work, and conditioning') RETURNING id"
    );
    const programId = program.id;

    const workouts = [
      {
        name: 'Glute Strength + Upper',
        description: 'Primary glute strength day with upper-body accessories for balance',
        sortOrder: 0,
        exercises: [
          { name: 'Hip Thrust', sets: 3, repRange: '8', description: 'Primary glute hypertrophy lift focused on powerful hip extension and peak glute contraction.' },
          { name: 'Back Hyperextension', sets: 3, repRange: '8', description: 'Posterior chain movement targeting glutes, hamstrings, and spinal erectors.' },
          { name: 'Dumbbell Sumo Squat', sets: 3, repRange: '8', description: 'Wide-stance squat variation emphasizing glutes, inner thighs, and quads.' },
          { name: 'Prone Glute Leg Raise', sets: 3, repRange: '8', description: 'Glute isolation movement focused on hip extension and glute activation.' },
          { name: 'Pull-Ups', sets: 3, repRange: '6', description: 'Vertical pulling exercise for upper-back and lat development.' },
          { name: 'Dumbbell Lateral Raise', sets: 3, repRange: '8', description: 'Shoulder isolation exercise targeting the side delts.' },
          { name: 'Overhead Triceps Extension', sets: 3, repRange: '8', description: 'Triceps isolation movement emphasizing the long head.' },
          { name: 'Close-Grip Push-Ups', sets: 3, repRange: '8', description: 'Bodyweight pressing movement targeting triceps, chest, and front delts.' },
        ],
      },
      {
        name: 'Glute Conditioning',
        description: 'Low-load activation day to improve recovery and glute blood flow',
        sortOrder: 1,
        exercises: [
          { name: 'Cardio', sets: 1, repRange: '30 min', description: 'Moderate steady-state cardio for conditioning and recovery.' },
          { name: 'Band Walks', sets: 4, repRange: '25', description: 'Lateral glute activation drill targeting glute medius and hip stability.' },
          { name: 'Glute Bridge', sets: 3, repRange: '15', description: 'Beginner-friendly glute movement to reinforce glute contraction and hip extension.' },
          { name: 'Bodyweight Frog Pumps', sets: 3, repRange: '20', description: 'High-rep glute burnout exercise emphasizing constant tension.' },
          { name: 'Standing Kickbacks', sets: 3, repRange: '15', description: 'Isolation movement targeting the glutes with controlled hip extension.' },
        ],
      },
      {
        name: 'Posterior Chain',
        description: 'Heavy posterior-chain day emphasizing glutes and hamstrings',
        sortOrder: 2,
        exercises: [
          { name: 'Good Morning', sets: 4, repRange: '5-12', description: 'Hip hinge movement targeting glutes, hamstrings, and lower back. Use controlled technique.' },
          { name: 'Romanian Deadlift', sets: 4, repRange: '8-10', description: 'Glute and hamstring builder focused on eccentric control and hip hinge mechanics.' },
          { name: 'Walking Lunges', sets: 3, repRange: '10', description: 'Unilateral leg exercise that develops glutes, quads, and balance.' },
          { name: 'Hamstring Curl', sets: 3, repRange: '10-12', description: 'Isolation exercise for hamstrings to support posterior chain growth.' },
          { name: 'Cable Pull-Through', sets: 3, repRange: '12-15', description: 'Glute-focused hinge movement emphasizing hip extension with lower spinal loading.' },
          { name: 'Plank', sets: 3, repRange: '30-45s', description: 'Core stabilization movement to support posture and bracing during heavy lower-body lifts.' },
        ],
      },
      {
        name: 'Glute Strength + Accessories',
        description: 'Second strength-focused glute day with single-leg work and accessories',
        sortOrder: 3,
        exercises: [
          { name: 'Barbell Hip Thrust', sets: 4, repRange: '8-10', description: 'Main glute builder focused on heavy loading and full hip lockout.' },
          { name: 'Bulgarian Split Squat', sets: 3, repRange: '8-10', description: 'Unilateral lower-body movement emphasizing glutes and quads.' },
          { name: 'Leg Press', sets: 3, repRange: '10-12', description: 'Lower-body compound movement allowing controlled volume for glutes and quads.' },
          { name: 'Dumbbell Step-Ups', sets: 3, repRange: '10', description: 'Functional unilateral movement that trains glutes, quads, and balance.' },
          { name: 'Cable Glute Kickback', sets: 3, repRange: '12-15', description: 'Isolation exercise for glute max with strong peak contraction.' },
          { name: 'Seated Abduction Machine', sets: 3, repRange: '15-20', description: 'Glute medius-focused movement for upper glute and hip stability development.' },
        ],
      },
      {
        name: 'Glute Pump + Conditioning',
        description: 'Higher-rep glute burnout day with metabolic stress and conditioning',
        sortOrder: 4,
        exercises: [
          { name: 'Dumbbell Glute Bridge', sets: 3, repRange: '15', description: 'High-rep glute bridge variation for additional glute volume and pump.' },
          { name: 'Goblet Squat', sets: 3, repRange: '12-15', description: 'Squat variation that reinforces full-depth mechanics while training glutes and quads.' },
          { name: 'Reverse Lunges', sets: 3, repRange: '10', description: 'Lower-body unilateral movement with a strong glute emphasis.' },
          { name: 'Frog Pumps', sets: 3, repRange: '25', description: 'High-rep glute finisher designed for metabolic stress and glute activation.' },
          { name: 'Banded Abductions', sets: 3, repRange: '20', description: 'Glute medius finisher for upper glute burn and hip stability.' },
          { name: 'Incline Walk or Stair Climber', sets: 1, repRange: '15-20 min', description: 'Conditioning finisher that reinforces glute and lower-body endurance.' },
        ],
      },
      {
        name: 'Rest',
        description: 'Recovery Day',
        sortOrder: 5,
        isRest: true,
        exercises: [],
      },
    ];

    for (const w of workouts) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [programId, w.name, w.description, w.isRest || false, w.sortOrder]
      );

      let sortOrder = 0;
      for (const ex of w.exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
            [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, sortOrder, ex.repRange, ex.description]
          );
        }
        sortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log('Seeded Glute Hypertrophy program');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedWillsPPL() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, $1, $2) RETURNING id",
      ["Will's PPL", "Will's custom Push, Pull, Legs split"]
    );
    const programId = program.id;

    const workouts = [
      {
        name: "Will's Legs 2",
        description: 'Quads, Hamstrings, Glutes, Calves',
        sortOrder: 1,
        exercises: [
          { name: 'Leg Extensions', sets: 3, repRange: '10-12', description: 'Quad isolation movement. Focus on controlled contraction at the top.' },
          { name: 'Leg Curls', sets: 3, repRange: '10-12', description: 'Hamstring isolation movement. Control the eccentric and squeeze at peak contraction.' },
          { name: 'Single Leg Leg Press', sets: 3, repRange: '10', description: 'Unilateral leg press for quad and glute development. One leg at a time to address imbalances.' },
          { name: 'BB Lunges', sets: 3, repRange: '10', description: 'Superset 1 of 3. Barbell lunges immediately into BB Squats and Calf Raises — no rest between exercises.' },
          { name: 'BB Squats', sets: 3, repRange: '10', description: 'Superset 2 of 3. Performed immediately after BB Lunges. Keep the same barbell loaded.' },
          { name: 'Calf Raises', sets: 3, repRange: '15', description: 'Superset 3 of 3. Performed immediately after BB Squats to finish the tri-set.' },
          { name: 'DB Walking Lunges', sets: 1, repRange: '20', description: 'Dumbbell walking lunges for distance/reps. Both legs, continuous movement.' },
          { name: 'DB Walking Lunges (Left)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — left leg only. Step with the left leg each rep.' },
          { name: 'DB Walking Lunges (Right)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — right leg only. Step with the right leg each rep.' },
          { name: 'Hip Abduction', sets: 2, repRange: '15', description: 'Machine hip abduction targeting the outer glutes and hip stabilizers.' },
          { name: 'Hip Adduction', sets: 2, repRange: '15', description: 'Machine hip adduction targeting the inner thighs.' },
        ],
      },
      {
        name: "Will's Pull 1",
        description: 'Back, Biceps, Rear Delts',
        sortOrder: 0,
        exercises: [
          { name: 'Cable Warm Up with Rope Attachment', sets: 3, repRange: '12-15', description: 'Superset: Face Pulls, Straight-Arm Pulldowns, Cable Rows, Hammer Curls' },
          { name: 'Single-Arm Cable Curls', sets: 1, repRange: '50', description: '50 total reps per arm.' },
          { name: 'Supinated Weighted Pull-Ups', sets: 3, repRange: '6', description: 'Underhand grip pull-ups with added weight. Focus on full range of motion and controlled reps.' },
          { name: 'Barbell Shrugs', sets: 3, repRange: '10-12', description: 'Superset with Hammer Curls. Heavy shrugs targeting upper traps — squeeze and hold at the top.' },
          { name: 'Hammer Curls', sets: 3, repRange: '10-12', description: 'Superset with Barbell Shrugs. Neutral grip curls targeting brachialis and forearms.' },
          { name: 'Banded Preacher Curls', sets: 3, repRange: '10-12', description: 'Resistance band preacher curls for constant tension through the full range of motion.' },
          { name: 'Wide-Grip Cable Pulldowns', sets: 3, repRange: '10-12', description: 'Wide grip lat pulldown emphasizing outer lats and upper back width.' },
          { name: 'Pyramid Single-Arm Cable Curls', sets: 7, repRange: '10', description: 'Pyramid sets: increase weight for 3 sets up to set 4 (peak), then decrease weight for the last 3 sets back down.' },
        ],
      },
    ];

    for (const w of workouts) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
        [programId, w.name, w.description, w.sortOrder]
      );

      let sortOrder = 0;
      for (const ex of w.exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
            [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, sortOrder, ex.repRange, ex.description]
          );
        }
        sortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log("Seeded Will's PPL program");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedWillsLegs2(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current max sort_order for this program
    const { rows: [maxRow] } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM templates WHERE program_id = $1',
      [programId]
    );
    const sortOrder = maxRow.max_sort + 1;

    const exercises = [
      { name: 'Leg Extensions', sets: 3, repRange: '10-12', description: 'Quad isolation movement. Focus on controlled contraction at the top.' },
      { name: 'Leg Curls', sets: 3, repRange: '10-12', description: 'Hamstring isolation movement. Control the eccentric and squeeze at peak contraction.' },
      { name: 'Single Leg Leg Press', sets: 3, repRange: '10', description: 'Unilateral leg press for quad and glute development. One leg at a time to address imbalances.' },
      { name: 'BB Lunges', sets: 3, repRange: '10', description: 'Superset 1 of 3. Barbell lunges immediately into BB Squats and Calf Raises — no rest between exercises.' },
      { name: 'BB Squats', sets: 3, repRange: '10', description: 'Superset 2 of 3. Performed immediately after BB Lunges. Keep the same barbell loaded.' },
      { name: 'Calf Raises', sets: 3, repRange: '15', description: 'Superset 3 of 3. Performed immediately after BB Squats to finish the tri-set.' },
      { name: 'DB Walking Lunges', sets: 1, repRange: '20', description: 'Dumbbell walking lunges for distance/reps. Both legs, continuous movement.' },
      { name: 'DB Walking Lunges (Left)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — left leg only. Step with the left leg each rep.' },
      { name: 'DB Walking Lunges (Right)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — right leg only. Step with the right leg each rep.' },
      { name: 'Hip Abduction', sets: 2, repRange: '15', description: 'Machine hip abduction targeting the outer glutes and hip stabilizers.' },
      { name: 'Hip Adduction', sets: 2, repRange: '15', description: 'Machine hip adduction targeting the inner thighs.' },
    ];

    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
      [programId, "Will's Legs 2", 'Quads, Hamstrings, Glutes, Calves', sortOrder]
    );

    let exSort = 0;
    for (const ex of exercises) {
      for (let i = 0; i < ex.sets; i++) {
        await client.query(
          'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
          [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, exSort, ex.repRange, ex.description]
        );
      }
      exSort++;
    }

    await client.query('COMMIT');
    console.log("Seeded Will's Legs 2 template");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedZJsWorkout() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, $1, $2) RETURNING id",
      ["ZJ's Workout", "ZJ's hypertrophy training program"]
    );
    const programId = program.id;

    const exercises = [
      { name: 'Cable Chest Flyes (Pre-Exhaust)', sets: [{ reps: 20, weight: 50 }, { reps: 8, weight: 45 }, { reps: 12, weight: 40 }, { reps: 16, weight: 35 }, { reps: 20, weight: 30 }], repRange: '8-20', description: 'Middle chest pre-exhaust. Set 1: 20 reps, Set 2: 16 reps, Set 3: 12 reps, Set 4: 8 reps, Set 5: 20 reps. 45 sec rest between sets. Choose a weight and increase each set.' },
      { name: 'Decline Barbell Bench Press', sets: [{ reps: 6, weight: 205 }, { reps: 6, weight: 205 }, { reps: 6, weight: 205 }, { reps: 6, weight: 205 }], repRange: '6-10', description: 'Primary lift. 3 sec down, controlled press up. Slight pause at the bottom to increase chest tension. 2 min rest.' },
      { name: 'Incline Dumbbell Press', sets: [{ reps: 12, weight: 100 }, { reps: 12, weight: 100 }, { reps: 12, weight: 100 }, { reps: 12, weight: 100 }], repRange: '8-12', description: 'Targets upper chest to balance the decline work. 90 sec rest.' },
      { name: 'Chest Dips (Lean Forward)', sets: [{ reps: 12, weight: 45 }, { reps: 10, weight: 45 }, { reps: 8, weight: 45 }], repRange: '8-12', description: 'Lean forward to emphasize chest. If bodyweight is easy, add weight with a belt. 90 sec rest. (1.5 reps) — Repeat the bottom half of the rep to accentuate the stretch.' },
      { name: 'Machine or Cable Chest Fly', sets: [{ reps: 15, weight: 50 }, { reps: 12, weight: 55 }, { reps: 12, weight: 60 }, { reps: 12, weight: 60 }], repRange: '12-15', description: 'Focus on slow stretch and squeeze. 60-75 sec rest.' },
      { name: 'Push-ups to Failure (Finisher)', sets: [{ reps: 99, weight: 0 }, { reps: 99, weight: 0 }], repRange: '999', description: 'Optional finisher. Go to failure each set.' },
    ];

    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, 0) RETURNING id',
      [programId, "ZJ's Chest Workout", 'Hypertrophy Chest Workout — Pre-exhaust cable flyes, decline bench, incline press, dips, flyes, burnout, finisher']
    );

    let sortOrder = 0;
    for (const ex of exercises) {
      for (let i = 0; i < ex.sets.length; i++) {
        await client.query(
          'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight, sortOrder, ex.repRange, ex.description]
        );
      }
      sortOrder++;
    }

    await client.query('COMMIT');
    console.log("Seeded ZJ's Workout program");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedWillsPush1(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [maxRow] } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM templates WHERE program_id = $1',
      [programId]
    );
    const sortOrder = maxRow.max_sort + 1;

    const exercises = [
      { name: 'Mid Upper Chest Flyes', sets: [{ reps: 20, weight: 30 }, { reps: 20, weight: 30 }, { reps: 20, weight: 30 }], repRange: '20', description: 'Cable or dumbbell flyes targeting the mid-upper chest. Focus on a deep stretch and controlled squeeze at the top.' },
      { name: 'Banded Close-Grip DB Bench', sets: [{ reps: 10, weight: 85 }, { reps: 10, weight: 85 }, { reps: 10, weight: 85 }], repRange: '10', description: 'Close-grip dumbbell bench press with a resistance band for added tension at lockout. Targets inner chest and triceps.' },
      { name: 'Incline DB Press', sets: [{ reps: 12, weight: 75 }, { reps: 12, weight: 75 }, { reps: 12, weight: 75 }], repRange: '12', description: 'Incline dumbbell press for upper chest development. Control the eccentric and drive through the chest.' },
      { name: 'Weighted Dips (Drop Set)', sets: [{ reps: 4, weight: 90 }, { reps: 4, weight: 45 }, { reps: 10, weight: 0 }], repRange: '4-10', description: 'Drop set dips: start heavy at 90 lbs, strip to 45 lbs, then bodyweight for 10 bottom-half reps. No rest between drops.' },
      { name: 'Cable Tricep Pushdowns (Pyramid)', sets: [{ reps: 12, weight: 40 }, { reps: 10, weight: 50 }, { reps: 8, weight: 60 }, { reps: 10, weight: 50 }, { reps: 12, weight: 40 }], repRange: '8-12', description: 'Pyramid sets: increase weight for 3 sets up to peak, then decrease back down. Focus on full extension and squeeze.' },
      { name: 'Cable Tricep Kickbacks (Burnout)', sets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 20 }, { reps: 15, weight: 20 }], repRange: '15', description: 'High-rep cable kickbacks for a tricep burnout. Keep upper arm locked and squeeze at full extension.' },
      { name: 'Hammer Strength Shoulder Press', sets: [{ reps: 10, weight: 90 }, { reps: 10, weight: 90 }, { reps: 10, weight: 90 }], repRange: '10', description: 'Machine shoulder press for controlled overhead pressing. Focus on full range of motion and even pressing.' },
      { name: 'Max Push-Ups', sets: [{ reps: 99, weight: 0 }, { reps: 99, weight: 0 }], repRange: 'Max', description: 'Finisher: go to failure on each set. Full range of motion, chest to floor.' },
    ];

    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
      [programId, "Will's Push 1", 'Chest, Triceps, Shoulders — flyes, bench, dips, pushdowns, shoulder press, burnout', sortOrder]
    );

    let exSort = 0;
    for (const ex of exercises) {
      for (let i = 0; i < ex.sets.length; i++) {
        await client.query(
          'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight, exSort, ex.repRange, ex.description]
        );
      }
      exSort++;
    }

    await client.query('COMMIT');
    console.log("Seeded Will's Push 1 template");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function expandPPLto7Days(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First, reorder existing templates: Push=0, Pull=1, Legs=2
    await client.query(
      "UPDATE templates SET sort_order = 0 WHERE program_id = $1 AND name = $2",
      [programId, "Will's Push 1"]
    );
    await client.query(
      "UPDATE templates SET sort_order = 1 WHERE program_id = $1 AND name = $2",
      [programId, "Will's Pull 1"]
    );
    await client.query(
      "UPDATE templates SET sort_order = 2 WHERE program_id = $1 AND name = $2",
      [programId, "Will's Legs 2"]
    );

    // Duplicate Push, Pull, Legs as days 4-6 (sort_order 3-5)
    const originals = [
      { origName: "Will's Push 1", newName: "Will's Push 2", newSort: 3 },
      { origName: "Will's Pull 1", newName: "Will's Pull 2", newSort: 4 },
      { origName: "Will's Legs 2", newName: "Will's Legs 2b", newSort: 5 },
    ];

    for (const { origName, newName, newSort } of originals) {
      // Get original template
      const { rows: [orig] } = await client.query(
        "SELECT id, description FROM templates WHERE program_id = $1 AND name = $2",
        [programId, origName]
      );
      if (!orig) continue;

      // Create duplicate template
      const { rows: [newTmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
        [programId, newName, orig.description, newSort]
      );

      // Copy all exercises from original
      await client.query(
        `INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description)
         SELECT $1, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description
         FROM template_exercises WHERE template_id = $2`,
        [newTmpl.id, orig.id]
      );
    }

    // Add Rest Day as day 7 (sort_order 6)
    await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, TRUE, $4)',
      [programId, "Rest Day", "Recovery day", 6]
    );

    await client.query('COMMIT');
    console.log("Expanded Will's PPL to 7-day cycle: Push, Pull, Legs, Push, Pull, Legs, Rest");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function expandBrowsePPLto6Weeks(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the base workout templates (Push, Pull, Legs — first 3 non-rest)
    const { rows: originals } = await client.query(
      "SELECT id, name, description FROM templates WHERE program_id = $1 AND is_rest = FALSE ORDER BY sort_order LIMIT 3",
      [programId]
    );

    // Get exercises for each base template
    const baseExercises = {};
    for (const orig of originals) {
      const { rows } = await client.query(
        'SELECT name, set_number, planned_reps, suggested_weight, sort_order FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number',
        [orig.id]
      );
      baseExercises[orig.id] = rows;
    }

    // Delete all existing templates for this program (start fresh)
    await client.query('DELETE FROM templates WHERE program_id = $1', [programId]);

    // Generate 6 weeks: weight increases +5 lbs every 2 weeks
    for (let week = 1; week <= 6; week++) {
      const weightBonus = Math.floor((week - 1) / 2) * 5;
      const weekOffset = (week - 1) * 7;
      const weekLabel = week > 1 ? ` (Week ${week})` : '';

      // 6 workouts per week: Push, Pull, Legs, Push, Pull, Legs
      for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
        const base = originals[dayIdx % 3];
        const sortOrder = weekOffset + dayIdx;
        const name = `${base.name}${weekLabel}`;

        const { rows: [newTmpl] } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
          [programId, name, base.description, sortOrder]
        );

        for (const ex of baseExercises[base.id]) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
            [newTmpl.id, ex.name, ex.set_number, ex.planned_reps, ex.suggested_weight + weightBonus, ex.sort_order]
          );
        }
      }

      // Rest day at end of each week
      const restName = week > 1 ? `Rest (Week ${week})` : 'Rest';
      await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, TRUE, $4)',
        [programId, restName, 'Recovery Day', weekOffset + 6]
      );
    }

    await client.query('COMMIT');
    console.log('Expanded Browse PPL to 6-week program with progressive overload');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function expandPPLto4Weeks(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all week 1 templates (sort_order 0-6)
    const { rows: week1Templates } = await client.query(
      "SELECT id, name, description, is_rest, sort_order FROM templates WHERE program_id = $1 AND sort_order <= 6 ORDER BY sort_order",
      [programId]
    );

    // Duplicate week 1 into weeks 2, 3, 4
    for (let week = 2; week <= 4; week++) {
      const offset = (week - 1) * 7;

      for (const tmpl of week1Templates) {
        const newName = tmpl.is_rest ? `Rest Day (Week ${week})` : `${tmpl.name} (Week ${week})`;
        const newSort = tmpl.sort_order + offset;

        const { rows: [newTmpl] } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
          [programId, newName, tmpl.description, tmpl.is_rest, newSort]
        );

        // Copy exercises (skip for rest days)
        if (!tmpl.is_rest) {
          await client.query(
            `INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description)
             SELECT $1, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description
             FROM template_exercises WHERE template_id = $2`,
            [newTmpl.id, tmpl.id]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log("Expanded Will's PPL to 4-week (28-day) program");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const MENTZER_CYCLE = [
      {
        name: 'Chest & Back',
        description: 'Incline Press, Pull-Ups, Dips, Deadlifts — 1 working set to failure',
        isRest: false,
        exercises: [
          { name: 'Incline Barbell Press (warm-up 50%)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Incline Barbell Press (warm-up 70%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Incline Barbell Press', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Pull-Ups (warm-up)', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Pull-Ups', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Weighted Dips (warm-up)', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Weighted Dips', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Deadlifts (warm-up 50%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Deadlifts (warm-up 70%)', sets: [{ reps: 3, weight: 0 }] },
          { name: 'Deadlifts', sets: [{ reps: 6, weight: 0 }] },
        ],
      },
      {
        name: 'Legs',
        description: 'Leg Extensions, Leg Press, Squats, Calf Raises — 1 working set to failure',
        isRest: false,
        exercises: [
          { name: 'Leg Extensions (warm-up)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Leg Extensions', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Leg Press (warm-up 50%)', sets: [{ reps: 8, weight: 0 }] },
          { name: 'Leg Press (warm-up 70%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Leg Press', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Squats (warm-up 50%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Squats (warm-up 70%)', sets: [{ reps: 3, weight: 0 }] },
          { name: 'Squats', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Standing Calf Raises (warm-up)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Standing Calf Raises', sets: [{ reps: 12, weight: 0 }, { reps: 10, weight: 0 }] },
        ],
      },
      {
        name: 'Shoulders & Arms',
        description: 'Curls, Shoulder Press, Lateral Raises, Close-Grip Bench, Pushdowns — 1 working set to failure',
        isRest: false,
        exercises: [
          { name: 'Barbell Curl (warm-up)', sets: [{ reps: 8, weight: 0 }] },
          { name: 'Barbell Curl', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Shoulder Press (warm-up 50%)', sets: [{ reps: 8, weight: 0 }] },
          { name: 'Shoulder Press (warm-up 70%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Shoulder Press', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Lateral Raises (warm-up)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Lateral Raises', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Close-Grip Bench Press (warm-up 50%)', sets: [{ reps: 6, weight: 0 }] },
          { name: 'Close-Grip Bench Press', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Triceps Pushdown (warm-up)', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Triceps Pushdown', sets: [{ reps: 8, weight: 0 }] },
        ],
      },
      {
        name: 'Rest',
        description: 'Recovery Day',
        isRest: true,
        exercises: [],
      },
    ];

async function seedMikeMentzerTemplates(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Repeat the 4-day cycle 7 times for 28 days (4 weeks)
    for (let day = 0; day < 28; day++) {
      const base = MENTZER_CYCLE[day % 4];
      const week = Math.floor(day / 7) + 1;
      const name = week > 1 ? `${base.name} (Week ${week})` : base.name;

      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [programId, name, base.description, base.isRest, day]
      );

      if (base.exercises.length > 0) {
        let exSortOrder = 0;
        for (const ex of base.exercises) {
          for (let i = 0; i < ex.sets.length; i++) {
            await client.query(
              'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
              [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight, exSortOrder]
            );
          }
          exSortOrder++;
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedMikeMentzer() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, $1, $2) RETURNING id",
      ['Mike Mentzer Workout', '4-week Heavy Duty program — 4-day cycle with 1 working set to failure']
    );
    await client.query('COMMIT');
    await seedMikeMentzerTemplates(program.id);
    console.log('Seeded Mike Mentzer Workout program');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
