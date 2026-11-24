import { describe, it, expect } from 'vitest';
import {
  programDays, weekCount, startWeekdayOf, dayLabel, dayHeaders, toLayoutSlots,
  setDay, addWeek, duplicateWeek, deleteWeek, moveDay, copiesInProgram, distinctWorkouts,
} from './programLayout';

const t = (id, name, extra = {}) => ({ id, name, programId: 1, userId: 37, isRest: false, sortOrder: id, exercises: [], ...extra });
const rest = (id) => t(id, 'Rest', { isRest: true });

describe('programDays', () => {
  it('orders templates and pads to whole weeks, leaving out prehab warm-ups', () => {
    const days = programDays([t(3, 'C'), t(1, 'A'), t(2, 'Warm-up', { isPrehab: true })]);
    expect(days).toHaveLength(7);
    expect(days.slice(0, 3).map((d) => d && d.name)).toEqual(['A', 'C', null]);
    expect(weekCount(days)).toBe(1);
  });

  it('an empty program is one empty week', () => {
    expect(programDays([])).toEqual(Array(7).fill(null));
  });
});

describe('day labels', () => {
  it('Day 1–7 by default, with the weekday once a start day is picked', () => {
    expect(dayLabel(2, null)).toBe('Day 3');
    expect(dayLabel(2, 1)).toBe('Day 3 · Wed');
    expect(dayLabel(9, 5)).toBe('Day 3 · Sun');
    expect(dayHeaders(null)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']);
    expect(dayHeaders(1)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('reads the start weekday from program_details', () => {
    expect(startWeekdayOf({ programDetails: { startWeekday: 0 } })).toBe(0);
    expect(startWeekdayOf({ programDetails: null })).toBeNull();
    expect(startWeekdayOf({ programDetails: { startWeekday: 9 } })).toBeNull();
  });
});

describe('edits', () => {
  const days = [t(1, 'Push'), rest(2), t(3, 'Pull'), null, null, null, null];

  it('turns days into layout slots (empty days become rest days)', () => {
    expect(toLayoutSlots(setDay(days, 3, { copyOf: 1 }))).toEqual([
      { templateId: 1 }, { templateId: 2 }, { templateId: 3 }, { copyOf: 1 }, { rest: true }, { rest: true }, { rest: true },
    ]);
  });

  it('adds, duplicates and deletes whole weeks', () => {
    expect(addWeek(days)).toHaveLength(14);
    const dup = duplicateWeek(days, 0);
    expect(dup.slice(7)).toEqual([{ copyOf: 1 }, null, { copyOf: 3 }, null, null, null, null]);
    expect(deleteWeek(dup, 0)).toEqual(dup.slice(7));
  });

  it('moving a workout swaps the two days', () => {
    const moved = moveDay(days, 0, 4);
    expect(moved[0]).toBeNull();
    expect(moved[4].name).toBe('Push');
    expect(moveDay(days, 0, 2).slice(0, 3).map((d) => d.name)).toEqual(['Pull', 'Rest', 'Push']);
  });
});

describe('copies', () => {
  const list = [t(1, 'Push'), t(2, ' push '), t(3, 'Pull'), t(4, 'Push', { programId: 2 }), rest(5), t(6, 'Push', { userId: null })];

  it('finds the other copies of a workout in the same program', () => {
    expect(copiesInProgram(list, list[0]).map((c) => c.id)).toEqual([2]);
    expect(copiesInProgram(list, { ...list[0], programId: null })).toEqual([]);
  });

  it('lists each different workout once', () => {
    expect(distinctWorkouts([list[0], list[1], list[2], list[4]]).map((w) => w.id)).toEqual([1, 3]);
  });
});
