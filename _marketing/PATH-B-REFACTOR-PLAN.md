# Path B Refactor Plan — exercise_name → exercise_id

**Status:** Phase 0 complete. Phases 1–4 are this plan.

## Phase 0 — DONE (overnight 2026-05-17)

- ✅ `template_exercises.exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL` — added + backfilled (5,792 rows linked, 0 orphans)
- ✅ `session_entries.exercise_id` — added + backfilled (2,933 linked, 1 orphan: `id 1438` "Incline machine press" — likely should map to id 579 "Hammer strength incline press" but left NULL for manual review)
- ✅ `personal_bests.exercise_id` — added + backfilled (117 linked, 0 orphans)
- ✅ Indexes on `exercise_id` for all three tables
- ✅ `schema.sql` updated so fresh deploys get the columns by default
- ✅ All columns NULLABLE — existing read paths still work via `exercise_name`

The database is in a **dual-state**: every row has both `exercise_name` (legacy) and `exercise_id` (canonical). Old code still works. New code can start preferring `exercise_id`.

---

## The principle

Three phases, **never break old code mid-flight**:

1. **Dual-write** — every INSERT/UPDATE populates BOTH columns.
2. **Switch reads** — one query at a time, switch joins from `LOWER(name) = LOWER(name)` to `exercise_id = id`. Verify after each.
3. **Drop the legacy column** — only after every read path uses `exercise_id` and a grace period has passed.

The third phase is optional — you may want to keep `exercise_name` permanently as a historical fallback (so a deleted exercise's PR history still shows the original name instead of "(deleted)").

---

## Phase 1 — Dual-write at every INSERT/UPDATE point

Every place that creates rows in the three tables needs to also populate `exercise_id`. Look up `exercise_id` from `exercises.name` once and pass it along.

### Server-side writes (the critical paths)

| File | Where | What to change |
|---|---|---|
| `server/db.js` line 90 | `INSERT INTO personal_bests (user_id, template_id, exercise_name, best_weight, best_reps)` | Add `exercise_id` column + parameter. Look up id via `(SELECT id FROM exercises WHERE LOWER(name) = LOWER($name) LIMIT 1)` or pass it in from the caller. |
| `server/db.js` line 729 | `INSERT INTO session_entries (session_id, exercise_name, set_number, weight, reps, is_completed)` | Same. This is the hot path — every set logged. |
| `server/db.js` line 764 | `INSERT INTO personal_bests (...) ON CONFLICT (user_id, template_id, exercise_name, best_weight) DO UPDATE` | Same. Note the ON CONFLICT key uses name — leave it for now; revisit when dropping name. |
| `server/db.js` `createTemplateExercises` (search for INSERT INTO template_exercises) | Template creation | Same. |
| `server/routes/trainer.js`, `server/routes/workoutDashboard.js`, `server/routes/admin.js` | Anywhere they INSERT into these tables (search for `INSERT INTO (template_exercises|session_entries|personal_bests)`) | Same pattern. |
| `server/seedSummerShred.js`, `server/migrations/add-*.js` | Historical seed files | LEAVE — these are one-time scripts that have already run. Backfill caught up everything they wrote. |

**Suggested helper** (drop in `server/db.js`):
```js
// Look up the master exercises.id for a name. Returns null if no match
// (custom names that haven't been added to the library yet). Cached per-
// request via Map to avoid duplicate lookups inside one session save.
async function resolveExerciseId(client, name, cache = null) {
  if (!name) return null;
  if (cache?.has(name.toLowerCase())) return cache.get(name.toLowerCase());
  const r = await client.query(
    'SELECT id FROM exercises WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [name]
  );
  const id = r.rows[0]?.id || null;
  if (cache) cache.set(name.toLowerCase(), id);
  return id;
}
```

Then in `createSession` and other batch inserts, build a name → id map once per call and pass `exercise_id` into the multi-row INSERT.

### Custom exercises (be careful here)

When a user types a custom name in the in-app Add Exercise picker, today's flow is:
1. The custom name lands in `template_exercises.name` (and later `session_entries.exercise_name`)
2. Per `server/db.js`, the master `exercises` table also gets an `INSERT` for custom names — search for `is_custom = TRUE` to find it.

After Phase 1: that INSERT into `exercises` must happen BEFORE the INSERT into `session_entries` so `exercise_id` can resolve. Otherwise `resolveExerciseId` returns NULL and you've got a name-only row again.

**Verification after Phase 1:**
```sql
-- Should hold steady at 0 (or 1 if you don't fix the Incline machine press orphan)
SELECT COUNT(*) FROM session_entries WHERE exercise_id IS NULL;
SELECT COUNT(*) FROM personal_bests WHERE exercise_id IS NULL;
SELECT COUNT(*) FROM template_exercises WHERE exercise_id IS NULL AND COALESCE(is_section_header, FALSE) = FALSE;
```

Run this in the admin dashboard daily for a week to confirm no regressions.

---

## Phase 2 — Switch reads onto exercise_id

This is most of the refactor work. The pattern everywhere is:

```sql
-- BEFORE
LEFT JOIN exercises e ON LOWER(e.name) = LOWER(pb.exercise_name)

-- AFTER
LEFT JOIN exercises e ON e.id = pb.exercise_id
```

Or for groupings:
```sql
-- BEFORE
GROUP BY pb.exercise_name

-- AFTER
GROUP BY pb.exercise_id, e.name   -- carry name through for display
```

### Sequenced module order (low-risk → high-risk)

Verify each module in production before moving to the next.

| Order | Module | Why first/last |
|---|---|---|
| 1 | `server/routes/admin.js` Exercise Library export + orphan PR detection | Internal-only, easy to verify visually in the .xlsx output. |
| 2 | `server/routes/admin.js` Admin dashboards (PR counts, exercise coverage) | Internal-only. |
| 3 | `server/routes/pbs.js` PR endpoints | Tightly scoped. Endpoint count: under 10. |
| 4 | `server/db.js` PR aggregation (`getAllPRsByMuscle`, `getPRsForUser`, etc.) | Powers the Workouts page Personal Records section + Progress page. |
| 5 | `server/db.js` session history (`getSession`, `getSessionsForCalendar`) | History views. |
| 6 | `server/db.js` template / program serializers (`getProgramTemplates`, etc.) | Read paths for the workout-session screen — be careful, exercise display, ordering, video lookup all hang off this. |
| 7 | `server/routes/trainer.js`, `server/routes/workoutDashboard.js`, `server/routes/community.js` | Less frequently hit; verify after. |

### Search anchors per file

Quick `grep` commands to find every read-by-name in each file:

```bash
grep -n "LOWER(.*exercise_name)\|exercise_name = " server/db.js
grep -n "LOWER(.*exercise_name)\|exercise_name = " server/routes/admin.js
grep -n "LOWER(.*exercise_name)\|exercise_name = " server/routes/pbs.js
grep -n "LOWER(.*exercise_name)\|exercise_name = " server/routes/trainer.js
grep -n "LOWER(.*exercise_name)\|exercise_name = " server/routes/workoutDashboard.js
```

Count from the overnight inventory (Phase 0):
- `server/db.js` — 36 refs
- `server/routes/admin.js` — 16 refs
- `server/routes/pbs.js` — 9 refs

Realistic total Phase 2 work: **~70 query rewrites**, ~1.5 days focused work plus verification.

---

## Phase 3 — Client display

The frontend mostly already works the right way — it consumes API responses and displays the exercise name from the joined master row. A few hotspots to verify aren't doing client-side filtering by name in a way that exercise_id would break:

| File | What to check |
|---|---|
| `client/src/pages/WorkoutSession.jsx` | The `entries[exerciseName]` keying — currently uses name as the map key. Switching to id key is a meaningful refactor (lots of state shape changes). **Lowest priority** — it works as-is; name-keyed maps just have to be regenerated when an exercise is renamed, which Path A already handled. |
| `client/src/pages/Workouts.jsx` | `allPRsByMuscle` grouping. Probably already joined server-side. |
| `client/src/pages/Progress.jsx` | Receives `{ exercise, weight, occurrences }` from `/sessions/progress-overload`. Server returns name; could return id + name. |
| `client/src/hooks/useExercises.js` | Reads exercise list. Already keys on the master library; no change needed. |

**Decision point for Phase 3:** do you want the frontend keying on `exercise_id` end-to-end, or is it OK to keep name as the client-side key as long as the server is id-canonical? The latter is way less work and the client is already insulated from duplicates after Path A — name collisions can't reappear unless someone manually creates them.

**Recommendation:** Keep client keying on name. Server is canonical on id. Done.

---

## Phase 4 — Drop exercise_name (optional)

After Phases 1–3 land, you have a choice:

**Option A — Keep both columns forever.**
- `exercise_id` is the FK / source of truth
- `exercise_name` is denormalized snapshot for display + historical
- Pros: deleting an exercise from the master library doesn't erase old PRs/history (they show the original name). FK uses ON DELETE SET NULL — exercise_id goes NULL but exercise_name persists.
- Cons: slightly more storage, denorm risk (name + id can drift if you don't keep the dual-write disciplined)

**Option B — Drop exercise_name from session_entries + personal_bests + template_exercises.**
- Schema is cleaner, can't drift
- Pros: enforced consistency, less code branching
- Cons: deleted exercises wipe historical names; PRs become "exercise #495 (deleted)" instead of "Barbell Bent Rows (deleted)"

**Recommendation:** Option A. The denorm cost is tiny and the historical preservation is valuable. Add a CHECK constraint or trigger that asserts `exercise_id IS NULL OR exercise_name = (SELECT name FROM exercises WHERE id = exercise_id)` if you want to enforce sync.

---

## Files NOT to touch

These reference `exercise_name` but are historical / one-shot / migrations:
- `server/migrations/exercise-cleanup-2026-05-17.mjs` (ran tonight)
- `server/migrations/add-exercise-id-columns-2026-05-17.mjs` (ran tonight)
- `server/migrations/add-hypertrophy-programs.js`, `add-smolov.js`, `add-shoulders-triceps.js` (historical seeds)
- `server/seedSummerShred.js` (historical seed)
- `server/migrations/_utils.js` — only touch if it has shared INSERT helpers

`server/scripts/seed-apple-reviewer.js` DOES need updating — Phase 1, since it creates session data the App Review reviewer sees.

---

## Open questions for tomorrow morning

1. **The 4 collision-skipped duplicates from Path A** — manual fix:
   - id 117 "Dumbbell Shoulder Press" (also exists as id 252)
   - id 290 "Banded DB Shoulder Press" (also exists as id 269)
   - id 321 "Single Leg Hack Squat" (also exists as id 280)
   - id 283 "Cable Flyes (Middle Chest)" (also exists as id 312)

   For each: add the missing id to the duplicates sheet pointing to the same target, OR just merge them manually via the admin UI.

2. **The 1 orphan session_entry** (id 1438, "Incline machine press", w=100 r=50). Best candidate is id 579 "Hammer strength incline press". Want me to link it on confirm?

3. **Order of Phase 1 work.** Do you want me to do Phase 1 (the dual-write changes) in the next session, or do you want to review Path A in production first?

4. **What to do with custom exercises that don't exist in the master library yet.** Right now they get `exercise_id = NULL`. Options:
   - Auto-create an `exercises` row with `is_custom = TRUE, created_by = user_id` whenever a new custom name shows up (current behavior — verify it still works after Phase 1)
   - Hard-fail at the API: every entry must reference a known exercise
   - Allow NULL and live with it

   Recommendation: auto-create, as today.
