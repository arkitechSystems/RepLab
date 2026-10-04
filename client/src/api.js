import { Capacitor } from '@capacitor/core';

// On web the SPA is served from the same origin as the API (Express serves
// client/dist directly), so relative paths work. The native app's WebView is
// NOT on that origin — Capacitor serves the bundled dist/ from its own local
// scheme (capacitor://localhost on iOS) and falls back to index.html for any
// unmatched path, which meant every relative API call was silently hitting
// the app's own HTML instead of the server (see api()'s 2xx/non-JSON -> {}
// fallback below) and login looked like it "succeeded" with no token.
const API_BASE = Capacitor.isNativePlatform() ? 'https://replab-fitness.com' : '';

// Exposed for the on-device diagnostics button (Login.jsx) — TestFlight
// builds have no attached console, so that button needs the raw base URL
// to report exactly what host it's hitting.
export { API_BASE };

// In-memory token fallback for Safari/iOS where localStorage can be unreliable
let memoryToken = null;
let memoryRefreshToken = null;
let onUnauthorized = null; // callback set by AuthContext

export function setApiToken(token) {
  memoryToken = token;
  try {
    if (token) {
      localStorage.setItem('replab_token', token);
    } else {
      localStorage.removeItem('replab_token');
    }
  } catch {
    // localStorage may be unavailable in Safari private browsing
  }
}

export function getApiToken() {
  try {
    return memoryToken || localStorage.getItem('replab_token');
  } catch {
    return memoryToken;
  }
}

export function setRefreshToken(token) {
  memoryRefreshToken = token;
  try {
    if (token) {
      localStorage.setItem('replab_refresh_token', token);
    } else {
      localStorage.removeItem('replab_refresh_token');
    }
  } catch {
    // localStorage unavailable
  }
}

export function getRefreshToken() {
  try {
    return memoryRefreshToken || localStorage.getItem('replab_refresh_token');
  } catch {
    return memoryRefreshToken;
  }
}

// Accept `{ accessToken, refreshToken, token }` from any auth endpoint and
// persist whichever pieces are present. `token` is kept as an alias for
// `accessToken` so legacy callers continue to work.
export function setAuthTokens({ accessToken, refreshToken, token } = {}) {
  const access = accessToken ?? token ?? null;
  if (access !== undefined) setApiToken(access);
  if (refreshToken !== undefined) setRefreshToken(refreshToken);
}

export function clearAuthTokens() {
  setApiToken(null);
  setRefreshToken(null);
  try { localStorage.removeItem('replab_user'); } catch {}
}

export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

// Shared promise so that N concurrent 401s trigger exactly one POST /auth/refresh.
// Every racer awaits the same promise; on resolve they all retry with the new
// access token, on reject they all propagate a single logout. Cleared as soon
// as the refresh settles so the next 401 (e.g. after the new access token
// itself expires 15 min later) kicks off a fresh refresh.
let refreshPromise = null;

async function performRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  // Same time limit + Retry prompt as api(). A connection failure here throws
  // an isConnectionError error, which api() surfaces instead of logging out.
  const res = await fetchWithRetry('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }, null);

  if (!res.ok) {
    throw new Error(`Refresh failed (${res.status})`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Refresh returned non-JSON response');
  }

  if (!data?.accessToken) {
    throw new Error('Refresh response missing accessToken');
  }

  setAuthTokens(data);
  return data.accessToken;
}

function getOrStartRefresh() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── Request time limit + Retry prompt ──
// Every request gives up after DEFAULT_TIMEOUT_MS (longer for AI features,
// which take 5-20s to generate) instead of hanging forever — a lost response
// used to leave buttons stuck on "Sending..." indefinitely. On a timeout or
// network failure, api() asks the registered retry handler (the
// <ConnectionRetryPrompt/> mounted in App) whether to try again; concurrent
// failures share one prompt, and Retry re-sends all of them. Pass
// { timeoutMs } to override per call, or { noRetryPrompt: true } to fail fast.
const DEFAULT_TIMEOUT_MS = 5000;
const AI_TIMEOUT_MS = 60000;
export const CONNECTION_ERROR_MESSAGE = "Couldn't reach RepLab. Check your connection and try again.";

function timeoutFor(path, options) {
  if (options.timeoutMs) return options.timeoutMs;
  if (path.startsWith('/ai/')) return AI_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

let retryHandler = null;
let pendingRetryDecision = null;
// Registered by ConnectionRetryPrompt: (message) => Promise<boolean>.
export function setRetryHandler(fn) {
  retryHandler = fn;
}
function askToRetry() {
  if (!retryHandler) return Promise.resolve(false);
  if (!pendingRetryDecision) {
    pendingRetryDecision = Promise.resolve(retryHandler(CONNECTION_ERROR_MESSAGE))
      .catch(() => false)
      .finally(() => { pendingRetryDecision = null; });
  }
  return pendingRetryDecision;
}

async function doFetch(path, options, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Abort on our own time limit, or when the caller's signal aborts.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutFor(path, options));
  const onCallerAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onCallerAbort, { once: true });
  }
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) {
      const timeoutErr = new Error(CONNECTION_ERROR_MESSAGE);
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}

// doFetch with the Retry prompt: on a timeout or network failure, ask the
// user; Retry loops, Cancel throws. A caller-initiated abort is rethrown as-is.
async function fetchWithRetry(path, options, token) {
  for (;;) {
    try {
      return await doFetch(path, options, token);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (options.noRetryPrompt || !(await askToRetry())) {
        const connErr = new Error(CONNECTION_ERROR_MESSAGE);
        connErr.isConnectionError = true;
        throw connErr;
      }
    }
  }
}

export async function api(path, options = {}) {
  const token = getApiToken();

  let res = await fetchWithRetry(path, options, token);

  // 401 handling: try to refresh once, then retry the original request.
  // Auth endpoints themselves (login/signup/demo/refresh/request-reset)
  // never go through the refresh flow — a 401 there is a real credential
  // failure, not a stale session.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    let newAccessToken = null;
    try {
      newAccessToken = await getOrStartRefresh();
    } catch (err) {
      // Couldn't reach the server: not a credential problem, so keep the
      // user signed in and surface the connection error instead.
      if (err?.isConnectionError) throw err;
      // Refresh failed (no refresh token, expired, password-changed, etc).
      // Fall through to full logout.
    }

    if (newAccessToken) {
      res = await fetchWithRetry(path, options, newAccessToken);
      // If it's STILL a 401 after a successful refresh, the access token is
      // being rejected for a non-expiry reason (tokenVersion bump between
      // the refresh and the retry, user deleted, etc). Treat as logout.
      if (res.status === 401) {
        clearAuthTokens();
        if (onUnauthorized) onUnauthorized();
        throw new Error('Unauthorized');
      }
    } else {
      clearAuthTokens();
      if (onUnauthorized) onUnauthorized();
      throw new Error('Unauthorized');
    }
  }

  let data;
  try {
    data = await res.json();
  } catch {
    // Response wasn't valid JSON
    if (!res.ok) {
      const err = new Error(`Server error (${res.status})`);
      err.status = res.status;
      throw err;
    }
    // Response was 2xx but body wasn't JSON (e.g. empty 204) — return empty object
    // so callers can safely destructure without null checks
    return {};
  }

  if (!res.ok) {
    // Attach status + parsed body so callers can branch on status (e.g. 409
    // structured-error responses with a code/details payload). Keep the
    // message field populated for legacy consumers that just stringify.
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
