import { createContext, useContext, useState, useCallback } from 'react';
import { api, setApiToken, getApiToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('willfit_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [token, setToken] = useState(() => getApiToken());

  const login = useCallback(async (identifier, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setApiToken(data.token);
    try { localStorage.setItem('willfit_user', JSON.stringify(data.user)); } catch {}
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (identifier, password) => {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setApiToken(data.token);
    try { localStorage.setItem('willfit_user', JSON.stringify(data.user)); } catch {}
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const demo = useCallback(async () => {
    const data = await api('/auth/demo', { method: 'POST' });
    setApiToken(data.token);
    try { localStorage.setItem('willfit_user', JSON.stringify(data.user)); } catch {}
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    setApiToken(null);
    try { localStorage.removeItem('willfit_user'); } catch {}
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, signup, demo, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
