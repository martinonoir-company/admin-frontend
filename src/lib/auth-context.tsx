"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

const API_BASE = "http://localhost:3001/api/v1";
const REFRESH_TOKEN_KEY = "mn_admin_refresh_token";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  user: AdminUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Keep ref in sync so interceptors can read without stale closure
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = state.accessToken;

  const setTokens = useCallback(
    (accessToken: string, refreshToken: string, user?: AdminUser) => {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      tokenRef.current = accessToken;
      setState((prev) => ({
        ...prev,
        accessToken,
        user: user ?? prev.user,
        isAuthenticated: true,
        isLoading: false,
      }));
    },
    []
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    tokenRef.current = null;
    setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  }, []);

  // Fetch user profile given a valid access token
  const fetchProfile = useCallback(async (token: string): Promise<AdminUser | null> => {
    try {
      const res = await fetch(`${API_BASE}/account/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as AdminUser;
    } catch {
      return null;
    }
  }, []);

  // Refresh token exchange
  const refresh = useCallback(async (): Promise<boolean> => {
    const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!stored) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: stored }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      const { accessToken, refreshToken } = json.data;
      const user = await fetchProfile(accessToken);
      if (user) setTokens(accessToken, refreshToken, user);
      else setTokens(accessToken, refreshToken);
      return true;
    } catch {
      return false;
    }
  }, [fetchProfile, setTokens]);

  // Bootstrap: try to restore session from stored refresh token
  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!stored) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      const ok = await refresh();
      if (!ok) {
        clearAuth();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(json.message)
          ? json.message.join(", ")
          : json.message ?? "Login failed";
        throw new Error(msg);
      }
      const { accessToken, refreshToken } = json.data;
      const user = await fetchProfile(accessToken);
      if (!user) throw new Error("Could not fetch user profile");
      setTokens(accessToken, refreshToken, user);
    },
    [fetchProfile, setTokens]
  );

  const logout = useCallback(async () => {
    const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (stored && tokenRef.current) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({ refreshToken: stored }),
        });
      } catch {
        /* ignore */
      }
    }
    clearAuth();
  }, [clearAuth]);

  const getToken = useCallback(() => tokenRef.current, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, getToken, refresh } as AuthContextValue & { refresh: () => Promise<boolean> }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue & { refresh: () => Promise<boolean> } {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx as AuthContextValue & { refresh: () => Promise<boolean> };
}
