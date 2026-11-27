// Signup platform (iOS app / Android app / website) — server/signupPlatform.js
// rules, plus the admin dashboard queries against a real database
// (DATABASE_URL; skipped without one, like cascade-delete.test.js).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  normalizePlatform, platformFromDeviceInfo, signupPlatformFrom, platformLabel,
} from '../signupPlatform.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-at-least-thirty-two-chars-long';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

describe('signup platform rules', () => {
  it('accepts only ios / android / web', () => {
    expect(normalizePlatform('ios')).toBe('ios');
    expect(normalizePlatform(' Android ')).toBe('android');
    expect(normalizePlatform('web')).toBe('web');
    for (const bad of ['windows', '', null, undefined, 3, {}, ['ios']]) expect(normalizePlatform(bad)).toBeNull();
  });

  it('reads the platform only from native-app deviceInfo', () => {
    expect(platformFromDeviceInfo('iPhone 15 Pro · ios 18.2')).toBe('ios');
    expect(platformFromDeviceInfo('Samsung SM-S918U · android 14')).toBe('android');
    expect(platformFromDeviceInfo('ios device')).toBe('ios');
    // Browser User-Agent descriptions (parseDevice) can't tell app from website.
    expect(platformFromDeviceInfo('Android Phone (Chrome)')).toBeNull();
    expect(platformFromDeviceInfo('iPhone (Safari)')).toBeNull();
    expect(platformFromDeviceInfo(undefined)).toBeNull();
  });

  it('prefers the sent platform, and never falls back to website', () => {
    expect(signupPlatformFrom({ platform: 'web', deviceInfo: 'iPhone · ios 18' })).toBe('web');
    expect(signupPlatformFrom({ platform: 'nope', deviceInfo: 'iPhone · ios 18' })).toBe('ios');
    expect(signupPlatformFrom({})).toBeNull();
    expect(signupPlatformFrom()).toBeNull();
  });

  it('labels', () => {
    expect([platformLabel('ios'), platformLabel('android'), platformLabel('web'), platformLabel(null)])
      .toEqual(['iOS app', 'Android app', 'Website', 'Unknown']);
  });
});

const HAS_DB = !!process.env.DATABASE_URL;
const describeIfDb = HAS_DB ? describe : describe.skip;

describeIfDb('signup platform in the database', () => {
  let db; let pool; let platformCounts;
  const TAG = `platformtest_${Date.now()}`;
  const DAY = '2001-02-03'; // a day no real user signed up on
  const ids = [];

  beforeAll(async () => {
    // Make sure the schema (incl. users.signup_platform) is migrated.
    await (await import('../initDb.js')).default();
    ({ default: db, platformCounts } = await import('../db.js'));
    ({ default: pool } = await import('../dbPool.js'));
    for (const [i, platform] of ['ios', 'ios', 'android', 'web', null, 'garbage'].entries()) {
      const u = await db.createUser({ email: `${TAG}_${i}@example.com`, passwordHash: 'x', signupPlatform: platform });
      ids.push(u.id);
    }
    await pool.query(`UPDATE users SET created_at = $1::date + interval '12 hours' WHERE id = ANY($2)`, [DAY, ids]);
  }, 60_000);

  afterAll(async () => {
    if (pool) await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  });

  it('createUser stores the platform, and an unrecognized one as NULL', async () => {
    const { rows } = await pool.query('SELECT signup_platform FROM users WHERE id = ANY($1) ORDER BY id', [ids]);
    expect(rows.map((r) => r.signup_platform)).toEqual(['ios', 'ios', 'android', 'web', null, null]);
  });

  it('the column refuses anything but ios / android / web', async () => {
    await expect(pool.query('UPDATE users SET signup_platform = $1 WHERE id = $2', ['windows', ids[0]]))
      .rejects.toMatchObject({ code: '23514' });
  });

  const expected = [
    { platform: 'ios', label: 'iOS app', count: 2 },
    { platform: 'android', label: 'Android app', count: 1 },
    { platform: 'web', label: 'Website', count: 1 },
    { platform: null, label: 'Unknown', count: 2 },
  ];

  it('getPlatformBreakdown counts the date range', async () => {
    expect(await db.getPlatformBreakdown(DAY, DAY)).toEqual(expected);
  });

  it('getDailyStats lists each new signup with its platform, plus the breakdown', async () => {
    const stats = await db.getDailyStats(DAY, DAY);
    expect(stats.recentSignups.map((u) => u.signup_platform).sort()).toEqual(['android', 'ios', 'ios', 'web', null, null].sort());
    expect(stats.signupPlatforms).toEqual(expected);
  });

  it('getAllUsers shows the label', async () => {
    const users = await db.getAllUsers();
    const mine = users.filter((u) => u.email?.startsWith(TAG)).map((u) => u.signupPlatform).sort();
    expect(mine).toEqual(['Android app', 'Unknown', 'Unknown', 'Website', 'iOS app', 'iOS app'].sort());
  });

  it('platformCounts always lists every platform', () => {
    expect(platformCounts([])).toEqual(expected.map((p) => ({ ...p, count: 0 })));
  });
});
