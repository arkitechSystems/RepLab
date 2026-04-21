// Lightweight Posthog analytics wrapper.
// All functions no-op silently when Posthog isn't initialized (missing VITE_POSTHOG_KEY),
// so local dev and tests never need to configure analytics.

import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!key) return; // silent no-op in dev / when not configured

  try {
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      person_profiles: 'identified_only',
      // Don't send events in dev builds by default
      loaded: () => {
        if (import.meta.env.DEV) {
          // Disable capturing in development to avoid polluting prod funnels
          posthog.opt_out_capturing();
        }
      },
    });
    initialized = true;
  } catch {
    // Never let analytics break the app
  }
}

export function track(eventName, props) {
  if (!initialized) return;
  try {
    posthog.capture(eventName, props || {});
  } catch {
    // swallow
  }
}

export function identify(userId, traits) {
  if (!initialized) return;
  if (userId == null) return;
  try {
    posthog.identify(String(userId), traits || {});
  } catch {
    // swallow
  }
}

export function reset() {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    // swallow
  }
}
