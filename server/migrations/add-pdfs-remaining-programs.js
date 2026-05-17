// Adds downloadable PDF links to the remaining three library programs.
// PDFs are served from the RepLab static-asset CDN at
// https://replab-videos.onrender.com (same Render static site that hosts
// the exercise demo videos). Source files no longer live in the app
// bundle — moved out to keep the iOS build slim. Pairs with
// add-pdf-to-muscle-strength-5000.js.
//
// Run with: node --env-file=server/.env server/migrations/add-pdfs-remaining-programs.js
// Idempotent — always sets/overwrites the PDF key on program_details.

import pool from '../dbPool.js';

const CDN = 'https://replab-videos.onrender.com';

const MAP = [
  {
    name: "Jim Stoppani's Shortcut to Shred",
    pdf: `${CDN}/Jim Stopanni's Shortcut to Shred.pdf`,
  },
  {
    name: "Robin Gallant's Intensive Max Glute Hypertrophy",
    pdf: `${CDN}/Robin Gallant's Intensive Max Glute Hypertrophy Program.pdf`,
  },
  {
    name: "Jeff Nippard's Push Pull Legs",
    pdf: `${CDN}/Jeff Nippard's Push Pull Legs.pdf`,
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
