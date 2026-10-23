/**
 * /verify-email — the signed-in-but-unverified screen. EmailVerificationGate sends
 * every operator here until they enter the 6-digit code emailed to them; the backend
 * 403s the rest of the API until then.
 *
 * Landing here (re)sends a code once; the server's 60s resend cooldown turns a
 * double-send into a harmless "already sent". A mistyped address can be fixed from
 * this screen (PATCH /api/auth/email), which mails a fresh code to the new address.
 *
 * Styles: styles/auth.css (.cv-auth-*).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '../../services/auth';
import { apiClient } from '../../services/apiClient';
import { ApiError } from '../../services/apiError';
import { useToast } from '../shared/Toast';
import AuthShell from './AuthShell';
import { describeAuthError, retryAfterSeconds } from './authErrors';
import { useCountdown } from './useCountdown';

const CODE_LENGTH = 6;
/** The server's resend cooldown (ceview.email-code.resend-cooldown); only used after an address change. */
const DEFAULT_RESEND_SECONDS = 60;

export default function VerifyEmailPage() {
  const { user, emailVerified, markEmailVerified, updateEmail, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [sentTo, setSentTo] = useState<string>(user?.email ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [secondsLeft, startCountdown] = useCountdown();

  const sendCode = useCallback(
    async (automatic: boolean) => {
      setError(null);
      setSending(true);
      try {
        const res = await apiClient.auth.sendVerificationCode();
        setSentTo(res.sentTo);
        startCountdown(res.resendAvailableInSeconds);
        setNotice(`We sent a ${CODE_LENGTH}-digit code to ${res.sentTo}.`);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ALREADY_VERIFIED') {
          markEmailVerified();
          return;
        }
        if (err instanceof ApiError && err.code === 'RESEND_COOLDOWN') {
          startCountdown(retryAfterSeconds(err) ?? DEFAULT_RESEND_SECONDS);
          if (automatic) {
            setNotice('We already sent you a code a moment ago. Check your inbox.');
            return;
          }
        }
        setNotice(null);
        setError(describeAuthError(err, 'We could not send the code. Please try again.'));
      } finally {
        setSending(false);
      }
    },
    [markEmailVerified, startCountdown],
  );

  // Send once on arrival. The ref (not state) survives React StrictMode's dev double-mount.
  const sentOnArrival = useRef(false);
  useEffect(() => {
    // An already-verified operator is redirected below; there is nothing to send them.
    if (sentOnArrival.current || emailVerified === true) return;
    sentOnArrival.current = true;
    void sendCode(true);
  }, [sendCode, emailVerified]);

  if (emailVerified === true) return <Navigate to="/dashboard" replace />;

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      await apiClient.auth.verifyEmail(code);
      showToast('Email verified');
      markEmailVerified();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(describeAuthError(err, 'We could not verify that code. Please try again.'));
    } finally {
      setVerifying(false);
    }
  }

  async function handleChangeEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await apiClient.auth.changeEmail(newEmail.trim());
      updateEmail(res.email);
      setSentTo(res.email);
      setCode('');
      setChanging(false);
      setNewEmail('');
      startCountdown(DEFAULT_RESEND_SECONDS);
      setNotice(`We sent a ${CODE_LENGTH}-digit code to ${res.email}.`);
    } catch (err) {
      setError(describeAuthError(err, 'We could not change your email. Please try again.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="cv-auth-heading">Verify your email</h2>
      <p className="cv-auth-sub">
        {sentTo ? (
          <>
            Enter the {CODE_LENGTH}-digit code we sent to <strong>{sentTo}</strong>.
          </>
        ) : (
          <>Enter the {CODE_LENGTH}-digit code we sent to your email.</>
        )}
      </p>

      <form onSubmit={handleVerify} className="cv-auth-form">
        <div className="cv-auth-field">
          <label htmlFor="verify-code">Verification code</label>
          <div className="cv-auth-control">
            <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
            <input
              id="verify-code"
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
        {notice && !error && (
          <p className="cv-auth-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="cv-auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={verifying || code.length !== CODE_LENGTH} className="cv-auth-submit">
          {verifying ? 'Verifying…' : 'Verify email'}
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>

      <div className="cv-auth-links">
        <button type="button" onClick={() => void sendCode(false)} disabled={sending || secondsLeft > 0}>
          {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
        </button>
        <button type="button" onClick={() => setChanging((v) => !v)}>
          Wrong email? Change it
        </button>
      </div>

      {changing && (
        <form onSubmit={handleChangeEmail} className="cv-auth-form cv-auth-form--inset">
          <div className="cv-auth-field">
            <label htmlFor="verify-new-email">New email</label>
            <div className="cv-auth-control">
              <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
              <input
                id="verify-new-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>
          <button type="submit" disabled={sending} className="cv-auth-submit">
            Send code to this email
          </button>
        </form>
      )}

      <p className="cv-auth-switch">
        <button type="button" onClick={logout}>
          Sign out
        </button>
      </p>
    </AuthShell>
  );
}
