const API_BASE = '';

// In-memory token fallback for Safari/iOS where localStorage can be unreliable
let memoryToken = null;

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

export async function api(path, options = {}) {
  const token = getApiToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setApiToken(null);
    try { localStorage.removeItem('willfit_user'); } catch {}
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}
