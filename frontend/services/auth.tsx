/**
 * JWT auth context. Login/register call apiClient.auth.* and persist the
 * returned access token via authStorage; AuthGate (components/auth/AuthGate)
 * reads isAuthenticated off this context to guard routes.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './apiClient';
import { clearTokens, loadTokens, saveTokens } from './authStorage';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // On mount, a persisted token means "was authenticated" — the actual user
  // profile re-fetch happens once a /me endpoint exists; for now presence of
  // a token is sufficient to keep the session alive across a reload.
  useState(() => {
    const tokens = loadTokens();
    if (tokens) setUser((u) => u ?? { id: 'unknown', email: '', businessName: null });
    setHydrated(true);
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.auth.login(email, password);
    saveTokens({ accessToken: res.accessToken });
    setUser({ id: res.user.id, email: res.user.email, businessName: res.user.businessName });
  }, []);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    const res = await apiClient.auth.register(email, password, firstName, lastName);
    saveTokens({ accessToken: res.accessToken });
    setUser({ id: res.user.id, email: res.user.email, businessName: res.user.businessName });
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, login, register, logout }),
    [user, login, register, logout]
  );

  if (!hydrated) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
