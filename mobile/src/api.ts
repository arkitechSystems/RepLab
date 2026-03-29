import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://willfit.onrender.com';

let memoryToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function initializeToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem('replab_token');
    memoryToken = token;
    return token;
  } catch {
    return null;
  }
}

export async function setApiToken(token: string | null): Promise<void> {
  memoryToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem('replab_token', token);
    } else {
      await AsyncStorage.removeItem('replab_token');
    }
  } catch {}
}

export function getApiToken(): string | null {
  return memoryToken;
}

export function setOnUnauthorized(callback: (() => void) | null): void {
  onUnauthorized = callback;
}

export async function api(path: string, options: RequestInit = {}): Promise<any> {
  const token = getApiToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Network error — check your connection and try again');
  }

  if (res.status === 401) {
    if (!path.startsWith('/auth/')) {
      await setApiToken(null);
      if (onUnauthorized) onUnauthorized();
      throw new Error('Unauthorized');
    }
  }

  let data;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data;
}
