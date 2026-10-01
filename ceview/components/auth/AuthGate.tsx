import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../services/auth';

/**
 * Route guard for every authenticated app route: redirects to /login when
 * there's no session, otherwise renders the nested route tree. LoginPage
 * itself lives outside this guard, at its own top-level /login route.
 */
const AuthGate: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default AuthGate;

/**
 * Inverse guard for the /login route: if there's already a session (e.g. a
 * still-logged-in user navigates to /login directly, or double-submits),
 * bounce straight to /dashboard instead of re-rendering the login form.
 * The main fix for "successful login doesn't navigate" is the post-submit
 * navigate() in LoginPage's SignInForm/CreateAccountForm — this covers the
 * complementary "already authenticated, visits /login" case.
 */
export const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
