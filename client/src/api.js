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
  // A different account signing in on this device: drop the previous
  // account's cached screens so they can never show for the new one.
  const prevUid = tokenUserId(getApiToken() || '');
  const nextUid = tokenUserId(token || '');
  if (prevUid != null && nextUid != null && prevUid !== nextUid) clearApiCache();
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
  clearApiCache();
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

  // Same time limit as api(). A POST, so it isn't retried automatically (a
  // lost response may already have rotated the token). A connection failure
  // throws an isConnectionError error, which api() surfaces instead of
  // logging out.
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

// ── Request time limit + automatic retries ──
// Every request gives up after DEFAULT_TIMEOUT_MS (longer for AI features,
// which take 5-20s to generate) instead of hanging forever — a lost response
// used to leave buttons stuck on "Sending..." indefinitely. 30s leaves room
// for slow gym Wi-Fi / weak cell signal (5s was too tight). On a timeout or
// network failure, safe-to-repeat requests (GET, or { retry: true }) are
// retried automatically after RETRY_DELAYS_MS; other requests (POST/PUT/
// DELETE) aren't, because the first try may have reached the server. While
// requests are slow or failing, the connection status below drives the
// yellow banner in Layout. Pass { timeoutMs } to override the limit, or
// { noRetryPrompt: true } for a quiet background call: fails fast, no
// retries, and doesn't affect the banner.
const DEFAULT_TIMEOUT_MS = 30000;
const AI_TIMEOUT_MS = 60000;
const RETRY_DELAYS_MS = [2000, 5000];
export const CONNECTION_ERROR_MESSAGE = "Couldn't reach RepLab. Check your connection and try again.";
export const OFFLINE_MESSAGE = "You're offline — try again when connected.";

function timeoutFor(path, options) {
  if (options.timeoutMs) return options.timeoutMs;
  if (path.startsWith('/ai/')) return AI_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

function isRetryable(options) {
  if (options.retry === true) return true;
  const method = (options.method || 'GET').toUpperCase();
  return method === 'GET' || method === 'HEAD';
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
    }, { once: true });
  });
}

// ── Connection status: 'ok' | 'slow' | 'failed' ──
// 'slow' while any request has been in flight > SLOW_AFTER_MS or is being
// retried; 'failed' for FAILED_SHOW_MS after a request gives up. Going back
// to 'ok' is delayed by OK_DEBOUNCE_MS so the banner doesn't flicker.
const SLOW_AFTER_MS = 8000;
const FAILED_SHOW_MS = 6000;
const OK_DEBOUNCE_MS = 1500;
let connectionState = 'ok';
let slowRequests = 0;
let failedUntil = 0;
let connTimer = null;
const connectionListeners = new Set();

function targetConnectionState() {
  if (Date.now() < failedUntil) return 'failed';
  return slowRequests > 0 ? 'slow' : 'ok';
}
function updateConnectionState() {
  clearTimeout(connTimer);
  const next = targetConnectionState();
  if (next === 'failed') {
    connTimer = setTimeout(updateConnectionState, failedUntil - Date.now() + 10);
  }
  if (next === connectionState) return;
  if (next === 'ok') {
    connTimer = setTimeout(() => {
      if (targetConnectionState() === 'ok' && connectionState !== 'ok') {
        connectionState = 'ok';
        connectionListeners.forEach((fn) => fn('ok'));
      }
    }, OK_DEBOUNCE_MS);
    return;
  }
  connectionState = next;
  connectionListeners.forEach((fn) => fn(next));
}
export function getConnectionState() {
  return connectionState;
}
// fn(state) is called whenever the status changes. Returns an unsubscribe.
export function subscribeConnection(fn) {
  connectionListeners.add(fn);
  return () => connectionListeners.delete(fn);
}

// ── Last-copy cache (show saved data instantly, refresh in background) ──
// GETs made with { cache: true } store their last successful JSON response
// in localStorage, keyed by the signed-in user id + path, so a screen can
// paint immediately from cacheOnly(path) and then refresh from the network.
// Read-only: writes never touch it. Entries over CACHE_MAX_CHARS are skipped.
// Cleared on logout (clearAuthTokens) and when a different user signs in.
const CACHE_PREFIX = 'rl_cache_v1:';
const CACHE_MAX_CHARS = 300000;

function tokenUserId(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).userId ?? null;
  } catch {
    return null;
  }
}
function cacheKey(path) {
  const uid = tokenUserId(getApiToken() || '');
  return uid == null ? null : `${CACHE_PREFIX}${uid}:${path}`;
}
function writeCache(path, data) {
  const key = cacheKey(path);
  if (!key) return;
  try {
    const raw = JSON.stringify({ at: Date.now(), data });
    if (raw.length > CACHE_MAX_CHARS) return;
    localStorage.setItem(key, raw);
  } catch {
    // Storage full or unavailable — caching is best-effort.
  }
}
function readCache(path) {
  const key = cacheKey(path);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return entry && typeof entry === 'object' && 'data' in entry ? entry : null;
  } catch {
    return null;
  }
}
// The cached copy of a GET, or a rejected promise when there isn't one.
// Shaped like api() so a loader can swap one for the other.
export function cacheOnly(path) {
  const entry = readCache(path);
  if (!entry) {
    const err = new Error('Not cached');
    err.notCached = true;
    return Promise.reject(err);
  }
  return Promise.resolve(entry.data);
}
// When the cached copy of `path` was saved (ms), or null.
export function cachedAt(path) {
  return readCache(path)?.at ?? null;
}
export function clearApiCache() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
  showingCached.clear();
  notifyShowingCached();
}

// ── "Showing saved data" marks ──
// A screen that painted from the cache calls markShowingCached(key, at) and
// clears it once fresh data lands (or on unmount). Layout shows a small
// "Showing saved data from <time>" line when a mark has been up > 8s.
const showingCached = new Map(); // key -> { at, since }
const showingCachedListeners = new Set();
function notifyShowingCached() {
  const list = [...showingCached.values()];
  showingCachedListeners.forEach((fn) => fn(list));
}
// { immediate: true } when the refresh has already failed, so the label
// shows right away instead of after the usual wait.
export function markShowingCached(key, at, { immediate = false } = {}) {
  if (at == null) return;
  showingCached.set(key, { at, since: immediate ? 0 : Date.now() });
  notifyShowingCached();
}
export function clearShowingCached(key) {
  if (!showingCached.delete(key)) return;
  notifyShowingCached();
}
// fn([{ at, since }, ...]) on every change. Returns an unsubscribe.
export function subscribeShowingCached(fn) {
  showingCachedListeners.add(fn);
  fn([...showingCached.values()]);
  return () => showingCachedListeners.delete(fn);
}

// Per-request tracker: flips the request to "slow" after SLOW_AFTER_MS or
// on its first retry, and settles it when the request ends.
function trackRequest(quiet) {
  if (quiet) return { markSlow() {}, done() {} };
  let slow = false;
  let settled = false;
  const markSlow = () => {
    if (slow || settled) return;
    slow = true;
    slowRequests++;
    updateConnectionState();
  };
  const timer = setTimeout(markSlow, SLOW_AFTER_MS);
  return {
    markSlow,
    done(failed) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (slow) slowRequests--;
      if (failed) failedUntil = Date.now() + FAILED_SHOW_MS;
      updateConnectionState();
    },
  };
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

// doFetch with automatic retries: on a timeout or network failure, wait and
// try again (up to RETRY_DELAYS_MS.length more times) for safe-to-repeat
// requests, then throw an isConnectionError error. A caller-initiated abort
// is rethrown as-is.
async function fetchWithRetry(path, options, token) {
  const quiet = options.noRetryPrompt === true;
  const tracker = trackRequest(quiet);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await doFetch(path, options, token);
      tracker.done(false);
      return res;
    } catch (err) {
      if (err.name === 'AbortError') { tracker.done(false); throw err; }
      if (quiet || attempt >= RETRY_DELAYS_MS.length || !isRetryable(options)) {
        tracker.done(true);
        const connErr = new Error(CONNECTION_ERROR_MESSAGE);
        connErr.isConnectionError = true;
        throw connErr;
      }
      tracker.markSlow();
      try {
        await wait(RETRY_DELAYS_MS[attempt], options.signal);
      } catch (abortErr) {
        tracker.done(false);
        throw abortErr;
      }
    }
  }
}

export async function api(path, options = {}) {
  const token = getApiToken();

  // Changes made while the phone reports no connection fail right away with
  // a clear message instead of waiting out the time limit. (Workout sets and
  // Mark Complete have their own offline queue in WorkoutSession.)
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineErr = new Error(OFFLINE_MESSAGE);
    offlineErr.isConnectionError = true;
    offlineErr.isOffline = true;
    throw offlineErr;
  }

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

  if (options.cache === true && (options.method || 'GET').toUpperCase() === 'GET') {
    writeCache(path, data);
  }
  return data;
}
