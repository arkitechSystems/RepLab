import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setApiToken, getApiToken, setOnUnauthorized, setAuthTokens, clearAuthTokens, setRefreshToken } from '../api';
import { identify as analyticsIdentify, reset as analyticsReset, track } from '../utils/analytics';
import { initPushNotifications, teardownPushNotifications } from '../utils/push';

const AuthContext = createContext(null);

// Returns the path to redirect to, or null if the input is unsafe (off-origin,
// protocol-relative, or otherwise abusable). Used by the bridge-token flow,
// where `?redirect=...` is taken from the URL and must not point off-site.
function sanitizeRedirectPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  // Reject anything that isn't a normal absolute path on this origin.
  // - Must start with a single "/" (not "//" — that's a protocol-relative URL).
  // - Must NOT contain a "\" which some browsers normalize to "/" creating
  //   bypass surface.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('replab_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => getApiToken());

  const logout = useCallback(() => {
    // Clears access token, refresh token, and cached user.
    clearAuthTokens();
    setToken(null);
    setUser(null);
    analyticsReset();
    teardownPushNotifications().catch(() => {});
  }, []);

  // Boot push notifications once we have an authenticated user. Safe no-op on
  // web (guarded by Capacitor.isNativePlatform). Idempotent — re-runs while
  // already initialized return immediately.
  useEffect(() => {
    if (!user) return;
    initPushNotifications().catch(() => {});
  }, [user]);

  // Register 401 handler — clears auth state without page reload
  useEffect(() => {
    setOnUnauthorized(logout);
    return () => setOnUnauthorized(null);
  }, [logout]);

  // JWT bridge — pick up token from URL when redirected from trainer/admin dashboard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bridgeToken = params.get('authToken');
    const bridgeRefreshToken = params.get('refreshToken');
    const redirectPath = params.get('redirect');
    if (!bridgeToken) return;

    // Store the JWT pair and clean URL immediately. The bridge may or may not
    // include a refresh token — older bridges issued access-only. If there's
    // no refresh token, the session will end when the 15-min access token
    // expires and api.js fails to refresh.
    setApiToken(bridgeToken);
    setRefreshToken(bridgeRefreshToken || null);
    setToken(bridgeToken);
    window.history.replaceState({}, '', '/');

    // Fetch user data with the bridge token. AbortController prevents
    // "set state on unmounted component" if the user navigates mid-fetch.
    const controller = new AbortController();
    let redirectTimer;
    fetch('/auth/me', {
      headers: { 'Authorization': 'Bearer ' + bridgeToken },
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`/auth/me returned ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.user) {
          try { localStorage.setItem('replab_user', JSON.stringify(data.user)); } catch {}
          setUser(data.user);
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // Bridge token was rejected — clear it so the user lands on login instead
        // of in a half-authenticated state with a token but no user object.
        if (import.meta.env.DEV) console.warn('Bridge token auth failed:', err);
        clearAuthTokens();
        setToken(null);
      });

    // Open-redirect guard: only allow same-origin paths. Strip absolute URLs,
    // protocol-relative URLs (//evil.com), and anything that fails URL parse
    // against the current origin.
    const safePath = sanitizeRedirectPath(redirectPath);
    if (safePath) {
      redirectTimer = setTimeout(() => { window.location.replace(safePath); }, 50);
    }

    return () => {
      controller.abort();
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, []);

  // Helper to set all auth state atomically, cleaning up on failure.
  // Accepts `{ accessToken, refreshToken, user }` from /auth/login, /auth/signup,
  // and /auth/demo. `token` (legacy alias of accessToken) is also accepted.
  function applyAuth(data) {
    try {
      setAuthTokens(data);
      try { localStorage.setItem('replab_user', JSON.stringify(data.user)); } catch {}
      setToken(data.accessToken ?? data.token ?? null);
      setUser(data.user);
    } catch {
      // If anything fails, clear everything to avoid partial state
      clearAuthTokens();
      setToken(null);
      setUser(null);
      throw new Error('Failed to save login state');
    }
  }

  const login = useCallback(async (identifier, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    applyAuth(data);
    if (data?.user?.id != null) {
      analyticsIdentify(data.user.id, {
        email: data.user.email,
        username: data.user.username,
      });
    }
    track('login_completed', { userId: data?.user?.id });
    return data;
  }, []);

  const signup = useCallback(async (identifier, password, extra = {}) => {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, ...extra }),
    });
    applyAuth(data);
    if (data?.user?.id != null) {
      analyticsIdentify(data.user.id, {
        email: data.user.email,
        username: data.user.username,
      });
    }
    track('signup_completed', { userId: data?.user?.id });
    return data;
  }, []);

  const demo = useCallback(async () => {
    const data = await api('/auth/demo', { method: 'POST' });
    applyAuth(data);
    return data;
  }, []);

  const updateUser = useCallback((newUser) => {
    try { localStorage.setItem('replab_user', JSON.stringify(newUser)); } catch {}
    setUser(newUser);
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, signup, demo, logout, updateUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
