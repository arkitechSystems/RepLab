// Backfill the master `exercises` table with every exercise that's referenced
// from any program template but doesn't yet have its own row. Several earlier
// migrations (notably add-hypertrophy-programs.js) inserted directly into
// `template_exercises` without ensuring each name also lives in the master
// library — so those names never get a `muscle_group`, never appear in the
// admin Exercise Library, and PRs against them get filed under "Other" in the
// body-part summary.
//
// What this does:
//   1. SELECT DISTINCT name FROM template_exercises WHERE is_section_header IS NOT TRUE
//      (template_exercises stores a few "section header" rows whose `name` is
//      the section label, e.g. "Power — Heavy Compounds"; we skip those)
//   2. For every name that has no case-insensitive match in `exercises`,
//      INSERT a row with (name, muscle_group, is_custom=FALSE) where
//      muscle_group is inferred via the same heuristic used by
//      add-nippard-push-pull-legs.js / client/src/utils/muscleAllocation.js.
//   3. Logs how many rows were added and the first ~10 added names so the
//      result is visible in deploy logs.
//
// Idempotent: re-running is a no-op once every name already has a row.
//
// Run with:
//   node --env-file=server/.env server/migrations/backfill-exercise-library.js
//
// Also wired into server/initDb.js so it runs automatically on every server
// boot in production (right after the glute_focused one-shot UPDATE).

import pool from '../dbPool.js';

// Heuristic ported verbatim from add-nippard-push-pull-legs.js (also exposed
// as inferMuscle in client/src/utils/muscleAllocation.js). Order matters —
// more-specific keywords have to win first.
export function inferMuscle(name) {
  if (!name) return 'Other';
  const n = String(name).toUpperCase();
  if (/\bCALF|CALVES\b/.test(n)) return 'Calves';
  if (/\bLEG CURL|HAMSTRING|ROMANIAN|RDL\b/.test(n)) return 'Hamstrings';
  if (/\bHIP THRUST|\bGLUTE|PULL[- ]THROUGH|PULLTHROUGH|LATERAL BAND WALK\b/.test(n)) return 'Glutes';
  if (/\bSQUAT|LUNGE|LEG EXTENSION|LEG PRESS|GOBLET\b/.test(n)) return 'Quads';
  if (/\bDEADLIFT\b/.test(n)) return 'Hamstrings';
  if (/\bSHRUG\b/.test(n)) return 'Traps';
  if (/\bCURL\b/.test(n)) return 'Biceps';
  if (/\bSKULL|TRICEPS|KICKBACK|PRESSDOWN|ROPE OVERHEAD|CLOSE.GRIP\b/.test(n)) return 'Triceps';
  if (/\bDIP\b/.test(n)) return 'Triceps';
  if (/\bSHOULDER PRESS|MILITARY|ARNOLD|LATERAL RAISE|UPRIGHT ROW|FACE PULL|REVERSE FLYE|REVERSE PEC|EGYPTIAN\b/.test(n)) return 'Shoulders';
  if (/\bBENCH PRESS|CHEST|PEC DECK|FLYE|FLY\b/.test(n)) return 'Chest';
  if (/\bROW|PULL-?UP|PULLDOWN|LAT PULL|PULL-OVER|T[- ]BAR|SEAL ROW\b/.test(n)) return 'Back';
  if (/\bHYPEREXTENSION\b/.test(n)) return 'Back';
  if (/\bCRUNCH|PLANK|ROLLOUT|LEG RAISE|BICYCLE\b/.test(n)) return 'Core';
  return 'Other';
}

// Exposed as a function so server/initDb.js can call it on boot without
// terminating the pool.
export async function backfillExerciseLibrary(client = pool) {
  // 1. Distinct exercise names referenced by any template, excluding section
  //    headers (their `name` is a section label, not an exercise) and any
  //    blanks. Trim whitespace so " Bench Press" doesn't masquerade as a new
  //    exercise.
  const { rows: refRows } = await client.query(`
    SELECT DISTINCT TRIM(name) AS name
    FROM template_exercises
    WHERE COALESCE(is_section_header, FALSE) = FALSE
      AND name IS NOT NULL
      AND TRIM(name) <> ''
  `);

  // 2. Existing master library — case-insensitive match.
  const { rows: existingRows } = await client.query(
    'SELECT LOWER(name) AS n FROM exercises'
  );
  const existingSet = new Set(existingRows.map((r) => r.n));

  // 3. Insert any missing names with a best-guess muscle group.
  const added = [];
  const otherBucket = [];
  for (const { name } of refRows) {
    if (!name) continue;
    if (existingSet.has(name.toLowerCase())) continue;
    const muscle = inferMuscle(name);
    await client.query(
      'INSERT INTO exercises (name, muscle_group, is_custom) VALUES ($1, $2, FALSE)',
      [name, muscle]
    );
    existingSet.add(name.toLowerCase()); // guard against duplicate refs in the same run
    added.push({ name, muscle });
    if (muscle === 'Other') otherBucket.push(name);
  }

  if (added.length === 0) {
    console.log('[backfill-exercise-library] No missing exercises — library is in sync.');
  } else {
    console.log(
      `[backfill-exercise-library] Added ${added.length} exercises to master library.`
    );
    const preview = added.slice(0, 10).map((e) => `${e.name} (${e.muscle})`);
    console.log(`[backfill-exercise-library] First ${preview.length}:`);
    for (const line of preview) console.log(`  - ${line}`);
    if (otherBucket.length) {
      console.log(
        `[backfill-exercise-library] ${otherBucket.length} landed in 'Other' (review/remap manually): ${otherBucket.slice(0, 20).join(', ')}${otherBucket.length > 20 ? '…' : ''}`
      );
    }
  }

  return { addedCount: added.length, added, otherCount: otherBucket.length };
}

// Allow running standalone via `node --env-file=server/.env …`
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
  || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMain) {
  (async () => {
    try {
      await backfillExerciseLibrary();
    } catch (err) {
      console.error('[backfill-exercise-library] Failed:', err);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
}
