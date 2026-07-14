/**
 * context/AuthContext.tsx
 * Holds the authenticated user and exposes login/logout. On mount it restores
 * the session from a stored token. One purpose: auth state for the whole app.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { fetchMe, login as loginRequest } from "@/api/auth";
import { clearToken, getToken, setToken } from "@/lib/auth";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isPm: boolean;
  isDeveloper: boolean;
  isClient: boolean;
  /** admin or pm — full CRUD on milestones/tasks/documents/meetings. */
  canManage: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest(email, password);
    setToken(res.access_token);
    setUser(await fetchMe());
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      isPm: user?.role === "pm",
      isDeveloper: user?.role === "developer",
      isClient: user?.role === "client",
      canManage: user?.role === "admin" || user?.role === "pm",
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
