/**
 * JWT auth context. Login/register call apiClient.auth.* and persist the
 * returned access token via authStorage; AuthGate (components/auth/AuthGate)
 * reads isAuthenticated off this context to guard routes. profileCompleted
 * additionally gates ProfileCompletionGate — see components/auth/CompleteProfilePage —
 * and emailVerified gates EmailVerificationGate (see components/auth/VerifyEmailPage).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './apiClient';
import { EMAIL_NOT_VERIFIED_EVENT } from './authEvents';
import { clearTokens, loadTokens, saveTokens } from './authStorage';
import type { AuthSession, AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  profileCompleted: boolean | null;
  /** `null` = unknown (a session stored before email verification shipped). */
  emailVerified: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string, contactNumber: string) => Promise<void>;
  loginWithGoogle: (idToken: string, intent: 'login' | 'register') => Promise<void>;
  /** Finishes a password reset: the emailed code proves ownership, so this also signs the user in. */
  completePasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  markProfileCompleted: () => void;
  markEmailVerified: () => void;
  /** Reflects an address change made on the verify screen (apiClient.auth.changeEmail already succeeded). */
  updateEmail: (email: string) => void;
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
  return tokens ? { id: 'unknown', email: tokens.email ?? '', businessName: null } : null;
}

function hydrateProfileCompleted(): boolean | null {
  return loadTokens()?.profileCompleted ?? null;
}

function hydrateEmailVerified(): boolean | null {
  return loadTokens()?.emailVerified ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(hydrateUser);
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(hydrateProfileCompleted);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(hydrateEmailVerified);

  const applySession = useCallback((res: AuthSession) => {
    saveTokens({
      accessToken: res.accessToken,
      profileCompleted: res.profileCompleted,
      emailVerified: res.emailVerified,
      ...(res.user.email ? { email: res.user.email } : {}),
    });
    setUser(res.user);
    setProfileCompleted(res.profileCompleted);
    setEmailVerified(res.emailVerified);
  }, []);

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

  const loginWithGoogle = useCallback(async (idToken: string, intent: 'login' | 'register') => {
    const res = await apiClient.auth.google(idToken, intent);
    applySession(res);
  }, [applySession]);

  const completePasswordReset = useCallback(async (email: string, code: string, newPassword: string) => {
    const res = await apiClient.auth.confirmPasswordReset(email, code, newPassword);
    applySession(res);
  }, [applySession]);

  /**
   * Called after the "complete your profile" form (CompleteProfilePage)
   * succeeds against PATCH /api/auth/profile — flips the flag locally
   * without a full re-login, since the backend call that got us here already
   * confirmed the update.
   */
  const markProfileCompleted = useCallback(() => {
    const tokens = loadTokens();
    if (tokens) saveTokens({ ...tokens, profileCompleted: true });
    setProfileCompleted(true);
  }, []);

  /** Same idea for the verify screen: the backend already accepted the code. */
  const markEmailVerified = useCallback(() => {
    const tokens = loadTokens();
    if (tokens) saveTokens({ ...tokens, emailVerified: true });
    setEmailVerified(true);
  }, []);

  const updateEmail = useCallback((email: string) => {
    const tokens = loadTokens();
    if (tokens) saveTokens({ ...tokens, email });
    setUser((u) => (u ? { ...u, email } : u));
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setProfileCompleted(null);
    setEmailVerified(null);
  }, []);

  // apiClient dispatches this when the backend answers 403 EMAIL_NOT_VERIFIED, e.g. for a
  // session stored before verification shipped. Flip the flag so EmailVerificationGate
  // redirects to /verify-email instead of leaving the screen stuck on a failed request.
  useEffect(() => {
    const onUnverified = () => {
      const tokens = loadTokens();
      if (tokens) saveTokens({ ...tokens, emailVerified: false });
      setEmailVerified(false);
    };
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, onUnverified);
    return () => window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, onUnverified);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      profileCompleted,
      emailVerified,
      login,
      register,
      loginWithGoogle,
      completePasswordReset,
      markProfileCompleted,
      markEmailVerified,
      updateEmail,
      logout,
    }),
    [user, profileCompleted, emailVerified, login, register, loginWithGoogle, completePasswordReset,
      markProfileCompleted, markEmailVerified, updateEmail, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
