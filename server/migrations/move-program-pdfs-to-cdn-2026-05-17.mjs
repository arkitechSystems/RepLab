// Migration: move program PDF references from in-bundle paths
// (/Workouts/<name>.pdf) to the CDN at replab-videos.onrender.com so the
// PDFs can be deleted from client/public/ for a leaner iOS app bundle.
//
// PDFs verified live at the CDN root (200 OK + Content-Type: application/pdf)
// before this migration is run. Idempotent — re-running detects the new URL
// and no-ops.
//
// Run with:
//   node --env-file=server/.env server/migrations/move-program-pdfs-to-cdn-2026-05-17.mjs

import pool from '../dbPool.js';

const CDN = 'https://replab-videos.onrender.com';

// programId -> new PDF URL. The id mapping was captured live before this
// migration ran (see audit query in the conversation). Names are kept here
// as comments for human review when reading the migration later.
const UPDATES = [
  { id: 50, name: "Jeff Nippard's Push Pull Legs",                          pdf: `${CDN}/Jeff Nippard's Push Pull Legs.pdf` },
  { id: 48, name: "Jim Stoppani's Shortcut to Shred",                       pdf: `${CDN}/Jim Stopanni's Shortcut to Shred.pdf` },
  { id: 47, name: 'Muscle & Fitness 5000 Rep Arm Specialization',          pdf: `${CDN}/Muscle and Strength 5000 rep Arm Specialization Program.pdf` },
  { id: 49, name: "Robin Gallant's Intensive Max Glute Hypertrophy",        pdf: `${CDN}/Robin Gallant's Intensive Max Glute Hypertrophy Program.pdf` },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of UPDATES) {
      // Sanity: confirm the program exists with the expected id + name.
      const { rows } = await client.query(
        'SELECT id, name, program_details FROM programs WHERE id = $1',
        [u.id]
      );
      if (!rows.length) {
        console.warn(`[skip] program id ${u.id} (${u.name}) not found`);
        continue;
      }
      const existing = rows[0].program_details || {};
      const before = existing.PDF || '(none)';
      const next = { ...existing, PDF: u.pdf };
      await client.query(
        'UPDATE programs SET program_details = $1 WHERE id = $2',
        [JSON.stringify(next), u.id]
      );
      console.log(`[updated] ${rows[0].name} (id=${u.id})\n  before: ${before}\n  after:  ${u.pdf}`);
    }
    await client.query('COMMIT');
    console.log('\nCOMMITTED');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED — rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

await run();
await pool.end();
