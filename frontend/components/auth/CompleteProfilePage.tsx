/**
 * One-time step for operators who don't have a contact number yet — chiefly
 * accounts provisioned via Google sign-in (services/firebase.ts +
 * apiClient.auth.google), which only ever gets email + name from the Google
 * profile. ProfileCompletionGate routes anyone with profileCompleted ===
 * false here before they can reach the rest of the app; the backend's
 * ProfileCompletionFilter enforces the same rule server-side so it can't be
 * bypassed by calling the API directly.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../services/auth';

export default function CompleteProfilePage() {
  const { markProfileCompleted } = useAuth();
  const navigate = useNavigate();
  const [contactNumber, setContactNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.auth.completeProfile(contactNumber);
      markProfileCompleted();
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Something went wrong saving your contact number. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-10" style={{ background: 'var(--gradient-canvas)' }}>
      <div className="card w-full max-w-sm">
        <h1 className="heading-lg mb-1">Complete your profile</h1>
        <p className="body-sm mb-6">
          One last thing — add a contact number so we can reach you about your account.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="complete-profile-contact-number">
              Contact number
            </label>
            <input
              id="complete-profile-contact-number"
              type="tel"
              required
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="input"
            />
          </div>
          {error && (
            <p className="body-xs mb-3" role="alert" style={{ color: 'var(--color-critical-text)' }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn-cta w-full">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
