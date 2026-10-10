import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server, http, HttpResponse } from '../test/server';
import { api, setApiToken } from '../api';
import { queryClient } from './queryClient';
import { pathKey } from './keys';
import { loadPath, loadPathOrSaved, savedPath, savedAt, importLegacyCache, markCacheRestored } from './data';

// A JWT whose payload is { userId }, enough for api.js's per-user cache keys.
const tokenFor = (userId) => `x.${btoa(JSON.stringify({ userId }))}.y`;

beforeEach(() => markCacheRestored());
afterEach(() => { queryClient.clear(); setApiToken(null); });

describe('pathKey', () => {
  it('splits the path and keeps the query string as an object', () => {
    expect(pathKey('/programs')).toEqual(['programs']);
    expect(pathKey('/sessions/completed')).toEqual(['sessions', 'completed']);
    expect(pathKey('/schedule?from=2026-10-01&to=2026-10-07')).toEqual(['schedule', { from: '2026-10-01', to: '2026-10-07' }]);
    expect(pathKey('/sessions/by-template/835/2026-10-07')).toEqual(['sessions', 'by-template', '835', '2026-10-07']);
  });
});

describe('loadPath / savedPath / savedAt', () => {
  it('loads live, then the same data is the saved copy', async () => {
    server.use(http.get('*/programs', () => HttpResponse.json([{ id: 1 }])));
    await expect(savedPath('/programs')).rejects.toMatchObject({ notCached: true });
    expect(savedAt('/programs')).toBeNull();
    await expect(loadPath('/programs')).resolves.toEqual([{ id: 1 }]);
    await expect(savedPath('/programs')).resolves.toEqual([{ id: 1 }]);
    expect(savedAt('/programs')).toBeGreaterThan(0);
  });

  it('always checks with the server, even when a saved copy exists', async () => {
    let n = 0;
    server.use(http.get('*/programs', () => HttpResponse.json([{ id: ++n }])));
    await loadPath('/programs');
    await expect(loadPath('/programs')).resolves.toEqual([{ id: 2 }]);
  });

  // Regression: gcTime of 30 days overflowed setTimeout and dropped every
  // unwatched query as soon as it loaded, so nothing was ever saved.
  it('a loaded path stays cached when no screen is watching it', async () => {
    server.use(http.get('*/programs', () => HttpResponse.json([{ id: 1 }])));
    await loadPath('/programs');
    await new Promise((r) => setTimeout(r, 50));
    expect(queryClient.getQueryData(['programs'])).toEqual([{ id: 1 }]);
  });

  it('two screens asking at once share one request', async () => {
    let n = 0;
    server.use(http.get('*/templates', async () => { n++; await new Promise((r) => setTimeout(r, 20)); return HttpResponse.json([]); }));
    await Promise.all([loadPath('/templates'), loadPath('/templates')]);
    expect(n).toBe(1);
  });

  it("an aborted caller gets AbortError, but the result still lands in the cache", async () => {
    server.use(http.get('*/programs', async () => { await new Promise((r) => setTimeout(r, 20)); return HttpResponse.json([{ id: 9 }]); }));
    const controller = new AbortController();
    const p = loadPath('/programs', { signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    await new Promise((r) => setTimeout(r, 40));
    expect(queryClient.getQueryData(['programs'])).toEqual([{ id: 9 }]);
  });

  it('server errors reject and are not saved', async () => {
    server.use(http.get('*/programs', () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    await expect(loadPath('/programs')).rejects.toMatchObject({ status: 500 });
    expect(savedAt('/programs')).toBeNull();
  });
});

describe('loadPathOrSaved (Profile, Community)', () => {
  it('returns live data, falls back to the saved copy on a dropped connection, and still fails on other errors', async () => {
    let mode = 'ok';
    server.use(http.get('*/metrics', () => {
      if (mode === 'drop') return HttpResponse.error();
      if (mode === 'bad') return HttpResponse.json({ error: 'nope' }, { status: 400 });
      return HttpResponse.json({ weight: 180 });
    }));
    await expect(loadPathOrSaved('/metrics')).resolves.toEqual({ weight: 180 });
    mode = 'drop';
    await expect(loadPathOrSaved('/metrics')).resolves.toEqual({ weight: 180 });
    mode = 'bad';
    await expect(loadPathOrSaved('/metrics')).rejects.toMatchObject({ status: 400 });
  }, 10000);

  it('with nothing saved, a dropped connection still fails', async () => {
    server.use(http.get('*/community/feed', () => HttpResponse.error()));
    await expect(loadPathOrSaved('/community/feed')).rejects.toMatchObject({ isConnectionError: true });
  }, 10000);
});

describe('saving through api() marks cached reads stale', () => {
  it('a schedule change marks the cached schedule and sessions stale', async () => {
    server.use(
      http.get('*/schedule', () => HttpResponse.json([])),
      http.put('*/schedule', () => HttpResponse.json({ ok: true })),
    );
    await loadPath('/schedule?from=a&to=b');
    expect(queryClient.getQueryState(pathKey('/schedule?from=a&to=b')).isInvalidated).toBe(false);
    await api('/schedule', { method: 'PUT', body: '{}' });
    expect(queryClient.getQueryState(pathKey('/schedule?from=a&to=b')).isInvalidated).toBe(true);
  });

  it('login/logout requests and { invalidate: false } do not', async () => {
    server.use(
      http.get('*/programs', () => HttpResponse.json([])),
      http.post('*/auth/logout', () => HttpResponse.json({ ok: true })),
      http.post('*/sessions', () => HttpResponse.json({ id: 1 })),
    );
    await loadPath('/programs');
    await api('/auth/logout', { method: 'POST' });
    await api('/sessions', { method: 'POST', body: '{}', invalidate: false });
    expect(queryClient.getQueryState(['programs']).isInvalidated).toBe(false);
  });
});

describe('importLegacyCache', () => {
  it("brings the signed-in user's old saved copies over, and only theirs", () => {
    setApiToken(tokenFor(37));
    localStorage.setItem('rl_cache_v1:37:/programs', JSON.stringify({ at: 1000, data: [{ id: 1 }] }));
    localStorage.setItem('rl_cache_v1:37:/schedule?from=a&to=b', JSON.stringify({ at: 2000, data: [{ date: 'a' }] }));
    localStorage.setItem('rl_cache_v1:58:/programs', JSON.stringify({ at: 3000, data: [{ id: 'someone else' }] }));
    importLegacyCache();
    expect(queryClient.getQueryData(['programs'])).toEqual([{ id: 1 }]);
    expect(savedAt('/programs')).toBe(1000);
    expect(queryClient.getQueryData(['schedule', { from: 'a', to: 'b' }])).toEqual([{ date: 'a' }]);
  });

  it("doesn't overwrite newer data", () => {
    setApiToken(tokenFor(37));
    queryClient.setQueryData(['programs'], [{ id: 'new' }], { updatedAt: 5000 });
    localStorage.setItem('rl_cache_v1:37:/programs', JSON.stringify({ at: 1000, data: [{ id: 'old' }] }));
    importLegacyCache();
    expect(queryClient.getQueryData(['programs'])).toEqual([{ id: 'new' }]);
  });
});
