import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
const TOKEN_KEY = 'ni-auth-token';

export interface Account {
  email: string;
  credits: number;
}

export interface CheckoutResult {
  orderId: string;
  credits: number;
}

interface AuthContextValue {
  token: string | null;
  account: Account | null;
  loading: boolean;
  register: (email: string, password: string) => Promise<Account>;
  login: (email: string, password: string) => Promise<Account>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Buy a funnel plan; returns the new credit balance. */
  subscribe: (planSize: number) => Promise<number>;
  /** Spend credits on the selected images. */
  checkout: (imageIds: string[], engraving: boolean) => Promise<CheckoutResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function firstError(data: unknown, fallback: string): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === 'string') return record.detail;
    for (const value of Object.values(record)) {
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    }
  }
  return fallback;
}

async function api<T>(
  path: string,
  opts: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(opts.token ? { Authorization: `Token ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(firstError(data, `Request failed (${res.status})`));
  return data as T;
}

interface AuthResponse {
  token: string;
  user: Account;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem(TOKEN_KEY),
  );
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setAccount(null);
      setLoading(false);
      return;
    }
    try {
      setAccount(await api<Account>('/api/v1/me/', { token }));
    } catch {
      // Invalid/expired token — clear it.
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await api<AuthResponse>('/api/v1/auth/register/', {
      method: 'POST',
      body: { email, password },
    });
    window.localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setAccount(res.user);
    return res.user;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<AuthResponse>('/api/v1/auth/login/', {
      method: 'POST',
      body: { email, password },
    });
    window.localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setAccount(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) await api('/api/v1/auth/logout/', { method: 'POST', token });
    } catch {
      /* token may already be invalid */
    } finally {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAccount(null);
    }
  }, [token]);

  const subscribe = useCallback(
    async (planSize: number) => {
      const res = await api<{ credits: number }>('/api/v1/subscribe/', {
        method: 'POST',
        token,
        body: { plan_size: planSize },
      });
      setAccount((prev) => (prev ? { ...prev, credits: res.credits } : prev));
      return res.credits;
    },
    [token],
  );

  const checkout = useCallback(
    async (imageIds: string[], engraving: boolean) => {
      const res = await api<{ order: { id: string }; credits: number }>(
        '/api/v1/checkout/',
        {
          method: 'POST',
          token,
          body: { image_ids: imageIds, engraving },
        },
      );
      setAccount((prev) => (prev ? { ...prev, credits: res.credits } : prev));
      return { orderId: res.order.id, credits: res.credits };
    },
    [token],
  );

  const value = useMemo(
    () => ({
      token,
      account,
      loading,
      register,
      login,
      logout,
      refresh,
      subscribe,
      checkout,
    }),
    [token, account, loading, register, login, logout, refresh, subscribe, checkout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}