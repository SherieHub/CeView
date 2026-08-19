/**
 * Route guard sitting between AuthGate and ProfileGate: an operator whose
 * profileCompleted is false (e.g. freshly provisioned via Google sign-in —
 * see services/apiClient.ts's auth.google) is redirected to
 * /complete-profile and kept there until they submit a contact number;
 * everyone else is bounced away from /complete-profile if they land on it
 * with nothing left to complete. Modeled on ProfileGate in
 * services/profileContext.tsx.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../services/auth';

const COMPLETE_PROFILE_PATH = '/complete-profile';
const DASHBOARD_PATH = '/dashboard';

export default function ProfileCompletionGate() {
  const { profileCompleted } = useAuth();
  const { pathname } = useLocation();
  const onCompletePath = pathname.startsWith(COMPLETE_PROFILE_PATH);

  if (profileCompleted === false && !onCompletePath) {
    return <Navigate to={COMPLETE_PROFILE_PATH} replace />;
  }
  if (profileCompleted !== false && onCompletePath) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }
  return <Outlet />;
}
