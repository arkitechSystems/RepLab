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
} else if (import.meta.env.PROD) {
  // Production build shipped without a DSN — error tracking is OFF. Make this
  // loud once at boot so a forgotten env var doesn't go unnoticed for weeks.
  // To fix: set VITE_SENTRY_DSN in the Render build environment.
  // eslint-disable-next-line no-console
  console.warn('[sentry] VITE_SENTRY_DSN is not set — error tracking is disabled.');
}

export { Sentry };
