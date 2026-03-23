import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, setApiToken, getApiToken, setOnUnauthorized, initializeToken } from '../api';
import { StorageKeys, getItem, setItem, removeItem } from '../utils/storage';

interface User {
  id: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  tier?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<any>;
  signup: (identifier: string, password: string, extra?: Record<string, any>) => Promise<any>;
  demo: () => Promise<any>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load saved auth on mount
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await initializeToken();
        const savedUser = await getItem<User>(StorageKeys.USER);
        if (savedToken) setToken(savedToken);
        if (savedUser) setUser(savedUser);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    await setApiToken(null);
    await removeItem(StorageKeys.USER);
    setToken(null);
    setUser(null);
  }, []);

  // Register 401 handler
  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
    return () => setOnUnauthorized(null);
  }, [logout]);

  const applyAuth = useCallback(async (data: { token: string; user: User }) => {
    try {
      await setApiToken(data.token);
      await setItem(StorageKeys.USER, data.user);
      setToken(data.token);
      setUser(data.user);
    } catch {
      await setApiToken(null);
      await removeItem(StorageKeys.USER);
      setToken(null);
      setUser(null);
      throw new Error('Failed to save login state');
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    await applyAuth(data);
    return data;
  }, [applyAuth]);

  const signup = useCallback(async (identifier: string, password: string, extra: Record<string, any> = {}) => {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, ...extra }),
    });
    await applyAuth(data);
    return data;
  }, [applyAuth]);

  const demo = useCallback(async () => {
    const data = await api('/auth/demo', { method: 'POST' });
    await applyAuth(data);
    return data;
  }, [applyAuth]);

  const updateUser = useCallback((newUser: User) => {
    setItem(StorageKeys.USER, newUser);
    setUser(newUser);
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, demo, logout, updateUser, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
