import pool from './dbPool.js';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description, sort_order) VALUES (NULL, $1, $2, (SELECT COALESCE(MAX(sort_order),0)+1 FROM programs WHERE user_id IS NULL)) RETURNING id",
      ['Athlean-X Summer Shred', '4-week fat loss & conditioning hybrid. 4-5 days/week. Strength + burst training + circuits.']
    );
    const pid = program.id;

    async function add(name, desc, sort, isRest, exercises) {
      const { rows: [t] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [pid, name, desc, isRest, sort]
      );
      if (!exercises) return;
      let es = 0;
      for (const ex of exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [t.id, ex.name, ex.type || 'straight', i + 1, ex.reps || 0, ex.weight || 0, es]
          );
        }
        es++;
      }
    }

    // WEEK 1
    await add('Core 4 (Day 1)', 'Deadlifts, Dips, Lateral Raises, Bent Rows — Triple X + 12RM. Track total reps.', 0, false, [
      { name: 'Deadlifts', sets: 3, reps: 0, type: 'straight' },
      { name: 'Weighted Dips', sets: 3, reps: 0 },
      { name: 'Single Arm Lateral Raises', sets: 4, reps: 12 },
      { name: 'Barbell Bent Rows', sets: 4, reps: 12 },
    ]);
    await add('Burst: Hang 10', '10 rounds in 10 min. Complete all 3 exercises within 60s, remaining time = rest.', 1, false, [
      { name: 'Sprawling Burpees', sets: 10, reps: 10 },
      { name: 'Twisting Pistons', sets: 10, reps: 10 },
      { name: 'Divebomber Pushups', sets: 10, reps: 10 },
    ]);
    await add('Arms Day', 'Run the Rack curls, Inverted Chin Curls, BW Tri Extensions (straight→halfway→dips), DB Bench', 2, false, [
      { name: 'Run the Rack DB Curls', sets: 3, reps: 0 },
      { name: 'Inverted Chin Curls', sets: 4, reps: 0 },
      { name: 'Bodyweight Triceps Extensions', sets: 3, reps: 0 },
      { name: 'Elbows Tucked DB Bench Press', sets: 4, reps: 0 },
    ]);
    await add('Rest', 'Recovery Day', 3, true, null);
    await add('Core 4 (Day 2)', 'Clean & Press, Pullups, Bench, Bulgarian Splits — Triple X + 12RM. Track total reps.', 4, false, [
      { name: 'Clean and Press', sets: 3, reps: 0 },
      { name: 'Weighted Pullups', sets: 3, reps: 0 },
      { name: 'Bench Press', sets: 4, reps: 12 },
      { name: 'DB Bulgarian Split Squats', sets: 4, reps: 12 },
    ]);
    await add('Shackled Complex', '3 rounds. Do NOT put weight down. Rest 2 min between rounds.', 5, false, [
      { name: 'Front Squats', sets: 3, reps: 20 },
      { name: 'Push Press', sets: 3, reps: 10 },
      { name: 'Barbell Rows', sets: 3, reps: 20 },
      { name: 'Barbell Curls', sets: 3, reps: 10 },
    ]);
    await add('Rest', 'Recovery Day', 6, true, null);

    // WEEK 2
    await add('Core 4 (Day 3) (Week 2)', 'Same as Day 1 — beat previous reps.', 7, false, [
      { name: 'Deadlifts', sets: 3, reps: 0 },
      { name: 'Weighted Dips', sets: 3, reps: 0 },
      { name: 'Single Arm Lateral Raises', sets: 4, reps: 12 },
      { name: 'Barbell Bent Rows', sets: 4, reps: 12 },
    ]);
    await add('Burst: 52 Pick-Up (Week 2)', '52 reps each exercise. Burpee Split Squat Press, Shuffle Pushups, Box Jumps, Inverted Rows.', 8, false, [
      { name: 'Burpees + DB Split Squat Curl/Press', sets: 1, reps: 52 },
      { name: 'Shuffle Pushups + Pick Up', sets: 1, reps: 52 },
      { name: 'Box Jumps + Pick Up', sets: 1, reps: 52 },
      { name: 'Inverted Rows', sets: 1, reps: 52 },
    ]);
    await add('Arms Day (Week 2)', 'Barbell Curls, Chin Curl + Negative, DB Tri Extensions, Upright Dips → Assisted', 9, false, [
      { name: 'Barbell Curls', sets: 4, reps: 12 },
      { name: 'Chin Curl + Negative Hold', sets: 3, reps: 0 },
      { name: 'DB Triceps Extensions', sets: 4, reps: 12 },
      { name: 'Upright Dips', sets: 3, reps: 0 },
    ]);
    await add('Rest (Week 2)', 'Recovery Day', 10, true, null);
    await add('Core 4 (Day 4) (Week 2)', 'Same as Day 2 — beat previous reps.', 11, false, [
      { name: 'Clean and Press', sets: 3, reps: 0 },
      { name: 'Weighted Pullups', sets: 3, reps: 0 },
      { name: 'Bench Press', sets: 4, reps: 12 },
      { name: 'DB Bulgarian Split Squats', sets: 4, reps: 12 },
    ]);
    await add('Burnin Rubber (Week 2)', 'Bands — 3 rounds: 40/30/20 reps. High Pulls, Curls, Press, Squat Raise, Tri Ext, Pushups.', 12, false, [
      { name: 'Band High Pulls', sets: 3, reps: 40 },
      { name: 'Band Curls', sets: 3, reps: 40 },
      { name: 'Band Shoulder Press', sets: 3, reps: 40 },
      { name: 'Band Squat + Front Raise', sets: 3, reps: 40 },
      { name: 'Band Triceps Extensions', sets: 3, reps: 40 },
      { name: 'Band Pushups', sets: 3, reps: 40 },
    ]);
    await add('Rest (Week 2)', 'Recovery Day', 13, true, null);

    // WEEK 3
    await add('Core 4 (Day 5) (Week 3)', 'Progressive overload — beat previous weeks.', 14, false, [
      { name: 'Deadlifts', sets: 3, reps: 0 },
      { name: 'Weighted Dips', sets: 3, reps: 0 },
      { name: 'Single Arm Lateral Raises', sets: 4, reps: 12 },
      { name: 'Barbell Bent Rows', sets: 4, reps: 12 },
    ]);
    await add('NXT 360 (Week 3)', '60 reps each — Taps, Knee Up Chinups, Skiers.', 15, false, [
      { name: 'Taps', sets: 1, reps: 60 },
      { name: 'Knee Up Chinups', sets: 1, reps: 60 },
      { name: 'Skiers', sets: 1, reps: 60 },
    ]);
    await add('Arms Day (Week 3)', 'Triple X Curls, DB+Band Combo, Triple X Pushdowns, Plank Ups + Diamond Pushups.', 16, false, [
      { name: 'Barbell Curls', sets: 3, reps: 0 },
      { name: 'DB + Band Curl Combo', sets: 4, reps: 12 },
      { name: 'Triceps Pushdowns', sets: 3, reps: 0 },
      { name: 'Plank Ups + Diamond Pushups', sets: 4, reps: 0 },
    ]);
    await add('Rest (Week 3)', 'Recovery Day', 17, true, null);
    await add('Core 4 (Day 6) (Week 3)', 'Progressive overload — beat previous weeks.', 18, false, [
      { name: 'Clean and Press', sets: 3, reps: 0 },
      { name: 'Weighted Pullups', sets: 3, reps: 0 },
      { name: 'Bench Press', sets: 4, reps: 12 },
      { name: 'DB Bulgarian Split Squats', sets: 4, reps: 12 },
    ]);
    await add('Dumbbell Death March (Week 3)', '3 rounds — Renegade Rows, Burpee Press, Cliffhangers, Jack Pushups.', 19, false, [
      { name: 'Walking Renegade Rows', sets: 3, reps: 10 },
      { name: 'Burpee Press', sets: 3, reps: 15 },
      { name: 'Cliffhanger Walkouts', sets: 3, reps: 10 },
      { name: 'Jack Pushups', sets: 3, reps: 15 },
    ]);
    await add('Rest (Week 3)', 'Recovery Day', 20, true, null);

    // WEEK 4
    await add('Core 4 (Day 7) (Week 4)', 'Final Core 4 — go all out.', 21, false, [
      { name: 'Deadlifts', sets: 3, reps: 0 },
      { name: 'Weighted Dips', sets: 3, reps: 0 },
      { name: 'Single Arm Lateral Raises', sets: 4, reps: 12 },
      { name: 'Barbell Bent Rows', sets: 4, reps: 12 },
    ]);
    await add('Three Up Three Down (Week 4)', 'All to failure, 2-3 rounds. Spiderman Pullups/Pushups, Corkscrews, Pistons, Over Unders, Mule Kicks.', 22, false, [
      { name: 'Spiderman Pullups', sets: 3, reps: 0 },
      { name: 'Spiderman Pushups', sets: 3, reps: 0 },
      { name: 'Hanging Corkscrews', sets: 3, reps: 0 },
      { name: 'Twisting Pistons', sets: 3, reps: 0 },
      { name: 'Over Unders', sets: 3, reps: 0 },
      { name: 'Mule Kicks', sets: 3, reps: 0 },
    ]);
    await add('Arms Day (Week 4)', 'DB 21s, Shovel Curls, Tri Ext + Close Grip Bench, Rotational Pushdowns.', 23, false, [
      { name: 'DB 21s', sets: 3, reps: 21 },
      { name: 'DB Shovel Curls', sets: 4, reps: 12 },
      { name: 'DB Triceps Extensions + Close Grip Bench', sets: 3, reps: 0 },
      { name: 'Rotational Pushdowns', sets: 4, reps: 12 },
    ]);
    await add('Rest (Week 4)', 'Recovery Day', 24, true, null);
    await add('15 Min of Fame (Week 4)', 'FINAL CHALLENGE. Deadlifts, Clean & Press, Dips, Pullups x 3RM. Up to 15 rounds. <6=Beginner, 6-9=Intermediate, 10-12=Advanced, 12-15=Elite.', 25, false, [
      { name: 'Deadlifts', sets: 15, reps: 3 },
      { name: 'Clean and Press', sets: 15, reps: 3 },
      { name: 'Weighted Dips', sets: 15, reps: 3 },
      { name: 'Weighted Pullups', sets: 15, reps: 3 },
    ]);
    await add('Rest (Week 4)', 'Recovery Day', 26, true, null);
    await add('Rest (Week 4)', 'Recovery Day', 27, true, null);

    await client.query('COMMIT');
    console.log('Summer Shred seeded — 28 days, program ID:', pid);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
