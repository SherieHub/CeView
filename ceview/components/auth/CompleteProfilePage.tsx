import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight } from 'lucide-react';
import { api, ApiError } from '../../services/apiClient';
import { useAuth } from '../../services/auth';
import PrimaryButton from '../shared/PrimaryButton';
import ServerErrorBanner from '../shared/ServerErrorBanner';

/**
 * One-time step for operators who don't have a contact number yet — chiefly
 * accounts provisioned via Google sign-in (see AuthController#google), which
 * only ever gets email + name from the Google profile. ProfileCompletionGate
 * routes anyone with profileCompleted === false here before they can reach
 * the rest of the app; ProfileCompletionFilter enforces the same rule
 * server-side so it can't be bypassed by calling the API directly.
 */
const CompleteProfilePage: React.FC = () => {
  const { markProfileCompleted } = useAuth();
  const navigate = useNavigate();
  const [contactNumber, setContactNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await api.completeProfile(contactNumber);
      markProfileCompleted();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const ae = err instanceof ApiError ? err : null;
      setError(ae?.message || 'Could not save your contact number. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="view-login">
      <main className="login-pane" style={{ margin: '0 auto' }}>
        <div className="login-card">
          <h2 className="h-lg">Complete your profile</h2>
          <p className="body-sm" style={{ marginTop: 5 }}>
            One last thing — add a contact number so we can reach you about your account.
          </p>

          {error && <ServerErrorBanner message={error} onDismiss={() => setError(null)} />}

          <form onSubmit={handleSubmit} noValidate>
            <label className="field">
              <span className="field-label">Contact number</span>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  type="tel"
                  required
                  autoComplete="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+63 900 000 0000"
                />
              </div>
            </label>

            <PrimaryButton type="submit" fullWidth isLoading={isLoading} icon={<ArrowRight size={16} />}>
              Continue
            </PrimaryButton>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CompleteProfilePage;
