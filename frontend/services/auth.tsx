/**
 * JWT auth context. Login/register call apiClient.auth.* and persist the
 * returned access token via authStorage; AuthGate (components/auth/AuthGate)
 * reads isAuthenticated off this context to guard routes. profileCompleted
 * additionally gates ProfileCompletionGate — see components/auth/CompleteProfilePage.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './apiClient';
import { clearTokens, loadTokens, saveTokens } from './authStorage';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  profileCompleted: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, contactNumber: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  markProfileCompleted: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// A persisted token means "was authenticated" — the actual user profile
// re-fetch happens once a /me endpoint exists; for now presence of a token
// is sufficient to keep the session alive across a reload. Computed once,
// synchronously, via lazy useState initializers so isAuthenticated is
// correct on the very first render — a full page load (any direct route
// visit) must not flash through "unauthenticated" for even one render, since
// AuthGate/RedirectIfAuthenticated would otherwise bounce it through /login
// and lose the originally-requested route.
function hydrateUser(): AuthUser | null {
  const tokens = loadTokens();
  return tokens ? { id: 'unknown', email: '', businessName: null } : null;
}

function hydrateProfileCompleted(): boolean | null {
  return loadTokens()?.profileCompleted ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(hydrateUser);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(hydrateProfileCompleted);

  const applySession = useCallback(
    (res: { accessToken: string; profileCompleted: boolean; user: AuthUser }) => {
      saveTokens({ accessToken: res.accessToken, profileCompleted: res.profileCompleted });
      setUser(res.user);
      setProfileCompleted(res.profileCompleted);
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.auth.login(email, password);
    applySession(res);
  }, [applySession]);

  const register = useCallback(async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    contactNumber: string,
  ) => {
    const res = await apiClient.auth.register(email, password, firstName, lastName, contactNumber);
    applySession(res);
  }, [applySession]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const res = await apiClient.auth.google(idToken);
    applySession(res);
  }, [applySession]);

  /**
   * Called after the "complete your profile" form (CompleteProfilePage)
   * succeeds against PATCH /api/v1/auth/profile — flips the flag locally
   * without a full re-login, since the backend call that got us here already
   * confirmed the update.
   */
  const markProfileCompleted = useCallback(() => {
    const tokens = loadTokens();
    if (tokens) saveTokens({ ...tokens, profileCompleted: true });
    setProfileCompleted(true);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setProfileCompleted(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: !!user, profileCompleted, login, register, loginWithGoogle, markProfileCompleted, logout }),
    [user, profileCompleted, login, register, loginWithGoogle, markProfileCompleted, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
