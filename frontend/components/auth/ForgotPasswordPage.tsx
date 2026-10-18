/**
 * /forgot-password — reset a password with an emailed 6-digit code. Two steps on one
 * screen: ask for the email, then the code plus a new password. Completing it also
 * verifies the email and signs the user in (AuthProvider.completePasswordReset), after
 * which RedirectIfAuthenticated carries them on to the app.
 *
 * Google-only accounts have no password; the backend answers GOOGLE_ACCOUNT and the
 * message points them back to "Continue with Google".
 *
 * Styles: styles/auth.css (.cv-auth-*).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, KeyRound, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../services/auth';
import { apiClient } from '../../services/apiClient';
import { PASSWORD_HINT, isValidPassword } from '../../services/passwordPolicy';
import { useToast } from '../shared/Toast';
import AuthShell from './AuthShell';
import { describeAuthError } from './authErrors';
import { useCountdown } from './useCountdown';

const CODE_LENGTH = 6;

export default function ForgotPasswordPage() {
  const { completePasswordReset } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, startCountdown] = useCountdown();

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiClient.auth.requestPasswordReset(email.trim());
      startCountdown(res.resendAvailableInSeconds);
      setStep('confirm');
    } catch (err) {
      setError(describeAuthError(err, 'We could not send the code. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidPassword(newPassword)) {
      setError(`Choose a stronger password. ${PASSWORD_HINT}`);
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordReset(email.trim(), code, newPassword);
      showToast('Password updated');
    } catch (err) {
      setError(describeAuthError(err, 'We could not reset your password. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="cv-auth-heading">Reset your password</h2>
      <p className="cv-auth-sub">
        {step === 'request' ? (
          'Enter your email and we’ll send you a code.'
        ) : (
          <>
            Enter the {CODE_LENGTH}-digit code we sent to <strong>{email.trim()}</strong> and choose a new password.
          </>
        )}
      </p>

      {step === 'request' ? (
        <form onSubmit={requestCode} className="cv-auth-form">
          <div className="cv-auth-field">
            <label htmlFor="reset-email">Email</label>
            <div className="cv-auth-control">
              <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>
          {error && (
            <p className="cv-auth-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="cv-auth-submit">
            {submitting ? 'Sending…' : 'Send code'}
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleConfirm} className="cv-auth-form">
            <div className="cv-auth-field">
              <label htmlFor="reset-code">Verification code</label>
              <div className="cv-auth-control">
                <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="reset-code"
                  className="cv-auth-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={CODE_LENGTH}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                  placeholder="000000"
                />
              </div>
            </div>
            <div className="cv-auth-field">
              <label htmlFor="reset-password">New password</label>
              <div className="cv-auth-control">
                <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="reset-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-describedby="reset-password-hint"
                />
              </div>
              <p id="reset-password-hint" className="cv-auth-hint">
                {PASSWORD_HINT}
              </p>
            </div>
            {error && (
              <p className="cv-auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting || code.length !== CODE_LENGTH} className="cv-auth-submit">
              {submitting ? 'Updating…' : 'Reset password'}
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>

          <div className="cv-auth-links">
            <button type="button" onClick={() => void requestCode()} disabled={submitting || secondsLeft > 0}>
              {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setCode('');
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </>
      )}

      <p className="cv-auth-switch">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
