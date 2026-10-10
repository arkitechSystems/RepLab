import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MutationObserver, QueryObserver, onlineManager } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { server, http, HttpResponse } from '../test/server';
import { api, clearApiCache } from '../api';
import {
  createQueryClient, createPersister, clearQueryCache, getPendingSaveCount,
  persistOptions, queryClient as appQueryClient, shouldRetryRead, shouldRetrySave,
} from './queryClient';
import { fetchPath } from './keys';

// A client like the app's, without retry waits.
function testClient() {
  const client = createQueryClient();
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
    mutations: { ...client.getDefaultOptions().mutations, retryDelay: 0 },
  });
  return client;
}

// Registered the way phase-4 session saves will be (queries/mutationDefaults).
function registerTestSave(client) {
  client.setMutationDefaults(['test', 'save'], {
    mutationFn: (vars) => api('/sessions', { method: 'POST', body: JSON.stringify(vars), autoRetry: false }),
  });
}

const persister = createPersister();
const persistWith = (client) => ({ ...persistOptions, queryClient: client, persister });

beforeEach(() => onlineManager.setOnline(true));
afterEach(async () => {
  onlineManager.setOnline(true);
  await persister.removeClient();
});

describe('retry rules', () => {
  const conn = { isConnectionError: true };
  it('reads retry twice on a connection error, never on a server answer or code bug', () => {
    expect(shouldRetryRead(0, conn)).toBe(true);
    expect(shouldRetryRead(1, conn)).toBe(true);
    expect(shouldRetryRead(2, conn)).toBe(false);
    expect(shouldRetryRead(0, { status: 400 })).toBe(false);
    expect(shouldRetryRead(0, { ...conn, isCodeError: true })).toBe(false);
  });
  it('saves keep retrying on a connection error only', () => {
    expect(shouldRetrySave(25, conn)).toBe(true);
    expect(shouldRetrySave(0, { status: 500 })).toBe(false);
    expect(shouldRetrySave(0, { ...conn, isCodeError: true })).toBe(false);
  });
});

describe('queries through api()', () => {
  it('makes 3 attempts on a dropped connection and 1 on a 400', async () => {
    const client = testClient();
    let dropped = 0;
    let bad = 0;
    server.use(
      http.get('*/programs', () => { dropped++; return HttpResponse.error(); }),
      http.get('*/templates', () => { bad++; return HttpResponse.json({ error: 'nope' }, { status: 400 }); }),
    );
    await expect(client.fetchQuery({ queryKey: ['programs'], queryFn: fetchPath('/programs') })).rejects.toMatchObject({ isConnectionError: true });
    await expect(client.fetchQuery({ queryKey: ['templates'], queryFn: fetchPath('/templates') })).rejects.toMatchObject({ status: 400 });
    expect(dropped).toBe(3);
    expect(bad).toBe(1);
  });
});

describe('saved copies', () => {
  it('a loaded screen survives an app restart', async () => {
    server.use(http.get('*/programs', () => HttpResponse.json([{ id: 7, name: 'Pull' }])));
    const before = testClient();
    await before.fetchQuery({ queryKey: ['programs'], queryFn: fetchPath('/programs') });
    await persistQueryClientSave(persistWith(before));

    const after = testClient();
    await persistQueryClientRestore(persistWith(after));
    expect(after.getQueryData(['programs'])).toEqual([{ id: 7, name: 'Pull' }]);
  });

  it("failed loads aren't saved", async () => {
    server.use(http.get('*/programs', () => HttpResponse.json({ error: 'x' }, { status: 400 })));
    const before = testClient();
    await before.fetchQuery({ queryKey: ['programs'], queryFn: fetchPath('/programs') }).catch(() => {});
    await persistQueryClientSave(persistWith(before));
    const after = testClient();
    await persistQueryClientRestore(persistWith(after));
    expect(after.getQueryState(['programs'])).toBeUndefined();
  });
});

describe('offline saves', () => {
  it('a save made offline survives an app restart and is sent exactly once when back online', async () => {
    const received = [];
    server.use(http.post('*/sessions', async ({ request }) => {
      received.push(await request.json());
      return HttpResponse.json({ id: 1 }, { status: 201 });
    }));

    onlineManager.setOnline(false);
    const before = testClient();
    registerTestSave(before);
    const observer = new MutationObserver(before, { mutationKey: ['test', 'save'], scope: { id: 'session-5-2026-10-10' } });
    observer.mutate({ templateId: 5, date: '2026-10-10' });
    await new Promise((r) => setTimeout(r, 10));
    expect(before.getMutationCache().getAll()[0].state.isPaused).toBe(true);
    expect(getPendingSaveCount(before)).toBe(1);
    expect(received).toHaveLength(0);
    await persistQueryClientSave(persistWith(before));

    // "Restart": a fresh client restores the queue, then the phone reconnects.
    const after = testClient();
    registerTestSave(after);
    await persistQueryClientRestore(persistWith(after));
    expect(getPendingSaveCount(after)).toBe(1);
    onlineManager.setOnline(true);
    await after.resumePausedMutations();

    expect(received).toEqual([{ templateId: 5, date: '2026-10-10' }]);
    expect(getPendingSaveCount(after)).toBe(0);
  });

  it('saves for the same workout day are sent in order', async () => {
    const order = [];
    let first = true;
    server.use(http.post('*/sessions', async ({ request }) => {
      const body = await request.json();
      // The first save is slow; the second must still land after it.
      if (first) { first = false; await new Promise((r) => setTimeout(r, 50)); }
      order.push(body.n);
      return HttpResponse.json({ id: 1 });
    }));
    const client = testClient();
    registerTestSave(client);
    const scope = { id: 'session-5-2026-10-10' };
    const a = new MutationObserver(client, { mutationKey: ['test', 'save'], scope }).mutate({ n: 1 });
    const b = new MutationObserver(client, { mutationKey: ['test', 'save'], scope }).mutate({ n: 2 });
    await Promise.all([a, b]);
    expect(order).toEqual([1, 2]);
  });
});

describe('logout / account switch', () => {
  it('clearQueryCache drops queries, queued saves and the saved copy on the device', async () => {
    server.use(http.get('*/programs', () => HttpResponse.json([{ id: 1 }])));
    onlineManager.setOnline(false);
    const client = testClient();
    registerTestSave(client);
    client.setQueryData(['programs'], [{ id: 1 }]);
    new MutationObserver(client, { mutationKey: ['test', 'save'] }).mutate({ x: 1 });
    await new Promise((r) => setTimeout(r, 10));
    await persistQueryClientSave(persistWith(client));

    await clearQueryCache(client, persister);
    expect(client.getQueryData(['programs'])).toBeUndefined();
    expect(getPendingSaveCount(client)).toBe(0);
    const restored = testClient();
    await persistQueryClientRestore(persistWith(restored));
    expect(restored.getQueryData(['programs'])).toBeUndefined();
  });

  it("api.js clearApiCache (logout, different user) also clears the app's query cache", async () => {
    appQueryClient.setQueryData(['programs'], [{ id: 1 }]);
    const observer = new QueryObserver(appQueryClient, { queryKey: ['programs'], enabled: false });
    expect(observer.getCurrentResult().data).toEqual([{ id: 1 }]);
    clearApiCache();
    await new Promise((r) => setTimeout(r, 10));
    expect(appQueryClient.getQueryData(['programs'])).toBeUndefined();
  });
});
