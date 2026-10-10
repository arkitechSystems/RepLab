// Shared setup for client tests (vitest + jsdom).
//   - jest-dom matchers (toBeInTheDocument, …)
//   - fake IndexedDB, for the persisted query cache
//   - MSW fake server: each test declares the API responses it needs with
//     server.use(http.get('/programs', …)); unhandled requests fail the test
//   - a clean localStorage between tests
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  // Wrapped after listen() so requests still go through MSW:
  //   - the app calls relative URLs ('/programs'); Node's fetch needs
  //     absolute ones, so resolve them against the jsdom page origin
  //   - Node's fetch rejects jsdom's AbortSignal ("Expected signal to be an
  //     instance of AbortSignal"), so the signal is handled here instead
  const mswFetch = globalThis.fetch;
  globalThis.fetch = (input, init = {}) => {
    const url = typeof input === 'string' && input.startsWith('/')
      ? new URL(input, window.location.origin).href
      : input;
    const { signal, ...rest } = init;
    const request = mswFetch(url, rest);
    if (!signal) return request;
    const abortError = () => new DOMException('The operation was aborted.', 'AbortError');
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(abortError()); return; }
      signal.addEventListener('abort', () => reject(abortError()), { once: true });
      request.then(resolve, reject);
    });
  };
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());
