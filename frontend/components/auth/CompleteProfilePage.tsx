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
    <div className="flex min-h-screen items-center justify-center p-10">
      <div className="w-full max-w-sm">
        <h1 className="heading-lg mb-1">Complete your profile</h1>
        <p className="body-sm text-navy-muted mb-6">
          One last thing — add a contact number so we can reach you about your account.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="body-xs">Contact number</span>
            <input
              type="tel"
              required
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="rounded-md border border-line px-3 py-2"
            />
          </label>
          {error && <p className="body-xs text-critical">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-gold py-2.5 font-bold text-navy disabled:opacity-60"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
