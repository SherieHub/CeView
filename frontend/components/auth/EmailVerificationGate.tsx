/**
 * Route guard wrapping ProfileCompletionGate (inside AuthGate): an operator whose
 * email is not verified yet is sent to /verify-email and kept there until they enter
 * the emailed code. The backend enforces the same rule on every API route
 * (EmailVerificationFilter), so this only spares the user a screen of failed requests.
 *
 * Only an explicit `false` redirects. `null` means "unknown" — a session stored before
 * verification shipped — which resolves itself: the first API call answers 403
 * EMAIL_NOT_VERIFIED, AuthProvider flips the flag to `false`, and this redirects.
 *
 * /verify-email itself sits outside this gate (see App.tsx) so the redirect cannot loop.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../services/auth';

export const VERIFY_EMAIL_PATH = '/verify-email';

export default function EmailVerificationGate() {
  const { emailVerified } = useAuth();
  if (emailVerified === false) return <Navigate to={VERIFY_EMAIL_PATH} replace />;
  return <Outlet />;
}
