import pool from './dbPool.js';

// wger API category ID → our muscle group names
const CATEGORY_MAP = {
  8: 'Arms',       // Arms (we split into Biceps/Triceps below based on muscles)
  9: 'Legs',       // Legs (we split into Quads/Hamstrings/Glutes below)
  10: 'Core',      // Abs
  11: 'Chest',     // Chest
  12: 'Back',      // Back
  13: 'Shoulders', // Shoulders
  14: 'Calves',    // Calves
  15: 'Cardio',    // Cardio
};

// wger muscle ID → our muscle group (for more specific mapping)
const MUSCLE_MAP = {
  1: 'Biceps',      // Biceps brachii
  2: 'Shoulders',   // Anterior deltoid
  3: 'Core',        // Serratus anterior
  4: 'Chest',       // Pectoralis major
  5: 'Triceps',     // Triceps brachii
  6: 'Core',        // Rectus abdominis
  7: 'Calves',      // Gastrocnemius
  8: 'Glutes',      // Gluteus maximus
  9: 'Traps',       // Trapezius
  10: 'Quads',      // Quadriceps femoris
  11: 'Hamstrings', // Biceps femoris
  12: 'Back',       // Latissimus dorsi
  13: 'Biceps',     // Brachialis
  14: 'Core',       // Obliquus externus
  15: 'Calves',     // Soleus
};

async function fetchAllPages(baseUrl) {
  const results = [];
  let url = baseUrl;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`wger API error: ${res.status}`);
    const data = await res.json();
    results.push(...data.results);
    url = data.next;
  }
  return results;
}

/**
 * Sync exercises from wger.de API into the exercises table.
 * Only inserts exercises that don't already exist (by name, case-insensitive).
 * Returns { added, skipped, total }.
 */
export async function syncFromWger() {
  console.log('Starting wger exercise sync...');

  // 1. Fetch all English exercise translations (names)
  const translations = await fetchAllPages(
    'https://wger.de/api/v2/exercise-translation/?format=json&language=2&limit=100'
  );
  console.log(`Fetched ${translations.length} exercise translations`);

  // 2. Fetch all exercise metadata (category, muscles)
  const exercises = await fetchAllPages(
    'https://wger.de/api/v2/exercise/?format=json&language=2&limit=100'
  );
  console.log(`Fetched ${exercises.length} exercise records`);

  // Build lookup: exercise ID → metadata
  const exerciseMeta = new Map();
  for (const ex of exercises) {
    exerciseMeta.set(ex.id, ex);
  }

  // 3. Build unique exercise list (deduplicate by name)
  const seen = new Set();
  const toSync = [];

  for (const t of translations) {
    const name = t.name?.trim();
    if (!name || name.length < 3 || name.length > 100) continue;

    const lower = name.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    const meta = exerciseMeta.get(t.exercise);
    if (!meta) continue;

    // Determine muscle group: prefer primary muscle, fall back to category
    let muscleGroup = 'Other';
    if (meta.muscles && meta.muscles.length > 0) {
      muscleGroup = MUSCLE_MAP[meta.muscles[0]] || CATEGORY_MAP[meta.category] || 'Other';
    } else {
      muscleGroup = CATEGORY_MAP[meta.category] || 'Other';
    }

    // Build tags from category + muscles
    const tags = [];
    if (CATEGORY_MAP[meta.category]) tags.push(CATEGORY_MAP[meta.category].toLowerCase());
    for (const m of (meta.muscles || [])) {
      const mapped = MUSCLE_MAP[m];
      if (mapped && !tags.includes(mapped.toLowerCase())) tags.push(mapped.toLowerCase());
    }

    toSync.push({ name, muscleGroup, tags });
  }

  console.log(`${toSync.length} unique exercises to check`);

  // 4. Get existing exercise names from DB
  const { rows: existing } = await pool.query(
    'SELECT LOWER(name) as name FROM exercises'
  );
  const existingNames = new Set(existing.map(r => r.name));

  // 5. Insert new exercises
  const client = await pool.connect();
  let added = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    for (const ex of toSync) {
      if (existingNames.has(ex.name.toLowerCase())) {
        skipped++;
        continue;
      }

      await client.query(
        'INSERT INTO exercises (name, muscle_group, tags, is_custom, created_by) VALUES ($1, $2, $3, FALSE, NULL)',
        [ex.name, ex.muscleGroup, ex.tags]
      );
      added++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Sync complete: ${added} added, ${skipped} already existed`);
  return { added, skipped, total: toSync.length };
}
