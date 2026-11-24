// Program builder ("sample calendar", 2026-11-23): a program is its ordered
// list of templates — position i is Week floor(i/7)+1, Day (i%7)+1, rest
// days are is_rest templates. The builder rewrites that list in one go
// through PUT /programs/:id/layout (routes/programs.js), and Create a
// Workout drops a new workout on a chosen day (POST /templates slotIndex).
//
// Every day is its own template row: placing the same workout on several
// days makes separate copies (decision with Will — same as library
// programs, so each day keeps its own goal weights). Starting a program is
// unchanged: template i goes on startDate + i days.

export const MAX_PROGRAM_WEEKS = 52;
export const MAX_PROGRAM_SLOTS = MAX_PROGRAM_WEEKS * 7;
export const REST_TEMPLATE_NAME = 'Rest';

// A 400 the route sends as-is.
export class LayoutError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Checks a slot list against the program's current templates (pure, so it's
// unit-tested without a database). Each slot is exactly one of
//   { templateId } — keep this template of the program on this day
//   { copyOf }     — a new copy of a workout (this program, the user's own
//                    workouts, or a library workout) on this day
//   { rest: true } — a new rest day
// Returns the template ids the layout no longer uses (deleted on save).
export function checkLayout(slots, currentIds, copySourceIds) {
  if (!Array.isArray(slots)) throw new LayoutError('Slots must be a list');
  if (slots.length % 7 !== 0) throw new LayoutError('Slots must be whole weeks (a multiple of 7 days)');
  if (slots.length > MAX_PROGRAM_SLOTS) throw new LayoutError(`A program can have at most ${MAX_PROGRAM_WEEKS} weeks`);
  const current = new Set(currentIds);
  const sources = new Set(copySourceIds);
  const kept = new Set();
  slots.forEach((slot, i) => {
    if (slot.templateId != null) {
      if (!current.has(slot.templateId)) throw new LayoutError(`Day ${i + 1}: that workout is not in this program`);
      if (kept.has(slot.templateId)) throw new LayoutError(`Day ${i + 1}: a workout can only be on one day — place a copy instead`);
      kept.add(slot.templateId);
    } else if (slot.copyOf != null) {
      if (!sources.has(slot.copyOf)) throw new LayoutError(`Day ${i + 1}: workout to copy not found`);
    } else if (slot.rest !== true) {
      throw new LayoutError(`Day ${i + 1}: must be a workout, a copy or a rest day`);
    }
  });
  return [...current].filter((tid) => !kept.has(tid));
}

// Copy a template (row + exercises) into a program at a sort position.
async function copyTemplate(client, userId, programId, sourceId, sortOrder) {
  const { rows } = await client.query(
    `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
     SELECT $1, $2, name, COALESCE(description, ''), COALESCE(is_rest, false), $3
       FROM templates WHERE id = $4
     RETURNING id`,
    [userId, programId, sortOrder, sourceId],
  );
  const newId = rows[0].id;
  await client.query(
    `INSERT INTO template_exercises (template_id, exercise_id, name, set_type, set_number, planned_reps,
       suggested_weight, sort_order, rep_range, exercise_description, is_section_header, section_notes,
       video_url, program_notes, superset_label)
     SELECT $1, exercise_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order,
       rep_range, exercise_description, is_section_header, section_notes, video_url, program_notes,
       superset_label
       FROM template_exercises WHERE template_id = $2
      ORDER BY id`,
    [newId, sourceId],
  );
  return newId;
}

// Rewrite a program's day list inside the caller's transaction. Returns null
// when the program isn't the user's (library programs are never editable),
// else { programId, templateIds (in day order), startWeekday }. Throws
// LayoutError for a bad slot list. Templates the layout no longer uses are
// deleted, like DELETE /templates/:id (their personal bests and calendar days
// go with them; logged sessions stay in History). Prehab warm-ups (library
// only) are never touched.
//
// startWeekday: undefined = unchanged, null = clear ("Day 1–7"), 0–6 =
// Sunday–Saturday, stored in programs.program_details.startWeekday.
export async function applyProgramLayout(client, userId, programId, slots, { startWeekday } = {}) {
  const { rows: progRows } = await client.query(
    'SELECT id, program_details FROM programs WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [programId, userId],
  );
  if (!progRows[0]) return null;

  const { rows: current } = await client.query(
    `SELECT id FROM templates
      WHERE program_id = $1 AND user_id = $2 AND NOT COALESCE(is_prehab, false)`,
    [programId, userId],
  );
  const copyIds = [...new Set(slots.filter((s) => s.copyOf != null).map((s) => s.copyOf))];
  let sourceIds = [];
  if (copyIds.length) {
    const { rows } = await client.query(
      `SELECT id FROM templates
        WHERE id = ANY($1) AND (user_id = $2 OR user_id IS NULL) AND NOT COALESCE(is_prehab, false)`,
      [copyIds, userId],
    );
    sourceIds = rows.map((r) => r.id);
  }
  const removed = checkLayout(slots, current.map((r) => r.id), sourceIds);

  // Removed templates go first, so a kept template's new sort_order never
  // collides with one that's about to disappear (sort_order isn't unique,
  // but the order reads cleaner in the log).
  if (removed.length) {
    await client.query('DELETE FROM templates WHERE id = ANY($1) AND user_id = $2', [removed, userId]);
  }

  const templateIds = [];
  const keptIds = [];
  const keptOrders = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.templateId != null) {
      keptIds.push(slot.templateId);
      keptOrders.push(i);
      templateIds.push(slot.templateId);
    } else if (slot.copyOf != null) {
      templateIds.push(await copyTemplate(client, userId, programId, slot.copyOf, i));
    } else {
      const { rows } = await client.query(
        `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
         VALUES ($1, $2, $3, '', true, $4) RETURNING id`,
        [userId, programId, REST_TEMPLATE_NAME, i],
      );
      templateIds.push(rows[0].id);
    }
  }
  if (keptIds.length) {
    await client.query(
      `UPDATE templates t SET sort_order = v.ord
         FROM unnest($1::int[], $2::int[]) AS v(id, ord)
        WHERE t.id = v.id AND t.program_id = $3`,
      [keptIds, keptOrders, programId],
    );
  }

  let details = progRows[0].program_details || null;
  if (startWeekday !== undefined) {
    const { rows } = await client.query(
      `UPDATE programs
          SET program_details = NULLIF(
                CASE WHEN $2::int IS NULL THEN COALESCE(program_details, '{}'::jsonb) - 'startWeekday'
                     ELSE COALESCE(program_details, '{}'::jsonb) || jsonb_build_object('startWeekday', $2::int)
                END, '{}'::jsonb)
        WHERE id = $1
        RETURNING program_details`,
      [programId, startWeekday],
    );
    details = rows[0].program_details || null;
  }
  const sw = details?.startWeekday;
  return {
    programId,
    templateIds,
    startWeekday: Number.isInteger(sw) ? sw : null,
  };
}

// Slot list that puts `templateId` (already in the program) on day
// `slotIndex`: it replaces a rest day or an empty day there; if a workout is
// already on that day, the new one goes on the first free day after it (a
// new week is added when needed). Pure — unit-tested.
//   ordered: the program's templates in day order, as { id, isRest }
export function slotsPlacingTemplate(ordered, templateId, slotIndex) {
  const others = ordered.filter((t) => t.id !== templateId);
  const weeksNeeded = Math.max(Math.ceil(others.length / 7), Math.floor(slotIndex / 7) + 1, 1);
  const days = Array.from({ length: weeksNeeded * 7 }, (_, i) => others[i] || null);
  let target = slotIndex;
  while (target < days.length && days[target] && !days[target].isRest) target++;
  if (target >= days.length) {
    // Every day from slotIndex on is a workout: add a week for it.
    for (let i = 0; i < 7; i++) days.push(null);
  }
  // A rest template replaced by the new workout isn't listed, so it's deleted.
  days[target] = { id: templateId };
  return days.map((d) => (d ? { templateId: d.id } : { rest: true }));
}

// Place a just-created template on a day of its program (inside the
// caller's transaction). Returns false when the program isn't the user's.
export async function placeTemplateAtSlot(client, userId, programId, templateId, slotIndex) {
  const { rows } = await client.query(
    `SELECT id, COALESCE(is_rest, false) AS is_rest FROM templates
      WHERE program_id = $1 AND user_id = $2 AND NOT COALESCE(is_prehab, false)
      ORDER BY sort_order, id`,
    [programId, userId],
  );
  const ordered = rows.map((r) => ({ id: r.id, isRest: r.is_rest }));
  const slots = slotsPlacingTemplate(ordered, templateId, slotIndex);
  const result = await applyProgramLayout(client, userId, programId, slots);
  return !!result;
}
