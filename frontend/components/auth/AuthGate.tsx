/**
 * Route guards backed by services/auth.tsx: AuthGate redirects unauthenticated
 * visitors to /login; RedirectIfAuthenticated keeps a logged-in user off the
 * public login page.
 */
import { Navigate, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../services/auth';

export default function AuthGate() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
