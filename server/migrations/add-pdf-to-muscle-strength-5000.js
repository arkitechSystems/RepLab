// Adds a downloadable PDF link to the Muscle & Fitness 5000 Rep Arms
// program's program_details JSON. The ProgramOverviewHero card reads the
// `PDF` key and renders a "Download PDF" button when it's present.
//
// Run with: node --env-file=server/.env server/migrations/add-pdf-to-muscle-strength-5000.js
// Idempotent.

import pool from '../dbPool.js';

const PROGRAM_NAME = 'Muscle & Fitness 5000 Rep Arm Specialization';
const PDF_URL = '/Workouts/Muscle and Strength 5000 rep Arm Specialization Program.pdf';

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, program_details FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );
    if (!rows.length) {
      console.error(`Program "${PROGRAM_NAME}" not found.`);
      process.exit(1);
    }
    const details = { ...(rows[0].program_details || {}), PDF: PDF_URL };
    await client.query(
      'UPDATE programs SET program_details = $1 WHERE id = $2',
      [JSON.stringify(details), rows[0].id]
    );
    console.log(`PDF link set on "${PROGRAM_NAME}".`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
