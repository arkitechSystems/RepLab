// Baseline tests for api() — the request layer every query and mutation will
// sit on. Written before the TanStack Query migration so later phases can't
// silently change these behaviors.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server, http, HttpResponse, reportedErrors } from './test/server';
import { api, setApiToken } from './api';

beforeEach(() => {
  reportedErrors.length = 0;
  vi.restoreAllMocks();
});

describe('api()', () => {
  it('returns the parsed JSON body', async () => {
    server.use(http.get('*/programs', () => HttpResponse.json([{ id: 1, name: 'Push' }])));
    await expect(api('/programs')).resolves.toEqual([{ id: 1, name: 'Push' }]);
  });

  it('sends the access token', async () => {
    setApiToken('test-token');
    let auth = null;
    server.use(http.get('*/programs', ({ request }) => {
      auth = request.headers.get('authorization');
      return HttpResponse.json([]);
    }));
    await api('/programs');
    expect(auth).toBe('Bearer test-token');
  });

  it('throws the server error message with its status', async () => {
    server.use(http.post('*/sessions', () => HttpResponse.json({ error: 'templateId, date, and entries are required' }, { status: 400 })));
    await expect(api('/sessions', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      status: 400,
      message: 'templateId, date, and entries are required',
    });
  });

  // Regression: 28fd8bd. api()'s own options (cache, retry, timeoutMs,
  // noRetryPrompt) used to reach fetch(), which rejects cache: true.
  it("doesn't pass its own options through to fetch()", async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    server.use(http.get('*/programs', () => HttpResponse.json([])));
    await api('/programs', { cache: true, retry: true, timeoutMs: 5000, noRetryPrompt: true });
    const init = spy.mock.calls[0][1];
    for (const key of ['cache', 'retry', 'timeoutMs', 'noRetryPrompt']) {
      expect(init).not.toHaveProperty(key);
    }
  });

  it('treats a dropped connection on a save as a connection error, without retrying', async () => {
    let calls = 0;
    server.use(http.post('*/sessions', () => { calls++; return HttpResponse.error(); }));
    await expect(api('/sessions', { method: 'POST', body: '{}' })).rejects.toMatchObject({ isConnectionError: true });
    expect(calls).toBe(1);
  });

  it('reports a non-network fetch() rejection as a code bug and does not retry it', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).includes('/errors/client')) return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.reject(new TypeError('Request constructor: true is not an accepted type.'));
    });
    await expect(api('/templates')).rejects.toMatchObject({ isCodeError: true });
    const apiCalls = spy.mock.calls.filter(([url]) => String(url).includes('/templates'));
    expect(apiCalls).toHaveLength(1);
    const report = spy.mock.calls.find(([url]) => String(url).includes('/errors/client'));
    expect(JSON.parse(report[1].body)).toMatchObject({ kind: 'code', origin: 'api', route: 'GET /templates' });
  });
});
