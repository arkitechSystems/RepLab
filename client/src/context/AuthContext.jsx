import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setApiToken, getApiToken, setOnUnauthorized } from '../api';
import { identify as analyticsIdentify, reset as analyticsReset, track } from '../utils/analytics';

const AuthContext = createContext(null);

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
    setApiToken(null);
    try { localStorage.removeItem('replab_user'); } catch {}
    setToken(null);
    setUser(null);
    analyticsReset();
  }, []);

  // Register 401 handler — clears auth state without page reload
  useEffect(() => {
    setOnUnauthorized(logout);
    return () => setOnUnauthorized(null);
  }, [logout]);

  // JWT bridge — pick up token from URL when redirected from trainer/admin dashboard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bridgeToken = params.get('authToken');
    const redirectPath = params.get('redirect');
    if (!bridgeToken) return;

    // Store the JWT and clean URL immediately
    setApiToken(bridgeToken);
    setToken(bridgeToken);
    window.history.replaceState({}, '', '/');

    // Fetch user data with the bridge token
    fetch('/auth/me', { headers: { 'Authorization': 'Bearer ' + bridgeToken } })
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
        // Bridge token was rejected — clear it so the user lands on login instead
        // of in a half-authenticated state with a token but no user object.
        console.warn('Bridge token auth failed:', err);
        setApiToken(null);
        setToken(null);
      });

    // Navigate to target after a tick so React Router can mount
    if (redirectPath) {
      setTimeout(() => { window.location.replace(redirectPath); }, 50);
    }
  }, []);

  // Helper to set all auth state atomically, cleaning up on failure
  function applyAuth(data) {
    try {
      setApiToken(data.token);
      try { localStorage.setItem('replab_user', JSON.stringify(data.user)); } catch {}
      setToken(data.token);
      setUser(data.user);
    } catch {
      // If anything fails, clear everything to avoid partial state
      setApiToken(null);
      try { localStorage.removeItem('replab_user'); } catch {}
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
