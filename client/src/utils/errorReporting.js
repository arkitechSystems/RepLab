// Sends browser/app crashes to the server for the admin Coding Errors page
// (POST /errors/client). Sentry gets them too where it's wired up; this copy
// lands in our own database so routine audits can see them in the dashboard.
//
// Each distinct error is reported at most once per page load, and reporting
// uses plain fetch (not api()) so a broken api() can't stop its own bug from
// being reported — or loop by reporting its own failure.
import { API_BASE, getApiToken } from '../api';
import { APP_VERSION } from '../version';

const sent = new Set();
const MAX_PER_LOAD = 20;

// origin: 'window' | 'promise' | 'boundary' | 'api'. extra.kind 'code' marks
// a failure known not to be a network problem; extra.route names the request.
export function reportClientError(error, origin, extra = {}) {
  try {
    const err = error instanceof Error ? error : new Error(String(error?.message || error || 'Unknown error'));
    const key = `${origin}|${err.name}|${err.message}|${extra.route || ''}`;
    if (sent.has(key) || sent.size >= MAX_PER_LOAD) return;
    sent.add(key);
    const token = getApiToken();
    fetch(`${API_BASE}/errors/client`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name: err.name,
        message: String(err.message).slice(0, 2000),
        stack: err.stack ? String(err.stack).slice(0, 8000) : null,
        page: window.location.pathname,
        origin,
        appVersion: APP_VERSION,
        ...(extra.kind ? { kind: extra.kind } : {}),
        ...(extra.route ? { route: extra.route } : {}),
      }),
    }).catch(() => {});
  } catch {
    // Reporting must never throw.
  }
}

// The messages browsers use when fetch() fails because the network did
// (Chrome / Safari / Firefox). Any other fetch() rejection means our code
// handed fetch() something invalid — a bug, not a bad connection.
export function isNetworkFailure(err) {
  return /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?|The Internet connection appears to be offline\.?|The network connection was lost\.?)$/i
    .test(String(err?.message || ''));
}

// Window-level crashes and unhandled promise rejections. Call once at start-up.
export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => {
    // Resource load failures (img/script 404) have no error object — skip.
    if (!event.error) return;
    reportClientError(event.error, 'window');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason?.name === 'AbortError') return;
    if (reason?.isConnectionError) return; // api()'s "couldn't reach RepLab"
    reportClientError(reason, 'promise');
  });
}
