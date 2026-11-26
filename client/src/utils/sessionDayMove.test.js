import { describe, it, expect } from 'vitest';
import { moveLocalSessionData, pendingDaySaves, flushDaySaves } from './sessionDayMove';
import { SAVE_SESSION, COMPLETE_SESSION } from '../queries/sessionMutations';

function memoryStorage(init = {}) {
  const map = new Map(Object.entries(init));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

describe('moveLocalSessionData', () => {
  it('renames backups on/after fromDate, drops their timers, leaves earlier days alone', () => {
    const s = memoryStorage({
      'replab:session:855:2026-11-25': '{"entries":{"a":1}}',
      'replab:session:856:2026-11-26': '{"entries":{"b":2}}',
      'replab:session:700:2026-11-20': '{"old":true}',
      'wf-timer-855-2026-11-25': '123',
      'wf-timer-700-2026-11-20': '456',
      'unrelated': 'x',
    });
    expect(moveLocalSessionData('2026-11-25', 1, s)).toBe(2);
    expect(s.dump()).toEqual({
      'replab:session:855:2026-11-26': '{"entries":{"a":1}}', // moved, not overwritten by 856's
      'replab:session:856:2026-11-27': '{"entries":{"b":2}}',
      'replab:session:700:2026-11-20': '{"old":true}',
      'wf-timer-700-2026-11-20': '456',
      'unrelated': 'x',
    });
  });

  it('handles moving several days and backwards', () => {
    const s = memoryStorage({ 'replab:session:1:2026-11-25': 'a', 'replab:session:1:2026-11-26': 'b' });
    moveLocalSessionData('2026-11-25', -1, s);
    expect(s.dump()).toEqual({ 'replab:session:1:2026-11-24': 'a', 'replab:session:1:2026-11-25': 'b' });
  });

  it('does nothing for a zero-day move', () => {
    const s = memoryStorage({ 'replab:session:1:2026-11-25': 'a' });
    expect(moveLocalSessionData('2026-11-25', 0, s)).toBe(0);
    expect(s.dump()).toEqual({ 'replab:session:1:2026-11-25': 'a' });
  });
});

function fakeClient(mutations) {
  return {
    resumed: 0,
    getMutationCache: () => ({ getAll: () => mutations }),
    resumePausedMutations() { this.resumed++; return Promise.resolve(); },
  };
}
const m = (key, variables, status = 'pending') => ({ options: { mutationKey: key }, state: { status, variables } });

describe('pendingDaySaves / flushDaySaves', () => {
  it('only counts pending workout saves/completions dated on or after fromDate', () => {
    const client = fakeClient([
      m(SAVE_SESSION, { body: { templateId: 855, date: '2026-11-25' } }),
      m(COMPLETE_SESSION, { templateId: 855, date: '2026-11-26', completed: true }),
      m(SAVE_SESSION, { body: { date: '2026-11-20' } }),                 // earlier day
      m(SAVE_SESSION, { body: { date: '2026-11-25' } }, 'success'),      // already sent
      m(['schedule', 'edit'], { date: '2026-11-25' }),                    // not a workout save
    ]);
    expect(pendingDaySaves(client, '2026-11-25')).toHaveLength(2);
  });

  it('resolves true at once when nothing is queued', async () => {
    const client = fakeClient([]);
    expect(await flushDaySaves(client, '2026-11-25')).toBe(true);
    expect(client.resumed).toBe(0);
  });

  it('waits for queued saves to go through', async () => {
    const save = m(SAVE_SESSION, { body: { date: '2026-11-25' } });
    const client = fakeClient([save]);
    setTimeout(() => { save.state.status = 'success'; }, 30);
    expect(await flushDaySaves(client, '2026-11-25', { timeoutMs: 1000, pollMs: 10 })).toBe(true);
    expect(client.resumed).toBe(1);
  });

  it('gives up (false) when they stay stuck, so the schedule is not moved', async () => {
    const client = fakeClient([m(SAVE_SESSION, { body: { date: '2026-11-25' } })]);
    expect(await flushDaySaves(client, '2026-11-25', { timeoutMs: 50, pollMs: 10 })).toBe(false);
  });
});
