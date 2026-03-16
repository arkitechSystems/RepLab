const API_BASE = '';

// In-memory token fallback for Safari/iOS where localStorage can be unreliable
let memoryToken = null;
let onUnauthorized = null; // callback set by AuthContext

export function setApiToken(token) {
  memoryToken = token;
  try {
    if (token) {
      localStorage.setItem('willfit_token', token);
    } else {
      localStorage.removeItem('willfit_token');
    }
  } catch {
    // localStorage may be unavailable in Safari private browsing
  }
}

export function getApiToken() {
  try {
    return memoryToken || localStorage.getItem('willfit_token');
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
    });
  } catch (err) {
    // Network error (offline, timeout, connection refused)
    throw new Error('Network error — check your connection and try again');
  }

  if (res.status === 401) {
    // Skip 401 handling for auth endpoints (login/signup/demo)
    if (!path.startsWith('/auth/')) {
      setApiToken(null);
      try { localStorage.removeItem('willfit_user'); } catch {}
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
    return null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data;
}
