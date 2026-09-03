import { Capacitor } from '@capacitor/core';

// On web the SPA is served from the same origin as the API (Express serves
// client/dist directly), so relative paths work. The native app's WebView is
// NOT on that origin — Capacitor serves the bundled dist/ from its own local
// scheme (capacitor://localhost on iOS) and falls back to index.html for any
// unmatched path, which meant every relative API call was silently hitting
// the app's own HTML instead of the server (see api()'s 2xx/non-JSON -> {}
// fallback below) and login looked like it "succeeded" with no token.
const API_BASE = Capacitor.isNativePlatform() ? 'https://replab-fitness.com' : '';

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

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

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

async function doFetch(path, options, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    signal: options.signal,
  });
}

export async function api(path, options = {}) {
  const token = getApiToken();

  let res;
  try {
    res = await doFetch(path, options, token);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // Network error (offline, timeout, connection refused)
    throw new Error('Network error — check your connection and try again');
  }

  // 401 handling: try to refresh once, then retry the original request.
  // Auth endpoints themselves (login/signup/demo/refresh/request-reset)
  // never go through the refresh flow — a 401 there is a real credential
  // failure, not a stale session.
  if (res.status === 401 && !path.startsWith('/auth/')) {
    let newAccessToken = null;
    try {
      newAccessToken = await getOrStartRefresh();
    } catch {
      // Refresh failed (no refresh token, expired, password-changed, etc).
      // Fall through to full logout.
    }

    if (newAccessToken) {
      try {
        res = await doFetch(path, options, newAccessToken);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw new Error('Network error — check your connection and try again');
      }
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
