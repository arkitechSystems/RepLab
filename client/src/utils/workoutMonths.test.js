import { describe, expect, it } from 'vitest';
import { groupWorkoutsByMonth, newestFirst } from './workoutMonths';

// Noon UTC on mid-month days so the month is the same in any time zone.
const t = (id, createdAt, sortOrder = 0) => ({ id, createdAt, sortOrder });

describe('groupWorkoutsByMonth', () => {
  it('groups by month created, newest month first, newest first inside, undated last as EARLIER', () => {
    const groups = groupWorkoutsByMonth([
      t(1, null, 0),
      t(2, '2026-10-05T12:00:00Z'),
      t(3, '2026-11-20T12:00:00Z'),
      t(4, '2026-10-25T12:00:00Z'),
      t(5, null, 3),
      t(6, '2025-12-15T12:00:00Z'),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['NOVEMBER 2026', 'OCTOBER 2026', 'DECEMBER 2025', 'EARLIER']);
    expect(groups.map((g) => g.items.map((x) => x.id))).toEqual([[3], [4, 2], [6], [5, 1]]);
  });

  it('same time: newest by list position, then id; bad dates count as undated', () => {
    expect([t(1, '2026-11-01T12:00:00Z', 0), t(2, '2026-11-01T12:00:00Z', 0)].sort(newestFirst).map((x) => x.id)).toEqual([2, 1]);
    expect(groupWorkoutsByMonth([t(1, 'not a date')]).map((g) => g.label)).toEqual(['EARLIER']);
    expect(groupWorkoutsByMonth([])).toEqual([]);
  });
});
