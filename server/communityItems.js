// Community feed item keys. Feed items are "<prefix>-<row id>" (see
// db.getCommunityFeed); likes store the category name as item_type.
// Kept out of db.js so routes and tests can use it without the db mock.
//
// The feed shows four kinds (2026-11): PRs ('pr' → personal_bests), program
// enrollments ('program' → program_starts), program completions
// ('programComplete' → program_completions) and workout-streak milestones
// ('streak' → streak_milestones). The old 'workout' (wk) and 'custom' (cw)
// kinds are retired; their rows and likes are kept but no longer shown.

const PREFIX_TO_TYPE = { pr: 'pr', prog: 'program', pc: 'programComplete', st: 'streak' };
const TYPE_TO_PREFIX = Object.fromEntries(
  Object.entries(PREFIX_TO_TYPE).map(([prefix, type]) => [type, prefix])
);

// Feed kinds, which are also the per-category sharing setting keys.
export const COMMUNITY_ITEM_TYPES = Object.values(PREFIX_TO_TYPE);

// "pr-123" → { type: 'pr', id: 123 }, or null for anything malformed.
export function parseCommunityItemKey(key) {
  const m = /^([a-z]+)-(\d{1,10})$/.exec(String(key || ''));
  if (!m || !PREFIX_TO_TYPE[m[1]]) return null;
  const id = Number(m[2]);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return null;
  return { type: PREFIX_TO_TYPE[m[1]], id };
}

export function communityItemKey(type, id) {
  return `${TYPE_TO_PREFIX[type]}-${id}`;
}
