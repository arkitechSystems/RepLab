// getClientPlatform() — the `platform` sent with signup / first Google-Apple
// sign-in so the admin dashboard can tell iOS app / Android app / website.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const getPlatform = vi.fn();
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => getPlatform() } }));

const { getClientPlatform } = await import('./deviceInfo');

describe('getClientPlatform', () => {
  beforeEach(() => getPlatform.mockReset());

  it.each(['ios', 'android', 'web'])('reports %s', (p) => {
    getPlatform.mockReturnValue(p);
    expect(getClientPlatform()).toBe(p);
  });

  it('sends nothing for an unexpected value', () => {
    getPlatform.mockReturnValue('electron');
    expect(getClientPlatform()).toBeUndefined();
  });
});
