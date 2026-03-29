const API_BASE = '';

// In-memory token fallback for Safari/iOS where localStorage can be unreliable
let memoryToken = null;
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

export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

export async function api(path, options = {}) {
  const token = getApiToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // Network error (offline, timeout, connection refused)
    throw new Error('Network error — check your connection and try again');
  }

  if (res.status === 401) {
    // Skip 401 handling for auth endpoints (login/signup/demo)
    // TODO: Token refresh could be added here once a refresh token endpoint exists.
    // Currently we log the user out immediately on any 401 from a non-auth endpoint.
    if (!path.startsWith('/auth/')) {
      setApiToken(null);
      try { localStorage.removeItem('replab_user'); } catch {}
      if (onUnauthorized) {
        onUnauthorized();
      }
      throw new Error('Unauthorized');
    }
  }

  let data;
  try {
    data = await res.json();
  } catch {
    // Response wasn't valid JSON
    if (!res.ok) {
      throw new Error(`Server error (${res.status})`);
    }
    // Response was 2xx but body wasn't JSON (e.g. empty 204) — return empty object
    // so callers can safely destructure without null checks
    return {};
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data;
}
