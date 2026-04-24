// Adds downloadable PDF links to the remaining three library programs that
// have a source PDF in client/public/Workouts/. Pairs with the existing
// add-pdf-to-muscle-strength-5000.js migration.
//
// Run with: node --env-file=server/.env server/migrations/add-pdfs-remaining-programs.js
// Idempotent — always sets/overwrites the PDF key on program_details.

import pool from '../dbPool.js';

const MAP = [
  {
    name: "Jim Stoppani's Shortcut to Shred",
    pdf: '/Workouts/Jim Stopanni\'s Shortcut to Shred.pdf',
  },
  {
    name: "Robin Gallant's Intensive Max Glute Hypertrophy",
    pdf: "/Workouts/Robin Gallant's Intensive Max Glute Hypertrophy Program.pdf",
  },
  {
    name: "Jeff Nippard's Push Pull Legs",
    pdf: "/Workouts/Jeff Nippard's Push Pull Legs.pdf",
  },
];

async function run() {
  const client = await pool.connect();
  try {
    for (const { name, pdf } of MAP) {
      const { rows } = await client.query(
        'SELECT id, program_details FROM programs WHERE user_id IS NULL AND name = $1',
        [name]
      );
      if (!rows.length) {
        console.warn(`  [skip] "${name}" not found`);
        continue;
      }
      const details = { ...(rows[0].program_details || {}), PDF: pdf };
      await client.query(
        'UPDATE programs SET program_details = $1 WHERE id = $2',
        [JSON.stringify(details), rows[0].id]
      );
      console.log(`  "${name}" → ${pdf}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run();
