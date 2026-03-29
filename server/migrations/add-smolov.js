// Migration: Add Smolov Squat & Bench Press program to the master library
// Run with: node --env-file=server/.env server/migrations/add-smolov.js

import pool from '../dbPool.js';

// Helper: insert a section header row
async function insertSection(client, templateId, sectionName, notes, sortOrder) {
  await client.query(
    `INSERT INTO template_exercises
      (template_id, name, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes)
     VALUES ($1, $2, 1, 0, 0, $3, TRUE, $4)`,
    [templateId, sectionName, sortOrder, notes || '']
  );
}

// Helper: insert N identical sets for an exercise
async function insertSets(client, templateId, exerciseName, setType, numSets, reps, sortOrder) {
  for (let i = 0; i < numSets; i++) {
    await client.query(
      `INSERT INTO template_exercises
        (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order)
       VALUES ($1, $2, $3, $4, $5, 0, $6)`,
      [templateId, exerciseName, setType, i + 1, reps, sortOrder]
    );
  }
}

// Helper: insert sets from an array of { reps, type } objects
async function insertSetList(client, templateId, exerciseName, sets, sortOrder) {
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i];
    await client.query(
      `INSERT INTO template_exercises
        (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order)
       VALUES ($1, $2, $3, $4, $5, 0, $6)`,
      [templateId, exerciseName, s.type, i + 1, s.reps, sortOrder]
    );
  }
}

// Helper: create a template, returns its id
async function createTemplate(client, programId, name, description, isRest, sortOrder) {
  const { rows: [t] } = await client.query(
    `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
     VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id`,
    [programId, name, description || '', isRest, sortOrder]
  );
  return t.id;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Create the program ──
    const { rows: [prog] } = await client.query(
      `INSERT INTO programs (user_id, name, description, sort_order)
       VALUES (NULL, $1, $2, 9) RETURNING id`,
      [
        'Smolov Squat & Bench Program',
        'A 13-week Russian powerlifting peaking program for squats, plus the 3-week Smolov Jr. bench press cycle. Designed for intermediate to advanced lifters looking to rapidly increase their 1RM. NOT recommended for beginners — requires solid form, recovery capacity, and nutrition.'
      ]
    );
    const programId = prog.id;
    console.log(`Created program id=${programId}`);

    let templateSort = 0;
    let exSort; // exercise sort_order within each template

    // ════════════════════════════════════════════════════════════════
    // Template 0: Program Overview (rest day / info card)
    // ════════════════════════════════════════════════════════════════
    await createTemplate(client, programId, 'Program Overview — READ FIRST',
      `This is Sergey Smolov's Russian powerlifting program — one of the most demanding squat peaking protocols ever designed, paired with the Smolov Jr. bench press cycle.\n\n` +
      `⚠️ WARNING: This program is NOT for beginners. You need at least 2+ years of consistent barbell training with solid squat and bench form.\n\n` +
      `REQUIREMENTS:\n` +
      `• Known 1RM for both back squat and bench press\n` +
      `• Adequate sleep — 8+ hours per night\n` +
      `• High-protein caloric surplus (you WILL need the fuel)\n` +
      `• Access to a squat rack and bench setup for every session\n\n` +
      `All weights in this program are described as percentages of YOUR 1RM. Enter your working weights accordingly.\n\n` +
      `PROGRAM STRUCTURE (13 weeks):\n` +
      `  Weeks 1-2: Phase In (prep joints & CNS)\n` +
      `  Weeks 3-5: Base Mesocycle (high-volume squats, +20 lbs/week)\n` +
      `  Weeks 6-7: Switching Phase (deload & recovery)\n` +
      `  Weeks 8-10: Smolov Jr. Bench Press (3-week bench cycle)\n` +
      `  Weeks 11-13: Intense Mesocycle (heavy squat singles, peaking)\n` +
      `  Final Day: MAX TEST DAY\n\n` +
      `Trust the process. Eat big, sleep big, lift big.`,
      true, templateSort++);

    // ════════════════════════════════════════════════════════════════
    // PHASE IN — Weeks 1-2
    // ════════════════════════════════════════════════════════════════

    // Day 1
    let tid = await createTemplate(client, programId, 'Phase In — Day 1', '', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Phase In', 'Use 60-70% of your 1RM. Focus on form. These 2 weeks prepare your joints and CNS for the base cycle.', exSort++);
    await insertSetList(client, tid, 'Back Squat', [
      { reps: 10, type: 'warm_up' }, { reps: 8, type: 'warm_up' }, { reps: 5, type: 'warm_up' },
      { reps: 8, type: 'straight' }, { reps: 8, type: 'straight' }, { reps: 8, type: 'straight' },
    ], exSort++);
    await insertSection(client, tid, 'Accessory', '', exSort++);
    await insertSets(client, tid, 'Leg Press', 'straight', 3, 10, exSort++);
    await insertSets(client, tid, 'Leg Curls', 'straight', 3, 10, exSort++);

    // Day 2
    tid = await createTemplate(client, programId, 'Phase In — Day 2', '', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Phase In', 'Work up to a comfortable heavy single (85-90%), then back-off sets at 65-70%.', exSort++);
    await insertSetList(client, tid, 'Back Squat', [
      { reps: 10, type: 'warm_up' }, { reps: 5, type: 'warm_up' }, { reps: 3, type: 'warm_up' },
      { reps: 1, type: 'straight' },
      { reps: 5, type: 'straight' }, { reps: 5, type: 'straight' }, { reps: 5, type: 'straight' },
    ], exSort++);
    await insertSets(client, tid, 'Romanian Deadlift', 'straight', 3, 8, exSort++);

    // Day 3
    tid = await createTemplate(client, programId, 'Phase In — Day 3', '', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Phase In', 'Higher reps at moderate weight. Build endurance for the base cycle.', exSort++);
    await insertSetList(client, tid, 'Back Squat', [
      { reps: 10, type: 'warm_up' }, { reps: 5, type: 'warm_up' },
      { reps: 5, type: 'straight' }, { reps: 5, type: 'straight' }, { reps: 5, type: 'straight' },
      { reps: 5, type: 'straight' }, { reps: 5, type: 'straight' },
    ], exSort++);
    await insertSets(client, tid, 'Walking Lunges', 'straight', 2, 12, exSort++);

    // Rest day
    await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);

    // Day 4
    tid = await createTemplate(client, programId, 'Phase In — Day 4', '', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Phase In', 'Light weight, explosive concentric. Focus on speed out of the hole.', exSort++);
    await insertSetList(client, tid, 'Back Squat (Pause)', [
      { reps: 5, type: 'warm_up' },
      { reps: 3, type: 'straight' }, { reps: 3, type: 'straight' }, { reps: 3, type: 'straight' },
      { reps: 3, type: 'straight' }, { reps: 3, type: 'straight' }, { reps: 3, type: 'straight' },
    ], exSort++);
    await insertSets(client, tid, 'Leg Extensions', 'straight', 3, 12, exSort++);

    // Rest x2
    await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
    await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);

    // ════════════════════════════════════════════════════════════════
    // BASE MESOCYCLE — Weeks 3-5 (3 weeks, +20 lbs each week)
    // ════════════════════════════════════════════════════════════════
    const baseWeeks = [
      { n: 1, add: '+0 lbs' },
      { n: 2, add: '+20 lbs' },
      { n: 3, add: '+40 lbs' },
    ];

    for (const wk of baseWeeks) {
      // Day 1 — 9x3
      tid = await createTemplate(client, programId, `Base Week ${wk.n} — Day 1 (9x3)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Base Mesocycle', `70% of 1RM ${wk.add}. Rest 2-3 min between sets.`, exSort++);
      await insertSets(client, tid, 'Back Squat', 'straight', 9, 3, exSort++);

      // Day 2 — 7x5
      tid = await createTemplate(client, programId, `Base Week ${wk.n} — Day 2 (7x5)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Base Mesocycle', `75% of 1RM ${wk.add}. Rest 2-3 min.`, exSort++);
      await insertSets(client, tid, 'Back Squat', 'straight', 7, 5, exSort++);

      // Rest day
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);

      // Day 3 — 6x7
      tid = await createTemplate(client, programId, `Base Week ${wk.n} — Day 3 (6x7)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Base Mesocycle', `80% of 1RM ${wk.add}. Rest 3-5 min. This is the hardest day.`, exSort++);
      await insertSets(client, tid, 'Back Squat', 'straight', 6, 7, exSort++);

      // Day 4 — 10x3
      tid = await createTemplate(client, programId, `Base Week ${wk.n} — Day 4 (10x3)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Base Mesocycle', `85% of 1RM ${wk.add}. Rest 2-3 min. Heavy triples.`, exSort++);
      await insertSets(client, tid, 'Back Squat', 'straight', 10, 3, exSort++);

      // Rest x2
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
    }

    // ════════════════════════════════════════════════════════════════
    // SWITCHING PHASE — Weeks 6-7 (deload)
    // ════════════════════════════════════════════════════════════════

    // Day 1
    tid = await createTemplate(client, programId, 'Switching Phase — Day 1', '', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Switching Phase (Deload)', 'Reduce volume significantly. Use 50-60% of 1RM. Focus on recovery — your body needs it after the base cycle.', exSort++);
    await insertSets(client, tid, 'Back Squat', 'straight', 3, 5, exSort++);
    await insertSets(client, tid, 'Good Mornings', 'straight', 3, 8, exSort++);
    await insertSets(client, tid, 'Abs/Core Work', 'straight', 3, 15, exSort++);

    // Day 2
    tid = await createTemplate(client, programId, 'Switching Phase — Day 2', '', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Switching Phase (Deload)', 'Speed work at 50% of 1RM. Explosive concentric, controlled eccentric.', exSort++);
    await insertSets(client, tid, 'Back Squat (Speed)', 'straight', 6, 3, exSort++);
    await insertSets(client, tid, 'Glute Ham Raise', 'straight', 3, 8, exSort++);

    // Rest x5
    for (let i = 0; i < 5; i++) {
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
    }

    // Day 3
    tid = await createTemplate(client, programId, 'Switching Phase — Day 3', '', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Switching Phase (Deload)', '', exSort++);
    await insertSets(client, tid, 'Back Squat', 'straight', 4, 5, exSort++);
    await insertSets(client, tid, 'Leg Press', 'straight', 2, 10, exSort++);

    // Rest x4
    for (let i = 0; i < 4; i++) {
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
    }

    // ════════════════════════════════════════════════════════════════
    // SMOLOV JR. BENCH PRESS — Weeks 8-10 (3 weeks, +10 lbs each)
    // ════════════════════════════════════════════════════════════════
    const benchWeeks = [
      { n: 1, add: '+0 lbs' },
      { n: 2, add: '+10 lbs' },
      { n: 3, add: '+20 lbs' },
    ];

    for (const wk of benchWeeks) {
      // Day 1 — 6x6
      tid = await createTemplate(client, programId, `Smolov Jr. Bench Week ${wk.n} — Day 1 (6x6)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Smolov Jr. Bench Press', `70% of bench 1RM ${wk.add}. Rest 2-3 min.`, exSort++);
      await insertSets(client, tid, 'Bench Press', 'straight', 6, 6, exSort++);
      await insertSets(client, tid, 'Barbell Row', 'straight', 3, 8, exSort++);

      // Day 2 — 7x5
      tid = await createTemplate(client, programId, `Smolov Jr. Bench Week ${wk.n} — Day 2 (7x5)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Smolov Jr. Bench Press', `75% of bench 1RM ${wk.add}.`, exSort++);
      await insertSets(client, tid, 'Bench Press', 'straight', 7, 5, exSort++);
      await insertSets(client, tid, 'Face Pulls', 'straight', 3, 15, exSort++);

      // Rest day
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);

      // Day 3 — 8x4
      tid = await createTemplate(client, programId, `Smolov Jr. Bench Week ${wk.n} — Day 3 (8x4)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Smolov Jr. Bench Press', `80% of bench 1RM ${wk.add}.`, exSort++);
      await insertSets(client, tid, 'Bench Press', 'straight', 8, 4, exSort++);
      await insertSets(client, tid, 'Tricep Dips', 'straight', 3, 10, exSort++);

      // Day 4 — 10x3
      tid = await createTemplate(client, programId, `Smolov Jr. Bench Week ${wk.n} — Day 4 (10x3)`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Smolov Jr. Bench Press', `85% of bench 1RM ${wk.add}. Heaviest day.`, exSort++);
      await insertSets(client, tid, 'Bench Press', 'straight', 10, 3, exSort++);

      // Rest x2
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
      await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
    }

    // ════════════════════════════════════════════════════════════════
    // INTENSE MESOCYCLE — Weeks 11-13 (peaking with heavy singles)
    // ════════════════════════════════════════════════════════════════
    for (let wk = 1; wk <= 3; wk++) {
      // Day 1 — heavy singles
      tid = await createTemplate(client, programId, `Intense Week ${wk} — Day 1`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Intense Mesocycle', 'Work up to 90-96% of your 1RM. Full rest between singles. Stay tight and controlled.', exSort++);
      await insertSetList(client, tid, 'Back Squat', [
        { reps: 10, type: 'warm_up' }, { reps: 5, type: 'warm_up' }, { reps: 3, type: 'warm_up' },
        { reps: 1, type: 'straight' }, { reps: 1, type: 'straight' }, { reps: 1, type: 'straight' },
        { reps: 1, type: 'straight' }, { reps: 1, type: 'straight' },
      ], exSort++);

      // Day 2 — back-off
      tid = await createTemplate(client, programId, `Intense Week ${wk} — Day 2`, '', false, templateSort++);
      exSort = 0;
      await insertSection(client, tid, 'Intense Mesocycle', 'Back-off day at 75-80% of 1RM. Keep form crisp.', exSort++);
      await insertSets(client, tid, 'Back Squat', 'straight', 4, 3, exSort++);
      await insertSets(client, tid, 'Leg Press', 'straight', 2, 8, exSort++);

      // Rest x5
      for (let i = 0; i < 5; i++) {
        await createTemplate(client, programId, 'Rest Day', '', true, templateSort++);
      }
    }

    // ════════════════════════════════════════════════════════════════
    // MAX TEST DAY
    // ════════════════════════════════════════════════════════════════
    tid = await createTemplate(client, programId, 'MAX TEST DAY',
      'The day you have been training for. Test your new 1RM.', false, templateSort++);
    exSort = 0;
    await insertSection(client, tid, 'Max Attempt', 'Warm up thoroughly. Take 3-4 progressively heavier singles. Rest 5+ minutes between heavy attempts. You earned this.', exSort++);
    await insertSetList(client, tid, 'Back Squat', [
      { reps: 10, type: 'warm_up' }, { reps: 5, type: 'warm_up' },
      { reps: 3, type: 'warm_up' }, { reps: 1, type: 'warm_up' },
      { reps: 1, type: 'straight' }, { reps: 1, type: 'straight' },
      { reps: 1, type: 'touch_up' },
    ], exSort++);

    await client.query('COMMIT');

    // Summary
    const { rows: [count] } = await client.query(
      'SELECT COUNT(*) AS cnt FROM templates WHERE program_id = $1', [programId]
    );
    console.log(`Done! Program id=${programId}, total templates=${count.cnt}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
