// Unit tests for the daily summary email job: once per UTC day after 13:00,
// and a failed send is not recorded, so the next run tries again.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const settings = new Map();
const sendDailySummaryEmail = vi.fn();

vi.mock('../db.js', () => ({
  default: {
    getAdminSetting: vi.fn(async (key) => settings.get(key) ?? null),
    setAdminSetting: vi.fn(async (key, value) => { settings.set(key, value); }),
    getDailyStats: vi.fn(async () => ({ totalUsers: 3, recentSignups: [] })),
  },
}));
vi.mock('../email.js', () => ({ sendDailySummaryEmail: (...args) => sendDailySummaryEmail(...args) }));

const { runDailySummary, DAILY_SUMMARY_FLAG } = await import('../dailySummaryJob.js');

beforeEach(() => {
  settings.clear();
  sendDailySummaryEmail.mockReset();
  sendDailySummaryEmail.mockResolvedValue(undefined);
});

describe('runDailySummary', () => {
  it('does nothing before 13:00 UTC', async () => {
    expect(await runDailySummary(new Date('2026-10-13T12:59:00Z'))).toBe('too-early');
    expect(sendDailySummaryEmail).not.toHaveBeenCalled();
  });

  it('sends once after 13:00 UTC and records the day', async () => {
    expect(await runDailySummary(new Date('2026-10-13T13:00:00Z'))).toBe('sent');
    expect(sendDailySummaryEmail).toHaveBeenCalledTimes(1);
    expect(settings.get(DAILY_SUMMARY_FLAG)).toBe('2026-10-13');

    expect(await runDailySummary(new Date('2026-10-13T13:10:00Z'))).toBe('already-sent');
    expect(sendDailySummaryEmail).toHaveBeenCalledTimes(1);
  });

  it('sends again the next day', async () => {
    await runDailySummary(new Date('2026-10-13T14:00:00Z'));
    expect(await runDailySummary(new Date('2026-10-14T13:00:00Z'))).toBe('sent');
    expect(sendDailySummaryEmail).toHaveBeenCalledTimes(2);
  });

  it('a failed send throws and is not recorded, so the next run retries', async () => {
    sendDailySummaryEmail.mockRejectedValueOnce(new Error('Resend rejected email'));
    await expect(runDailySummary(new Date('2026-10-13T13:00:00Z'))).rejects.toThrow('Resend rejected');
    expect(settings.has(DAILY_SUMMARY_FLAG)).toBe(false);

    expect(await runDailySummary(new Date('2026-10-13T13:10:00Z'))).toBe('sent');
    expect(sendDailySummaryEmail).toHaveBeenCalledTimes(2);
  });
});
