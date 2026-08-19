/**
 * Frontend auth context: owns the JWT + operatorId session, backed by
 * localStorage so a page refresh doesn't force a fresh login. Login/register
 * calls reuse the same BASE/ApiError error-shape conventions as apiClient.ts's
 * req<T>() without routing through it, since a failed login/register attempt
 * (e.g. bad credentials, 401) is expected/normal and must NOT trigger the
 * "session expired, log out" handling that apiClient.ts's req<T>() applies to
 * 401s from already-authenticated requests (see setUnauthorizedHandler below).
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ApiError, setUnauthorizedHandler } from './apiClient';
import { TOKEN_KEY, OPERATOR_ID_KEY, PROFILE_COMPLETED_KEY } from './authStorage';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface AuthResponse {
  operatorId: string;
  token: string;
  profileCompleted: boolean;
}

async function authReq(path: string, body: unknown): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError({
      code: 'CLIENT_NETWORK_FAIL',
      traceId: null,
      status: 0,
      message: `Backend unreachable: ${(e as Error).message}`,
    });
  }

  const raw = await res.text();
  let parsed: any = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }

  if (!res.ok) {
    const traceHeader = res.headers.get('X-Trace-Id');
    throw new ApiError({
      code: parsed?.code ?? `HTTP_${res.status}`,
      traceId: parsed?.traceId ?? traceHeader ?? null,
      status: res.status,
      message: parsed?.message ?? parsed?.error ?? `${res.status} ${res.statusText}`,
    });
  }

  if (
    !parsed ||
    typeof parsed.token !== 'string' ||
    typeof parsed.operatorId !== 'string' ||
    typeof parsed.profileCompleted !== 'boolean'
  ) {
    throw new ApiError({
      code: 'CLIENT_BAD_RESPONSE',
      traceId: res.headers.get('X-Trace-Id'),
      status: res.status,
      message: 'Server returned an unexpected response shape.',
    });
  }

  return parsed as AuthResponse;
}

interface AuthContextValue {
  token: string | null;
  operatorId: string | null;
  isAuthenticated: boolean;
  profileCompleted: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    contactNumber?: string,
  ) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  markProfileCompleted: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [operatorId, setOperatorId] = useState<string | null>(() => localStorage.getItem(OPERATOR_ID_KEY));
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(
    () => localStorage.getItem(PROFILE_COMPLETED_KEY) === 'true',
  );

  // Hydrate is done synchronously in useState initializers above; this effect
  // is a no-op safety net in case either key is present without the other.
  useEffect(() => {
    if (!token || !operatorId) {
      setToken(null);
      setOperatorId(null);
      setProfileCompleted(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(OPERATOR_ID_KEY);
      localStorage.removeItem(PROFILE_COMPLETED_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySession = useCallback((session: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(OPERATOR_ID_KEY, session.operatorId);
    localStorage.setItem(PROFILE_COMPLETED_KEY, String(session.profileCompleted));
    setToken(session.token);
    setOperatorId(session.operatorId);
    setProfileCompleted(session.profileCompleted);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authReq('/api/v1/auth/login', { email, password });
    applySession(session);
  }, [applySession]);

  const register = useCallback(async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    contactNumber?: string,
  ) => {
    const session = await authReq('/api/v1/auth/register', {
      firstName, lastName, email, password,
      ...(contactNumber ? { contactNumber } : {}),
    });
    applySession(session);
  }, [applySession]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const session = await authReq('/api/v1/auth/google', { idToken });
    applySession(session);
  }, [applySession]);

  /**
   * Called after the "complete your profile" form (see CompleteProfilePage)
   * succeeds against PATCH /api/v1/auth/profile — flips the flag locally
   * without a full re-login, since the backend call that got us here already
   * confirmed the update.
   */
  const markProfileCompleted = useCallback(() => {
    localStorage.setItem(PROFILE_COMPLETED_KEY, 'true');
    setProfileCompleted(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OPERATOR_ID_KEY);
    localStorage.removeItem(PROFILE_COMPLETED_KEY);
    setToken(null);
    setOperatorId(null);
    setProfileCompleted(null);
  }, []);

  // Register once so apiClient.ts can trigger a logout when any authenticated
  // request comes back 401 (expired/invalid token), without depending on React.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value: AuthContextValue = {
    token,
    operatorId,
    isAuthenticated: !!token,
    profileCompleted,
    login,
    register,
    loginWithGoogle,
    markProfileCompleted,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
