// Unit tests for missedWorkouts.js — the "missed" rule, Resume's shift and
// Skip's marking. DB helpers run against a small in-memory schedule store
// (matched on SQL fragments) that enforces the (user_id, schedule_date)
// unique index, so a collision-unsafe shift fails the test.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeMissed, getMissedWorkouts, shiftScheduleFrom, markMissedSkipped,
  addDays, daysBetween, isValidDate, isPlausibleToday, MISSED_WINDOW_DAYS,
} from '../missedWorkouts.js';

const TODAY = '2026-09-29';
const TEMPLATES = { 10: { name: 'Push Day', is_rest: false }, 11: { name: 'Pull Day', is_rest: false }, 99: { name: 'Rest', is_rest: true } };

let store;
function makeStore({ schedule = [], sessions = [] } = {}) {
  let nextId = 1;
  return {
    schedule: schedule.map((d) => ({ id: nextId++, user_id: 1, is_rest: false, missed_skipped_at: null, template_id: null, ...d })),
    sessions: sessions.map((s) => ({ user_id: 1, completed: true, ...s })),
  };
}

const client = {
  async query(sql, params = []) {
    if (sql.includes('FROM schedule_days sd')) {
      const [userId, from, to] = params;
      return {
        rows: store.schedule
          .filter((r) => r.user_id === userId && r.schedule_date >= from && r.schedule_date < to)
          .map((r) => ({
            date: r.schedule_date,
            template_id: r.template_id,
            day_is_rest: r.is_rest,
            template_is_rest: r.template_id ? TEMPLATES[r.template_id].is_rest : false,
            template_name: r.template_id ? TEMPLATES[r.template_id].name : null,
            skipped: r.missed_skipped_at !== null,
          })),
      };
    }
    if (sql.includes('FROM sessions')) {
      const [userId, from, to] = params;
      return {
        rows: store.sessions
          .filter((s) => s.user_id === userId && s.completed && s.date >= from && s.date <= to)
          .map((s) => ({ template_id: s.template_id, date: s.date })),
      };
    }
    if (sql.includes('SELECT id FROM schedule_days')) {
      const [userId, from] = params;
      return {
        rows: store.schedule
          .filter((r) => r.user_id === userId && r.schedule_date >= from)
          .sort((a, b) => (a.schedule_date < b.schedule_date ? 1 : -1))
          .map((r) => ({ id: r.id })),
      };
    }
    if (sql.includes('SET schedule_date = schedule_date +')) {
      const [id, days] = params;
      const row = store.schedule.find((r) => r.id === id);
      const next = addDays(row.schedule_date, days);
      if (store.schedule.some((r) => r.id !== id && r.user_id === row.user_id && r.schedule_date === next)) {
        throw new Error('duplicate key value violates unique constraint "idx_schedule_days_user_date"');
      }
      row.schedule_date = next;
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('SET missed_skipped_at = NOW()')) {
      const [userId, dates] = params;
      let n = 0;
      for (const r of store.schedule) {
        if (r.user_id === userId && dates.includes(r.schedule_date) && r.missed_skipped_at === null) {
          r.missed_skipped_at = new Date();
          n++;
        }
      }
      return { rows: [], rowCount: n };
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  },
};

const d = (n) => addDays(TODAY, n);
const dates = () => store.schedule.map((r) => [r.schedule_date, r.template_id, r.is_rest]).sort();

describe('date helpers', () => {
  it('validates and does day math in calendar days', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-9-1')).toBe(false);
    expect(isValidDate(TODAY)).toBe(true);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-09-27', TODAY)).toBe(2);
  });

  it('accepts a client today within a day of the server UTC date', () => {
    const now = new Date('2026-09-29T12:00:00Z');
    expect(isPlausibleToday('2026-09-28', now)).toBe(true);
    expect(isPlausibleToday('2026-09-30', now)).toBe(true);
    expect(isPlausibleToday('2026-10-02', now)).toBe(false);
    expect(isPlausibleToday('nope', now)).toBe(false);
  });
});

describe('computeMissed / getMissedWorkouts', () => {
  it('finds past non-rest workouts with no completed session, earliest first', async () => {
    store = makeStore({
      schedule: [
        { schedule_date: d(-1), template_id: 11 },
        { schedule_date: d(-2), template_id: 10 },
        { schedule_date: d(-3), is_rest: true },           // rest day row
        { schedule_date: d(-4), template_id: 99 },          // rest template
        { schedule_date: d(0), template_id: 10 },           // today — not past
      ],
    });
    const missed = await getMissedWorkouts(client, 1, TODAY);
    expect(missed.map((m) => m.date)).toEqual([d(-2), d(-1)]);
    expect(missed[0]).toEqual({ date: d(-2), templateId: 10, templateName: 'Push Day' });
  });

  it(`ignores misses older than ${MISSED_WINDOW_DAYS} days`, async () => {
    store = makeStore({
      schedule: [
        { schedule_date: d(-(MISSED_WINDOW_DAYS + 1)), template_id: 10 },
        { schedule_date: d(-MISSED_WINDOW_DAYS), template_id: 11 },
      ],
    });
    const missed = await getMissedWorkouts(client, 1, TODAY);
    expect(missed.map((m) => m.date)).toEqual([d(-MISSED_WINDOW_DAYS)]);
  });

  it('only counts misses after the most recent completed workout', async () => {
    store = makeStore({
      schedule: [
        { schedule_date: d(-3), template_id: 10 },  // missed, then they trained
        { schedule_date: d(-2), template_id: 11 },  // completed
        { schedule_date: d(-1), template_id: 10 },  // missed since
      ],
      sessions: [{ template_id: 11, date: d(-2) }],
    });
    const missed = await getMissedWorkouts(client, 1, TODAY);
    expect(missed.map((m) => m.date)).toEqual([d(-1)]);
  });

  it('prompts nothing once they already trained today', () => {
    const missed = computeMissed({
      schedule: [{ date: d(-1), templateId: 10 }],
      completed: [{ date: TODAY, templateId: 11 }],
      today: TODAY,
    });
    expect(missed).toEqual([]);
  });

  it('counts an in-progress (not completed) session as missed', async () => {
    store = makeStore({
      schedule: [{ schedule_date: d(-1), template_id: 10 }],
      sessions: [{ template_id: 10, date: d(-1), completed: false }],
    });
    expect((await getMissedWorkouts(client, 1, TODAY)).length).toBe(1);
  });

  it('a completed session only clears the same template on the same date', () => {
    const missed = computeMissed({
      schedule: [{ date: d(-1), templateId: 10 }],
      completed: [{ date: d(-5), templateId: 10 }],
      today: TODAY,
    });
    expect(missed.length).toBe(1);
  });

  it('does not re-prompt skipped days', async () => {
    store = makeStore({ schedule: [{ schedule_date: d(-1), template_id: 10, missed_skipped_at: new Date() }] });
    expect(await getMissedWorkouts(client, 1, TODAY)).toEqual([]);
  });
});

describe('Resume — shiftScheduleFrom', () => {
  it('moves the earliest miss to today and pushes everything after it back by the same days', async () => {
    store = makeStore({
      schedule: [
        { schedule_date: d(-5), template_id: 11 },   // completed — untouched
        { schedule_date: d(-2), template_id: 10 },   // earliest miss (E)
        { schedule_date: d(-1), template_id: 11 },   // also missed
        { schedule_date: d(0), template_id: 10 },    // today's own workout
        { schedule_date: d(1), is_rest: true },      // rest day
        { schedule_date: d(2), template_id: 11 },    // consecutive rows → collisions if unordered
        { schedule_date: d(3), template_id: 10 },
      ],
      sessions: [{ template_id: 11, date: d(-5) }],
    });
    const missed = await getMissedWorkouts(client, 1, TODAY);
    const days = daysBetween(missed[0].date, TODAY);
    expect(days).toBe(2);

    const moved = await shiftScheduleFrom(client, 1, missed[0].date, days);

    expect(moved).toBe(6);
    expect(dates()).toEqual([
      [d(-5), 11, false],
      [d(0), 10, false],   // resumed workout is now today
      [d(1), 11, false],
      [d(2), 10, false],
      [d(3), null, true],  // rest day kept its place in the pattern
      [d(4), 11, false],
      [d(5), 10, false],
    ].sort());
    expect(await getMissedWorkouts(client, 1, TODAY)).toEqual([]);
  });
});

describe('Skip — markMissedSkipped', () => {
  it('stamps the missed days and changes no dates', async () => {
    store = makeStore({
      schedule: [
        { schedule_date: d(-2), template_id: 10 },
        { schedule_date: d(-1), template_id: 11 },
        { schedule_date: d(1), template_id: 10 },
      ],
    });
    const before = dates();
    const missed = await getMissedWorkouts(client, 1, TODAY);
    expect(await markMissedSkipped(client, 1, missed.map((m) => m.date))).toBe(2);
    expect(dates()).toEqual(before);
    expect(await getMissedWorkouts(client, 1, TODAY)).toEqual([]);
    // Idempotent: nothing left to skip.
    expect(await markMissedSkipped(client, 1, missed.map((m) => m.date))).toBe(0);
    expect(await markMissedSkipped(client, 1, [])).toBe(0);
  });
});
