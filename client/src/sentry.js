import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Only send errors in production
    enabled: import.meta.env.PROD,
    // Sample 100% of errors, 10% of performance traces
    sampleRate: 1.0,
    tracesSampleRate: 0.1,
    // Don't send PII
    sendDefaultPii: false,
    // Ignore common non-actionable errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Network request failed',
      'Load failed',
      'AbortError',
    ],
  });
}

export { Sentry };
